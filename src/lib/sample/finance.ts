// Sample finance data: vendors, Non-PO payments, QuickBooks bank balances,
// cash forecast inputs, channel sales vs cash receipts, expenses with splits,
// marketing ad metrics. Illustrative numbers only.

import type { AdMetric } from "../engine/marketing.ts";
import type {
  BankAccount,
  BankMovement,
  CashForecastLine,
  CashReceipt,
  ChannelCosts,
  ChannelSales,
  Expense,
  NonPOPayment,
  Vendor,
} from "../engine/finance.ts";
import type { SalesChannel } from "../engine/types.ts";

export const vendors: Vendor[] = [
  {
    id: "V-BL",
    name: "Beauty Labs",
    category: "PO Supplier",
    paymentTerms: "40% deposit · 40% on fill · 20% net 30",
    currency: "USD",
    contact: "Mark Ellis",
    email: "orders@beautylabs.example",
    maintainedBy: "Supply Chain",
    status: "Active",
  },
  {
    id: "V-PF",
    name: "Prime Fill",
    category: "PO Supplier",
    paymentTerms: "50% deposit · 50% on shipment",
    currency: "USD",
    contact: "Dana Ortiz",
    email: "ap@primefill.example",
    maintainedBy: "Supply Chain",
    status: "Active",
  },
  {
    id: "V-CP",
    name: "China Pack",
    category: "Packaging",
    paymentTerms: "50% deposit · 50% before shipment",
    currency: "USD",
    contact: "Lily Chen",
    email: "sales@chinapack.example",
    maintainedBy: "Supply Chain",
    status: "Active",
  },
  {
    id: "V-AC",
    name: "Sample Accessory Co",
    category: "PO Supplier",
    paymentTerms: "Net 30",
    currency: "USD",
    contact: "Sam Patel",
    email: "sam@accessory.example",
    maintainedBy: "Supply Chain",
    status: "Active",
  },
  {
    id: "V-GA",
    name: "Georgia Prep Warehouse",
    category: "Logistics",
    paymentTerms: "Monthly invoice · net 15",
    currency: "USD",
    contact: "Ops Desk",
    email: "billing@gaprep.example",
    maintainedBy: "Finance",
    status: "Active",
  },
  {
    id: "V-FR",
    name: "FreightLink",
    category: "Logistics",
    paymentTerms: "Net 15",
    currency: "USD",
    contact: "Kevin Brooks",
    email: "ar@freightlink.example",
    maintainedBy: "Supply Chain",
    status: "Active",
  },
  {
    id: "V-AG",
    name: "Brightside Creative Agency",
    category: "Marketing",
    paymentTerms: "Monthly retainer · net 10",
    currency: "USD",
    contact: "Priya Rao",
    email: "billing@brightside.example",
    maintainedBy: "Finance",
    status: "Active",
  },
  {
    id: "V-LL",
    name: "Brentwood Property LLC",
    category: "Facilities",
    paymentTerms: "1st of month",
    currency: "USD",
    contact: "Leasing Office",
    email: "rent@brentwoodprop.example",
    maintainedBy: "Finance",
    status: "Active",
  },
  {
    id: "V-CPA",
    name: "Hart & Co CPAs",
    category: "Professional Services",
    paymentTerms: "Net 30",
    currency: "USD",
    contact: "Ruth Hart",
    email: "ruth@hartcpa.example",
    maintainedBy: "Finance",
    status: "Active",
  },
  {
    id: "V-INS",
    name: "Shield Business Insurance",
    category: "Other",
    paymentTerms: "Quarterly",
    currency: "USD",
    contact: "Policy Desk",
    email: "service@shield.example",
    maintainedBy: "Finance",
    status: "Active",
  },
];

