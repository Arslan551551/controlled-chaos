// CC03 Demand / Planning Engine.
// Implements Living Blueprint v1.10 sections 7–14:
// burn windows, Sales Trend, 12-month projection, 135-day trigger with
// lead-time safety, 180-day recommended quantity with MOQ, Additional PO,
// 60-day Brentwood transfer, and Empty Tube requirement.

import { addDays, daysBetween, monthKey, monthKeys } from "./dates.ts";
import type { ActualSale, PlannedSale, PurchaseOrder, Sku, StockPosition } from "./types.ts";

export const RULES = {
  reorderCoverDays: 135,
  recommendedCoverDays: 180,
  spikeThreshold: 0.25,
  /** Sales Trend thresholds (14-day vs 30-day). Declining threshold not defined in the blueprint — assumption. */
  trendAccelerating: 0.25,
  trendDeclining: -0.15,
  transferFloorDays: 60,
  /** Warn this many days before Brentwood is projected to hit the 60-day floor. Assumption. */
  transferLookaheadDays: 14,
  /** PO Open By within this many days shows "PO Due Soon". Assumption. */
  poDueSoonDays: 30,
  horizonDays: 365,
  /** Days after the FG PO is opened that the filler needs the tubes. Assumption — confirm with Supply Chain. */
  tubeNeededAfterFgPoDays: 14,
  /** Recommended quantities are rounded up to this multiple. Assumption. */
  roundTo: 100,
} as const;

export type SalesTrend = "Accelerating" | "Stable" | "Declining";
export type POStatusLabel = "PO Now" | "Additional PO Required" | "PO Due Soon" | "No PO Required";
export type TransferStatus = "Transfer Required" | "Transfer Due Soon" | "No Georgia Stock" | "No Transfer Required";
export type TubeStatus = "Open Tube PO" | "No Tube PO Required";

export interface MonthProjection {
  month: string;
  projectedBurn: number;
  plannedDemand: number;
  inbound: number;
  closingStock: number;
}

export interface SkuPlan {
  sku: string;
  description: string;
  type: Sku["type"];
  brentwood: number;
  georgia: number;
  combined: number;
  burn7: number;
  burn14: number;
  burn30: number;
  projectionBurn: number;
  spike: boolean;
  lowStockException: boolean;
  salesTrend: SalesTrend;
  daysOfStockLeft: number | null;
  leadTimeDays: number;
  openPOQty: number;
  nextInboundEta: string | null;
  activePlannedQty: number;
  pastDuePlanned: PlannedSale[];
  /** First day projected cover falls below 135 days (null = not within horizon). */
  coverBreachDate: string | null;
  poOpenBy: string | null;
  recommendedQty: number;
  moqApplied: boolean;
  projectedCoverAtArrival: number | null;
  stockoutBeforeArrival: boolean;
  poStatus: POStatusLabel;
  reason: string;
  months: MonthProjection[];
  transfer: TransferPlan;
}

export interface TransferPlan {
  brentwoodDaysLeft: number | null;
  status: TransferStatus;
  minimumReferenceQty: number;
  projectedFloorDate: string | null;
}

export interface TubePlan {
  tubeSku: string;
  description: string;
  relatedFinishedGoods: string[];
  currentQty: number;
  inboundInTime: number;
  thresholdQty: number;
  fgRequirement: number;
  requiredBy: string | null;
  tubeOpenBy: string | null;
  leadTimeDays: number;
  calculatedQty: number;
  recommendedQty: number;
  moqApplied: boolean;
  status: TubeStatus;
  urgent: boolean;
}

export interface PlanningInput {
  asOf: string;
  skus: Sku[];
  stock: StockPosition[];
  sales: ActualSale[];
  plannedSales: PlannedSale[];
  purchaseOrders: PurchaseOrder[];
}

export interface PlanningResult {
  asOf: string;
  finishedGoods: SkuPlan[];
  tubes: TubePlan[];
}

const ACTIVE_PLANNED = new Set(["Confirmed", "Delayed"]);

export function isActivePlanned(p: PlannedSale): boolean {
  return ACTIVE_PLANNED.has(p.status);
}

export function burnOver(sales: ActualSale[], sku: string, asOf: string, days: number): number {
  const from = addDays(asOf, -days); // exclusive
  let total = 0;
  for (const s of sales) {
    if (s.sku === sku && s.date > from && s.date <= asOf) total += s.qty;
  }
  return total / days;
}

