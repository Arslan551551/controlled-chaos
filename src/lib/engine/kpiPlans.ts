// Configurable KPI / pay / bonus engine.
// One plan = a list of components; every metric comes from a locked month-end
// snapshot. Covers every plan seen so far (docs/excel-analysis/kpi-framework-summary.md):
// Mehran (Amazon), Sadam (Google), Rafay (Meta), support-team review bonus,
// Shumaila (TikTok Shop), TikTok GMV Max consultant, Walmart sales KPI.

export type Currency = "USD" | "PKR";
export type Rating = "Excellent" | "Good" | "Fair" | "Poor";

/** Review scale from the bonus workbook. A blank rating scores 0 (sheet behaviour) and is flagged. */
export const RATING_POINTS: Record<Rating, number> = { Excellent: 100, Good: 75, Fair: 35, Poor: 0 };

export interface MetricSnapshot {
  id: string;
  /** "2026-09" */
  period: string;
  values: Record<string, number>;
  /** metric key -> source system (e.g. "Sellerboard", "Shopify first-click", "QuickBooks") */
  sources: Record<string, string>;
  status: "Draft" | "Locked";
  lockedBy: string | null;
  lockedAt: string | null;
  /** PKR per 1 USD for the month — one rate for every conversion. */
  pkrPerUsd: number;
}

export type Op = ">" | ">=" | "<" | "<=";

export interface Condition {
  metric: string;
  op: Op;
  value: number;
}

/** Whole-tier lookup: the metric falls in [from, to) and the whole amount is paid. */
export interface Tier {
  from: number;
  to: number | null;
  amount: number;
}

/** Marginal slab: [from, to) with a rate. Per-unit count bands use inclusive from/to (1–40, 41–80). */
export interface Band {
  from: number;
  to: number | null;
  rate: number;
}

interface ComponentBase {
  id: string;
  label: string;
  /** Currency the component is calculated in. */
  currency: Currency;
  /** All (AND) or any (OR) of the conditions must pass, otherwise the component pays 0. */
  conditions: Condition[];
  conditionMode: "all" | "any";
  cap: number | null;
  floor: number | null;
}

export type PlanComponent =
  | (ComponentBase & {
      kind: "fixed";
      amount: number;
      /** Mid-month changes / pro-rata: Σ amount × days / basisDays. Empty = full amount. */
      periods: { amount: number; days: number; basisDays: number }[];
      roundTo: number | null;
    })
  | (ComponentBase & { kind: "pctAboveThreshold"; metric: string; threshold: number; rate: number; floorAtZero: boolean })
  | (ComponentBase & { kind: "pctOfMetric"; metric: string; rate: number })
  | (ComponentBase & { kind: "stepTier"; metric: string; tiers: Tier[] })
  | (ComponentBase & { kind: "progressiveSlab"; metric: string; slabs: Band[] })
  | (ComponentBase & { kind: "perUnit"; metric: string; bands: Band[]; mode: "whole" | "marginal" })
  | (ComponentBase & {
      kind: "scoredReview";
      /** Achievable bonus before the review score. */
      base:
        | { kind: "amount"; amount: number; daysWorked: number | null; basisDays: number | null; share: number }
        | { kind: "pctOfMetric"; metric: string; rate: number; metricCurrency: Currency; share: number }
        | { kind: "periods"; periods: { amount: number; days: number; basisDays: number }[]; roundTo: number | null; share: number };
      /** Sheet override, e.g. Sadam/Rafay typed 100. null = use the review. */
      scoreOverride: number | null;
    });

export type ComponentKind = PlanComponent["kind"];

export interface PayPlan {
  id: string;
  personId: string;
  name: string;
  /** Currency the person is paid in. */
  payCurrency: Currency;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
  components: PlanComponent[];
  /** Share of cost borne by Controlled Chaos (rest Urtasker). Applied for cost booking only. */
  controlledChaosShare: number;
  /** Maximum total payout in the pay currency (e.g. GMV Max consultant $520). null = none. */
  cap: number | null;
  notes: string;
}

export interface ReviewRating {
  personId: string;
  period: string;
  reviewer: string;
  answers: { question: string; rating: Rating | null }[];
}

export interface PayAdjustment {
  id: string;
  personId: string;
  period: string;
  amount: number;
  currency: Currency;
  reason: string;
  by: string;
}

export interface ConditionResult {
  text: string;
  actual: number | null;
  passed: boolean;
}

export interface PayLine {
  componentId: string;
  label: string;
  kind: ComponentKind | "adjustment";
  currency: Currency;
  /** Amount in the component currency. */
  amount: number;
  amountUsd: number;
  amountPkr: number;
  explanation: string;
  conditions: ConditionResult[];
  gated: boolean;
  capped: boolean;
  floored: boolean;
  warnings: string[];
}

