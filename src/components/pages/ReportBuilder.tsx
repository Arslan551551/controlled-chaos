// CEO custom report builder: pick a dataset, group rows (and optionally pivot a
// column), choose measures, filter, sort, top-N, export, save. Ready-made
// "CEO asks" presets are just saved builder configurations.

import { useMemo, useState, type ReactNode } from "react";

import { Assume, HBar, Section } from "@/components/cc/ui";
import { usePayments, useWeeklyCash } from "@/lib/derived";
import { openUsd, bucketOf, daysOverdue } from "@/lib/engine/ar";
import { analyzeCampaign } from "@/lib/engine/campaigns";
import { tentativePOTotal } from "@/lib/engine/cogs";
import { addMonths, formatDate, monthKey, monthLabel } from "@/lib/engine/dates";
import { invoicePaid } from "@/lib/engine/distributors";
import { profitability } from "@/lib/engine/finance";
import { monthlyCost } from "@/lib/engine/operations";
import { finishLayers, EMPTY_LAYERS } from "@/lib/engine/productProfit";
import { int, pct, usd } from "@/lib/format";
import { productFamilies } from "@/lib/sample/productpnl";
import { useCosting, useStore } from "@/lib/store";

// ---------------------------------------------------------------- types

type Fmt = "usd" | "int" | "pct" | "ratio";
type Row = Record<string, string | number>;

interface Measure {
  key: string;
  label: string;
  fmt: Fmt;
  /** How the raw value combines across rows. Ignored when `derive` is set. */
  agg?: "sum" | "first" | "last";
  /** Ratio-of-sums style measure computed from the summed raw values. */
  derive?: (get: (k: string) => number) => number;
}

interface Dimension {
  key: string;
  label: string;
  kind?: "month" | "week";
}

interface Dataset {
  id: string;
  label: string;
  description: string;
  rows: Row[];
  dimensions: Dimension[];
  measures: Measure[];
  /** Dimension used by the period picker. */
  periodKey: string | null;
  /** Dimensions offered as filters. */
  filterKeys: string[];
  note?: ReactNode;
}

export interface ReportConfig {
  datasetId: string;
  rowsBy: string[];
  columnBy: string | null;
  measures: string[];
  periods: string[];
  filters: Record<string, string[]>;
  sortBy: string | null;
  sortDir: "desc" | "asc";
  topN: number | null;
}

interface SavedReport {
  id: string;
  title: string;
  description: string;
  config: ReportConfig;
}

const div = (a: number, b: number) => (b !== 0 ? a / b : 0);

// ---------------------------------------------------------------- datasets

const PNL_MEASURES: Measure[] = [
  { key: "units", label: "Units", fmt: "int" },
  { key: "grossSales", label: "Gross sales", fmt: "usd" },
  { key: "discounts", label: "Discounts", fmt: "usd" },
  { key: "refunds", label: "Refunds", fmt: "usd" },
  { key: "netRevenue", label: "Net revenue", fmt: "usd" },
  { key: "cogs", label: "COGS", fmt: "usd" },
  { key: "gp", label: "GP", fmt: "usd" },
  { key: "gpPct", label: "GP %", fmt: "pct", derive: (g) => div(g("gp"), g("netRevenue")) },
  { key: "platformFees", label: "Platform fees", fmt: "usd" },
  { key: "fulfillmentFees", label: "Fulfilment", fmt: "usd" },
  { key: "shippingCost", label: "Shipping", fmt: "usd" },
  { key: "cm1", label: "CM1 (after fees & shipping)", fmt: "usd" },
  { key: "cm1Pct", label: "CM1 %", fmt: "pct", derive: (g) => div(g("cm1"), g("netRevenue")) },
  { key: "adSpend", label: "Ad spend", fmt: "usd" },
  { key: "sampleCost", label: "Samples", fmt: "usd" },
  { key: "cm2", label: "CM2 (after marketing)", fmt: "usd" },
  { key: "cm2Pct", label: "CM2 %", fmt: "pct", derive: (g) => div(g("cm2"), g("netRevenue")) },
  { key: "overhead", label: "Allocated overhead", fmt: "usd" },
  { key: "np", label: "NP", fmt: "usd" },
  { key: "npPct", label: "NP %", fmt: "pct", derive: (g) => div(g("np"), g("netRevenue")) },
  { key: "npPerUnit", label: "NP / unit", fmt: "usd", derive: (g) => div(g("np"), g("units")) },
  { key: "shipPerUnit", label: "Shipping / unit", fmt: "usd", derive: (g) => div(g("shippingCost"), g("units")) },
  { key: "feePct", label: "Platform fees %", fmt: "pct", derive: (g) => div(g("platformFees"), g("netRevenue")) },
  { key: "roas", label: "ROAS (net rev ÷ ads)", fmt: "ratio", derive: (g) => div(g("netRevenue"), g("adSpend")) },
];

const NEW_SKU = "New (first PO in last 6 months)";
const EXISTING_SKU = "Existing";

