// Company health: rule-based signals and cost-cut suggestions for the CEO.
// The AI-written summary is generated from these same signals (server-side, later).

import type { CashFlowMonth, ProfitRow, SalesVsCashRow } from "./finance.ts";
import type { MarketingSummary } from "./marketing.ts";
import type { DetectedSubscription, Subscription } from "./operations.ts";
import { monthlyCost } from "./operations.ts";
import type { SkuPlan } from "./planning.ts";
import type { DistributorPosition } from "./distributors.ts";

export interface HealthTargets {
  minimumCashBuffer: number;
  targetNetMarginPct: number;
  targetRoas: number;
  maxTacos: number;
  minSeatUsePct: number;
  minCollectedPct: number;
}

export type Severity = "critical" | "warning" | "good";

export interface HealthSignal {
  id: string;
  area:
    | "Cash"
    | "Profitability"
    | "Marketing"
    | "Subscriptions"
    | "Inventory"
    | "Collections"
    | "Distributors";
  severity: Severity;
  title: string;
  detail: string;
  /** Estimated monthly saving if the suggestion is acted on. */
  monthlySaving: number;
  suggestion: string | null;
}

export interface HealthInput {
  targets: HealthTargets;
  cash: CashFlowMonth[];
  profit: ProfitRow[];
  marketing: MarketingSummary[];
  subscriptions: Subscription[];
  detected: DetectedSubscription[];
  planning: SkuPlan[];
  salesVsCash: SalesVsCashRow[];
  distributors: DistributorPosition[];
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function healthSignals(i: HealthInput): HealthSignal[] {
  const out: HealthSignal[] = [];
  const t = i.targets;

  // Cash
  const lowest = [...i.cash].sort((a, b) => a.closing - b.closing)[0];
  if (lowest) {
    const sev: Severity =
      lowest.closing < 0 ? "critical" : lowest.closing < t.minimumCashBuffer ? "warning" : "good";
    out.push({
      id: "cash-low",
      area: "Cash",
      severity: sev,
      title:
        sev === "good"
          ? "Cash stays above the minimum buffer"
          : `Projected cash falls to ${usd(lowest.closing)}`,
      detail: `Lowest projected month-end cash is ${usd(lowest.closing)} (${lowest.month}) against a ${usd(t.minimumCashBuffer)} buffer.`,
      monthlySaving: 0,
      suggestion:
        sev === "good" ? null : "Move non-critical Non-PO payments later or stage PO installments.",
    });
  }

  // Profitability by channel
  for (const r of i.profit) {
    if (r.netRevenue <= 0) continue;
    if (r.netMarginPct < t.targetNetMarginPct) {
      out.push({
        id: `margin-${r.channel}`,
        area: "Profitability",
        severity: r.netMarginPct < 0 ? "critical" : "warning",
        title: `${r.channel} net margin ${pct(r.netMarginPct)}`,
        detail: `Below the ${pct(t.targetNetMarginPct)} target. Ad spend ${usd(r.adSpend)}, fees ${usd(r.platformFees)}, allocated overhead ${usd(r.allocatedExpenses)}.`,
        monthlySaving: 0,
        suggestion:
          r.adSpend > r.netProfit
            ? `Review ${r.channel} ad spend first — it is larger than the channel's profit.`
            : `Review ${r.channel} pricing and fees.`,
      });
    }
  }

  // Marketing
  for (const m of i.marketing) {
    if (m.spend <= 0) continue;
    if (m.roas < t.targetRoas) {
      const excess = m.spend - m.adSales / t.targetRoas;
      out.push({
        id: `roas-${m.key}`,
        area: "Marketing",
        severity: m.roas < 1 ? "critical" : "warning",
        title: `${m.key} ROAS ${m.roas.toFixed(2)}`,
        detail: `Target ${t.targetRoas.toFixed(1)}. Spend ${usd(m.spend)} returned ${usd(m.adSales)} in ad sales.`,
        monthlySaving: Math.max(0, excess),
        suggestion: `Cut or restructure the weakest ${m.key} campaigns; spend above target efficiency is about ${usd(Math.max(0, excess))}.`,
      });
    }
  }

  // Subscriptions
  for (const s of i.subscriptions.filter((x) => x.status === "Active")) {
    if (s.seats > 1 && s.seatsUsed / s.seats < t.minSeatUsePct) {
      const unused = s.seats - s.seatsUsed;
      const saving = (monthlyCost(s) / s.seats) * unused;
      out.push({
        id: `seats-${s.id}`,
        area: "Subscriptions",
        severity: "warning",
        title: `${s.tool}: ${unused} unused seat${unused === 1 ? "" : "s"}`,
        detail: `${s.seatsUsed} of ${s.seats} seats used (${s.department}).`,
        monthlySaving: saving,
        suggestion: `Reduce ${s.tool} to ${s.seatsUsed} seat${s.seatsUsed === 1 ? "" : "s"} before the ${s.nextRenewal} renewal.`,
      });
    }
  }
  const byCategory = new Map<string, Subscription[]>();
  for (const s of i.subscriptions.filter((x) => x.status === "Active"))
    byCategory.set(s.category, [...(byCategory.get(s.category) ?? []), s]);
  for (const [cat, subs] of byCategory) {
    if (subs.length < 2) continue;
    const cheapest = [...subs].sort((a, b) => monthlyCost(a) - monthlyCost(b))[0]!;
    const saving = subs.filter((s) => s !== cheapest).reduce((a, s) => a + monthlyCost(s), 0);
    out.push({
      id: `dup-${cat}`,
      area: "Subscriptions",
      severity: "warning",
      title: `${subs.length} tools for ${cat}`,
      detail: subs.map((s) => `${s.tool} (${s.department})`).join(", "),
      monthlySaving: saving,
      suggestion: `Consolidate on one ${cat} tool.`,
    });
  }
  for (const d of i.detected.filter((x) => x.finding !== "Matches register")) {
    out.push({
      id: `detected-${d.merchant}`,
      area: "Subscriptions",
      severity: "warning",
      title:
        d.finding === "Not registered"
          ? `Unregistered recurring charge: ${d.merchant}`
          : `${d.merchant} price increased`,
      detail: `Last charge ${usd(d.lastAmount)} on ${d.lastDate}; seen in ${d.months} months.`,
      monthlySaving: d.finding === "Not registered" ? d.averageAmount : 0,
      suggestion:
        d.finding === "Not registered"
          ? "Assign an owner or cancel."
          : "Confirm the new price was approved.",
    });
  }

  // Inventory
  const poNow = i.planning.filter(
    (p) => p.poStatus === "PO Now" || p.poStatus === "Additional PO Required",
  );
  if (poNow.length > 0) {
    out.push({
      id: "inventory-po",
      area: "Inventory",
      severity: poNow.some((p) => p.stockoutBeforeArrival) ? "critical" : "warning",
      title: `${poNow.length} SKU${poNow.length === 1 ? "" : "s"} need a PO now`,
      detail: poNow.map((p) => `${p.sku} (${p.daysOfStockLeft ?? "—"} days left)`).join(", "),
      monthlySaving: 0,
      suggestion: null,
    });
  }

  // Collections
  for (const r of i.salesVsCash) {
    if (r.expectedNet > 0 && r.collectedPct < t.minCollectedPct) {
      out.push({
        id: `collect-${r.channel}`,
        area: "Collections",
        severity: "warning",
        title: `${r.channel}: ${usd(r.outstanding)} not yet received`,
        detail: `${pct(r.collectedPct)} of expected payout received.`,
        monthlySaving: 0,
        suggestion: `Chase ${r.channel} settlement / reconcile payout reports.`,
      });
    }
  }

  // Distributors
  for (const d of i.distributors) {
    if (d.aging.d61_90 + d.aging.d90plus > 0) {
      out.push({
        id: `dist-${d.distributor.id}`,
        area: "Distributors",
        severity: "warning",
        title: `${d.distributor.name}: ${usd(d.aging.d61_90 + d.aging.d90plus)} over 60 days`,
        detail: `Open AR ${usd(d.openAR)}; marketing fund + product credit owed to them ${usd(d.marketingFundBalance + d.productCreditBalance)}.`,
        monthlySaving: 0,
        suggestion: "Apply open fund / credits against overdue invoices, or hold new orders.",
      });
    }
  }

  const order: Record<Severity, number> = { critical: 0, warning: 1, good: 2 };
  return out.sort(
    (a, b) => order[a.severity] - order[b.severity] || b.monthlySaving - a.monthlySaving,
  );
}

/**
 * 0–100 score. Each area counts once, by its worst signal: −20 for a critical area,
 * −8 for an area with only warnings. Many small items in one area (e.g. a few unused
 * seats) don't sink the whole score.
 */
export function healthScore(signals: HealthSignal[]): number {
  const worst = new Map<HealthSignal["area"], Severity>();
  for (const x of signals) {
    if (x.severity === "good") continue;
    if (worst.get(x.area) !== "critical") worst.set(x.area, x.severity);
  }
  let s = 100;
  for (const sev of worst.values()) s -= sev === "critical" ? 20 : 8;
  return Math.max(0, Math.min(100, s));
}