export interface PayResult {
  planId: string;
  personId: string;
  period: string;
  lines: PayLine[];
  totalUsd: number;
  totalPkr: number;
  /** Total in the plan's pay currency. */
  total: number;
  controlledChaosCost: number;
  missingMetrics: string[];
  snapshotLocked: boolean;
  planCapped: boolean;
}

// ---------------------------------------------------------------- helpers

const fmt = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const pctText = (r: number) => `${+(r * 100).toFixed(4)}%`;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

function metricValue(snapshot: MetricSnapshot, key: string, missing: Set<string>): number {
  const v = snapshot.values[key];
  if (v === undefined) {
    missing.add(key);
    return 0;
  }
  return v;
}

function compare(a: number, op: Op, b: number): boolean {
  switch (op) {
    case ">":
      return a > b;
    case ">=":
      return a >= b;
    case "<":
      return a < b;
    case "<=":
      return a <= b;
  }
}

function inBand(v: number, from: number, to: number | null) {
  return v >= from && (to === null || v < to);
}

export function reviewScore(r: ReviewRating | undefined): { score: number; blanks: number; count: number } {
  if (!r || r.answers.length === 0) return { score: 0, blanks: 0, count: 0 };
  const blanks = r.answers.filter((a) => a.rating === null).length;
  const total = r.answers.reduce((s, a) => s + (a.rating ? RATING_POINTS[a.rating] : 0), 0);
  return { score: total / r.answers.length, blanks, count: r.answers.length };
}

/** Marginal slabs: Σ rate × portion of the metric inside each slab. */
export function progressive(v: number, slabs: Band[]): { amount: number; parts: string[] } {
  let amount = 0;
  const parts: string[] = [];
  for (const s of slabs) {
    const top = s.to === null ? v : Math.min(v, s.to);
    const portion = Math.max(0, top - s.from);
    if (portion <= 0) continue;
    amount += portion * s.rate;
    parts.push(`${pctText(s.rate)} × ${fmt(portion)}`);
  }
  return { amount, parts };
}

// ---------------------------------------------------------------- engine