function useDatasets(): Dataset[] {
  const { data, asOf } = useStore();
  const { unitCost } = useCosting();
  const payments = usePayments();
  const weeks = useWeeklyCash(8);

  return useMemo<Dataset[]>(() => {
    const desc = (sku: string) => data.skus.find((s) => s.sku === sku)?.description ?? sku;
    const fam = (sku: string) => productFamilies[sku] ?? "Other";

    // --- Product × channel P&L (GP / CM / NP), overhead per channel-month allocated by net revenue share
    const pnlRows: Row[] = [];
    const months = [...new Set(data.skuChannelMonth.map((r) => r.month))].sort();
    for (const m of months) {
      const overhead = new Map(profitability(data.channelSales, data.channelCosts, data.expenses, [m]).rows.map((r) => [r.channel, r.allocatedExpenses]));
      const inMonth = data.skuChannelMonth.filter((r) => r.month === m);
      const layered = inMonth.map((r) => ({
        r,
        l: finishLayers({
          ...EMPTY_LAYERS,
          units: r.units,
          grossSales: r.grossSales,
          discounts: r.discounts,
          refunds: r.refunds,
          cogs: r.units * unitCost(r.sku),
          platformFees: r.platformFees,
          fulfillmentFees: r.fulfillmentFees,
          shippingCost: r.shippingCost,
          adSpend: r.adSpend,
          sampleCost: r.sampleCost,
          otherVariable: r.otherVariable,
        }),
      }));
      const channelNet = new Map<string, number>();
      for (const x of layered) channelNet.set(x.r.channel, (channelNet.get(x.r.channel) ?? 0) + Math.max(0, x.l.netRevenue));
      for (const { r, l } of layered) {
        const pool = overhead.get(r.channel) ?? 0;
        const base = channelNet.get(r.channel) ?? 0;
        const full = finishLayers({ ...l, overhead: base > 0 ? (pool * Math.max(0, l.netRevenue)) / base : 0 });
        pnlRows.push({
          sku: r.sku,
          product: desc(r.sku),
          family: fam(r.sku),
          channel: r.channel,
          month: r.month,
          units: full.units,
          grossSales: full.grossSales,
          discounts: full.discounts,
          refunds: full.refunds,
          netRevenue: full.netRevenue,
          cogs: full.cogs,
          gp: full.gp,
          platformFees: full.platformFees,
          fulfillmentFees: full.fulfillmentFees,
          shippingCost: full.shippingCost,
          cm1: full.cm1,
          adSpend: full.adSpend,
          sampleCost: full.sampleCost,
          otherVariable: full.otherVariable,
          cm2: full.cm2,
          overhead: full.overhead,
          np: full.np,
        });
      }
    }

    // --- Sales vs cash
    const scRows: Row[] = data.channelSales.map((s) => {
      const received = data.cashReceipts.filter((r) => r.channel === s.channel && r.settlesMonth === s.month).reduce((a, r) => a + r.amount, 0);
      return { channel: s.channel, month: s.month, grossSales: s.grossSales, refunds: s.refunds, platformFees: s.platformFees, expectedNet: s.expectedNet, received, outstanding: s.expectedNet - received };
    });

    // --- Marketing by platform
    const mktRows: Row[] = data.adMetrics.map((a) => ({ platform: a.platform, channel: a.channel, month: a.month, spend: a.spend, impressions: a.impressions, clicks: a.clicks, orders: a.orders, adSales: a.adSales }));

    // --- Campaigns
    const campRows: Row[] = data.campaigns.map((c) => {
      const a = analyzeCampaign(c, unitCost);
      return {
        campaign: c.name,
        channel: c.channel,
        type: c.type,
        status: c.status,
        verdict: a.verdict,
        owner: c.owner,
        month: monthKey(c.startDate),
        totalCost: a.totalCost,
        discountCost: c.costs.discountCost,
        adSpend: c.costs.adSpend,
        netSales: c.results.netSales,
        incrementalSales: a.incrementalSales,
        incrementalProfit: a.incrementalProfit,
        orders: c.results.orders,
        newCustomers: c.results.newCustomers,
      };
    });

    // --- Conversion (traffic sources)
    const convRows: Row[] = data.trafficSources.map((t) => ({
      channel: t.channel,
      source: t.source,
      month: t.month,
      sessions: t.sessions,
      addToCart: t.addToCart,
      orders: t.orders,
      newCustomers: t.newCustomers,
      returningCustomers: t.returningCustomers,
      revenue: t.revenue,
      adSpend: t.adSpend,
    }));

    // --- Purchases / spend on products. New SKU = first PO opened within the last 6 months.
    const sixMonthsAgo = addMonths(asOf, -6);
    const firstPo = new Map<string, string>();
    for (const p of data.purchaseOrders) {
      const prev = firstPo.get(p.sku);
      if (!prev || p.openDate < prev) firstPo.set(p.sku, p.openDate);
    }
    const ageOf = (sku: string) => ((firstPo.get(sku) ?? "0000") >= sixMonthsAgo ? NEW_SKU : EXISTING_SKU);
    const purchaseRows: Row[] = [
      ...data.purchaseOrders
        .filter((p) => p.status !== "Cancelled")
        .map((p) => {
          const committed = tentativePOTotal(p);
          const paid = p.installments.filter((i) => i.paid).reduce((a, i) => a + i.amount, 0);
          return {
            sku: p.sku,
            product: desc(p.sku),
            family: fam(p.sku),
            vendor: p.supplier,
            spendType: `${p.type} PO`,
            skuAge: ageOf(p.sku),
            firstPo: firstPo.get(p.sku) ?? "",
            month: monthKey(p.openDate),
            committed,
            paid,
            unpaid: committed - paid,
            marketing: 0,
            units: p.orderedQty,
          };
        }),
      ...data.skuChannelMonth
        .filter((r) => r.adSpend + r.sampleCost > 0)
        .map((r) => ({
          sku: r.sku,
          product: desc(r.sku),
          family: fam(r.sku),
          vendor: `${r.channel} marketing`,
          spendType: "Marketing (ads + samples)",
          skuAge: ageOf(r.sku),
          firstPo: firstPo.get(r.sku) ?? "",
          month: r.month,
          committed: 0,
          paid: 0,
          unpaid: 0,
          marketing: r.adSpend + r.sampleCost,
          units: 0,
        })),
    ];

    // --- Payments plan (individual payments)
    const payRows: Row[] = payments.all
      .filter((p) => p.status !== "Paid")
      .map((p) => ({
        vendor: p.vendor,
        category: p.category,
        source: p.source,
        status: p.status,
        month: p.dueDate ? monthKey(p.dueDate) : "TBD",
        reference: p.reference,
        amount: p.amount,
        count: 1,
      }));

    // --- Weekly cash schedule
    const weekRows: Row[] = weeks.map((w) => {
      const o = (c: string) => w.outByCategory[c] ?? 0;
      return {
        week: w.weekStart,
        opening: w.opening,
        poPayments: o("PO Payment"),
        nonPo: o("Non-PO Payment"),
        payroll: o("Payroll"),
        subscriptions: o("Subscription"),
        otherOut: w.paymentsOut - o("PO Payment") - o("Non-PO Payment") - o("Payroll") - o("Subscription"),
        paymentsOut: w.paymentsOut,
        receiptsIn: w.receiptsIn,
        closing: w.closing,
      };
    });

    // --- AR (customers incl. distributors), USD
    const arRows: Row[] = [
      ...data.arInvoices.map((i) => ({ customer: i.customerName, type: i.customerType, owner: i.ownerName, bucket: bucketOf(i, asOf), open: openUsd(i), overdue: daysOverdue(i, asOf) > 0 ? openUsd(i) : 0, invoices: 1 })),
      ...data.distributorInvoices.map((inv) => {
        const d = data.distributors.find((x) => x.id === inv.distributorId);
        const fx = d?.fxToUsd ?? 1;
        const open = Math.max(0, inv.amount - invoicePaid(inv)) * fx;
        const late = Math.round((Date.parse(asOf) - Date.parse(inv.dueDate)) / 86_400_000);
        const bucket = late <= 0 ? "Current" : late <= 30 ? "1–30" : late <= 60 ? "31–60" : late <= 90 ? "61–90" : "90+";
        return { customer: d?.name ?? inv.distributorId, type: "Distributor", owner: "Director Finance", bucket, open, overdue: late > 0 ? open : 0, invoices: 1 };
      }),
    ].filter((r) => (r.open as number) > 0.005);

    // --- Subscriptions
    const subRows: Row[] = data.subscriptions.map((s) => ({
      tool: s.tool,
      department: s.department,
      category: s.category,
      cycle: s.billingCycle,
      status: s.status,
      owner: s.owner,
      monthlyCost: monthlyCost(s),
      annualCost: monthlyCost(s) * 12,
      seats: s.seats,
      seatsUsed: s.seatsUsed,
    }));

    const channelDim: Dimension = { key: "channel", label: "Channel" };
    const monthDim: Dimension = { key: "month", label: "Month", kind: "month" };

    return [
      {
        id: "pnl",
        label: "Product × channel P&L (GP / CM / NP)",
        description: "Every SKU on every platform with all profit layers",
        rows: pnlRows,
        dimensions: [{ key: "sku", label: "SKU" }, { key: "product", label: "Product" }, { key: "family", label: "Product family" }, channelDim, monthDim],
        measures: PNL_MEASURES,
        periodKey: "month",
        filterKeys: ["channel", "family", "sku"],
        note: (
          <>
            NP = CM2 − the channel's split shared expenses, allocated to SKUs by net revenue. <Assume title="Ad spend is attributed to SKUs by revenue share; overhead by net revenue within each channel and month.">ad & overhead allocation</Assume>
          </>
        ),
      },
      {
        id: "sales-cash",
        label: "Sales vs cash received",
        description: "Expected payouts vs cash that landed in the bank (QuickBooks)",
        rows: scRows,
        dimensions: [channelDim, monthDim],
        measures: [
          { key: "grossSales", label: "Gross sales", fmt: "usd" },
          { key: "refunds", label: "Refunds", fmt: "usd" },
          { key: "platformFees", label: "Fees withheld", fmt: "usd" },
          { key: "expectedNet", label: "Expected net", fmt: "usd" },
          { key: "received", label: "Cash received", fmt: "usd" },
          { key: "outstanding", label: "Outstanding", fmt: "usd" },
          { key: "collectedPct", label: "% collected", fmt: "pct", derive: (g) => div(g("received"), g("expectedNet")) },
        ],
        periodKey: "month",
        filterKeys: ["channel"],
      },
      {
        id: "marketing",
        label: "Marketing by ad platform",
        description: "Spend, ad sales, ROAS, ACoS, CTR, CPC, CVR",
        rows: mktRows,
        dimensions: [{ key: "platform", label: "Platform" }, channelDim, monthDim],
        measures: [
          { key: "spend", label: "Ad spend", fmt: "usd" },
          { key: "adSales", label: "Ad sales", fmt: "usd" },
          { key: "roas", label: "ROAS", fmt: "ratio", derive: (g) => div(g("adSales"), g("spend")) },
          { key: "acos", label: "ACoS", fmt: "pct", derive: (g) => div(g("spend"), g("adSales")) },
          { key: "impressions", label: "Impressions", fmt: "int" },
          { key: "clicks", label: "Clicks", fmt: "int" },
          { key: "ctr", label: "CTR", fmt: "pct", derive: (g) => div(g("clicks"), g("impressions")) },
          { key: "cpc", label: "CPC", fmt: "usd", derive: (g) => div(g("spend"), g("clicks")) },
          { key: "orders", label: "Orders", fmt: "int" },
          { key: "cvr", label: "CVR", fmt: "pct", derive: (g) => div(g("orders"), g("clicks")) },
          { key: "cpa", label: "Cost per order", fmt: "usd", derive: (g) => div(g("spend"), g("orders")) },
        ],
        periodKey: "month",
        filterKeys: ["platform", "channel"],
      },
      {
        id: "campaigns",
        label: "Campaigns",
        description: "Cost (incl. discounts) vs incremental sales and profit",
        rows: campRows,
        dimensions: [{ key: "campaign", label: "Campaign" }, channelDim, { key: "type", label: "Type" }, { key: "verdict", label: "Verdict" }, { key: "status", label: "Status" }, { key: "owner", label: "Owner" }, monthDim],
        measures: [
          { key: "totalCost", label: "Total cost", fmt: "usd" },
          { key: "discountCost", label: "Discounts given", fmt: "usd" },
          { key: "adSpend", label: "Ad spend", fmt: "usd" },
          { key: "netSales", label: "Net sales", fmt: "usd" },
          { key: "incrementalSales", label: "Incremental sales", fmt: "usd" },
          { key: "incrementalProfit", label: "Incremental profit", fmt: "usd" },
          { key: "roi", label: "ROI", fmt: "pct", derive: (g) => div(g("incrementalProfit"), g("totalCost")) },
          { key: "mer", label: "MER", fmt: "ratio", derive: (g) => div(g("netSales"), g("totalCost")) },
          { key: "orders", label: "Orders", fmt: "int" },
          { key: "newCustomers", label: "New customers", fmt: "int" },
          { key: "cac", label: "Cost per new customer", fmt: "usd", derive: (g) => div(g("totalCost"), g("newCustomers")) },
        ],
        periodKey: "month",
        filterKeys: ["channel", "type", "verdict", "status"],
      },
      {
        id: "conversion",
        label: "Marketing conversion",
        description: "Sessions → add to cart → orders, AOV, new customers, CAC",
        rows: convRows,
        dimensions: [channelDim, { key: "source", label: "Traffic source" }, monthDim],
        measures: [
          { key: "sessions", label: "Sessions", fmt: "int" },
          { key: "addToCart", label: "Add to cart", fmt: "int" },
          { key: "orders", label: "Orders", fmt: "int" },
          { key: "cvr", label: "Conversion rate", fmt: "pct", derive: (g) => div(g("orders"), g("sessions")) },
          { key: "atcRate", label: "Add-to-cart rate", fmt: "pct", derive: (g) => div(g("addToCart"), g("sessions")) },
          { key: "revenue", label: "Revenue", fmt: "usd" },
          { key: "aov", label: "AOV", fmt: "usd", derive: (g) => div(g("revenue"), g("orders")) },
          { key: "newCustomers", label: "New customers", fmt: "int" },
          { key: "returningCustomers", label: "Returning customers", fmt: "int" },
          { key: "newShare", label: "New customer share", fmt: "pct", derive: (g) => div(g("newCustomers"), g("newCustomers") + g("returningCustomers")) },
          { key: "adSpend", label: "Ad spend", fmt: "usd" },
          { key: "cac", label: "CAC", fmt: "usd", derive: (g) => div(g("adSpend"), g("newCustomers")) },
          { key: "roas", label: "ROAS", fmt: "ratio", derive: (g) => div(g("revenue"), g("adSpend")) },
        ],
        periodKey: "month",
        filterKeys: ["channel", "source"],
      },
      {
        id: "purchases",
        label: "Spend on products (POs + marketing)",
        description: "PO commitments, paid installments and product marketing by SKU",
        rows: purchaseRows,
        dimensions: [{ key: "sku", label: "SKU" }, { key: "product", label: "Product" }, { key: "family", label: "Product family" }, { key: "vendor", label: "Vendor / channel" }, { key: "spendType", label: "Spend type" }, { key: "skuAge", label: "New vs existing SKU" }, monthDim],
        measures: [
          { key: "committed", label: "PO committed", fmt: "usd" },
          { key: "paid", label: "PO paid", fmt: "usd" },
          { key: "unpaid", label: "PO still to pay", fmt: "usd" },
          { key: "marketing", label: "Marketing (ads + samples)", fmt: "usd" },
          { key: "totalSpend", label: "Total spend", fmt: "usd", derive: (g) => g("committed") + g("marketing") },
          { key: "units", label: "Units ordered", fmt: "int" },
        ],
        periodKey: "month",
        filterKeys: ["skuAge", "spendType", "family", "vendor"],
        note: (
          <>
            <Assume title="A SKU counts as new when its first purchase order was opened within the last 6 months (from today). Live data will also check the first sale date.">New SKU = first PO opened in the last 6 months</Assume> PO spend is shown in the month the PO was opened.
          </>
        ),
      },
      {
        id: "payments",
        label: "Payments to make",
        description: "Unpaid PO installments, Non-PO payments and payroll",
        rows: payRows,
        dimensions: [{ key: "vendor", label: "Vendor" }, { key: "category", label: "Category" }, { key: "source", label: "Source" }, { key: "status", label: "Status" }, { key: "month", label: "Due month" }],
        measures: [
          { key: "amount", label: "Amount", fmt: "usd" },
          { key: "count", label: "Payments", fmt: "int" },
        ],
        periodKey: "month",
        filterKeys: ["category", "source", "status", "vendor"],
      },
      {
        id: "weekly-cash",
        label: "Weekly cash schedule",
        description: "What to pay each week, receipts, and cash left in the bank",
        rows: weekRows,
        dimensions: [{ key: "week", label: "Week from", kind: "week" }],
        measures: [
          { key: "opening", label: "Cash at start", fmt: "usd", agg: "first" },
          { key: "poPayments", label: "PO payments", fmt: "usd" },
          { key: "nonPo", label: "Non-PO", fmt: "usd" },
          { key: "payroll", label: "Payroll", fmt: "usd" },
          { key: "subscriptions", label: "Subscriptions", fmt: "usd" },
          { key: "otherOut", label: "Other out (loans, tax)", fmt: "usd" },
          { key: "paymentsOut", label: "Total to pay", fmt: "usd" },
          { key: "receiptsIn", label: "Receipts in", fmt: "usd" },
          { key: "closing", label: "Cash left", fmt: "usd", agg: "last" },
        ],
        periodKey: "week",
        filterKeys: [],
        note: "Opening balance from QuickBooks bank accounts; payments from the Payment Planner; receipts from payout forecasts and QuickBooks AR.",
      },
      {
        id: "ar",
        label: "Accounts receivable",
        description: "What customers owe, by aging bucket and owner (USD)",
        rows: arRows,
        dimensions: [{ key: "customer", label: "Customer" }, { key: "type", label: "Customer type" }, { key: "owner", label: "Account owner" }, { key: "bucket", label: "Aging" }],
        measures: [
          { key: "open", label: "Open (USD)", fmt: "usd" },
          { key: "overdue", label: "Overdue (USD)", fmt: "usd" },
          { key: "overduePct", label: "% overdue", fmt: "pct", derive: (g) => div(g("overdue"), g("open")) },
          { key: "invoices", label: "Invoices", fmt: "int" },
        ],
        periodKey: null,
        filterKeys: ["type", "owner", "bucket"],
      },
      {
        id: "subscriptions",
        label: "Tools & subscriptions",
        description: "Cost and seat use by department and tool",
        rows: subRows,
        dimensions: [{ key: "department", label: "Department" }, { key: "tool", label: "Tool" }, { key: "category", label: "Category" }, { key: "owner", label: "Owner" }, { key: "status", label: "Status" }, { key: "cycle", label: "Billing cycle" }],
        measures: [
          { key: "monthlyCost", label: "Monthly cost", fmt: "usd" },
          { key: "annualCost", label: "Annual cost", fmt: "usd" },
          { key: "seats", label: "Seats", fmt: "int" },
          { key: "seatsUsed", label: "Seats used", fmt: "int" },
          { key: "seatUse", label: "Seat use", fmt: "pct", derive: (g) => div(g("seatsUsed"), g("seats")) },
        ],
        periodKey: null,
        filterKeys: ["department", "category", "status"],
      },
    ];
  }, [data, asOf, unitCost, payments.all, weeks]);
}

