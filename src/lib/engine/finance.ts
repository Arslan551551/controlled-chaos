// Finance engines: payment planner, cash flow outlook (QuickBooks bank),
// sales vs cash received, marketplace profitability with expense splits.

import { addDays, endOfMonth, monthKey, monthKeys, toDate } from "./dates.ts";
import type { PurchaseOrder, SalesChannel } from "./types.ts";

export const CHANNELS: SalesChannel[] = [
  "Amazon",
  "Shopify",
  "TikTok Shop",
  "Walmart",
  "Salon Direct",
  "Distributor",
];

// ---------------------------------------------------------------- vendors & payments

export interface Vendor {
  id: string;
  name: string;
  category:
    | "PO Supplier"
    | "Packaging"
    | "Logistics"
    | "Marketing"
    | "Software"
    | "Professional Services"
    | "Facilities"
    | "Other";
  paymentTerms: string;
  currency: "USD" | "CNY" | "EUR" | "GBP";
  contact: string;
  email: string;
  /** Which team maintains the vendor record. */
  maintainedBy: "Supply Chain" | "Finance";
  status: "Active" | "On Hold" | "Inactive";
}

export type PaymentStatus = "Planned" | "Approved" | "Paid";

export interface NonPOPayment {
  id: string;
  vendorId: string;
  category: string;
  description: string;
  amount: number;
  dueDate: string | null;
  status: PaymentStatus;
  enteredBy: "Supply Chain" | "Finance";
  recurring: "None" | "Monthly" | "Quarterly" | "Annual";
}

export interface PlannedPayment {
  id: string;
  source: "PO Installment" | "Non-PO" | "Payroll";
  reference: string;
  vendor: string;
  description: string;
  category: string;
  amount: number;
  dueDate: string | null;
  status: PaymentStatus;
}