export const nonPOPayments: NonPOPayment[] = [
  {
    id: "NP-101",
    vendorId: "V-LL",
    category: "Rent",
    description: "Brentwood warehouse rent – Nov",
    amount: 14500,
    dueDate: "2026-11-01",
    status: "Approved",
    enteredBy: "Finance",
    recurring: "Monthly",
  },
  {
    id: "NP-102",
    vendorId: "V-LL",
    category: "Rent",
    description: "Brentwood warehouse rent – Dec",
    amount: 14500,
    dueDate: "2026-12-01",
    status: "Planned",
    enteredBy: "Finance",
    recurring: "Monthly",
  },
  {
    id: "NP-103",
    vendorId: "V-LL",
    category: "Rent",
    description: "Brentwood warehouse rent – Jan",
    amount: 14500,
    dueDate: "2027-01-01",
    status: "Planned",
    enteredBy: "Finance",
    recurring: "Monthly",
  },
  {
    id: "NP-104",
    vendorId: "V-GA",
    category: "3PL / Storage",
    description: "Georgia storage & prep – Oct",
    amount: 8200,
    dueDate: "2026-11-15",
    status: "Planned",
    enteredBy: "Finance",
    recurring: "Monthly",
  },
  {
    id: "NP-105",
    vendorId: "V-GA",
    category: "3PL / Storage",
    description: "Georgia storage & prep – Nov",
    amount: 8400,
    dueDate: "2026-12-15",
    status: "Planned",
    enteredBy: "Finance",
    recurring: "Monthly",
  },
  {
    id: "NP-106",
    vendorId: "V-FR",
    category: "Freight",
    description: "Inbound freight PO-1024 / PO-1030",
    amount: 6800,
    dueDate: "2026-11-20",
    status: "Planned",
    enteredBy: "Supply Chain",
    recurring: "None",
  },
  {
    id: "NP-107",
    vendorId: "V-FR",
    category: "Freight",
    description: "Ocean freight tubes PO-1027",
    amount: 4300,
    dueDate: "2026-10-29",
    status: "Approved",
    enteredBy: "Supply Chain",
    recurring: "None",
  },
  {
    id: "NP-108",
    vendorId: "V-AG",
    category: "Marketing",
    description: "Creative retainer – Nov",
    amount: 9000,
    dueDate: "2026-11-10",
    status: "Approved",
    enteredBy: "Finance",
    recurring: "Monthly",
  },
  {
    id: "NP-109",
    vendorId: "V-AG",
    category: "Marketing",
    description: "Creative retainer – Dec",
    amount: 9000,
    dueDate: "2026-12-10",
    status: "Planned",
    enteredBy: "Finance",
    recurring: "Monthly",
  },
  {
    id: "NP-110",
    vendorId: "V-CPA",
    category: "Professional Fees",
    description: "Q3 bookkeeping & tax review",
    amount: 5200,
    dueDate: "2026-11-25",
    status: "Planned",
    enteredBy: "Finance",
    recurring: "None",
  },
  {
    id: "NP-111",
    vendorId: "V-INS",
    category: "Insurance",
    description: "Product liability – Q1 premium",
    amount: 7600,
    dueDate: "2027-01-05",
    status: "Planned",
    enteredBy: "Finance",
    recurring: "Quarterly",
  },
  {
    id: "NP-112",
    vendorId: "V-CP",
    category: "Packaging",
    description: "Shipper cartons & inserts",
    amount: 3100,
    dueDate: null,
    status: "Planned",
    enteredBy: "Supply Chain",
    recurring: "None",
  },
];

export const bankAccounts: BankAccount[] = [
  { id: "QB-1010", name: "Chase Operating ••4821", balance: 386400, syncedAt: "2026-10-24T06:00" },
  { id: "QB-1020", name: "Chase Payroll ••7710", balance: 41200, syncedAt: "2026-10-24T06:00" },
  { id: "QB-1030", name: "Mercury Reserve ••0193", balance: 75000, syncedAt: "2026-10-24T06:00" },
];

/** Payroll, loans and tax are entered by Director Finance (or come from QuickBooks recurring transactions). */
export const manualCashLines = [
  {
    date: "2026-10-31",
    direction: "out" as const,
    category: "Payroll" as const,
    description: "Payroll 16–31 Oct",
    amount: 61000,
  },
  {
    date: "2026-11-15",
    direction: "out" as const,
    category: "Payroll" as const,
    description: "Payroll 1–15 Nov",
    amount: 61000,
  },
  {
    date: "2026-11-30",
    direction: "out" as const,
    category: "Payroll" as const,
    description: "Payroll 16–30 Nov",
    amount: 61000,
  },
  {
    date: "2026-12-15",
    direction: "out" as const,
    category: "Payroll" as const,
    description: "Payroll 1–15 Dec",
    amount: 61000,
  },
  {
    date: "2026-12-31",
    direction: "out" as const,
    category: "Payroll" as const,
    description: "Payroll 16–31 Dec + bonus",
    amount: 78000,
  },
  {
    date: "2026-11-12",
    direction: "in" as const,
    category: "Loan Receipt" as const,
    description: "Line of credit drawdown",
    amount: 120000,
  },
  {
    date: "2026-11-05",
    direction: "out" as const,
    category: "Loan Repayment" as const,
    description: "Term loan instalment",
    amount: 6500,
  },
  {
    date: "2026-12-05",
    direction: "out" as const,
    category: "Loan Repayment" as const,
    description: "Term loan instalment",
    amount: 6500,
  },
  {
    date: "2026-12-15",
    direction: "out" as const,
    category: "Tax" as const,
    description: "Estimated tax – Q4",
    amount: 22000,
  },
];