// ---------------------------------------------------------------- aggregation

interface Acc {
  sums: Record<string, number>;
  first: Record<string, number>;
  last: Record<string, number>;
}

function newAcc(): Acc {
  return { sums: {}, first: {}, last: {} };
}

function addToAcc(acc: Acc, row: Row, rawKeys: string[]) {
  for (const k of rawKeys) {
    const v = row[k];
    if (typeof v !== "number") continue;
    acc.sums[k] = (acc.sums[k] ?? 0) + v;
    if (!(k in acc.first)) acc.first[k] = v;
    acc.last[k] = v;
  }
}

function valueOf(acc: Acc | undefined, m: Measure): number | null {
  if (!acc) return null;
  if (m.derive) return m.derive((k) => acc.sums[k] ?? 0);
  if (m.agg === "first") return acc.first[m.key] ?? 0;
  if (m.agg === "last") return acc.last[m.key] ?? 0;
  return acc.sums[m.key] ?? 0;
}

interface ResultRow {
  key: string;
  dims: Record<string, string>;
  cells: Map<string, Acc>;
  total: Acc;
}

interface Result {
  rows: ResultRow[];
  columnValues: string[];
  grand: Acc;
  grandByColumn: Map<string, Acc>;
  measures: Measure[];
  dims: Dimension[];
}

