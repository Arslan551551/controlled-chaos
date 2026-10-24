// Marketing campaigns and conversion.
//
// Campaigns: what marketing spent (ads, discounts given away, deal fees, agency,
// influencers, samples) against the sales lift over a pre-campaign baseline,
// measured after product cost — so a campaign that "sold a lot" but gave the
// margin away shows as "Lost money".
//
// Conversion & MER: follows the ROAS reports (docs/excel-analysis/roas-report-*):
//   MER  = channel sales ÷ (ad & selling cost + allocated marketing payroll)
//   ROAS = paid-ad-attributed sales ÷ paid ad spend (channels without paid data excluded)

import { daysBetween } from "./dates.ts";
import type { SalesChannel } from "./types.ts";

export type CampaignType =
  | "Amazon Coupon"
  | "Lightning Deal"
  | "Prime Day Deal"
  | "Shopify Discount Code"
  | "TikTok Flash Sale"
  | "TikTok Creator / Affiliate"
  | "Meta Campaign"
  | "Google Campaign"
  | "Walmart Rollback"
  | "Email/SMS"
  | "Influencer";

export const CAMPAIGN_TYPES: CampaignType[] = [
  "Amazon Coupon",
  "Lightning Deal",
  "Prime Day Deal",
  "Shopify Discount Code",
  "TikTok Flash Sale",
  "TikTok Creator / Affiliate",
  "Meta Campaign",
  "Google Campaign",
  "Walmart Rollback",
  "Email/SMS",
  "Influencer",
];

export type CampaignStatus = "Planned" | "Live" | "Ended";

export interface CampaignCosts {
  adSpend: number;
  /** Revenue given away through the discount (list price − selling price) × units. */
  discountCost: number;
  /** Marketplace deal / coupon / redemption fees. */
  dealFees: number;
  agencyFees: number;
  influencerFees: number;
  /** Free product sent (product cost + shipping). */
  samplesCost: number;
}

export interface CampaignResults {
  orders: number;
  units: number;
  /** Sales at list price before the discount. */
  grossSales: number;
  /** What customers actually paid (gross − discount). */
  netSales: number;
  newCustomers: number;
  /** Units per day in the 14 days after the campaign (to spot a post-campaign dip). Optional. */
  postDailyUnits?: number;
}

export interface Campaign {
  id: string;
  name: string;
  channel: SalesChannel;
  type: CampaignType;
  owner: string;
  startDate: string;
  endDate: string;
  skus: string[];
  discountPct: number;
  budget: number;
  costs: CampaignCosts;
  results: CampaignResults;
  /** Average daily units / net sales of the same SKUs on the same channel before the campaign. */
  baseline: { dailyUnits: number; dailySales: number };
  status: CampaignStatus;
  notes: string;
}

export type Verdict = "Profitable" | "Break-even" | "Lost money" | "Not started";

export interface CampaignAnalysis {
  campaign: Campaign;
  days: number;
  totalCost: number;
  /** Cost excluding the discount given away (cash actually paid out). */
  cashCost: number;
  baselineUnits: number;
  baselineSales: number;
  incrementalUnits: number;
  incrementalSales: number;
  liftPct: number;
  unitCost: number;
  /** (incremental net sales − COGS of incremental units) — the discount is already out of net sales. */
  incrementalGrossProfit: number;
  /** Incremental gross profit − cash marketing costs (ads, fees, agency, influencer, samples). */
  incrementalProfit: number;
  /** Incremental profit ÷ total cost (incl. discount). */
  roi: number;
  costPerIncrementalOrder: number;
  cac: number;
  /** Net sales ÷ total marketing cost (incl. discount). */
  mer: number;
  /** Net sales ÷ ad spend. */
  roas: number;
  verdict: Verdict;
  /** Units/day after the campaign fell below baseline (pulled-forward demand). */
  postCampaignDip: boolean;
}

/** Break-even band: incremental profit within ±5% of total cost counts as break-even. */
export const BREAK_EVEN_BAND = 0.05;

export function campaignTotalCost(c: CampaignCosts): number {
  return c.adSpend + c.discountCost + c.dealFees + c.agencyFees + c.influencerFees + c.samplesCost;
}

export function campaignCashCost(c: CampaignCosts): number {
  return c.adSpend + c.dealFees + c.agencyFees + c.influencerFees + c.samplesCost;
}