/** Expected payouts per channel per month (from payout schedules / QuickBooks AR). */
export const expectedReceipts: {
  channel: SalesChannel;
  month: string;
  amount: number;
  days: number[];
}[] = [
  { channel: "Amazon", month: "2026-10", amount: 48000, days: [28] },
  { channel: "Amazon", month: "2026-11", amount: 104000, days: [11, 25] },
  { channel: "Amazon", month: "2026-12", amount: 128000, days: [9, 23] },
  { channel: "Shopify", month: "2026-10", amount: 16000, days: [27, 31] },
  { channel: "Shopify", month: "2026-11", amount: 64000, days: [3, 10, 17, 24] },
  { channel: "Shopify", month: "2026-12", amount: 82000, days: [1, 8, 15, 22, 29] },
  { channel: "TikTok Shop", month: "2026-10", amount: 7000, days: [29] },
  { channel: "TikTok Shop", month: "2026-11", amount: 28000, days: [5, 12, 19, 26] },
  { channel: "TikTok Shop", month: "2026-12", amount: 34000, days: [3, 10, 17, 24] },
  { channel: "Walmart", month: "2026-11", amount: 18000, days: [6, 20] },
  { channel: "Walmart", month: "2026-12", amount: 21000, days: [4, 18] },
  { channel: "Salon Direct", month: "2026-10", amount: 9500, days: [30] },
  { channel: "Salon Direct", month: "2026-11", amount: 21000, days: [15, 30] },
  { channel: "Salon Direct", month: "2026-12", amount: 24000, days: [15, 30] },
  { channel: "Distributor", month: "2026-11", amount: 46000, days: [10, 28] },
  { channel: "Distributor", month: "2026-12", amount: 39000, days: [12, 29] },
];

export const SALES_MONTHS = ["2026-07", "2026-08", "2026-09", "2026-10"];

/** Gross sales by channel/month with platform-withheld fees. Oct is month-to-date. */
export const channelSales: ChannelSales[] = (() => {
  const base: Record<SalesChannel, [number, number, number]> = {
    // [gross per month, refund %, fee %]
    Amazon: [214000, 0.03, 0.31],
    Shopify: [128000, 0.04, 0.035],
    "TikTok Shop": [61000, 0.06, 0.12],
    Walmart: [38000, 0.03, 0.15],
    "Salon Direct": [36000, 0.01, 0],
    Distributor: [52000, 0, 0],
  };
  const growth = [0.92, 0.97, 1, 0.78];
  const out: ChannelSales[] = [];
  for (const [channel, [gross, refundPct, feePct]] of Object.entries(base) as [
    SalesChannel,
    [number, number, number],
  ][]) {
    SALES_MONTHS.forEach((month, i) => {
      const g = Math.round(gross * (growth[i] ?? 1));
      const refunds = Math.round(g * refundPct);
      const platformFees = Math.round(g * feePct);
      out.push({
        channel,
        month,
        grossSales: g,
        refunds,
        platformFees,
        expectedNet: g - refunds - platformFees,
      });
    });
  }
  return out;
})();

