// AR & Collections: what customers owe us (QuickBooks open invoices) and
// internal reminders to the people who manage each account — never the customer.

import { addDays, daysBetween } from "./dates.ts";

export type CustomerType = "Distributor" | "Salon" | "Wholesale";

export interface ArInvoice {
  id: string;
  customerId: string;
  customerName: string;
  customerType: CustomerType;
  /** Internal person who manages the account. */
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  date: string;
  dueDate: string;
  amount: number;
  paid: number;
  currency: "USD" | "EUR" | "GBP";
  /** 1 unit of currency in USD. */
  fxToUsd: number;
}

export type AgingBucket = "Current" | "1–30" | "31–60" | "61–90" | "90+";
export const BUCKETS: AgingBucket[] = ["Current", "1–30", "31–60", "61–90", "90+"];

export function openAmount(i: ArInvoice): number {
  return Math.max(0, Math.round((i.amount - i.paid) * 100) / 100);
}

export function openUsd(i: ArInvoice): number {
  return Math.round(openAmount(i) * i.fxToUsd * 100) / 100;
}

export function daysOverdue(i: ArInvoice, asOf: string): number {
  return Math.max(0, daysBetween(i.dueDate, asOf));
}

export function bucketOf(i: ArInvoice, asOf: string): AgingBucket {
  const late = daysBetween(i.dueDate, asOf);
  if (late <= 0) return "Current";
  if (late <= 30) return "1–30";
  if (late <= 60) return "31–60";
  if (late <= 90) return "61–90";
  return "90+";
}

export type BucketTotals = Record<AgingBucket, number>;

export function emptyBuckets(): BucketTotals {
  return { Current: 0, "1–30": 0, "31–60": 0, "61–90": 0, "90+": 0 };
}

export interface ArGroupRow {
  key: string;
  label: string;
  type: CustomerType | null;
  ownerName: string;
  invoices: number;
  open: number;
  overdue: number;
  buckets: BucketTotals;
  oldestDaysOverdue: number;
}

/** Aging grouped by any key (customer, owner, type). All amounts in USD. */
export function agingBy(invoices: ArInvoice[], asOf: string, keyOf: (i: ArInvoice) => { key: string; label: string; type: CustomerType | null; ownerName: string }): ArGroupRow[] {
  const map = new Map<string, ArGroupRow>();
  for (const inv of invoices) {
    const open = openUsd(inv);
    if (open <= 0) continue;
    const k = keyOf(inv);
    const row = map.get(k.key) ?? { ...k, invoices: 0, open: 0, overdue: 0, buckets: emptyBuckets(), oldestDaysOverdue: 0 };
    const b = bucketOf(inv, asOf);
    row.invoices += 1;
    row.open = round2(row.open + open);
    if (b !== "Current") row.overdue = round2(row.overdue + open);
    row.buckets[b] = round2(row.buckets[b] + open);
    row.oldestDaysOverdue = Math.max(row.oldestDaysOverdue, daysOverdue(inv, asOf));
    map.set(k.key, row);
  }
  return [...map.values()].sort((a, b) => b.overdue - a.overdue || b.open - a.open);
}

export function arPosition(invoices: ArInvoice[], asOf: string) {
  const buckets = emptyBuckets();
  let open = 0;
  for (const inv of invoices) {
    const o = openUsd(inv);
    if (o <= 0) continue;
    open += o;
    const b = bucketOf(inv, asOf);
    buckets[b] = round2(buckets[b] + o);
  }
  open = round2(open);
  const overdue = round2(open - buckets.Current);
  const over60 = round2(buckets["61–90"] + buckets["90+"]);
  return { open, overdue, over60, buckets };
}

/**
 * DSO-style metric: open AR ÷ invoiced in the last `days` days × `days`.
 * Uses invoice totals in USD.
 */
