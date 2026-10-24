// Product × platform profitability (GP / CM1 / CM2 / NP) and profit drivers.
//
// Layers (docs/excel-analysis/profitability-model-summary.md, recommended view):
//   Net revenue = gross sales − discounts − refunds
//   GP  (gross profit)        = net revenue − product COGS (units × landed unit cost)
//   CM1 (after fulfilment)    = GP − platform fees − fulfilment fees − shipping
//   CM2 (after marketing)     = CM1 − ad spend − samples − other variable marketing
//   NP  (net profit)          = CM2 − allocated overhead
// Overhead is the channel's share of split shared expenses (Profitability → Expense
// splits), allocated to SKUs inside the channel by net-revenue share.
// Amazon ads sit below CM1 like every other channel's ads (so channels are comparable).

import type { SalesChannel } from "./types.ts";

export interface SkuChannelMonth {
  sku: string;
  channel: SalesChannel;
  month: string; // "2026-09"
  units: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  /** Referral / commission / payment-processing fees. */
  platformFees: number;
  /** FBA / WFS / 3PL pick-pack. */
  fulfillmentFees: number;
  /** Label / postage paid by us. */
  shippingCost: number;
  /** Ad spend attributed to the SKU on this channel. */
  adSpend: number;
  /** Free samples / creator product (cost + shipping). */
  sampleCost: number;
  /** Other variable selling cost (rep commission, distributor marketing fund…). */
  otherVariable: number;
}

export interface PnlLayers {
  units: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  netRevenue: number;
  cogs: number;
  gp: number;
  platformFees: number;
  fulfillmentFees: number;
  shippingCost: number;
  cm1: number;
  adSpend: number;
  sampleCost: number;
  otherVariable: number;
  cm2: number;
  overhead: number;
  np: number;
}

export interface PnlLine extends PnlLayers {
  key: string;
  label: string;
  sku?: string;
  channel?: SalesChannel;
  family?: string;
}

export const EMPTY_LAYERS: PnlLayers = {
  units: 0, grossSales: 0, discounts: 0, refunds: 0, netRevenue: 0, cogs: 0, gp: 0,
  platformFees: 0, fulfillmentFees: 0, shippingCost: 0, cm1: 0, adSpend: 0, sampleCost: 0,
  otherVariable: 0, cm2: 0, overhead: 0, np: 0,
};

/** Re-derives the subtotal layers from the raw lines (so sums always reconcile). */
export function finishLayers(l: PnlLayers): PnlLayers {
  const netRevenue = l.grossSales - l.discounts - l.refunds;
  const gp = netRevenue - l.cogs;
  const cm1 = gp - l.platformFees - l.fulfillmentFees - l.shippingCost;
  const cm2 = cm1 - l.adSpend - l.sampleCost - l.otherVariable;
  return { ...l, netRevenue, gp, cm1, cm2, np: cm2 - l.overhead };
}

const RAW: (keyof PnlLayers)[] = ["units", "grossSales", "discounts", "refunds", "cogs", "platformFees", "fulfillmentFees", "shippingCost", "adSpend", "sampleCost", "otherVariable", "overhead"];

export function addLayers(a: PnlLayers, b: PnlLayers): PnlLayers {
  const out = { ...a };
  for (const k of RAW) out[k] = a[k] + b[k];
  return finishLayers(out);
}

export function sumLayers(items: PnlLayers[]): PnlLayers {
  return items.reduce((acc, x) => addLayers(acc, x), { ...EMPTY_LAYERS });
}

export interface ProductPnlInput {
  rows: SkuChannelMonth[];
  months: string[];
  unitCost: (sku: string) => number;
  /** Overhead per channel for the whole period (e.g. allocated shared expenses). */
  channelOverhead: Partial<Record<SalesChannel, number>>;
  family: (sku: string) => string;
  label: (sku: string) => string;
}

export interface ProductPnl {
  lines: PnlLine[]; // SKU × channel
  bySku: PnlLine[];
  byChannel: PnlLine[];
  byFamily: PnlLine[];
  total: PnlLayers;
}