function dimLabel(d: Dimension | undefined, v: string): string {
  if (!d) return v;
  if (d.kind === "month") return /^\d{4}-\d{2}$/.test(v) ? monthLabel(v) : v;
  if (d.kind === "week") return formatDate(v);
  return v;
}

function runReport(ds: Dataset, cfg: ReportConfig): Result {
  const measures = cfg.measures.map((k) => ds.measures.find((m) => m.key === k)).filter((m): m is Measure => !!m);
  const rawKeys = ds.measures.filter((m) => !m.derive).map((m) => m.key);
  const dims = cfg.rowsBy.map((k) => ds.dimensions.find((d) => d.key === k)).filter((d): d is Dimension => !!d);
  const sorted = ds.periodKey ? [...ds.rows].sort((a, b) => String(a[ds.periodKey ?? ""] ?? "").localeCompare(String(b[ds.periodKey ?? ""] ?? ""))) : ds.rows;
  const filtered = sorted.filter((r) => {
    if (ds.periodKey && cfg.periods.length && !cfg.periods.includes(String(r[ds.periodKey] ?? ""))) return false;
    for (const [k, vals] of Object.entries(cfg.filters)) if (vals.length && !vals.includes(String(r[k] ?? ""))) return false;
    return true;
  });
  const map = new Map<string, ResultRow>();
  const grand = newAcc();
  const grandByColumn = new Map<string, Acc>();
  const columnValues = new Set<string>();
  for (const r of filtered) {
    const dimVals: Record<string, string> = {};
    for (const d of dims) dimVals[d.key] = String(r[d.key] ?? "");
    const key = dims.map((d) => dimVals[d.key]).join("|") || "All";
    const row = map.get(key) ?? { key, dims: dimVals, cells: new Map<string, Acc>(), total: newAcc() };
    addToAcc(row.total, r, rawKeys);
    addToAcc(grand, r, rawKeys);
    if (cfg.columnBy) {
      const cv = String(r[cfg.columnBy] ?? "");
      columnValues.add(cv);
      const cell = row.cells.get(cv) ?? newAcc();
      addToAcc(cell, r, rawKeys);
      row.cells.set(cv, cell);
      const g = grandByColumn.get(cv) ?? newAcc();
      addToAcc(g, r, rawKeys);
      grandByColumn.set(cv, g);
    }
    map.set(key, row);
  }
  let rows = [...map.values()];
  const sortMeasure = measures.find((m) => m.key === cfg.sortBy);
  if (sortMeasure) {
    rows.sort((a, b) => ((valueOf(a.total, sortMeasure) ?? 0) - (valueOf(b.total, sortMeasure) ?? 0)) * (cfg.sortDir === "desc" ? -1 : 1));
  } else {
    rows.sort((a, b) => a.key.localeCompare(b.key));
  }
  if (cfg.topN) rows = rows.slice(0, cfg.topN);
  const colDim = ds.dimensions.find((d) => d.key === cfg.columnBy);
  const cols = [...columnValues].sort((a, b) => (colDim?.kind ? a.localeCompare(b) : (valueOf(grandByColumn.get(b), measures[0] ?? ds.measures[0]!) ?? 0) - (valueOf(grandByColumn.get(a), measures[0] ?? ds.measures[0]!) ?? 0)));
  return { rows, columnValues: cols, grand, grandByColumn, measures, dims };
}

