// Operations engines: physical stock count reconciliation and
// tool / subscription detection from QuickBooks bank & card charges.

import { monthKey } from "./dates.ts";
import type { Location } from "./types.ts";

// ---------------------------------------------------------------- stock count
// Modelled on "Physical Stock Counting.xlsx": one sheet per month and location,
// every active SKU listed by burn (fastest first), each line counted on its own
// date/time as No. of Boxes × Units/Box (+ loose units), compared with the
// ShipStation quantity captured at that moment.

export type CountSheetStatus = "In Progress" | "Sent to Finance" | "Adjusted in ShipStation";

export interface CountSheetLine {
  sku: string;
  /** ISO date-time "2026-10-20T09:30" when this SKU was counted. */
  countedAt: string | null;
  boxes: number | null;
  unitsPerBox: number;
  looseUnits: number | null;
  /** ShipStation quantity captured at countedAt. */
  systemQty: number | null;
  counter: string | null;
}

export interface CountSheet {
  id: string;
  month: string; // "2026-10"
  location: Location;
  status: CountSheetStatus;
  lines: CountSheetLine[];
  notes: string;
  sentAt: string | null;
  adjustedBy: string | null;
  adjustedAt: string | null;
}

export const VARIANCE_REVIEW_PCT = 0.02;

/** Boxes × units/box + loose units; null when nothing entered yet. */
export function countedTotal(l: CountSheetLine): number | null {
  if (l.boxes === null && l.looseUnits === null) return null;
  return (l.boxes ?? 0) * l.unitsPerBox + (l.looseUnits ?? 0);
}

export function isCounted(l: CountSheetLine): boolean {
  return l.countedAt !== null && countedTotal(l) !== null;
}

export function sheetProgress(sheet: CountSheet) {
  const counted = sheet.lines.filter(isCounted).length;
  return {
    counted,
    total: sheet.lines.length,
    pct: sheet.lines.length ? counted / sheet.lines.length : 0,
  };
}

/** Units/box looks wrong: over 1,000, or more than 3× away from the SKU master value. */
export function unitsPerBoxAnomaly(lineUnits: number, masterUnits: number): boolean {
  if (lineUnits > 1000) return true;
  if (
    masterUnits > 0 &&
    lineUnits > 0 &&
    (lineUnits > masterUnits * 3 || lineUnits * 3 < masterUnits)
  )
    return true;
  return false;
}

export interface SheetVarianceLine extends CountSheetLine {
  counted: number | null;
  variance: number | null;
  variancePct: number | null;
  valueImpact: number | null;
  needsReview: boolean;
  anomaly: boolean;
}

export function sheetVariances(
  sheet: CountSheet,
  unitCost: (sku: string) => number,
  masterUnitsPerBox: (sku: string) => number,
): SheetVarianceLine[] {
  return sheet.lines.map((l) => {
    const counted = isCounted(l) ? countedTotal(l) : null;
    const anomaly = l.boxes !== null && unitsPerBoxAnomaly(l.unitsPerBox, masterUnitsPerBox(l.sku));
    if (counted === null || l.systemQty === null) {
      return {
        ...l,
        counted,
        variance: null,
        variancePct: null,
        valueImpact: null,
        needsReview: false,
        anomaly,
      };
    }
    const variance = counted - l.systemQty;
    const variancePct = l.systemQty > 0 ? variance / l.systemQty : counted > 0 ? 1 : 0;
    return {
      ...l,
      counted,
      variance,
      variancePct,
      valueImpact: Math.round(variance * unitCost(l.sku) * 100) / 100,
      needsReview: Math.abs(variancePct) >= VARIANCE_REVIEW_PCT,
      anomaly,
    };
  });
}

/** Builds a new sheet: SKUs sorted by burn, fastest first (like the Excel). */
export function newCountSheet(
  id: string,
  month: string,
  location: Location,
  skus: { sku: string; unitsPerBox: number; burnPerDay: number }[],
): CountSheet {
  const lines = [...skus]
    .sort((a, b) => b.burnPerDay - a.burnPerDay || a.sku.localeCompare(b.sku))
    .map((s) => ({
      sku: s.sku,
      countedAt: null,
      boxes: null,
      unitsPerBox: s.unitsPerBox,
      looseUnits: null,
      systemQty: null,
      counter: null,
    }));
  return {
    id,
    month,
    location,
    status: "In Progress",
    lines,
    notes: "",
    sentAt: null,
    adjustedBy: null,
    adjustedAt: null,
  };
}