export function plannedPayments(
  pos: PurchaseOrder[],
  nonPO: NonPOPayment[],
  vendors: Vendor[],
): PlannedPayment[] {
  const vendorName = (id: string) => vendors.find((v) => v.id === id)?.name ?? id;
  const fromPO: PlannedPayment[] = pos
    .filter((p) => p.status !== "Cancelled")
    .flatMap((p) =>
      p.installments.map((i, idx) => ({
        id: `${p.po}-${i.id}`,
        source: "PO Installment" as const,
        reference: `${p.po} · Payment ${idx + 1}`,
        vendor: p.supplier,
        description: `${p.type} PO ${p.sku}`,
        category: p.type === "Empty Tube" ? "Packaging" : "Inventory Purchase",
        amount: i.amount,
        dueDate: i.dueDate,
        status: (i.paid ? "Paid" : "Approved") as PaymentStatus,
      })),
    );
  const other: PlannedPayment[] = nonPO.map((n) => ({
    id: n.id,
    source: "Non-PO",
    reference: n.id,
    vendor: vendorName(n.vendorId),
    description: n.description,
    category: n.category,
    amount: n.amount,
    dueDate: n.dueDate,
    status: n.status,
  }));
  return [...fromPO, ...other].sort((a, b) =>
    (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
  );
}

export interface MonthlyPaymentPlan {
  month: string;
  total: number;
  poTotal: number;
  nonPoTotal: number;
  payrollTotal: number;
  items: PlannedPayment[];
}

/** Unpaid payments grouped by due month. TBD dates are returned separately. */
export function paymentPlanByMonth(payments: PlannedPayment[], asOf: string, months: number) {
  const keys = monthKeys(asOf, months);
  const unpaid = payments.filter((p) => p.status !== "Paid");
  const overdue = unpaid.filter((p) => p.dueDate !== null && p.dueDate < `${keys[0]}-01`);
  const plan: MonthlyPaymentPlan[] = keys.map((k) => {
    const items = unpaid.filter((p) => p.dueDate !== null && monthKey(p.dueDate) === k);
    const poTotal = items
      .filter((i) => i.source === "PO Installment")
      .reduce((a, i) => a + i.amount, 0);
    const nonPoTotal = items.filter((i) => i.source === "Non-PO").reduce((a, i) => a + i.amount, 0);
    const payrollTotal = items
      .filter((i) => i.source === "Payroll")
      .reduce((a, i) => a + i.amount, 0);
    return {
      month: k,
      total: poTotal + nonPoTotal + payrollTotal,
      poTotal,
      nonPoTotal,
      payrollTotal,
      items,
    };
  });
  const tbd = unpaid.filter((p) => p.dueDate === null);
  return { plan, tbd, overdue };
}

// ---------------------------------------------------------------- cash flow (QuickBooks)

export interface BankAccount {
  id: string;
  name: string;
  /** Balance as synced from QuickBooks. */
  balance: number;
  syncedAt: string;
}

export type CashInCategory =
  "Marketplace Payout" | "Salon / Distributor Receipt" | "Loan Receipt" | "Other Receipt";
export type CashOutCategory =
  | "PO Payment"
  | "Non-PO Payment"
  | "Subscription"
  | "Payroll"
  | "Loan Repayment"
  | "Tax"
  | "Other Payment";

export interface CashForecastLine {
  id: string;
  date: string;
  direction: "in" | "out";
  category: CashInCategory | CashOutCategory;
  description: string;
  amount: number;
  source:
    | "Payment Planner"
    | "QuickBooks AR"
    | "Payout Forecast"
    | "Loan Schedule"
    | "Subscriptions"
    | "Payroll file"
    | "Manual";
}

export interface CashFlowMonth {
  month: string;
  opening: number;
  paymentsOut: number;
  salesIn: number;
  loanIn: number;
  otherIn: number;
  closing: number;
  outByCategory: Record<string, number>;
  inByCategory: Record<string, number>;
  lines: CashForecastLine[];
}

/** Opening (QuickBooks bank) − cash out + sales receipts in + loan receipts in = month-end cash. */
export function cashFlowOutlook(
  accounts: BankAccount[],
  lines: CashForecastLine[],
  asOf: string,
  months = 3,
): CashFlowMonth[] {
  let opening = accounts.reduce((a, b) => a + b.balance, 0);
  return monthKeys(asOf, months).map((k, i) => {
    const from = i === 0 ? asOf : `${k}-01`;
    const to = endOfMonth(`${k}-01`);
    const inMonth = lines.filter((l) => l.date >= from && l.date <= to);
    const sum = (f: (l: CashForecastLine) => boolean) =>
      inMonth.filter(f).reduce((a, l) => a + l.amount, 0);
    const paymentsOut = sum((l) => l.direction === "out");
    const salesIn = sum(
      (l) => l.category === "Marketplace Payout" || l.category === "Salon / Distributor Receipt",
    );
    const loanIn = sum((l) => l.category === "Loan Receipt");
    const otherIn = sum((l) => l.category === "Other Receipt");
    const outByCategory: Record<string, number> = {};
    const inByCategory: Record<string, number> = {};
    for (const l of inMonth) {
      const bucket = l.direction === "out" ? outByCategory : inByCategory;
      bucket[l.category] = (bucket[l.category] ?? 0) + l.amount;
    }
    const closing = opening - paymentsOut + salesIn + loanIn + otherIn;
    const row: CashFlowMonth = {
      month: k,
      opening,
      paymentsOut,
      salesIn,
      loanIn,
      otherIn,
      closing,
      outByCategory,
      inByCategory,
      lines: inMonth,
    };
    opening = closing;
    return row;
  });
}

export interface CashFlowWeek {
  /** Monday of the week (ISO). The first week starts at asOf. */
  weekStart: string;
  weekEnd: string;
  opening: number;
  paymentsOut: number;
  receiptsIn: number;
  closing: number;
  outByCategory: Record<string, number>;
  inByCategory: Record<string, number>;
  lines: CashForecastLine[];
}

/** Monday (ISO) of the week containing `iso`. */
export function weekMonday(iso: string): string {
  const dow = toDate(iso).getUTCDay(); // 0 = Sunday
  return addDays(iso, -((dow + 6) % 7));
}

/**
 * Week-by-week cash schedule (Mon–Sun): what has to be paid each week,
 * what comes in, and what is left in the bank after the week.
 * Week 1 runs from asOf to that Sunday. Lines dated before asOf are ignored.
 */
export function weeklyCash(
  accounts: BankAccount[],
  lines: CashForecastLine[],
  asOf: string,
  weeks = 8,
): CashFlowWeek[] {
  let opening = accounts.reduce((a, b) => a + b.balance, 0);
  const firstMonday = weekMonday(asOf);
  const out: CashFlowWeek[] = [];
  for (let w = 0; w < weeks; w++) {
    const monday = addDays(firstMonday, w * 7);
    const weekStart = w === 0 ? asOf : monday;
    const weekEnd = addDays(monday, 6);
    const inWeek = lines.filter((l) => l.date >= weekStart && l.date <= weekEnd);
    const outByCategory: Record<string, number> = {};
    const inByCategory: Record<string, number> = {};
    let paymentsOut = 0;
    let receiptsIn = 0;
    for (const l of inWeek) {
      if (l.direction === "out") {
        paymentsOut += l.amount;
        outByCategory[l.category] = (outByCategory[l.category] ?? 0) + l.amount;
      } else {
        receiptsIn += l.amount;
        inByCategory[l.category] = (inByCategory[l.category] ?? 0) + l.amount;
      }
    }
    const closing = opening - paymentsOut + receiptsIn;
    out.push({
      weekStart,
      weekEnd,
      opening,
      paymentsOut,
      receiptsIn,
      closing,
      outByCategory,
      inByCategory,
      lines: inWeek,
    });
    opening = closing;
  }
  return out;
}

// ---------------------------------------------------------------- expected vs actual cash

/** A real bank movement from the QuickBooks bank feed. */
export interface BankMovement {
  id: string;
  date: string;
  direction: "in" | "out";
  category: CashInCategory | CashOutCategory;
  description: string;
  amount: number;
  /** The expected line this movement settles (matched on sync); null = not planned. */
  matchedTo: string | null;
}

export type CashLineStatus =
  | "Received"
  | "Paid"
  | "Partly received"
  | "Received more"
  | "Paid more"
  | "Paid less"
  | "Late"
  | "Unplanned"
  | "Expected";

export interface CashCompareLine {
  id: string;
  direction: "in" | "out";
  category: string;
  description: string;
  expectedDate: string | null;
  expected: number;
  actualDate: string | null;
  actual: number;
  /** actual − expected (positive = more money than planned moved). */
  difference: number;
  status: CashLineStatus;
}

export interface CashCompareWeek {
  weekStart: string;
  weekEnd: string;
  kind: "past" | "current" | "future";
  expectedIn: number;
  actualIn: number;
  expectedOut: number;
  actualOut: number;
  /** Bank balance at the end of the week: real for past weeks, projected for the rest. */
  closing: number;
  closingIsActual: boolean;
  lines: CashCompareLine[];
}

const TOLERANCE = 0.01;

function compareStatus(
  direction: "in" | "out",
  expected: number,
  actual: number,
  hasActual: boolean,
  expectedDate: string | null,
  asOf: string,
): CashLineStatus {
  if (!expectedDate) return "Unplanned";
  if (!hasActual) return expectedDate < asOf ? "Late" : "Expected";
  const diff = actual - expected;
  if (Math.abs(diff) <= Math.max(1, expected * TOLERANCE))
    return direction === "in" ? "Received" : "Paid";
  if (direction === "in") return diff < 0 ? "Partly received" : "Received more";
  return diff > 0 ? "Paid more" : "Paid less";
}

/**
 * Week by week (Mon–Sun): what we expected to come in and go out, what really did
 * (QuickBooks bank), and the difference. `expected` holds the plan for past weeks
 * (the forecast as it stood) and for the coming weeks; `actual` holds bank movements.
 */
export function cashExpectedVsActual(
  bankBalanceNow: number,
  expected: CashForecastLine[],
  actual: BankMovement[],
  asOf: string,
  weeksBack = 4,
  weeksAhead = 8,
): CashCompareWeek[] {
  const thisMonday = weekMonday(asOf);
  const firstMonday = addDays(thisMonday, -7 * weeksBack);
  const lines: CashCompareLine[] = [];
  for (const e of expected) {
    const matched = actual.filter((a) => a.matchedTo === e.id);
    const amt = matched.reduce((x, a) => x + a.amount, 0);
    const date = matched.map((a) => a.date).sort()[0] ?? null;
    lines.push({
      id: e.id,
      direction: e.direction,
      category: e.category,
      description: e.description,
      expectedDate: e.date,
      expected: e.amount,
      actualDate: date,
      actual: amt,
      difference: matched.length ? amt - e.amount : 0,
      status: compareStatus(e.direction, e.amount, amt, matched.length > 0, e.date, asOf),
    });
  }
  const known = new Set(expected.map((e) => e.id));
  for (const a of actual.filter((x) => !x.matchedTo || !known.has(x.matchedTo)))
    lines.push({
      id: a.id,
      direction: a.direction,
      category: a.category,
      description: a.description,
      expectedDate: null,
      expected: 0,
      actualDate: a.date,
      actual: a.amount,
      difference: a.amount,
      status: "Unplanned",
    });

  const net = (m: BankMovement) => (m.direction === "in" ? m.amount : -m.amount);
  const weeks: CashCompareWeek[] = [];
  let projected = bankBalanceNow;
  for (let w = 0; w < weeksBack + weeksAhead; w++) {
    const weekStart = addDays(firstMonday, w * 7);
    const weekEnd = addDays(weekStart, 6);
    const kind = weekStart === thisMonday ? "current" : weekStart < thisMonday ? "past" : "future";
    const inWeek = lines.filter((l) => {
      const d = l.expectedDate ?? l.actualDate!;
      return d >= weekStart && d <= weekEnd;
    });
    const sumBy = (dir: "in" | "out", f: (l: CashCompareLine) => number) =>
      inWeek.filter((l) => l.direction === dir).reduce((x, l) => x + f(l), 0);
    const week: CashCompareWeek = {
      weekStart,
      weekEnd,
      kind,
      expectedIn: sumBy("in", (l) => l.expected),
      actualIn: sumBy("in", (l) => l.actual),
      expectedOut: sumBy("out", (l) => l.expected),
      actualOut: sumBy("out", (l) => l.actual),
      closing: 0,
      closingIsActual: kind === "past",
      lines: inWeek.sort((a, b) =>
        (a.expectedDate ?? a.actualDate!).localeCompare(b.expectedDate ?? b.actualDate!),
      ),
    };
    if (kind === "past") {
      // Real balance: today's bank balance minus everything that moved after this week.
      week.closing =
        bankBalanceNow -
        actual.filter((m) => m.date > weekEnd && m.date <= asOf).reduce((x, m) => x + net(m), 0);
    } else {
      // From today on: plan for what hasn't happened yet (late items are assumed to land now).
      const carried =
        kind === "current"
          ? lines.filter(
              (l) =>
                l.status === "Late" &&
                l.expectedDate! < weekStart &&
                l.expectedDate! >= firstMonday,
            )
          : [];
      const pending = [...inWeek, ...carried].filter(
        (l) => l.status === "Expected" || l.status === "Late",
      );
      projected += pending.reduce(
        (x, l) => x + (l.direction === "in" ? l.expected : -l.expected),
        0,
      );
      week.closing = projected;
    }
    weeks.push(week);
  }
  return weeks;
}

// ---------------------------------------------------------------- sales vs cash received

export interface ChannelSales {
  channel: SalesChannel;
  month: string;
  grossSales: number;
  refunds: number;
  platformFees: number;
  /** Net amount the business should receive = gross − refunds − fees withheld by the platform. */
  expectedNet: number;
}

export interface CashReceipt {
  id: string;
  channel: SalesChannel;
  date: string;
  amount: number;
  reference: string;
  /** Which sales month the receipt settles (from the payout/settlement report). */
  settlesMonth: string;
}

export interface SalesVsCashRow {
  channel: SalesChannel;
  grossSales: number;
  expectedNet: number;
  received: number;
  outstanding: number;
  collectedPct: number;
}

export function salesVsCash(
  sales: ChannelSales[],
  receipts: CashReceipt[],
  months: string[],
): SalesVsCashRow[] {
  return CHANNELS.map((channel) => {
    const s = sales.filter((x) => x.channel === channel && months.includes(x.month));
    const r = receipts.filter((x) => x.channel === channel && months.includes(x.settlesMonth));
    const grossSales = s.reduce((a, x) => a + x.grossSales, 0);
    const expectedNet = s.reduce((a, x) => a + x.expectedNet, 0);
    const received = r.reduce((a, x) => a + x.amount, 0);
    return {
      channel,
      grossSales,
      expectedNet,
      received,
      outstanding: expectedNet - received,
      collectedPct: expectedNet > 0 ? received / expectedNet : 0,
    };
  });
}

// ---------------------------------------------------------------- profitability

export interface Expense {
  id: string;
  date: string;
  vendor: string;
  category: string;
  description: string;
  amount: number;
  /** Percentage split by channel (must total 100). null = not yet split. */
  allocation: Partial<Record<SalesChannel, number>> | null;
  source: "QuickBooks" | "Manual";
}

export function allocationTotal(a: Expense["allocation"]): number {
  if (!a) return 0;
  return Object.values(a).reduce((s, v) => s + (v ?? 0), 0);
}

export function isValidAllocation(a: Expense["allocation"]): boolean {
  return (
    a !== null &&
    Math.abs(allocationTotal(a) - 100) < 0.001 &&
    Object.values(a).every((v) => (v ?? 0) >= 0)
  );
}

export interface ChannelCosts {
  channel: SalesChannel;
  month: string;
  unitsSold: number;
  cogs: number;
  fulfillment: number;
  adSpend: number;
}

export interface ProfitRow {
  channel: SalesChannel;
  revenue: number;
  refunds: number;
  netRevenue: number;
  platformFees: number;
  cogs: number;
  grossProfit: number;
  fulfillment: number;
  adSpend: number;
  contribution: number;
  allocatedExpenses: number;
  netProfit: number;
  netMarginPct: number;
}

export function profitability(
  sales: ChannelSales[],
  costs: ChannelCosts[],
  expenses: Expense[],
  months: string[],
): { rows: ProfitRow[]; unallocated: Expense[] } {
  const rows = CHANNELS.map((channel) => {
    const s = sales.filter((x) => x.channel === channel && months.includes(x.month));
    const c = costs.filter((x) => x.channel === channel && months.includes(x.month));
    const revenue = s.reduce((a, x) => a + x.grossSales, 0);
    const refunds = s.reduce((a, x) => a + x.refunds, 0);
    const platformFees = s.reduce((a, x) => a + x.platformFees, 0);
    const cogs = c.reduce((a, x) => a + x.cogs, 0);
    const fulfillment = c.reduce((a, x) => a + x.fulfillment, 0);
    const adSpend = c.reduce((a, x) => a + x.adSpend, 0);
    const allocatedExpenses = expenses
      .filter((e) => isValidAllocation(e.allocation) && months.includes(monthKey(e.date)))
      .reduce((a, e) => a + (e.amount * (e.allocation?.[channel] ?? 0)) / 100, 0);
    const netRevenue = revenue - refunds;
    const grossProfit = netRevenue - platformFees - cogs;
    const contribution = grossProfit - fulfillment - adSpend;
    const netProfit = contribution - allocatedExpenses;
    return {
      channel,
      revenue,
      refunds,
      netRevenue,
      platformFees,
      cogs,
      grossProfit,
      fulfillment,
      adSpend,
      contribution,
      allocatedExpenses,
      netProfit,
      netMarginPct: netRevenue > 0 ? netProfit / netRevenue : 0,
    };
  });
  const unallocated = expenses.filter(
    (e) => months.includes(monthKey(e.date)) && !isValidAllocation(e.allocation),
  );
  return { rows, unallocated };
}