export function calculateComponent(
  c: PlanComponent,
  snapshot: MetricSnapshot,
  review: ReviewRating | undefined,
  missing: Set<string>,
): PayLine {
  const fx = snapshot.pkrPerUsd;
  const warnings: string[] = [];
  const conditions: ConditionResult[] = c.conditions.map((k) => {
    const actual = snapshot.values[k.metric];
    if (actual === undefined) missing.add(k.metric);
    return { text: `${k.metric} ${k.op} ${k.value}`, actual: actual ?? null, passed: actual !== undefined && compare(actual, k.op, k.value) };
  });
  const gatePass = conditions.length === 0 || (c.conditionMode === "all" ? conditions.every((x) => x.passed) : conditions.some((x) => x.passed));

  let raw = 0;
  let explanation = "";
  switch (c.kind) {
    case "fixed": {
      if (c.periods.length === 0) {
        raw = c.amount;
        explanation = `Fixed ${fmt(c.amount)}`;
      } else {
        raw = c.periods.reduce((s, p) => s + (p.amount * p.days) / p.basisDays, 0);
        explanation = c.periods.map((p) => `${fmt(p.amount, 0)} × ${p.days}/${p.basisDays}`).join(" + ") + ` = ${fmt(raw)}`;
      }
      if (c.roundTo !== null && c.roundTo > 0) {
        raw = Math.round(raw / c.roundTo) * c.roundTo;
        explanation += ` → rounded ${fmt(raw)}`;
      }
      break;
    }
    case "pctAboveThreshold": {
      const v = metricValue(snapshot, c.metric, missing);
      const diff = v - c.threshold;
      raw = c.rate * (c.floorAtZero ? Math.max(0, diff) : diff);
      explanation = `${pctText(c.rate)} × (${fmt(v)} − ${fmt(c.threshold)}) = ${fmt(raw)}`;
      if (!c.floorAtZero && diff < 0) warnings.push("Below threshold gives a negative amount (sheet has no zero floor)");
      break;
    }
    case "pctOfMetric": {
      const v = metricValue(snapshot, c.metric, missing);
      raw = c.rate * v;
      explanation = `${pctText(c.rate)} × ${fmt(v)} = ${fmt(raw)}`;
      break;
    }
    case "stepTier": {
      const v = metricValue(snapshot, c.metric, missing);
      const tier = c.tiers.find((t) => inBand(v, t.from, t.to));
      raw = tier?.amount ?? 0;
      explanation = tier
        ? `${c.metric} ${fmt(v)} is in tier ${fmt(tier.from, 0)}${tier.to === null ? "+" : `–${fmt(tier.to, 0)}`} → ${fmt(raw)}`
        : `${c.metric} ${fmt(v)} is outside every tier → 0`;
      break;
    }
    case "progressiveSlab": {
      const v = metricValue(snapshot, c.metric, missing);
      const p = progressive(v, c.slabs);
      raw = p.amount;
      explanation = `${p.parts.join(" + ") || "0"} = ${fmt(raw)}`;
      break;
    }
    case "perUnit": {
      // Count bands are inclusive, as written in the sheets: 1–40, 41–80, 81+.
      const v = Math.floor(metricValue(snapshot, c.metric, missing));
      if (c.mode === "marginal") {
        const parts: string[] = [];
        for (const b of c.bands) {
          const n = Math.max(0, Math.min(v, b.to ?? v) - b.from + 1);
          if (n <= 0) continue;
          raw += n * b.rate;
          parts.push(`${n} × ${fmt(b.rate)}`);
        }
        explanation = `${parts.join(" + ") || "0"} = ${fmt(raw)} (each band at its own rate)`;
      } else {
        const band = c.bands.find((b) => v >= b.from && (b.to === null || v <= b.to));
        const rate = band?.rate ?? 0;
        raw = v * rate;
        explanation = `${fmt(v, 0)} × ${fmt(rate)}${band ? ` (band ${band.from}–${band.to ?? "+"})` : ""} = ${fmt(raw)}`;
      }
      break;
    }
    case "scoredReview": {
      let achievable = 0;
      let baseText = "";
      if (c.base.kind === "amount") {
        const prorate = c.base.daysWorked !== null && c.base.basisDays ? c.base.daysWorked / c.base.basisDays : 1;
        achievable = c.base.amount * prorate * c.base.share;
        baseText = `${fmt(c.base.amount, 0)}${prorate !== 1 ? ` × ${c.base.daysWorked}/${c.base.basisDays}` : ""}${c.base.share !== 1 ? ` × ${pctText(c.base.share)}` : ""}`;
      } else if (c.base.kind === "periods") {
        let a = c.base.periods.reduce((t, p) => t + (p.amount * p.days) / p.basisDays, 0);
        if (c.base.roundTo !== null && c.base.roundTo > 0) a = Math.round(a / c.base.roundTo) * c.base.roundTo;
        achievable = a * c.base.share;
        baseText = `${c.base.periods.map((p) => `${fmt(p.amount, 0)} × ${p.days}/${p.basisDays}`).join(" + ")}${c.base.roundTo ? " (rounded)" : ""}${c.base.share !== 1 ? ` × ${pctText(c.base.share)}` : ""}`;
      } else {
        const v = metricValue(snapshot, c.base.metric, missing);
        const conv = c.base.metricCurrency === c.currency ? 1 : c.currency === "PKR" ? fx : 1 / fx;
        achievable = c.base.rate * v * conv * c.base.share;
        baseText = `${pctText(c.base.rate)} × ${fmt(v)}${conv !== 1 ? ` × ${fmt(conv, 2)}` : ""}${c.base.share !== 1 ? ` × ${pctText(c.base.share)}` : ""}`;
      }
      const rs = reviewScore(review);
      const score = c.scoreOverride ?? rs.score;
      if (c.scoreOverride === null && rs.count === 0) warnings.push("No review submitted for this month");
      if (c.scoreOverride === null && rs.blanks > 0) warnings.push(`${rs.blanks} question(s) left blank — scored 0`);
      raw = (achievable * score) / 100;
      explanation = `Achievable ${baseText} = ${fmt(achievable)} × review score ${fmt(score)}% = ${fmt(raw)}${c.scoreOverride !== null ? " (score fixed by plan)" : ""}`;
      break;
    }
  }

  let amount = gatePass ? raw : 0;
  let capped = false;
  let floored = false;
  if (gatePass && c.cap !== null && amount > c.cap) {
    amount = c.cap;
    capped = true;
  }
  if (gatePass && c.floor !== null && amount < c.floor) {
    amount = c.floor;
    floored = true;
  }
  if (!gatePass) explanation = `Not eligible (${conditions.filter((x) => !x.passed).map((x) => `${x.text}; actual ${x.actual === null ? "missing" : fmt(x.actual, 4)}`).join(" · ")}) → 0. Would have been: ${explanation}`;
  if (capped) explanation += ` → capped at ${fmt(c.cap ?? 0)}`;
  if (floored) explanation += ` → floor ${fmt(c.floor ?? 0)}`;

  const amountUsd = c.currency === "USD" ? amount : amount / fx;
  const amountPkr = c.currency === "PKR" ? amount : amount * fx;
  return {
    componentId: c.id,
    label: c.label,
    kind: c.kind,
    currency: c.currency,
    amount: r4(amount),
    amountUsd: r4(amountUsd),
    amountPkr: r4(amountPkr),
    explanation,
    conditions,
    gated: !gatePass,
    capped,
    floored,
    warnings,
  };
}