export function dso(invoices: ArInvoice[], asOf: string, days = 90): number {
  const from = addDays(asOf, -days);
  const billed = invoices.filter((i) => i.date > from && i.date <= asOf).reduce((a, i) => a + i.amount * i.fxToUsd, 0);
  if (billed <= 0) return 0;
  const open = invoices.reduce((a, i) => a + openUsd(i), 0);
  return Math.round((open / billed) * days);
}

// ---------------------------------------------------------------- reminders

export interface ReminderRules {
  /** Remind the owner this many days before the due date (0 = off). */
  daysBeforeDue: number;
  onDueDate: boolean;
  /** Repeat every N days while overdue (0 = off). */
  overdueEveryDays: number;
  /** Copy Director Finance when this many days overdue. */
  escalateFinanceAt: number;
  /** Copy the CEO when this many days overdue. */
  escalateCeoAt: number;
  financeEmail: string;
  ceoEmail: string;
}

export interface ReminderLogEntry {
  invoiceId: string;
  sentOn: string;
  kind: ReminderKind;
  to: string;
}

export type ReminderKind = "Before due" | "Due today" | "Overdue";

export interface Reminder {
  id: string;
  invoiceId: string;
  kind: ReminderKind;
  to: string;
  cc: string[];
  subject: string;
  body: string;
  customerName: string;
  ownerName: string;
  amountUsd: number;
  daysOverdue: number;
}

/**
 * Reminders due today. Recipients are always internal (account owner, plus
 * Finance / CEO escalation) — the customer is never a recipient.
 */
export function generateReminders(invoices: ArInvoice[], rules: ReminderRules, asOf: string, log: ReminderLogEntry[]): Reminder[] {
  const out: Reminder[] = [];
  for (const inv of invoices) {
    const open = openAmount(inv);
    if (open <= 0) continue;
    const toDue = daysBetween(asOf, inv.dueDate); // positive = days until due
    const late = -toDue;
    let kind: ReminderKind | null = null;
    if (rules.daysBeforeDue > 0 && toDue === rules.daysBeforeDue) kind = "Before due";
    else if (rules.onDueDate && toDue === 0) kind = "Due today";
    else if (late > 0 && rules.overdueEveryDays > 0) {
      const sent = log.filter((l) => l.invoiceId === inv.id && l.kind === "Overdue").map((l) => l.sentOn).sort();
      const last = sent[sent.length - 1];
      if (!last || daysBetween(last, asOf) >= rules.overdueEveryDays) kind = "Overdue";
    }
    if (!kind) continue;
    if (kind !== "Overdue" && log.some((l) => l.invoiceId === inv.id && l.kind === kind)) continue;
    const cc: string[] = [];
    if (late >= rules.escalateFinanceAt && rules.financeEmail !== inv.ownerEmail) cc.push(rules.financeEmail);
    if (late >= rules.escalateCeoAt) cc.push(rules.ceoEmail);
    const amountUsd = openUsd(inv);
    const money = `${inv.currency === "USD" ? "$" : inv.currency + " "}${open.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const when = kind === "Before due" ? `is due in ${toDue} days (${inv.dueDate})` : kind === "Due today" ? `is due today (${inv.dueDate})` : `is ${late} days overdue (due ${inv.dueDate})`;
    out.push({
      id: `${inv.id}-${kind}-${asOf}`,
      invoiceId: inv.id,
      kind,
      to: inv.ownerEmail,
      cc,
      subject: `[AR ${kind}] ${inv.customerName} – invoice ${inv.id} – ${money}`,
      body: [
        `Hi ${inv.ownerName},`,
        "",
        `${inv.customerName} (${inv.customerType}) has ${money} open on invoice ${inv.id}, which ${when}.`,
        "Please follow up with the customer and update Finance on the expected payment date.",
        cc.length ? `Escalated to: ${cc.join(", ")}.` : "",
        "",
        "This is an internal reminder from the Controlled Chaos portal. It was not sent to the customer.",
      ].filter((s, i, a) => !(s === "" && a[i - 1] === "")).join("\n"),
      customerName: inv.customerName,
      ownerName: inv.ownerName,
      amountUsd,
      daysOverdue: Math.max(0, late),
    });
  }
  return out.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