export function classifyTrend(burn14: number, burn30: number): SalesTrend {
  if (burn30 <= 0) return burn14 > 0 ? "Accelerating" : "Stable";
  const change = (burn14 - burn30) / burn30;
  if (change >= RULES.trendAccelerating) return "Accelerating";
  if (change <= RULES.trendDeclining) return "Declining";
  return "Stable";
}

function roundUp(qty: number): number {
  return Math.ceil(qty / RULES.roundTo) * RULES.roundTo;
}

export function remainingQty(po: PurchaseOrder): number {
  if (po.status !== "Open") return 0;
  return Math.max(0, po.orderedQty - po.receivedQty);
}

/** ETA used for projection: real ETA, else open date + lead time; overdue ETAs move to tomorrow. */
export function effectiveEta(po: PurchaseOrder, asOf: string): string {
  const eta = po.eta ?? addDays(po.openDate, po.leadTimeDays);
  return eta <= asOf ? addDays(asOf, 1) : eta;
}

interface DailySim {
  /** closing[d] = projected combined stock at end of day asOf+d (d = 0 is today's opening). Can be negative. */
  closing: number[];
  dailyPlanned: Map<number, number>;
  dailyInbound: Map<number, number>;
}

function simulate(
  start: number,
  burn: number,
  planned: { day: number; qty: number }[],
  inbound: { day: number; qty: number }[],
  days: number,
): DailySim {
  const dailyPlanned = new Map<number, number>();
  const dailyInbound = new Map<number, number>();
  for (const p of planned) dailyPlanned.set(p.day, (dailyPlanned.get(p.day) ?? 0) + p.qty);
  for (const i of inbound) dailyInbound.set(i.day, (dailyInbound.get(i.day) ?? 0) + i.qty);
  const closing: number[] = [start + (dailyInbound.get(0) ?? 0) - (dailyPlanned.get(0) ?? 0)];
  for (let d = 1; d <= days; d++) {
    const prev = closing[d - 1] ?? 0;
    closing.push(prev - burn - (dailyPlanned.get(d) ?? 0) + (dailyInbound.get(d) ?? 0));
  }
  return { closing, dailyPlanned, dailyInbound };
}

/** Planned demand in days (from, to] using the per-day map. */
function plannedBetween(map: Map<number, number>, fromExclusive: number, toInclusive: number): number {
  let t = 0;
  for (const [day, qty] of map) if (day > fromExclusive && day <= toInclusive) t += qty;
  return t;
}