export function buildProductPnl(i: ProductPnlInput): ProductPnl {
  const rows = i.rows.filter((r) => i.months.includes(r.month));
  // SKU × channel, before overhead
  const map = new Map<string, PnlLine>();
  for (const r of rows) {
    const key = `${r.sku}|${r.channel}`;
    const prev = map.get(key) ?? { ...EMPTY_LAYERS, key, label: `${i.label(r.sku)} · ${r.channel}`, sku: r.sku, channel: r.channel, family: i.family(r.sku) };
    const add: PnlLayers = finishLayers({
      ...EMPTY_LAYERS,
      units: r.units,
      grossSales: r.grossSales,
      discounts: r.discounts,
      refunds: r.refunds,
      cogs: r.units * i.unitCost(r.sku),
      platformFees: r.platformFees,
      fulfillmentFees: r.fulfillmentFees,
      shippingCost: r.shippingCost,
      adSpend: r.adSpend,
      sampleCost: r.sampleCost,
      otherVariable: r.otherVariable,
    });
    map.set(key, { ...prev, ...addLayers(prev, add) });
  }
  const lines = [...map.values()];
  // Allocate channel overhead by net-revenue share within the channel
  const channelNet = new Map<SalesChannel, number>();
  for (const l of lines) if (l.channel) channelNet.set(l.channel, (channelNet.get(l.channel) ?? 0) + Math.max(0, l.netRevenue));
  for (const l of lines) {
    if (!l.channel) continue;
    const pool = i.channelOverhead[l.channel] ?? 0;
    const base = channelNet.get(l.channel) ?? 0;
    l.overhead = base > 0 ? (pool * Math.max(0, l.netRevenue)) / base : 0;
    Object.assign(l, finishLayers(l));
  }
  const group = (keyOf: (l: PnlLine) => string, labelOf: (k: string, l: PnlLine) => Partial<PnlLine>): PnlLine[] => {
    const g = new Map<string, PnlLine[]>();
    for (const l of lines) g.set(keyOf(l), [...(g.get(keyOf(l)) ?? []), l]);
    return [...g.entries()]
      .map(([k, ls]) => ({ key: k, label: k, ...labelOf(k, ls[0]!), ...sumLayers(ls) }))
      .sort((a, b) => b.netRevenue - a.netRevenue);
  };
  return {
    lines: lines.sort((a, b) => b.netRevenue - a.netRevenue),
    bySku: group((l) => l.sku ?? "", (k, l) => ({ sku: k, label: i.label(k), family: l.family ?? "" })),
    byChannel: group((l) => l.channel ?? "", (k) => ({ channel: k as SalesChannel, label: k })),
    byFamily: group((l) => l.family ?? "", (k) => ({ family: k, label: k })),
    total: sumLayers(lines),
  };
}

export function margin(value: number, l: PnlLayers): number {
  return l.netRevenue !== 0 ? value / l.netRevenue : 0;
}

/** Net revenue ÷ CM1: the ROAS at which ads exactly use up the contribution before marketing. */
export function breakevenRoas(l: PnlLayers): number | null {
  return l.cm1 > 0 ? l.netRevenue / l.cm1 : null;
}

/** Net revenue ÷ ad spend (all channel revenue attributed to ads — an upper bound). */
export function actualRoas(l: PnlLayers): number | null {
  return l.adSpend > 0 ? l.netRevenue / l.adSpend : null;
}

// ---------------------------------------------------------------- drivers

export type CostLine = "cogs" | "platformFees" | "fulfillmentFees" | "shippingCost" | "adSpend" | "sampleCost" | "refunds" | "discounts" | "otherVariable";

export const COST_LINES: { key: CostLine; label: string }[] = [
  { key: "cogs", label: "Product cost (COGS)" },
  { key: "platformFees", label: "Platform fees" },
  { key: "fulfillmentFees", label: "Fulfilment fees" },
  { key: "shippingCost", label: "Shipping" },
  { key: "adSpend", label: "Ad spend" },
  { key: "sampleCost", label: "Samples" },
  { key: "refunds", label: "Refunds" },
  { key: "discounts", label: "Discounts" },
  { key: "otherVariable", label: "Commission / fund" },
];

/**
 * Target % of net revenue per channel and cost line. Where no target is set the
 * company average for that cost line is used. Sample targets — to be agreed with the CEO.
 */
export const DEFAULT_BENCHMARKS: Partial<Record<SalesChannel, Partial<Record<CostLine, number>>>> = {
  Amazon: { platformFees: 0.16, fulfillmentFees: 0.22, adSpend: 0.1, refunds: 0.03 },
  Shopify: { platformFees: 0.035, shippingCost: 0.15, adSpend: 0.18, discounts: 0.08 },
  "TikTok Shop": { platformFees: 0.08, shippingCost: 0.15, adSpend: 0.15, sampleCost: 0.025, refunds: 0.04, discounts: 0.06 },
  Walmart: { platformFees: 0.16, fulfillmentFees: 0.22, refunds: 0.035 },
  "Salon Direct": { otherVariable: 0.08, shippingCost: 0.12 },
  Distributor: { otherVariable: 0.04, shippingCost: 0.06 },
};

const SUGGEST: Record<CostLine, string> = {
  cogs: "Renegotiate the fill / purchase price, or raise the selling price.",
  platformFees: "Check the referral category and size tier; raise the price or sell as a bundle so fees are spread over more value.",
  fulfillmentFees: "Review the FBA/WFS size tier and storage; move slow movers out of FBA; bundle low-price items.",
  shippingCost: "Renegotiate carrier rates or use the platform's own shipping programme; raise the free-shipping threshold; ship bundles instead of single units.",
  adSpend: "Cut campaigns running below breakeven ROAS and move budget to SKUs with margin room.",
  sampleCost: "Cap creator samples and require a minimum GMV per sample sent.",
  refunds: "Investigate return reasons (damage, listing accuracy) and fix the top cause.",
  discounts: "Reduce discount depth or limit promotions to bundles.",
  otherVariable: "Review commission / marketing-fund rates against the sales they generate.",
};