/** Cash actually deposited (QuickBooks bank feed), matched to the sales month it settles. */
export const cashReceipts: CashReceipt[] = (() => {
  const collected: Record<SalesChannel, [number, number, number, number]> = {
    Amazon: [1, 1, 0.82, 0.28],
    Shopify: [1, 1, 0.99, 0.6],
    "TikTok Shop": [1, 0.97, 0.7, 0.2],
    Walmart: [1, 1, 0.55, 0],
    "Salon Direct": [0.98, 0.95, 0.74, 0.31],
    Distributor: [1, 0.86, 0.48, 0],
  };
  const out: CashReceipt[] = [];
  for (const s of channelSales) {
    const idx = SALES_MONTHS.indexOf(s.month);
    const pct = collected[s.channel][idx] ?? 0;
    if (pct <= 0) continue;
    const [y, m] = s.month.split("-").map(Number);
    const next = `${m === 12 ? y! + 1 : y}-${String(m === 12 ? 1 : m! + 1).padStart(2, "0")}`;
    out.push({
      id: `R-${s.channel}-${s.month}`,
      channel: s.channel,
      date: `${s.month === "2026-10" ? "2026-10" : next}-${s.month === "2026-10" ? "20" : "08"}`,
      amount: Math.round(s.expectedNet * pct),
      reference: `${s.channel} settlement ${s.month}`,
      settlesMonth: s.month,
    });
  }
  return out;
})();

export const adMetrics: AdMetric[] = (() => {
  const plat: [AdMetric["platform"], SalesChannel, number, number, number, number][] = [
    // platform, channel, monthly spend, ROAS, CTR, CVR
    ["Amazon Ads", "Amazon", 21000, 4.3, 0.0042, 0.11],
    ["Meta Ads", "Shopify", 14500, 2.6, 0.011, 0.028],
    ["Google Ads", "Shopify", 6200, 3.4, 0.032, 0.041],
    ["TikTok Ads", "TikTok Shop", 9800, 1.7, 0.009, 0.019],
  ];
  const spendTrend = [0.85, 0.95, 1, 0.8];
  const roasTrend = [1.05, 1.0, 0.94, 0.9];
  const out: AdMetric[] = [];
  for (const [platform, channel, spend, roas, ctr, cvr] of plat) {
    SALES_MONTHS.forEach((month, i) => {
      const s = Math.round(spend * (spendTrend[i] ?? 1));
      const adSales = Math.round(s * roas * (roasTrend[i] ?? 1));
      const cpc = platform === "Amazon Ads" ? 1.15 : platform === "Google Ads" ? 0.95 : 0.78;
      const clicks = Math.round(s / cpc);
      out.push({
        platform,
        channel,
        month,
        spend: s,
        impressions: Math.round(clicks / ctr),
        clicks,
        orders: Math.round(clicks * cvr),
        adSales,
      });
    });
  }
  return out;
})();

export const channelCosts: ChannelCosts[] = (() => {
  const unitPrice: Record<SalesChannel, number> = {
    Amazon: 15.5,
    Shopify: 17,
    "TikTok Shop": 14,
    Walmart: 15,
    "Salon Direct": 9.5,
    Distributor: 7.2,
  };
  const fulfilPerUnit: Record<SalesChannel, number> = {
    Amazon: 3.9,
    Shopify: 4.6,
    "TikTok Shop": 4.2,
    Walmart: 4.4,
    "Salon Direct": 1.1,
    Distributor: 0.35,
  };
  const out: ChannelCosts[] = [];
  for (const s of channelSales) {
    const units = Math.round(s.grossSales / unitPrice[s.channel]);
    const adSpend = adMetrics
      .filter((a) => a.channel === s.channel && a.month === s.month)
      .reduce((t, a) => t + a.spend, 0);
    out.push({
      channel: s.channel,
      month: s.month,
      unitsSold: units,
      cogs: Math.round(units * 2.58),
      fulfillment: Math.round(units * fulfilPerUnit[s.channel]),
      adSpend,
    });
  }
  return out;
})();