export function planSku(input: PlanningInput, sku: Sku): SkuPlan {
  const { asOf } = input;
  const brentwood = input.stock.filter((s) => s.sku === sku.sku && s.location === "Brentwood").reduce((a, s) => a + s.qty, 0);
  const georgia = input.stock.filter((s) => s.sku === sku.sku && s.location === "Georgia").reduce((a, s) => a + s.qty, 0);
  const combined = brentwood + georgia;

  const burn7 = burnOver(input.sales, sku.sku, asOf, 7);
  const burn14 = burnOver(input.sales, sku.sku, asOf, 14);
  const burn30 = burnOver(input.sales, sku.sku, asOf, 30);
  const spike = burn30 > 0 && burn7 >= burn30 * (1 + RULES.spikeThreshold);
  const salesTrend = classifyTrend(burn14, burn30);

  const confirmedBurn = burn14 > 0 ? burn14 : burn30;
  // Low-stock exception: when a spike is already visible and stock would fall
  // inside the reorder floor plus lead time at the spike rate, plan on the spike
  // rate instead of waiting for 14-day confirmation.
  const lowStockException =
    spike && burn7 > 0 && combined / burn7 < RULES.reorderCoverDays + sku.leadTimeDays && burn7 > confirmedBurn;
  const projectionBurn = lowStockException ? burn7 : confirmedBurn;

  const openPOs = input.purchaseOrders.filter((p) => p.sku === sku.sku && remainingQty(p) > 0);
  const inbound = openPOs.map((p) => ({ day: daysBetween(asOf, effectiveEta(p, asOf)), qty: remainingQty(p), eta: effectiveEta(p, asOf) }));
  const openPOQty = inbound.reduce((a, i) => a + i.qty, 0);
  const nextInboundEta = inbound.map((i) => i.eta).sort()[0] ?? null;

  const skuPlanned = input.plannedSales.filter((p) => p.sku === sku.sku && isActivePlanned(p));
  const pastDuePlanned = skuPlanned.filter((p) => p.expectedDate < asOf);
  // Past-due active planned sales stay as demand today until reviewed (never auto-cancelled).
  const planned = skuPlanned.map((p) => ({ day: Math.max(0, daysBetween(asOf, p.expectedDate)), qty: p.qty }));
  const activePlannedQty = skuPlanned.reduce((a, p) => a + p.qty, 0);

  const simDays = RULES.horizonDays + RULES.reorderCoverDays + RULES.recommendedCoverDays + sku.leadTimeDays;
  const sim = simulate(combined, projectionBurn, planned, inbound, simDays);

  const requirement = (d: number) =>
    projectionBurn * RULES.reorderCoverDays + plannedBetween(sim.dailyPlanned, d, d + RULES.reorderCoverDays);

  let breachDay: number | null = null;
  if (projectionBurn > 0 || activePlannedQty > 0) {
    for (let d = 0; d <= RULES.horizonDays; d++) {
      const req = requirement(d);
      if (req > 0 && (sim.closing[d] ?? 0) <= req) {
        breachDay = d;
        break;
      }
    }
  }

  const daysOfStockLeft = projectionBurn > 0 ? Math.floor(combined / projectionBurn) : null;

  let poOpenBy: string | null = null;
  let poStatus: POStatusLabel = "No PO Required";
  let recommendedQty = 0;
  let moqApplied = false;
  let projectedCoverAtArrival: number | null = null;
  let stockoutBeforeArrival = false;
  let reason = "Projected cover stays above the 135-day floor for the next 12 months.";

  if (breachDay !== null) {
    const openByDay = breachDay - sku.leadTimeDays;
    poOpenBy = addDays(asOf, openByDay);
    const arrivalDay = Math.max(breachDay, sku.leadTimeDays);
    const stockAtArrival = sim.closing[arrivalDay] ?? 0;
    stockoutBeforeArrival = sim.closing.slice(0, arrivalDay + 1).some((v) => v < 0);
    projectedCoverAtArrival = projectionBurn > 0 ? Math.max(0, Math.floor(stockAtArrival / projectionBurn)) : null;

    if (openByDay <= RULES.poDueSoonDays) {
      const demand180 =
        projectionBurn * RULES.recommendedCoverDays +
        plannedBetween(sim.dailyPlanned, arrivalDay, arrivalDay + RULES.recommendedCoverDays);
      const backfill = Math.max(0, -stockAtArrival);
      const needed = roundUp(demand180 + backfill);
      recommendedQty = Math.max(needed, sku.moq);
      moqApplied = sku.moq > needed;
    }

    if (openByDay <= 0) {
      poStatus = openPOQty > 0 ? "Additional PO Required" : "PO Now";
      const parts = [
        `${daysOfStockLeft ?? "—"} days of stock left`,
        breachDay === 0 ? "135-day trigger breached" : `cover falls below 135 days on day ${breachDay}, inside the ${sku.leadTimeDays}-day lead time`,
      ];
      if (openPOQty > 0) parts.push("existing open PO does not restore required cover");
      if (lowStockException) parts.push("7-day spike: low-stock exception applied");
      if (activePlannedQty > 0) parts.push("includes known planned demand");
      reason = parts.join(" · ");
    } else if (openByDay <= RULES.poDueSoonDays) {
      poStatus = "PO Due Soon";
      reason = `PO must be opened within ${openByDay} days to protect the 135-day floor`;
    } else {
      reason = `Next PO needed by ${poOpenBy}`;
    }
  }

  const months = monthlyProjection(asOf, sim);
  const transfer = planTransfer(asOf, brentwood, georgia, projectionBurn);

  return {
    sku: sku.sku,
    description: sku.description,
    type: sku.type,
    brentwood,
    georgia,
    combined,
    burn7,
    burn14,
    burn30,
    projectionBurn,
    spike,
    lowStockException,
    salesTrend,
    daysOfStockLeft,
    leadTimeDays: sku.leadTimeDays,
    openPOQty,
    nextInboundEta,
    activePlannedQty,
    pastDuePlanned,
    coverBreachDate: breachDay === null ? null : addDays(asOf, breachDay),
    poOpenBy,
    recommendedQty,
    moqApplied,
    projectedCoverAtArrival,
    stockoutBeforeArrival,
    poStatus,
    reason,
    months,
    transfer,
  };
}