export interface Leak {
  id: string;
  scope: "channel" | "sku";
  channel: SalesChannel;
  sku?: string;
  costLine: CostLine;
  label: string;
  perUnit: number;
  pctOfNet: number;
  benchmarkPct: number;
  benchmarkSource: "target" | "company average";
  /** Change in percentage points vs the previous period (null when no previous data). */
  changePts: number | null;
  /** Cost above benchmark, per month. */
  monthlyImpact: number;
  headline: string;
  suggestion: string;
}

function pctOf(l: PnlLayers, k: CostLine) {
  return l.netRevenue > 0 ? l[k] / l.netRevenue : 0;
}

export function profitDrivers(
  current: ProductPnl,
  monthCount: number,
  previous: ProductPnl | null,
  benchmarks = DEFAULT_BENCHMARKS,
  skuLabel: (sku: string) => string = (s) => s,
): Leak[] {
  const months = Math.max(1, monthCount);
  const company = current.total;
  const leaks: Leak[] = [];
  const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  const usd2 = (n: number) => `$${n.toFixed(2)}`;
  const p = (n: number) => `${(n * 100).toFixed(1)}%`;

  for (const ch of current.byChannel) {
    if (!ch.channel || ch.netRevenue <= 0) continue;
    const prev = previous?.byChannel.find((x) => x.channel === ch.channel) ?? null;
    for (const { key, label } of COST_LINES) {
      if (ch[key] <= 0) continue;
      const target = benchmarks[ch.channel]?.[key];
      // Product cost differs by price level (trade vs retail), so it is only flagged against an explicit target.
      if (key === "cogs" && target === undefined) continue;
      const bench = target ?? pctOf(company, key);
      const pctNow = pctOf(ch, key);
      const excess = (pctNow - bench) * ch.netRevenue;
      if (excess <= 0) continue;
      leaks.push({
        id: `ch-${ch.channel}-${key}`,
        scope: "channel",
        channel: ch.channel,
        costLine: key,
        label,
        perUnit: ch.units > 0 ? ch[key] / ch.units : 0,
        pctOfNet: pctNow,
        benchmarkPct: bench,
        benchmarkSource: target === undefined ? "company average" : "target",
        changePts: prev && prev.netRevenue > 0 ? (pctNow - pctOf(prev, key)) * 100 : null,
        monthlyImpact: excess / months,
        headline: `${ch.channel} ${label.toLowerCase()}: ${usd2(ch.units > 0 ? ch[key] / ch.units : 0)}/unit = ${p(pctNow)} of net revenue vs ${p(bench)} ${target === undefined ? "company average" : "target"}`,
        suggestion: SUGGEST[key],
      });
    }
  }

  // SKU × channel lines that lose money after marketing
  for (const l of current.lines) {
    if (!l.channel || !l.sku || l.netRevenue <= 0 || l.cm2 >= 0) continue;
    const be = breakevenRoas(l);
    const roas = actualRoas(l);
    const adsProblem = be !== null && roas !== null && roas < be;
    const biggest = COST_LINES.filter((c) => c.key !== "cogs").sort((a, b) => l[b.key] - l[a.key])[0]!;
    leaks.push({
      id: `sku-${l.sku}-${l.channel}`,
      scope: "sku",
      channel: l.channel,
      sku: l.sku,
      costLine: adsProblem ? "adSpend" : biggest.key,
      label: adsProblem ? "Ad spend" : biggest.label,
      perUnit: l.units > 0 ? l.cm2 / l.units : 0,
      pctOfNet: margin(l.cm2, l),
      benchmarkPct: 0,
      benchmarkSource: "target",
      changePts: null,
      monthlyImpact: -l.cm2 / months,
      headline: `${skuLabel(l.sku)} on ${l.channel} loses ${usd(-l.cm2 / months)}/month after marketing (CM2 ${p(margin(l.cm2, l))})${
        adsProblem && be !== null && roas !== null ? ` — ROAS ${roas.toFixed(2)} vs breakeven ${be.toFixed(2)}` : ""
      }`,
      suggestion: adsProblem
        ? `Cut ${l.channel} ads on this SKU to below ${usd(Math.max(0, l.cm1) / months)}/month, or raise the price.`
        : `Raise the price, sell as a bundle, or stop pushing this SKU on ${l.channel}. ${SUGGEST[biggest.key]}`,
    });
  }

  return leaks.sort((a, b) => b.monthlyImpact - a.monthlyImpact);
}
