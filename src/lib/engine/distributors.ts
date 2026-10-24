// Distributor management. Modelled on the "Malys Ledger" workbook:
//
// 1) Marketing Fund ledger (the accrual): every time a distributor PAYS an
//    invoice, a fund of X% of the amount paid is created (Fund +). Free goods
//    issued against the fund reduce it (Fund −). Running balance.
// 2) Product Credit ledger: QuickBooks credit memos issued to the distributor
//    (e.g. reimbursing an ad they paid for, or product credit for units) add to
//    the balance; credits applied on a later invoice reduce it.
//
// Plus: invoices / payments / AR aging from QuickBooks, and consignment stock
// for distributors who hold our stock and are invoiced when they sell.

import { daysBetween } from "./dates.ts";

export interface Distributor {
  id: string;
  name: string;
  legalName: string;
  contact: string;
  email: string;
  city: string;
  country: string;
  currency: "USD" | "EUR" | "GBP";
  /** Wholesale = invoiced on shipment. Consignment = our stock at their site, invoiced when they report sales. */
  model: "Wholesale" | "Consignment";
  paymentTermsDays: number;
  creditLimit: number;
  /** Marketing fund created on each invoice payment, e.g. 4 = 4% of invoice paid. */
  marketingFundPct: number;
  status: "Active" | "On Hold" | "Inactive";
  /** 1 unit of the distributor's currency in USD (e.g. 1 EUR = 1.165365 USD). */
  fxToUsd: number;
  /** Agreed unit price per SKU in the distributor's currency (consignment valuation, invoicing). */
  priceList: Record<string, number>;
}

export interface InvoicePayment {
  date: string;
  amount: number;
  /**
   * Cash = money received. "Credit / Fund Applied" = part of the invoice settled with a
   * product credit or the marketing fund. Only cash creates a new marketing fund —
   * settling with accrual must not create accrual again (confirmed by Arslan, 24 Oct 2026).
   */
  method?: "Cash" | "Credit / Fund Applied";
}

/** QuickBooks invoice to a distributor. */
export interface DistributorInvoice {
  id: string; // QuickBooks invoice number, e.g. "30001"
  distributorId: string;
  date: string;
  dueDate: string;
  amount: number;
  payments: InvoicePayment[];
  link: string | null;
}

export type LedgerName = "Marketing Fund" | "Product Credit";
export type LedgerEntryType =
  "Fund Created" | "Goods Issued" | "Credit Memo" | "Credit Applied" | "Adjustment";

export interface LedgerEntry {
  id: string;
  distributorId: string;
  ledger: LedgerName;
  date: string;
  type: LedgerEntryType;
  /** QuickBooks document number (invoice / credit memo). */
  ref: string;
  description: string;
  plus: number;
  minus: number;
  /** Supporting document (QuickBooks link or uploaded file name). */
  support: string | null;
  source: "Auto from QuickBooks payment" | "QuickBooks credit memo" | "Manual";
}

export interface LedgerRow extends LedgerEntry {
  balance: number;
}

/** Everything settled on the invoice — cash plus credits / fund applied. */
export function invoicePaid(inv: DistributorInvoice): number {
  return inv.payments.reduce((a, p) => a + p.amount, 0);
}

/** Fund Created entries generated automatically from invoice payments (X% of the amount paid). */
export function autoFundEntries(d: Distributor, invoices: DistributorInvoice[]): LedgerEntry[] {
  if (d.marketingFundPct <= 0) return [];
  return invoices
    .filter((i) => i.distributorId === d.id)
    .flatMap((inv) =>
      inv.payments.flatMap((p, idx) =>
        (p.method ?? "Cash") !== "Cash"
          ? []
          : [
              {
                id: `MF-${inv.id}-${idx}`,
                distributorId: d.id,
                ledger: "Marketing Fund" as const,
                date: p.date,
                type: "Fund Created" as const,
                ref: `#${inv.id}`,
                description: `Marketing Fund Allocation ${d.marketingFundPct}% of Invoice Paid ($${p.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} × ${d.marketingFundPct}%)`,
                plus: Math.round(p.amount * d.marketingFundPct) / 100,
                minus: 0,
                support: inv.link,
                source: "Auto from QuickBooks payment" as const,
              },
            ],
      ),
    );
}

/** Running balance, oldest first (same as the Balance column in the workbook). */
export function runLedger(entries: LedgerEntry[]): LedgerRow[] {
  let balance = 0;
  return [...entries]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .map((e) => {
      balance = Math.round((balance + e.plus - e.minus) * 100) / 100;
      return { ...e, balance };
    });
}

export interface AgingBuckets {
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90plus: number;
}

export function aging(invoices: DistributorInvoice[], asOf: string): AgingBuckets {
  const b: AgingBuckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
  for (const inv of invoices) {
    const open = Math.round((inv.amount - invoicePaid(inv)) * 100) / 100;
    if (open <= 0) continue;
    const late = daysBetween(inv.dueDate, asOf);
    if (late <= 0) b.current += open;
    else if (late <= 30) b.d1_30 += open;
    else if (late <= 60) b.d31_60 += open;
    else if (late <= 90) b.d61_90 += open;
    else b.d90plus += open;
  }
  return b;
}