export function campaignDays(c: Pick<Campaign, "startDate" | "endDate">): number {
  return Math.max(1, daysBetween(c.startDate, c.endDate) + 1);
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const div = (a: number, b: number) => (b > 0 ? a / b : 0);

/** unitCost: full COGS per unit for a SKU; a campaign's cost per unit is the average across its SKUs. */
export function analyzeCampaign(c: Campaign, unitCost: (sku: string) => number): CampaignAnalysis {
  const days = campaignDays(c);
  const totalCost = campaignTotalCost(c.costs);
  const cashCost = campaignCashCost(c.costs);
  const baselineUnits = c.baseline.dailyUnits * days;
  const baselineSales = c.baseline.dailySales * days;
  const incrementalUnits = c.results.units - baselineUnits;
  const incrementalSales = c.results.netSales - baselineSales;
  const cost = c.skus.length ? c.skus.reduce((a, s) => a + unitCost(s), 0) / c.skus.length : 0;
  const incrementalGrossProfit = incrementalSales - incrementalUnits * cost;
  const incrementalProfit = incrementalGrossProfit - cashCost;
  const roi = div(incrementalProfit, totalCost);
  const incrementalOrders = c.results.units > 0 ? (c.results.orders * incrementalUnits) / c.results.units : 0;
  let verdict: Verdict;
  if (c.status === "Planned") verdict = "Not started";
  else if (incrementalProfit > totalCost * BREAK_EVEN_BAND) verdict = "Profitable";
  else if (incrementalProfit >= -totalCost * BREAK_EVEN_BAND) verdict = "Break-even";
  else verdict = "Lost money";
  return {
    campaign: c,
    days,
    totalCost: r2(totalCost),
    cashCost: r2(cashCost),
    baselineUnits: Math.round(baselineUnits),
    baselineSales: r2(baselineSales),
    incrementalUnits: Math.round(incrementalUnits),
    incrementalSales: r2(incrementalSales),
    liftPct: div(incrementalUnits, baselineUnits),
    unitCost: r2(cost),
    incrementalGrossProfit: r2(incrementalGrossProfit),
    incrementalProfit: r2(incrementalProfit),
    roi,
    costPerIncrementalOrder: incrementalOrders > 0 ? r2(totalCost / incrementalOrders) : 0,
    cac: c.results.newCustomers > 0 ? r2(totalCost / c.results.newCustomers) : 0,
    mer: div(c.results.netSales, totalCost),
    roas: div(c.results.netSales, c.costs.adSpend),
    verdict,
    postCampaignDip: c.results.postDailyUnits !== undefined && c.results.postDailyUnits < c.baseline.dailyUnits * 0.9,
  };
}

// ---------------------------------------------------------------- conversion

/** Shopify first-click sources as mapped in the ROAS report; marketplaces use one row per channel. */
export type TrafficSourceName = "google" | "facebook/instagram" | "email" | "direct" | "affiliate" | "others" | "marketplace";

export interface TrafficSource {
  channel: SalesChannel;
  source: TrafficSourceName;
  month: string;
  sessions: number;
  addToCart: number;
  orders: number;
  newCustomers: number;
  returningCustomers: number;
  revenue: number;
  /** Ad / platform spend attributed to this source. */
  adSpend: number;
}

export interface FunnelRow {
  key: string;
  sessions: number;
  addToCart: number;
  orders: number;
  revenue: number;
  newCustomers: number;
  returningCustomers: number;
  adSpend: number;
  conversionRate: number;
  atcRate: number;
  cartToOrder: number;
  aov: number;
  newCustomerShare: number;
  /** Ad spend ÷ new customers. */
  cac: number;
  roas: number;
}

export function funnel(key: string, rows: TrafficSource[]): FunnelRow {
  const s = (f: (r: TrafficSource) => number) => rows.reduce((a, r) => a + f(r), 0);
  const sessions = s((r) => r.sessions);
  const addToCart = s((r) => r.addToCart);
  const orders = s((r) => r.orders);
  const revenue = s((r) => r.revenue);
  const newCustomers = s((r) => r.newCustomers);
  const returningCustomers = s((r) => r.returningCustomers);
  const adSpend = s((r) => r.adSpend);
  return {
    key,
    sessions,
    addToCart,
    orders,
    revenue,
    newCustomers,
    returningCustomers,
    adSpend,
    conversionRate: div(orders, sessions),
    atcRate: div(addToCart, sessions),
    cartToOrder: div(orders, addToCart),
    aov: div(revenue, orders),
    newCustomerShare: div(newCustomers, newCustomers + returningCustomers),
    cac: div(adSpend, newCustomers),
    roas: div(revenue, adSpend),
  };
}

/** Channel-level MER inputs, one row per channel per month (the "MER Inputs" sheet). */
export interface MerInput {
  channel: SalesChannel;
  month: string;
  totalSales: number;
  /** Ad spend + other selling / marketing cost (samples, deal fees, agency, Reddit…). */
  marketingSellingCost: number;
  /** Allocated marketing payroll. */
  marketingPayroll: number;
  /** null = no paid-attribution data (e.g. Wholesale) — excluded from blended ROAS. */
  paidAdSales: number | null;
  paidAdSpend: number | null;
}

export interface MerRow extends MerInput {
  totalMarketingCost: number;
  mer: number;
  roas: number | null;
}

export function merRow(i: MerInput): MerRow {
  const totalMarketingCost = i.marketingSellingCost + i.marketingPayroll;
  return {
    ...i,
    totalMarketingCost,
    mer: div(i.totalSales, totalMarketingCost),
    roas: i.paidAdSales === null || i.paidAdSpend === null ? null : div(i.paidAdSales, i.paidAdSpend),
  };
}

/** Blended MER = Σ sales ÷ Σ total marketing cost. Blended ROAS = Σ paid sales ÷ Σ paid spend (N/A channels excluded). */
export function blended(rows: MerInput[]) {
  const totalSales = rows.reduce((a, r) => a + r.totalSales, 0);
  const totalCost = rows.reduce((a, r) => a + r.marketingSellingCost + r.marketingPayroll, 0);
  const paid = rows.filter((r) => r.paidAdSales !== null && r.paidAdSpend !== null);
  const paidSales = paid.reduce((a, r) => a + (r.paidAdSales ?? 0), 0);
  const paidSpend = paid.reduce((a, r) => a + (r.paidAdSpend ?? 0), 0);
  return { totalSales, totalCost, paidSales, paidSpend, mer: div(totalSales, totalCost), roas: div(paidSales, paidSpend) };
}