export const expenses: Expense[] = [
  {
    id: "EX-301",
    date: "2026-09-01",
    vendor: "Brentwood Property LLC",
    category: "Rent",
    description: "Warehouse rent – Sep",
    amount: 14500,
    allocation: {
      Amazon: 35,
      Shopify: 30,
      "TikTok Shop": 10,
      Walmart: 10,
      "Salon Direct": 10,
      Distributor: 5,
    },
    source: "QuickBooks",
  },
  {
    id: "EX-302",
    date: "2026-09-10",
    vendor: "Brightside Creative Agency",
    category: "Marketing",
    description: "Creative retainer – Sep",
    amount: 9000,
    allocation: { Shopify: 50, "TikTok Shop": 30, Amazon: 20 },
    source: "QuickBooks",
  },
  {
    id: "EX-303",
    date: "2026-09-15",
    vendor: "Georgia Prep Warehouse",
    category: "3PL / Storage",
    description: "Georgia storage & prep – Sep",
    amount: 7900,
    allocation: { Amazon: 60, Walmart: 20, Shopify: 20 },
    source: "QuickBooks",
  },
  {
    id: "EX-304",
    date: "2026-09-30",
    vendor: "Payroll",
    category: "Payroll",
    description: "Sales & marketing payroll – Sep",
    amount: 52000,
    allocation: {
      Amazon: 30,
      Shopify: 25,
      "TikTok Shop": 10,
      Walmart: 5,
      "Salon Direct": 20,
      Distributor: 10,
    },
    source: "QuickBooks",
  },
  {
    id: "EX-305",
    date: "2026-09-22",
    vendor: "Influencer – @curlqueen",
    category: "Marketing",
    description: "TikTok creator campaign",
    amount: 6000,
    allocation: { "TikTok Shop": 100 },
    source: "Manual",
  },
  {
    id: "EX-306",
    date: "2026-09-25",
    vendor: "Hart & Co CPAs",
    category: "Professional Fees",
    description: "Monthly bookkeeping – Sep",
    amount: 2600,
    allocation: null,
    source: "QuickBooks",
  },
  {
    id: "EX-307",
    date: "2026-09-28",
    vendor: "Salon Expo Atlanta",
    category: "Events",
    description: "Trade show booth",
    amount: 8400,
    allocation: null,
    source: "QuickBooks",
  },
  {
    id: "EX-401",
    date: "2026-10-01",
    vendor: "Brentwood Property LLC",
    category: "Rent",
    description: "Warehouse rent – Oct",
    amount: 14500,
    allocation: {
      Amazon: 35,
      Shopify: 30,
      "TikTok Shop": 10,
      Walmart: 10,
      "Salon Direct": 10,
      Distributor: 5,
    },
    source: "QuickBooks",
  },
  {
    id: "EX-402",
    date: "2026-10-10",
    vendor: "Brightside Creative Agency",
    category: "Marketing",
    description: "Creative retainer – Oct",
    amount: 9000,
    allocation: null,
    source: "QuickBooks",
  },
  {
    id: "EX-403",
    date: "2026-10-18",
    vendor: "FreightLink",
    category: "Freight",
    description: "Distributor freight – Beauty Supply East",
    amount: 3200,
    allocation: { Distributor: 100 },
    source: "QuickBooks",
  },
];

export const HEALTH_TARGETS = {
  minimumCashBuffer: 150000,
  targetNetMarginPct: 0.08,
  targetRoas: 3,
  maxTacos: 0.12,
  minSeatUsePct: 0.7,
  minCollectedPct: 0.8,
};

// ---------------------------------------------------------------- expected vs actual (last 4 weeks)

/**
 * The cash plan as it stood for the last four weeks (in production: the forecast is
 * saved every Monday). Compared with what actually moved in the bank.
 */