/** The email Finance receives. Queued in the outbox; sent via Gmail later. Only counted lines with a difference. */
export function varianceEmail(sheet: CountSheet, lines: SheetVarianceLine[], financeEmail: string) {
  const changed = lines.filter((l) => l.variance !== null && l.variance !== 0);
  const counted = lines.filter((l) => l.counted !== null).length;
  const body = [
    `Physical stock count – ${sheet.location} – ${sheet.month} (${counted} of ${lines.length} SKUs counted).`,
    "",
    changed.length === 0
      ? "All counted SKUs match ShipStation. No adjustment needed."
      : "Please adjust ShipStation for these differences:",
    ...changed.map(
      (l) =>
        `• ${l.sku} (counted ${l.countedAt?.replace("T", " ") ?? ""} by ${l.counter ?? "warehouse"}): counted ${l.counted}, ShipStation ${l.systemQty}, difference ${(l.variance ?? 0) > 0 ? "+" : ""}${l.variance}`,
    ),
    "",
    sheet.notes ? `Warehouse notes: ${sheet.notes}` : "",
  ].filter((s, i, a) => !(s === "" && a[i - 1] === ""));
  return {
    to: financeEmail,
    subject: `Stock count variance – ${sheet.location} – ${sheet.month} (${changed.length} SKU${changed.length === 1 ? "" : "s"})`,
    body: body.join("\n"),
  };
}

// ---------------------------------------------------------------- subscriptions

export interface Subscription {
  id: string;
  tool: string;
  /** Merchant name as it appears on bank/card charges. */
  merchantMatch: string;
  department: string;
  owner: string;
  category: string;
  billingCycle: "Monthly" | "Annual";
  cost: number;
  nextRenewal: string;
  seats: number;
  seatsUsed: number;
  status: "Active" | "Cancel Requested" | "Cancelled";
}

export interface BankTransaction {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  account: string;
}

export function normalizeMerchant(m: string): string {
  return m
    .toUpperCase()
    .replace(/\*.*$/, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\b(INC|LLC|LTD|COM|HTTPS?|WWW)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface DetectedSubscription {
  merchant: string;
  charges: BankTransaction[];
  months: number;
  averageAmount: number;
  lastAmount: number;
  lastDate: string;
  matched: Subscription | null;
  finding: "Not registered" | "Price increase" | "Matches register";
}

/**
 * Finds recurring merchants: charged in 2+ different months with amounts
 * within 15% of their average. Unregistered ones need an owner; registered
 * ones are checked for price increases (> 5% above the register cost).
 */
export function detectSubscriptions(
  transactions: BankTransaction[],
  register: Subscription[],
): DetectedSubscription[] {
  const groups = new Map<string, BankTransaction[]>();
  for (const t of transactions) {
    const key = normalizeMerchant(t.merchant);
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const out: DetectedSubscription[] = [];
  for (const [merchant, charges] of groups) {
    const months = new Set(charges.map((c) => monthKey(c.date))).size;
    if (months < 2) continue;
    const avg = charges.reduce((a, c) => a + c.amount, 0) / charges.length;
    if (!charges.every((c) => Math.abs(c.amount - avg) <= avg * 0.15)) continue;
    const sorted = [...charges].sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted[sorted.length - 1]!;
    const matched = register.find((s) => normalizeMerchant(s.merchantMatch) === merchant) ?? null;
    const monthlyCost = matched
      ? matched.billingCycle === "Annual"
        ? matched.cost / 12
        : matched.cost
      : 0;
    const finding: DetectedSubscription["finding"] = !matched
      ? "Not registered"
      : last.amount > monthlyCost * 1.05
        ? "Price increase"
        : "Matches register";
    out.push({
      merchant,
      charges: sorted,
      months,
      averageAmount: avg,
      lastAmount: last.amount,
      lastDate: last.date,
      matched,
      finding,
    });
  }
  return out.sort((a, b) => a.finding.localeCompare(b.finding) || b.lastAmount - a.lastAmount);
}

export function monthlyCost(s: Subscription): number {
  return s.billingCycle === "Annual" ? s.cost / 12 : s.cost;
}