function monthlyProjection(asOf: string, sim: DailySim): MonthProjection[] {
  const keys = monthKeys(asOf, 12);
  const rows: MonthProjection[] = keys.map((k) => ({ month: k, projectedBurn: 0, plannedDemand: 0, inbound: 0, closingStock: 0 }));
  const index = new Map(keys.map((k, i) => [k, i]));
  const lastKey = keys[keys.length - 1] ?? "";
  for (let d = 0; d < sim.closing.length; d++) {
    const key = monthKey(addDays(asOf, d));
    if (key > lastKey) break;
    const row = rows[index.get(key) ?? -1];
    if (!row) continue;
    const prev = d === 0 ? null : (sim.closing[d - 1] ?? 0);
    const today = sim.closing[d] ?? 0;
    const planned = sim.dailyPlanned.get(d) ?? 0;
    const inbound = sim.dailyInbound.get(d) ?? 0;
    if (prev !== null) row.projectedBurn += prev - today - planned + inbound;
    row.plannedDemand += planned;
    row.inbound += inbound;
    row.closingStock = Math.max(0, Math.round(today));
  }
  for (const r of rows) r.projectedBurn = Math.round(r.projectedBurn);
  return rows;
}

export function planTransfer(asOf: string, brentwood: number, georgia: number, burn: number): TransferPlan {
  if (burn <= 0) return { brentwoodDaysLeft: null, status: "No Transfer Required", minimumReferenceQty: 0, projectedFloorDate: null };
  const days = Math.floor(brentwood / burn);
  const daysToFloor = Math.max(0, Math.floor((brentwood - burn * RULES.transferFloorDays) / burn));
  const projectedFloorDate = addDays(asOf, daysToFloor);
  const minimumReferenceQty = Math.min(georgia, Math.max(0, Math.ceil(burn * (RULES.transferFloorDays + 1) - brentwood)));
  let status: TransferStatus = "No Transfer Required";
  if (days <= RULES.transferFloorDays) status = georgia > 0 ? "Transfer Required" : "No Georgia Stock";
  else if (days <= RULES.transferFloorDays + RULES.transferLookaheadDays && georgia > 0) status = "Transfer Due Soon";
  return { brentwoodDaysLeft: days, status, minimumReferenceQty: status === "Transfer Required" ? minimumReferenceQty : 0, projectedFloorDate };
}

export function planTubes(input: PlanningInput, fg: SkuPlan[]): TubePlan[] {
  const { asOf } = input;
  const tubes = input.skus.filter((s) => s.type === "Empty Tube" && s.active);
  return tubes.map((t) => {
    const linkedFg = input.skus.filter((s) => s.cogsMethod === "Tube Fill" && s.linkedTubeSku === t.sku);
    const drivers = fg.filter(
      (p) => linkedFg.some((s) => s.sku === p.sku) && p.recommendedQty > 0 && p.poStatus !== "No PO Required",
    );
    const fgRequirement = drivers.reduce((a, p) => a + p.recommendedQty, 0);
    const requiredBy =
      drivers
        .map((p) => addDays(p.poOpenBy && p.poOpenBy > asOf ? p.poOpenBy : asOf, RULES.tubeNeededAfterFgPoDays))
        .sort()[0] ?? null;
    const currentQty = input.stock.filter((s) => s.sku === t.sku).reduce((a, s) => a + s.qty, 0);
    const cutoff = requiredBy ?? addDays(asOf, RULES.horizonDays);
    const inboundInTime = input.purchaseOrders
      .filter((p) => p.sku === t.sku && remainingQty(p) > 0 && effectiveEta(p, asOf) <= cutoff)
      .reduce((a, p) => a + remainingQty(p), 0);
    const calculatedQty = Math.max(0, fgRequirement + t.tubeThresholdQty - currentQty - inboundInTime);
    const recommendedQty = calculatedQty > 0 ? Math.max(calculatedQty, t.moq) : 0;
    const tubeOpenBy = recommendedQty > 0 ? addDays(requiredBy ?? asOf, -t.leadTimeDays) : null;
    return {
      tubeSku: t.sku,
      description: t.description,
      relatedFinishedGoods: linkedFg.map((s) => s.sku),
      currentQty,
      inboundInTime,
      thresholdQty: t.tubeThresholdQty,
      fgRequirement,
      requiredBy,
      tubeOpenBy,
      leadTimeDays: t.leadTimeDays,
      calculatedQty,
      recommendedQty,
      moqApplied: recommendedQty > calculatedQty,
      status: recommendedQty > 0 ? "Open Tube PO" : "No Tube PO Required",
      urgent: tubeOpenBy !== null && tubeOpenBy <= asOf,
    };
  });
}

export function runPlanning(input: PlanningInput): PlanningResult {
  const finishedGoods = input.skus
    .filter((s) => s.active && (s.type === "Finished Goods" || s.type === "Accessory"))
    .map((s) => planSku(input, s));
  return { asOf: input.asOf, finishedGoods, tubes: planTubes(input, finishedGoods) };
}