export const pastCashPlan: CashForecastLine[] = [
  {
    id: "x01",
    date: "2026-09-30",
    direction: "in",
    category: "Marketplace Payout",
    description: "Amazon payout",
    amount: 24000,
    source: "Payout Forecast",
  },
  {
    id: "x02",
    date: "2026-10-01",
    direction: "in",
    category: "Marketplace Payout",
    description: "Shopify payout",
    amount: 18500,
    source: "Payout Forecast",
  },
  {
    id: "x03",
    date: "2026-10-02",
    direction: "in",
    category: "Marketplace Payout",
    description: "TikTok Shop payout",
    amount: 6000,
    source: "Payout Forecast",
  },
  {
    id: "x04",
    date: "2026-09-30",
    direction: "out",
    category: "Payroll",
    description: "US payroll · 16–30 Sep",
    amount: 61000,
    source: "Manual",
  },
  {
    id: "x05",
    date: "2026-10-01",
    direction: "out",
    category: "PO Payment",
    description: "China Pack · PO-1031 deposit",
    amount: 9600,
    source: "Payment Planner",
  },
  {
    id: "x06",
    date: "2026-10-01",
    direction: "out",
    category: "Non-PO Payment",
    description: "Brentwood Property LLC · October rent",
    amount: 14500,
    source: "Payment Planner",
  },
  {
    id: "x07",
    date: "2026-10-07",
    direction: "in",
    category: "Marketplace Payout",
    description: "Amazon payout",
    amount: 26000,
    source: "Payout Forecast",
  },
  {
    id: "x08",
    date: "2026-10-08",
    direction: "in",
    category: "Marketplace Payout",
    description: "Walmart payout",
    amount: 7500,
    source: "Payout Forecast",
  },
  {
    id: "x09",
    date: "2026-10-09",
    direction: "in",
    category: "Salon / Distributor Receipt",
    description: "Salon receipts (QuickBooks AR)",
    amount: 4200,
    source: "QuickBooks AR",
  },
  {
    id: "x10",
    date: "2026-10-10",
    direction: "in",
    category: "Salon / Distributor Receipt",
    description: "Beauty Supply East · INV-2208",
    amount: 10000,
    source: "QuickBooks AR",
  },
  {
    id: "x11",
    date: "2026-10-06",
    direction: "out",
    category: "Non-PO Payment",
    description: "FreightLink · September freight",
    amount: 3800,
    source: "Payment Planner",
  },
  {
    id: "x12",
    date: "2026-10-10",
    direction: "out",
    category: "Tax",
    description: "Sales tax · September",
    amount: 8200,
    source: "Manual",
  },
  {
    id: "x13",
    date: "2026-10-14",
    direction: "in",
    category: "Marketplace Payout",
    description: "Amazon payout",
    amount: 25000,
    source: "Payout Forecast",
  },
  {
    id: "x14",
    date: "2026-10-15",
    direction: "in",
    category: "Marketplace Payout",
    description: "Shopify payout",
    amount: 19000,
    source: "Payout Forecast",
  },
  {
    id: "x15",
    date: "2026-10-16",
    direction: "in",
    category: "Marketplace Payout",
    description: "TikTok Shop payout",
    amount: 6500,
    source: "Payout Forecast",
  },
  {
    id: "x16",
    date: "2026-10-15",
    direction: "out",
    category: "Payroll",
    description: "US payroll · 1–15 Oct",
    amount: 61000,
    source: "Manual",
  },
  {
    id: "x17",
    date: "2026-10-13",
    direction: "out",
    category: "PO Payment",
    description: "Beauty Labs · PO-1029 balance",
    amount: 8000,
    source: "Payment Planner",
  },
  {
    id: "x18",
    date: "2026-10-15",
    direction: "out",
    category: "Other Payment",
    description: "Meta Ads · card settlement",
    amount: 7000,
    source: "Manual",
  },
  {
    id: "x19",
    date: "2026-10-21",
    direction: "in",
    category: "Marketplace Payout",
    description: "Amazon payout",
    amount: 24000,
    source: "Payout Forecast",
  },
  {
    id: "x20",
    date: "2026-10-22",
    direction: "in",
    category: "Marketplace Payout",
    description: "Shopify payout",
    amount: 18000,
    source: "Payout Forecast",
  },
  {
    id: "x21",
    date: "2026-10-23",
    direction: "in",
    category: "Salon / Distributor Receipt",
    description: "Salon receipts (QuickBooks AR)",
    amount: 3800,
    source: "QuickBooks AR",
  },
  {
    id: "x22",
    date: "2026-10-20",
    direction: "out",
    category: "Non-PO Payment",
    description: "Packaging Plus · labels",
    amount: 5200,
    source: "Payment Planner",
  },
  {
    id: "x23",
    date: "2026-10-21",
    direction: "out",
    category: "Subscription",
    description: "Klaviyo",
    amount: 720,
    source: "Subscriptions",
  },
];

