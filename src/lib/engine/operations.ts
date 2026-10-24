// Operations engines: physical stock count reconciliation and
// tool / subscription detection from QuickBooks bank & card charges.

import { monthKey } from "./dates.ts";
import type { Location } from "./types.ts";

// ---------------------------------------------------------------- stock count

export interface StockCountLine {
  sku: string;
  countedQty: number;
  /** ShipStation quantity captured at the count date/time. */
  systemQty: number;
}

export type StockCountStatus = "Draft" | "Sent to Finance" | "Adjusted in ShipStation";

export interface StockCount {
  id: string;
  countedAt: string; // ISO date-time "2026-10-20T14:30"
  location: Location;
  countedBy: string;
  lines: StockCountLine[];
  status: StockCountStatus;
  notes: string;
  adjustedBy: string | null;
  adjustedAt: string | null;
}

export const VARIANCE_REVIEW_PCT = 0.02;

export interface VarianceLine extends StockCountLine {
  variance: number;
  variancePct: number;
  valueImpact: number;
  needsReview: boolean;
}

export function countVariances(count: StockCount, unitCost: (sku: string) => number): VarianceLine[] {
  return count.lines.map((l) => {
    const variance = l.countedQty - l.systemQty;
    const variancePct = l.systemQty > 0 ? variance / l.systemQty : l.countedQty > 0 ? 1 : 0;
    return {
      ...l,
      variance,
      variancePct,
      valueImpact: Math.round(variance * unitCost(l.sku) * 100) / 100,
      needsReview: Math.abs(variancePct) >= VARIANCE_REVIEW_PCT,
    };
  });
}

/** The email Finance receives when a count is sent. Queued in the outbox; sent via Gmail later. */
export function varianceEmail(count: StockCount, lines: VarianceLine[], financeEmail: string) {
  const changed = lines.filter((l) => l.variance !== 0);
  const body = [
    `Physical stock count at ${count.location} on ${count.countedAt.replace("T", " ")} by ${count.countedBy}.`,
    "",
    changed.length === 0
      ? "All counted SKUs match ShipStation. No adjustment needed."
      : "Please adjust ShipStation for these differences:",
    ...changed.map((l) => `• ${l.sku}: counted ${l.countedQty}, ShipStation ${l.systemQty}, difference ${l.variance > 0 ? "+" : ""}${l.variance}`),
    "",
    count.notes ? `Warehouse notes: ${count.notes}` : "",
  ].filter((s, i, a) => !(s === "" && a[i - 1] === ""));
  return {
    to: financeEmail,
    subject: `Stock count variance – ${count.location} – ${count.countedAt.slice(0, 10)} (${changed.length} SKU${changed.length === 1 ? "" : "s"})`,
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
export function detectSubscriptions(transactions: BankTransaction[], register: Subscription[]): DetectedSubscription[] {
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
    const monthlyCost = matched ? (matched.billingCycle === "Annual" ? matched.cost / 12 : matched.cost) : 0;
    const finding: DetectedSubscription["finding"] = !matched
      ? "Not registered"
      : last.amount > monthlyCost * 1.05
        ? "Price increase"
        : "Matches register";
    out.push({ merchant, charges: sorted, months, averageAmount: avg, lastAmount: last.amount, lastDate: last.date, matched, finding });
  }
  return out.sort((a, b) => a.finding.localeCompare(b.finding) || b.lastAmount - a.lastAmount);
}

export function monthlyCost(s: Subscription): number {
  return s.billingCycle === "Annual" ? s.cost / 12 : s.cost;
}
