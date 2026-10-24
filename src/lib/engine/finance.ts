// Finance engines: payment planner, cash flow outlook (QuickBooks bank),
// sales vs cash received, marketplace profitability with expense splits.

import { endOfMonth, monthKey, monthKeys } from "./dates.ts";
import type { PurchaseOrder, SalesChannel } from "./types.ts";

export const CHANNELS: SalesChannel[] = ["Amazon", "Shopify", "TikTok Shop", "Walmart", "Salon Direct", "Distributor"];

// ---------------------------------------------------------------- vendors & payments

export interface Vendor {
  id: string;
  name: string;
  category: "PO Supplier" | "Packaging" | "Logistics" | "Marketing" | "Software" | "Professional Services" | "Facilities" | "Other";
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
  source: "PO Installment" | "Non-PO";
  reference: string;
  vendor: string;
  description: string;
  category: string;
  amount: number;
  dueDate: string | null;
  status: PaymentStatus;
}

export function plannedPayments(pos: PurchaseOrder[], nonPO: NonPOPayment[], vendors: Vendor[]): PlannedPayment[] {
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
  return [...fromPO, ...other].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
}

export interface MonthlyPaymentPlan {
  month: string;
  total: number;
  poTotal: number;
  nonPoTotal: number;
  items: PlannedPayment[];
}

/** Unpaid payments grouped by due month. TBD dates are returned separately. */
export function paymentPlanByMonth(payments: PlannedPayment[], asOf: string, months: number) {
  const keys = monthKeys(asOf, months);
  const unpaid = payments.filter((p) => p.status !== "Paid");
  const overdue = unpaid.filter((p) => p.dueDate !== null && p.dueDate < `${keys[0]}-01`);
  const plan: MonthlyPaymentPlan[] = keys.map((k) => {
    const items = unpaid.filter((p) => p.dueDate !== null && monthKey(p.dueDate) === k);
    const poTotal = items.filter((i) => i.source === "PO Installment").reduce((a, i) => a + i.amount, 0);
    const nonPoTotal = items.filter((i) => i.source === "Non-PO").reduce((a, i) => a + i.amount, 0);
    return { month: k, total: poTotal + nonPoTotal, poTotal, nonPoTotal, items };
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

export type CashInCategory = "Marketplace Payout" | "Salon / Distributor Receipt" | "Loan Receipt" | "Other Receipt";
export type CashOutCategory = "PO Payment" | "Non-PO Payment" | "Subscription" | "Payroll" | "Loan Repayment" | "Tax" | "Other Payment";

export interface CashForecastLine {
  id: string;
  date: string;
  direction: "in" | "out";
  category: CashInCategory | CashOutCategory;
  description: string;
  amount: number;
  source: "Payment Planner" | "QuickBooks AR" | "Payout Forecast" | "Loan Schedule" | "Subscriptions" | "Manual";
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
export function cashFlowOutlook(accounts: BankAccount[], lines: CashForecastLine[], asOf: string, months = 3): CashFlowMonth[] {
  let opening = accounts.reduce((a, b) => a + b.balance, 0);
  return monthKeys(asOf, months).map((k, i) => {
    const from = i === 0 ? asOf : `${k}-01`;
    const to = endOfMonth(`${k}-01`);
    const inMonth = lines.filter((l) => l.date >= from && l.date <= to);
    const sum = (f: (l: CashForecastLine) => boolean) => inMonth.filter(f).reduce((a, l) => a + l.amount, 0);
    const paymentsOut = sum((l) => l.direction === "out");
    const salesIn = sum((l) => l.category === "Marketplace Payout" || l.category === "Salon / Distributor Receipt");
    const loanIn = sum((l) => l.category === "Loan Receipt");
    const otherIn = sum((l) => l.category === "Other Receipt");
    const outByCategory: Record<string, number> = {};
    const inByCategory: Record<string, number> = {};
    for (const l of inMonth) {
      const bucket = l.direction === "out" ? outByCategory : inByCategory;
      bucket[l.category] = (bucket[l.category] ?? 0) + l.amount;
    }
    const closing = opening - paymentsOut + salesIn + loanIn + otherIn;
    const row: CashFlowMonth = { month: k, opening, paymentsOut, salesIn, loanIn, otherIn, closing, outByCategory, inByCategory, lines: inMonth };
    opening = closing;
    return row;
  });
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

export function salesVsCash(sales: ChannelSales[], receipts: CashReceipt[], months: string[]): SalesVsCashRow[] {
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
  return a !== null && Math.abs(allocationTotal(a) - 100) < 0.001 && Object.values(a).every((v) => (v ?? 0) >= 0);
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
  const unallocated = expenses.filter((e) => months.includes(monthKey(e.date)) && !isValidAllocation(e.allocation));
  return { rows, unallocated };
}