/** Real bank movements from the QuickBooks bank feed, matched to the plan line they settle. */
export const bankMovements: BankMovement[] = [
  {
    id: "bm01",
    date: "2026-09-30",
    direction: "in",
    category: "Marketplace Payout",
    description: "Amazon payout",
    amount: 22140,
    matchedTo: "x01",
  },
  {
    id: "bm02",
    date: "2026-10-01",
    direction: "in",
    category: "Marketplace Payout",
    description: "Shopify payout",
    amount: 18620,
    matchedTo: "x02",
  },
  {
    id: "bm03",
    date: "2026-10-02",
    direction: "in",
    category: "Marketplace Payout",
    description: "TikTok Shop payout",
    amount: 5880,
    matchedTo: "x03",
  },
  {
    id: "bm04",
    date: "2026-09-30",
    direction: "out",
    category: "Payroll",
    description: "US payroll · 16–30 Sep",
    amount: 61000,
    matchedTo: "x04",
  },
  {
    id: "bm05",
    date: "2026-10-01",
    direction: "out",
    category: "PO Payment",
    description: "China Pack · PO-1031 deposit",
    amount: 9600,
    matchedTo: "x05",
  },
  {
    id: "bm06",
    date: "2026-10-01",
    direction: "out",
    category: "Non-PO Payment",
    description: "Brentwood Property LLC · October rent",
    amount: 14500,
    matchedTo: "x06",
  },
  {
    id: "bm07",
    date: "2026-10-07",
    direction: "in",
    category: "Marketplace Payout",
    description: "Amazon payout",
    amount: 25410,
    matchedTo: "x07",
  },
  {
    id: "bm08",
    date: "2026-10-09",
    direction: "in",
    category: "Salon / Distributor Receipt",
    description: "Salon receipts (QuickBooks AR)",
    amount: 3100,
    matchedTo: "x09",
  },
  {
    id: "bm09",
    date: "2026-10-06",
    direction: "out",
    category: "Non-PO Payment",
    description: "FreightLink · September freight",
    amount: 4350,
    matchedTo: "x11",
  },
  {
    id: "bm10",
    date: "2026-10-10",
    direction: "out",
    category: "Tax",
    description: "Sales tax · September",
    amount: 8200,
    matchedTo: "x12",
  },
  {
    id: "bm11",
    date: "2026-10-14",
    direction: "in",
    category: "Marketplace Payout",
    description: "Amazon payout",
    amount: 24880,
    matchedTo: "x13",
  },
  {
    id: "bm12",
    date: "2026-10-15",
    direction: "in",
    category: "Marketplace Payout",
    description: "Shopify payout",
    amount: 19450,
    matchedTo: "x14",
  },
  {
    id: "bm13",
    date: "2026-10-16",
    direction: "in",
    category: "Marketplace Payout",
    description: "TikTok Shop payout",
    amount: 4900,
    matchedTo: "x15",
  },
  {
    id: "bm14",
    date: "2026-10-15",
    direction: "out",
    category: "Payroll",
    description: "US payroll · 1–15 Oct",
    amount: 61000,
    matchedTo: "x16",
  },
  {
    id: "bm15",
    date: "2026-10-13",
    direction: "out",
    category: "PO Payment",
    description: "Beauty Labs · PO-1029 balance",
    amount: 8000,
    matchedTo: "x17",
  },
  {
    id: "bm16",
    date: "2026-10-15",
    direction: "out",
    category: "Other Payment",
    description: "Meta Ads · card settlement",
    amount: 7600,
    matchedTo: "x18",
  },
  {
    id: "bm17",
    date: "2026-10-21",
    direction: "in",
    category: "Marketplace Payout",
    description: "Amazon payout",
    amount: 23700,
    matchedTo: "x19",
  },
  {
    id: "bm18",
    date: "2026-10-22",
    direction: "in",
    category: "Marketplace Payout",
    description: "Shopify payout",
    amount: 18000,
    matchedTo: "x20",
  },
  {
    id: "bm19",
    date: "2026-10-20",
    direction: "out",
    category: "Non-PO Payment",
    description: "Packaging Plus · labels",
    amount: 5200,
    matchedTo: "x22",
  },
  {
    id: "bm20",
    date: "2026-10-21",
    direction: "out",
    category: "Subscription",
    description: "Klaviyo",
    amount: 720,
    matchedTo: "x23",
  },
  {
    id: "u1",
    date: "2026-10-03",
    direction: "out",
    category: "Other Payment",
    description: "Amazon FBA inbound placement fee",
    amount: 1240,
    matchedTo: null,
  },
  {
    id: "u2",
    date: "2026-10-17",
    direction: "out",
    category: "Other Payment",
    description: "Shopify app charges",
    amount: 640,
    matchedTo: null,
  },
  {
    id: "u3",
    date: "2026-10-19",
    direction: "in",
    category: "Other Receipt",
    description: "UPS claim refund",
    amount: 410,
    matchedTo: null,
  },
];