function fmt(v: number | null, f: Fmt): string {
  if (v === null || !Number.isFinite(v)) return "—";
  if (f === "usd") return usd(v);
  if (f === "int") return int(v);
  if (f === "pct") return pct(v);
  return v.toFixed(2);
}

function exportCsv(name: string, header: string[], body: string[][]) {
  if (typeof window === "undefined") return;
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const text = [header, ...body].map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------- presets

function lastMonths(all: string[], n: number): string[] {
  return all.slice(Math.max(0, all.length - n));
}

function usePresets(datasets: Dataset[], asOf: string): SavedReport[] {
  return useMemo(() => {
    const periodsOf = (id: string) => {
      const ds = datasets.find((d) => d.id === id);
      if (!ds?.periodKey) return [];
      const key = ds.periodKey;
      return [...new Set(ds.rows.map((r) => String(r[key] ?? "")))].sort();
    };
    const pnlMonths = periodsOf("pnl");
    const fullPnl = pnlMonths.filter((m) => m < monthKey(asOf));
    const lastFull = fullPnl.slice(-1);
    const sixMonthStart = monthKey(addMonths(asOf, -6));
    return [
      {
        id: "brush-pick",
        title: "Brush + Hair Pick on all platforms",
        description: "GP, CM2 and NP with margins by channel",
        config: { datasetId: "pnl", rowsBy: ["channel"], columnBy: null, measures: ["units", "netRevenue", "gp", "gpPct", "cm2", "cm2Pct", "np", "npPct", "npPerUnit"], periods: pnlMonths, filters: { sku: ["CCHAIRBRUSH1", "IE-O3AV-F28K"] }, sortBy: "netRevenue", sortDir: "desc", topN: null },
      },
      {
        id: "new-sku-spend",
        title: "Spend on new products, last 6 months",
        description: "PO commitments, paid and marketing for new SKUs",
        config: { datasetId: "purchases", rowsBy: ["product"], columnBy: null, measures: ["committed", "paid", "unpaid", "marketing", "totalSpend", "units"], periods: periodsOf("purchases").filter((m) => m >= sixMonthStart), filters: { skuAge: [NEW_SKU] }, sortBy: "totalSpend", sortDir: "desc", topN: null },
      },
      {
        id: "marketplace-gp-cm-np",
        title: "Marketplace profitability: GP / CM / NP",
        description: "Each channel at every profit layer, last full month",
        config: { datasetId: "pnl", rowsBy: ["channel"], columnBy: null, measures: ["netRevenue", "gp", "gpPct", "cm1", "cm1Pct", "cm2", "cm2Pct", "np", "npPct"], periods: lastFull, filters: {}, sortBy: "netRevenue", sortDir: "desc", topN: null },
      },
      {
        id: "product-per-platform",
        title: "Product-wise profitability per platform",
        description: "SKU × channel matrix of NP and NP %",
        config: { datasetId: "pnl", rowsBy: ["product"], columnBy: "channel", measures: ["np", "npPct"], periods: fullPnl, filters: {}, sortBy: "np", sortDir: "desc", topN: null },
      },
      {
        id: "weekly-cash",
        title: "Weekly payment & cash schedule",
        description: "Next 8 weeks: what to pay, receipts, cash left",
        config: { datasetId: "weekly-cash", rowsBy: ["week"], columnBy: null, measures: ["opening", "poPayments", "nonPo", "payroll", "subscriptions", "otherOut", "paymentsOut", "receiptsIn", "closing"], periods: [], filters: {}, sortBy: null, sortDir: "desc", topN: null },
      },
      {
        id: "conversion",
        title: "Marketing conversion by channel",
        description: "Sessions, orders, CVR, AOV, new customers, CAC",
        config: { datasetId: "conversion", rowsBy: ["channel"], columnBy: null, measures: ["sessions", "orders", "cvr", "aov", "newCustomers", "newShare", "cac", "roas"], periods: lastMonths(periodsOf("conversion").filter((m) => m < monthKey(asOf)), 1), filters: {}, sortBy: "sessions", sortDir: "desc", topN: null },
      },
      {
        id: "profit-leaks",
        title: "Where profit leaks: shipping & fees by channel",
        description: "Shipping per unit, fee %, ROAS and NP % per platform",
        config: { datasetId: "pnl", rowsBy: ["channel"], columnBy: null, measures: ["units", "shipPerUnit", "feePct", "adSpend", "roas", "cm1Pct", "npPct"], periods: lastFull, filters: {}, sortBy: "npPct", sortDir: "asc", topN: null },
      },
    ];
  }, [datasets, asOf]);
}

// ---------------------------------------------------------------- UI

export function ReportBuilder() {
  const { asOf, flash } = useStore();
  const datasets = useDatasets();
  const presets = usePresets(datasets, asOf);
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [activeTitle, setActiveTitle] = useState<string>(presets[0]?.title ?? "Custom report");
  const [cfg, setCfg] = useState<ReportConfig>(() => presets[0]?.config ?? { datasetId: "pnl", rowsBy: ["channel"], columnBy: null, measures: ["netRevenue", "np"], periods: [], filters: {}, sortBy: null, sortDir: "desc", topN: null });
  const [saveName, setSaveName] = useState("");

  const ds = datasets.find((d) => d.id === cfg.datasetId) ?? datasets[0]!;
  const periodOptions = useMemo(() => {
    if (!ds.periodKey) return [];
    const key = ds.periodKey;
    return [...new Set(ds.rows.map((r) => String(r[key] ?? "")))].sort();
  }, [ds]);
  const result = useMemo(() => runReport(ds, cfg), [ds, cfg]);
  const periodDim = ds.dimensions.find((d) => d.key === ds.periodKey);

  const open = (r: SavedReport) => {
    setCfg(r.config);
    setActiveTitle(r.title);
  };
  const patch = (p: Partial<ReportConfig>) => {
    setCfg((c) => ({ ...c, ...p }));
    setActiveTitle("Custom report");
  };
  const changeDataset = (id: string) => {
    const next = datasets.find((d) => d.id === id);
    if (!next) return;
    setCfg({
      datasetId: id,
      rowsBy: [next.dimensions[0]?.key ?? ""],
      columnBy: null,
      measures: next.measures.slice(0, 3).map((m) => m.key),
      periods: [],
      filters: {},
      sortBy: null,
      sortDir: "desc",
      topN: null,
    });
    setActiveTitle("Custom report");
  };
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  // Table layout
  const headDims = result.dims.map((d) => d.label);
  const measureCols: { label: string; col: string | null; m: Measure }[] = cfg.columnBy
    ? [
        ...result.columnValues.flatMap((cv) => result.measures.map((m) => ({ label: `${dimLabel(ds.dimensions.find((d) => d.key === cfg.columnBy), cv)} · ${m.label}`, col: cv, m }))),
        ...result.measures.map((m) => ({ label: `Total · ${m.label}`, col: null, m })),
      ]
    : result.measures.map((m) => ({ label: m.label, col: null, m }));
  const cellValue = (row: ResultRow, c: { col: string | null; m: Measure }) => valueOf(c.col === null ? row.total : row.cells.get(c.col), c.m);
  const totalValue = (c: { col: string | null; m: Measure }) => valueOf(c.col === null ? result.grand : result.grandByColumn.get(c.col), c.m);
  const rowLabel = (row: ResultRow) => result.dims.map((d) => dimLabel(d, row.dims[d.key] ?? "")).join(" · ") || "All";

  const chartMeasure = result.measures[0];
  const chartRows = chartMeasure ? result.rows.slice(0, 12).map((r) => ({ label: rowLabel(r), v: valueOf(r.total, chartMeasure) ?? 0 })) : [];
  const chartMax = Math.max(0, ...chartRows.map((r) => Math.abs(r.v)));

  const doExport = () => {
    exportCsv(activeTitle, [...headDims, ...measureCols.map((c) => c.label)], [
      ...result.rows.map((r) => [...result.dims.map((d) => dimLabel(d, r.dims[d.key] ?? "")), ...measureCols.map((c) => String(cellValue(r, c) ?? ""))]),
      [...result.dims.map((_, i) => (i === 0 ? "Total" : "")), ...measureCols.map((c) => String(totalValue(c) ?? ""))],
    ]);
  };

  const doSave = () => {
    const title = saveName.trim() || `${ds.label} by ${result.dims.map((d) => d.label).join(" & ")}`;
    setSaved((s) => [...s, { id: `saved-${s.length + 1}`, title, description: `${ds.label} · ${result.measures.map((m) => m.label).join(", ")}`, config: cfg }]);
    setActiveTitle(title);
    setSaveName("");
    flash(`Saved "${title}" to the CEO's reports`);
  };

  return (
    <Section title="Custom report builder" kicker="ASK A QUESTION" hint="Pick a ready answer or build your own" className="mt">
      <div className="section-kicker" style={{ marginBottom: 8 }}>CEO ASKS</div>
      <div className="grid-3" style={{ marginBottom: 14 }}>
        {presets.map((p) => (
          <button key={p.id} type="button" className={`report-card${activeTitle === p.title ? " active" : ""}`} onClick={() => open(p)}>
            <strong>{p.title}</strong>
            <span>{p.description}</span>
          </button>
        ))}
      </div>
      {saved.length ? (
        <>
          <div className="section-kicker" style={{ marginBottom: 8 }}>SAVED BY CEO</div>
          <div className="grid-3" style={{ marginBottom: 14 }}>
            {saved.map((p) => (
              <button key={p.id} type="button" className={`report-card${activeTitle === p.title ? " active" : ""}`} onClick={() => open(p)}>
                <strong>{p.title}</strong>
                <span>{p.description}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div className="card" style={{ background: "#f7f9fc", boxShadow: "none" }}>
        <div className="inline-form">
          <div className="field">
            <label>Dataset</label>
            <select value={cfg.datasetId} onChange={(e) => changeDataset(e.target.value)}>
              {datasets.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Rows</label>
            <select value={cfg.rowsBy[0] ?? ""} onChange={(e) => patch({ rowsBy: [e.target.value, ...cfg.rowsBy.slice(1).filter((x) => x !== e.target.value)] })}>
              {ds.dimensions.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Then by</label>
            <select value={cfg.rowsBy[1] ?? ""} onChange={(e) => patch({ rowsBy: e.target.value ? [cfg.rowsBy[0] ?? "", e.target.value] : [cfg.rowsBy[0] ?? ""] })}>
              <option value="">—</option>
              {ds.dimensions.filter((d) => d.key !== cfg.rowsBy[0]).map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Columns (matrix)</label>
            <select value={cfg.columnBy ?? ""} onChange={(e) => patch({ columnBy: e.target.value || null })}>
              <option value="">— none —</option>
              {ds.dimensions.filter((d) => !cfg.rowsBy.includes(d.key)).map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Sort by</label>
            <select value={cfg.sortBy ?? ""} onChange={(e) => patch({ sortBy: e.target.value || null })}>
              <option value="">Row name</option>
              {result.measures.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Order</label>
            <select value={cfg.sortDir} onChange={(e) => patch({ sortDir: e.target.value === "asc" ? "asc" : "desc" })}>
              <option value="desc">Highest first</option>
              <option value="asc">Lowest first</option>
            </select>
          </div>
          <div className="field">
            <label>Show</label>
            <select value={cfg.topN ?? ""} onChange={(e) => patch({ topN: e.target.value ? Number(e.target.value) : null })}>
              <option value="">All rows</option>
              <option value="5">Top 5</option>
              <option value="10">Top 10</option>
              <option value="20">Top 20</option>
            </select>
          </div>
        </div>

        {ds.periodKey ? (
          <div className="mt">
            <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>{periodDim?.label ?? "Period"} <span className="muted">(none selected = all)</span></div>
            <div className="row">
              {periodOptions.map((p) => (
                <button key={p} type="button" className={`btn${cfg.periods.includes(p) ? " primary" : ""}`} onClick={() => patch({ periods: toggle(cfg.periods, p) })}>
                  {dimLabel(periodDim, p)}
                </button>
              ))}
              {periodOptions.length > 3 ? <button type="button" className="btn ghost" onClick={() => patch({ periods: lastMonths(periodOptions, 3) })}>Last 3</button> : null}
              {periodOptions.length > 6 ? <button type="button" className="btn ghost" onClick={() => patch({ periods: lastMonths(periodOptions, 6) })}>Last 6</button> : null}
              <button type="button" className="btn ghost" onClick={() => patch({ periods: [] })}>All</button>
            </div>
          </div>
        ) : null}

        <div className="mt">
          <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>Measures</div>
          <div className="row">
            {ds.measures.map((m) => (
              <label key={m.key} className="row small" style={{ gap: 4, marginRight: 8 }}>
                <input type="checkbox" checked={cfg.measures.includes(m.key)} onChange={() => patch({ measures: toggle(cfg.measures, m.key) })} />
                {m.label}
              </label>
            ))}
          </div>
        </div>

        {ds.filterKeys.length ? (
          <div className="inline-form mt">
            {ds.filterKeys.map((k) => {
              const d = ds.dimensions.find((x) => x.key === k);
              const values = [...new Set(ds.rows.map((r) => String(r[k] ?? "")))].sort();
              const chosen = cfg.filters[k] ?? [];
              return (
                <div className="field" key={k}>
                  <label>{d?.label ?? k} {chosen.length ? `(${chosen.length})` : "(all)"}</label>
                  <select
                    multiple
                    size={Math.min(5, Math.max(2, values.length))}
                    value={chosen}
                    onChange={(e) => patch({ filters: { ...cfg.filters, [k]: [...e.target.selectedOptions].map((o) => o.value) } })}
                  >
                    {values.map((v) => <option key={v} value={v}>{k === "sku" ? `${v} — ${String(ds.rows.find((r) => r[k] === v)?.["product"] ?? "")}` : dimLabel(d, v)}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="section-title mt">
        <div>
          <span className="section-kicker">{ds.label.toUpperCase()}</span>
          <h3>{activeTitle}</h3>
        </div>
        <div className="row">
          <input className="control" placeholder="Name this report" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
          <button className="btn" type="button" onClick={doSave}>☆ Save as report</button>
          <button className="btn" type="button" onClick={doExport}>⇩ Export CSV</button>
        </div>
      </div>
      {ds.note ? <div className="small" style={{ marginBottom: 10 }}>{ds.note}</div> : null}

      {result.measures.length === 0 ? (
        <div className="empty">Tick at least one measure.</div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {headDims.map((h) => <th key={h}>{h}</th>)}
                  {measureCols.map((c) => <th key={c.label} className="num">{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 ? (
                  <tr><td colSpan={headDims.length + measureCols.length}><div className="empty">No rows match these filters.</div></td></tr>
                ) : (
                  result.rows.map((r) => (
                    <tr key={r.key}>
                      {result.dims.map((d, i) => (
                        <td key={d.key}>{i === 0 ? <strong>{dimLabel(d, r.dims[d.key] ?? "")}</strong> : dimLabel(d, r.dims[d.key] ?? "")}</td>
                      ))}
                      {measureCols.map((c) => {
                        const v = cellValue(r, c);
                        return <td key={c.label} className={`num${v !== null && v < 0 ? " neg" : ""}`}>{fmt(v, c.m.fmt)}</td>;
                      })}
                    </tr>
                  ))
                )}
                {result.rows.length > 1 || cfg.topN ? (
                  <tr className="total-row">
                    {result.dims.map((d, i) => <td key={d.key}>{i === 0 ? (cfg.topN ? "Total (all rows)" : "Total") : ""}</td>)}
                    {measureCols.map((c) => {
                      const v = totalValue(c);
                      return <td key={c.label} className={`num${v !== null && v < 0 ? " neg" : ""}`}>{fmt(v, c.m.fmt)}</td>;
                    })}
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {chartMeasure && chartRows.length > 1 ? (
            <div className="mt">
              <div className="small" style={{ fontWeight: 700, marginBottom: 4 }}>{chartMeasure.label}</div>
              {chartRows.map((r) => (
                <HBar key={r.label} label={r.label} value={Math.abs(r.v)} max={chartMax} display={fmt(r.v, chartMeasure.fmt)} tone={r.v < 0 ? "bad" : ""} />
              ))}
            </div>
          ) : null}
        </>
      )}

      <div className="notice mt" style={{ marginBottom: 0 }}>
        <strong>How to ask for a new report:</strong> try the builder first: pick the data, what to group by and the numbers you want, then save it. If the data isn't in the list (for example, a new platform or a cost Finance doesn't capture yet), tell Claude the question the CEO asked in plain words, for example "profit on the 32oz range at Walmart last quarter", and it gets added as a dataset or a one-click report here.
      </div>
    </Section>
  );
}