export interface PayContext {
  snapshot: MetricSnapshot;
  reviews: ReviewRating[];
  adjustments: PayAdjustment[];
}

export function calculatePay(plan: PayPlan, ctx: PayContext): PayResult {
  const planCap = plan.cap;
  const missing = new Set<string>();
  const review = ctx.reviews.find((r) => r.personId === plan.personId && r.period === ctx.snapshot.period);
  const fx = ctx.snapshot.pkrPerUsd;
  const lines = plan.components.map((c) => calculateComponent(c, ctx.snapshot, review, missing));
  for (const a of ctx.adjustments.filter((x) => x.personId === plan.personId && x.period === ctx.snapshot.period)) {
    lines.push({
      componentId: a.id,
      label: a.amount >= 0 ? `Addition: ${a.reason}` : `Deduction: ${a.reason}`,
      kind: "adjustment",
      currency: a.currency,
      amount: a.amount,
      amountUsd: r4(a.currency === "USD" ? a.amount : a.amount / fx),
      amountPkr: r4(a.currency === "PKR" ? a.amount : a.amount * fx),
      explanation: `Manual ${a.amount >= 0 ? "addition" : "deduction"} by ${a.by}`,
      conditions: [],
      gated: false,
      capped: false,
      floored: false,
      warnings: [],
    });
  }
  let totalUsd = lines.reduce((s, l) => s + l.amountUsd, 0);
  let totalPkr = lines.reduce((s, l) => s + l.amountPkr, 0);
  if (planCap !== null) {
    const capInPay = plan.payCurrency === "USD" ? totalUsd : totalPkr;
    if (capInPay > planCap) {
      const k = planCap / capInPay;
      totalUsd *= k;
      totalPkr *= k;
    }
  }
  const total = plan.payCurrency === "USD" ? totalUsd : totalPkr;
  const planCapped = planCap !== null && (plan.payCurrency === "USD" ? lines.reduce((a, l) => a + l.amountUsd, 0) : lines.reduce((a, l) => a + l.amountPkr, 0)) > planCap;
  return {
    planCapped,
    planId: plan.id,
    personId: plan.personId,
    period: ctx.snapshot.period,
    lines,
    totalUsd: r4(totalUsd),
    totalPkr: r4(totalPkr),
    total: r4(total),
    controlledChaosCost: r4(total * plan.controlledChaosShare),
    missingMetrics: [...missing].sort(),
    snapshotLocked: ctx.snapshot.status === "Locked",
  };
}

/** Plan in force for a person on the first day of a period (plans are dated versions). */
export function planForPeriod(plans: PayPlan[], personId: string, period: string): PayPlan | null {
  const day = `${period}-01`;
  const matches = plans
    .filter((p) => p.personId === personId && p.effectiveFrom <= day && (p.effectiveTo === null || p.effectiveTo >= day))
    .sort((a, b) => b.version - a.version);
  return matches[0] ?? null;
}

export function describeComponent(c: PlanComponent): string {
  const gate = c.conditions.length ? ` if ${c.conditions.map((k) => `${k.metric} ${k.op} ${k.value}`).join(c.conditionMode === "all" ? " and " : " or ")}` : "";
  const cap = c.cap !== null ? `, cap ${fmt(c.cap, 0)}` : "";
  switch (c.kind) {
    case "fixed":
      return `${c.label}: ${c.currency} ${fmt(c.amount, 0)}${c.periods.length ? " (pro-rata)" : ""}${gate}${cap}`;
    case "pctAboveThreshold":
      return `${c.label}: ${pctText(c.rate)} × (${c.metric} − ${fmt(c.threshold, 0)})${c.floorAtZero ? "" : " (no zero floor)"}${gate}${cap}`;
    case "pctOfMetric":
      return `${c.label}: ${pctText(c.rate)} × ${c.metric}${gate}${cap}`;
    case "stepTier":
      return `${c.label}: tier on ${c.metric} (${c.tiers.map((t) => `${fmt(t.from, 0)}+ → ${fmt(t.amount, 0)}`).join(", ")})${gate}${cap}`;
    case "progressiveSlab":
      return `${c.label}: marginal slabs on ${c.metric} (${c.slabs.map((s) => pctText(s.rate)).join(" / ")})${gate}${cap}`;
    case "perUnit":
      return `${c.label}: per unit of ${c.metric} (${c.bands.map((b) => `${b.from}–${b.to ?? "∞"} @ ${fmt(b.rate)}`).join(", ")}, ${c.mode})${gate}${cap}`;
    case "scoredReview":
      return `${c.label}: achievable × review score${c.scoreOverride !== null ? ` (fixed ${c.scoreOverride}%)` : ""}${gate}${cap}`;
  }
}