export interface DistributorPosition {
  distributor: Distributor;
  invoicedYtd: number;
  paidYtd: number;
  openAR: number;
  aging: AgingBuckets;
  marketingFund: LedgerRow[];
  productCredit: LedgerRow[];
  marketingFundBalance: number;
  productCreditBalance: number;
  /** What they owe us minus fund and credits we owe them. */
  netPosition: number;
  creditUsedPct: number;
  overdue: number;
}

export function distributorPositions(
  distributors: Distributor[],
  invoices: DistributorInvoice[],
  manualEntries: LedgerEntry[],
  asOf: string,
  yearStart: string,
): DistributorPosition[] {
  return distributors.map((d) => {
    const inv = invoices.filter((i) => i.distributorId === d.id);
    const mine = manualEntries.filter((e) => e.distributorId === d.id);
    const marketingFund = runLedger([
      ...autoFundEntries(d, inv),
      ...mine.filter((e) => e.ledger === "Marketing Fund"),
    ]);
    const productCredit = runLedger(mine.filter((e) => e.ledger === "Product Credit"));
    const openAR = inv.reduce((a, i) => a + Math.max(0, i.amount - invoicePaid(i)), 0);
    const ag = aging(inv, asOf);
    const marketingFundBalance = marketingFund.at(-1)?.balance ?? 0;
    const productCreditBalance = productCredit.at(-1)?.balance ?? 0;
    return {
      distributor: d,
      invoicedYtd: inv.filter((i) => i.date >= yearStart).reduce((a, i) => a + i.amount, 0),
      paidYtd: inv
        .flatMap((i) => i.payments)
        .filter((p) => p.date >= yearStart)
        .reduce((a, p) => a + p.amount, 0),
      openAR,
      aging: ag,
      marketingFund,
      productCredit,
      marketingFundBalance,
      productCreditBalance,
      netPosition: Math.round((openAR - marketingFundBalance - productCreditBalance) * 100) / 100,
      creditUsedPct: d.creditLimit > 0 ? openAR / d.creditLimit : 0,
      overdue: ag.d1_30 + ag.d31_60 + ag.d61_90 + ag.d90plus,
    };
  });
}

// ---------------------------------------------------------------- consignment

export interface ConsignmentMovement {
  id: string;
  distributorId: string;
  date: string;
  sku: string;
  type: "Shipment to Distributor" | "Reported Sale" | "Return to Us" | "Adjustment";
  qty: number;
  /** Agreed selling price to the distributor, for reported sales (distributor currency). */
  unitPrice?: number;
  /** Reported sales value, when the distributor reports an amount rather than a unit price. */
  amount?: number;
  /** Invoice raised for a reported sale; null = still to invoice. */
  invoiceId?: string | null;
  reference: string;
}

export interface ConsignmentSkuPosition {
  sku: string;
  shipped: number;
  sold: number;
  returned: number;
  adjusted: number;
  onHandAtDistributor: number;
  soldNotInvoicedQty: number;
  soldNotInvoicedValue: number;
  /** Value of reported sales (distributor currency). */
  salesValue: number;
  pctSold: number;
  stockValueAtCost: number;
  /** Remaining stock at the agreed price, in USD (as in the JB report). */
  remainingValueAtPriceUsd: number;
}

const saleValue = (m: ConsignmentMovement) => m.amount ?? m.qty * (m.unitPrice ?? 0);

export function consignmentPosition(
  movements: ConsignmentMovement[],
  distributorId: string,
  unitCost: (sku: string) => number,
  price: { priceList: Record<string, number>; fxToUsd: number } = { priceList: {}, fxToUsd: 1 },
): ConsignmentSkuPosition[] {
  const mine = movements.filter((m) => m.distributorId === distributorId);
  const skus = [...new Set(mine.map((m) => m.sku))].sort();
  return skus.map((sku) => {
    const rows = mine.filter((m) => m.sku === sku);
    const total = (t: ConsignmentMovement["type"]) =>
      rows.filter((m) => m.type === t).reduce((a, m) => a + m.qty, 0);
    const shipped = total("Shipment to Distributor");
    const sold = total("Reported Sale");
    const returned = total("Return to Us");
    const adjusted = total("Adjustment");
    const onHand = shipped - sold - returned + adjusted;
    const uninvoiced = rows.filter((m) => m.type === "Reported Sale" && !m.invoiceId);
    return {
      sku,
      shipped,
      sold,
      returned,
      adjusted,
      onHandAtDistributor: onHand,
      soldNotInvoicedQty: uninvoiced.reduce((a, m) => a + m.qty, 0),
      soldNotInvoicedValue:
        Math.round(uninvoiced.reduce((a, m) => a + saleValue(m), 0) * 100) / 100,
      salesValue:
        Math.round(
          rows.filter((m) => m.type === "Reported Sale").reduce((a, m) => a + saleValue(m), 0) *
            100,
        ) / 100,
      pctSold: shipped > 0 ? sold / shipped : 0,
      stockValueAtCost: Math.round(onHand * unitCost(sku) * 100) / 100,
      remainingValueAtPriceUsd:
        Math.round(onHand * (price.priceList[sku] ?? 0) * price.fxToUsd * 100) / 100,
    };
  });
}
