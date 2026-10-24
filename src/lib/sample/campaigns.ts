// Sample marketing campaigns, traffic/conversion and MER inputs.
// Sep-26 MER inputs and Shopify source figures are the real numbers from
// "ROAS Report Summary Sep 3.xlsx"; other months and the campaigns are illustrative.

import type { Campaign, MerInput, TrafficSource } from "../engine/campaigns.ts";
import type { SalesChannel } from "../engine/types.ts";

const c = (x: Campaign) => x;

export const campaigns: Campaign[] = [
  c({ id: "CMP-01", name: "Prime Big Deal Days – Curl Creme 5oz", channel: "Amazon", type: "Prime Day Deal", owner: "Mehran (Amazon)", startDate: "2026-10-07", endDate: "2026-10-08", skus: ["CONTCHAOSCC5OZ"], discountPct: 25, budget: 6000,
    costs: { adSpend: 2400, discountCost: 3150, dealFees: 500, agencyFees: 0, influencerFees: 0, samplesCost: 0 },
    results: { orders: 790, units: 840, grossSales: 12600, netSales: 9450, newCustomers: 410, postDailyUnits: 41 }, baseline: { dailyUnits: 46, dailySales: 690 }, status: "Ended", notes: "Strong lift; demand dipped for a week afterwards." }),
  c({ id: "CMP-02", name: "Amazon 15% coupon – Hair Moisturizer 8oz", channel: "Amazon", type: "Amazon Coupon", owner: "Mehran (Amazon)", startDate: "2026-09-01", endDate: "2026-09-30", skus: ["MOISTAHR8OZPO"], discountPct: 15, budget: 3500,
    costs: { adSpend: 1900, discountCost: 1620, dealFees: 324, agencyFees: 0, influencerFees: 0, samplesCost: 0 },
    results: { orders: 1720, units: 1800, grossSales: 27000, netSales: 22950, newCustomers: 610, postDailyUnits: 52 }, baseline: { dailyUnits: 48, dailySales: 720 }, status: "Ended", notes: "" }),
  c({ id: "CMP-03", name: "Lightning Deal – Curl Creme 3oz", channel: "Amazon", type: "Lightning Deal", owner: "Mehran (Amazon)", startDate: "2026-08-19", endDate: "2026-08-19", skus: ["CONTCHAOSCC3OZ"], discountPct: 30, budget: 900,
    costs: { adSpend: 150, discountCost: 520, dealFees: 500, agencyFees: 0, influencerFees: 0, samplesCost: 0 },
    results: { orders: 160, units: 172, grossSales: 1720, netSales: 1200, newCustomers: 95 }, baseline: { dailyUnits: 36, dailySales: 360 }, status: "Ended", notes: "Deal fee ate the margin." }),
  c({ id: "CMP-04", name: "Labor Day sitewide 20% – SHOP20", channel: "Shopify", type: "Shopify Discount Code", owner: "Marketing Manager", startDate: "2026-08-29", endDate: "2026-09-02", skus: ["CONTCHAOSCC5OZ", "MOISTAHR8OZPO", "CLNSAHR8OZGFF"], discountPct: 20, budget: 2500,
    costs: { adSpend: 1400, discountCost: 1880, dealFees: 0, agencyFees: 450, influencerFees: 0, samplesCost: 0 },
    results: { orders: 520, units: 690, grossSales: 9400, netSales: 7520, newCustomers: 140, postDailyUnits: 18 }, baseline: { dailyUnits: 22, dailySales: 340 }, status: "Ended", notes: "Mostly returning customers used the code." }),
  c({ id: "CMP-05", name: "Google Shopping – Leave-In Spray push", channel: "Shopify", type: "Google Campaign", owner: "Sadam (Google)", startDate: "2026-09-01", endDate: "2026-09-30", skus: ["CC-LICS-8OZ", "CC-LICS-3.4OZ"], discountPct: 0, budget: 4000,
    costs: { adSpend: 3760.42, discountCost: 0, dealFees: 0, agencyFees: 0, influencerFees: 0, samplesCost: 0 },
    results: { orders: 61, units: 92, grossSales: 3221.21, netSales: 3221.21, newCustomers: 12 }, baseline: { dailyUnits: 1.2, dailySales: 42 }, status: "Ended", notes: "ROAS 0.86 — spend above sales." }),
  c({ id: "CMP-06", name: "Meta prospecting – Curl Creme bundle", channel: "Shopify", type: "Meta Campaign", owner: "Rafay (Meta)", startDate: "2026-09-01", endDate: "2026-09-30", skus: ["CONTCHAOSCC5OZ"], discountPct: 0, budget: 2500,
    costs: { adSpend: 2373.01, discountCost: 0, dealFees: 0, agencyFees: 0, influencerFees: 0, samplesCost: 0 },
    results: { orders: 9, units: 14, grossSales: 296.14, netSales: 296.14, newCustomers: 3 }, baseline: { dailyUnits: 0.1, dailySales: 2 }, status: "Ended", notes: "ROAS 0.12 — pause or rebuild creative." }),
  c({ id: "CMP-07", name: "Klaviyo win-back flow", channel: "Shopify", type: "Email/SMS", owner: "Marketing Manager", startDate: "2026-09-01", endDate: "2026-09-30", skus: ["CONTCHAOSCC5OZ", "MOISTAHR8OZPO"], discountPct: 10, budget: 700,
    costs: { adSpend: 582.36, discountCost: 240, dealFees: 0, agencyFees: 0, influencerFees: 0, samplesCost: 0 },
    results: { orders: 30, units: 128, grossSales: 2415.68, netSales: 2175.68, newCustomers: 2 }, baseline: { dailyUnits: 2.2, dailySales: 38 }, status: "Ended", notes: "" }),
  c({ id: "CMP-08", name: "TikTok 11.11 flash sale", channel: "TikTok Shop", type: "TikTok Flash Sale", owner: "Shumaila (TikTok)", startDate: "2026-11-10", endDate: "2026-11-12", skus: ["CONTCHAOSCC5OZ", "CONTCHAOSCC3OZ"], discountPct: 30, budget: 3000,
    costs: { adSpend: 0, discountCost: 0, dealFees: 0, agencyFees: 0, influencerFees: 0, samplesCost: 0 },
    results: { orders: 0, units: 0, grossSales: 0, netSales: 0, newCustomers: 0 }, baseline: { dailyUnits: 30, dailySales: 330 }, status: "Planned", notes: "Budget approved; creators briefed." }),
  c({ id: "CMP-09", name: "TikTok creator seeding – Sept", channel: "TikTok Shop", type: "TikTok Creator / Affiliate", owner: "Shumaila (TikTok)", startDate: "2026-09-01", endDate: "2026-09-30", skus: ["CONTCHAOSCC5OZ", "MOISTAHR8OZPO"], discountPct: 15, budget: 6500,
    costs: { adSpend: 3297.06, discountCost: 1150, dealFees: 0, agencyFees: 1837.66, influencerFees: 3014.02, samplesCost: 1664.58 },
    results: { orders: 478, units: 690, grossSales: 10013.13, netSales: 8863.13, newCustomers: 464 }, baseline: { dailyUnits: 9, dailySales: 120 }, status: "Ended", notes: "Join brand 1,837.66 + Direct Marketing 3,014.02 + free samples (ROAS report)." }),
  c({ id: "CMP-10", name: "Influencer reel – @curlqueen", channel: "TikTok Shop", type: "Influencer", owner: "Marketing Manager", startDate: "2026-09-22", endDate: "2026-09-28", skus: ["CONTCHAOSCC5OZ"], discountPct: 0, budget: 6000,
    costs: { adSpend: 0, discountCost: 0, dealFees: 0, agencyFees: 0, influencerFees: 6000, samplesCost: 180 },
    results: { orders: 210, units: 236, grossSales: 3300, netSales: 3300, newCustomers: 190 }, baseline: { dailyUnits: 9, dailySales: 120 }, status: "Ended", notes: "Flat fee — sales did not cover it." }),
  c({ id: "CMP-11", name: "Walmart Rollback – Hair Cleanser 8oz", channel: "Walmart", type: "Walmart Rollback", owner: "Walmart consultant", startDate: "2026-10-01", endDate: "2026-10-31", skus: ["CLNSAHR8OZGFF"], discountPct: 12, budget: 900,
    costs: { adSpend: 364.26, discountCost: 210, dealFees: 0, agencyFees: 0, influencerFees: 0, samplesCost: 0 },
    results: { orders: 118, units: 131, grossSales: 1750, netSales: 1540, newCustomers: 104 }, baseline: { dailyUnits: 2.4, dailySales: 32 }, status: "Live", notes: "Month to date." }),
  c({ id: "CMP-12", name: "Black Friday – Amazon coupon 25%", channel: "Amazon", type: "Amazon Coupon", owner: "Mehran (Amazon)", startDate: "2026-11-24", endDate: "2026-12-01", skus: ["CONTCHAOSCC5OZ", "MOISTAHR8OZPO"], discountPct: 25, budget: 9000,
    costs: { adSpend: 0, discountCost: 0, dealFees: 0, agencyFees: 0, influencerFees: 0, samplesCost: 0 },
    results: { orders: 0, units: 0, grossSales: 0, netSales: 0, newCustomers: 0 }, baseline: { dailyUnits: 94, dailySales: 1410 }, status: "Planned", notes: "Check PO cover for CONTCHAOSCC5OZ before launch." }),
];

const MONTHS = ["2026-07", "2026-08", "2026-09", "2026-10"];
/** Month scale vs September (Oct is month to date). */
const SCALE = [0.92, 0.97, 1, 0.78];

/** Shopify by first-click source — Sep sales / customers / spend are the real ROAS-report figures. Sessions & add-to-cart are sample values. */
const SHOPIFY_SEP: { source: TrafficSource["source"]; sessions: number; addToCart: number; orders: number; newC: number; retC: number; revenue: number; spend: number }[] = [
  { source: "google", sessions: 6200, addToCart: 410, orders: 34, newC: 12, retC: 22, revenue: 3221.21, spend: 3760.42 },
  { source: "facebook/instagram", sessions: 5100, addToCart: 160, orders: 5, newC: 3, retC: 2, revenue: 296.14, spend: 2373.01 },
  { source: "email", sessions: 1900, addToCart: 260, orders: 30, newC: 2, retC: 28, revenue: 2175.68, spend: 582.36 },
  { source: "direct", sessions: 1400, addToCart: 120, orders: 9, newC: 2, retC: 7, revenue: 1120.71, spend: 0 },
  { source: "others", sessions: 3600, addToCart: 540, orders: 101, newC: 8, retC: 93, revenue: 5005.93, spend: 0 },
  { source: "affiliate", sessions: 220, addToCart: 9, orders: 1, newC: 1, retC: 0, revenue: 139.49, spend: 0 },
];

/** Marketplaces: one row per channel (sessions / units style of Seller Central Business Report etc.). */
const MARKETPLACE_SEP: { channel: SalesChannel; sessions: number; addToCart: number; orders: number; newC: number; retC: number; revenue: number; spend: number }[] = [
  { channel: "Amazon", sessions: 61200, addToCart: 7300, orders: 3410, newC: 2150, retC: 1260, revenue: 51178.52, spend: 9604.51 },
  { channel: "TikTok Shop", sessions: 48500, addToCart: 2100, orders: 478, newC: 464, retC: 14, revenue: 8863.13, spend: 3297.06 },
  { channel: "Walmart", sessions: 5200, addToCart: 260, orders: 66, newC: 64, retC: 2, revenue: 1125.35, spend: 364.26 },
];

export const trafficSources: TrafficSource[] = MONTHS.flatMap((month, i) => {
  const k = SCALE[i] ?? 1;
  const r = (n: number) => Math.round(n * k);
  const m = (n: number) => Math.round(n * k * 100) / 100;
  return [
    ...SHOPIFY_SEP.map((s) => ({ channel: "Shopify" as SalesChannel, source: s.source, month, sessions: r(s.sessions), addToCart: r(s.addToCart), orders: r(s.orders), newCustomers: r(s.newC), returningCustomers: r(s.retC), revenue: m(s.revenue), adSpend: m(s.spend) })),
    ...MARKETPLACE_SEP.map((s) => ({ channel: s.channel, source: "marketplace" as const, month, sessions: r(s.sessions), addToCart: r(s.addToCart), orders: r(s.orders), newCustomers: r(s.newC), returningCustomers: r(s.retC), revenue: m(s.revenue), adSpend: m(s.spend) })),
  ];
});

/** MER inputs per channel — Sep-26 exactly as "MER Inputs" in the ROAS Report Summary. */
const MER_SEP: Omit<MerInput, "month">[] = [
  { channel: "Shopify", totalSales: 11959.16, marketingSellingCost: 7080.79, marketingPayroll: 3016.906, paidAdSales: 3517.35, paidAdSpend: 6133.43 },
  { channel: "Distributor", totalSales: 2628.52, marketingSellingCost: 0, marketingPayroll: 91.335, paidAdSales: null, paidAdSpend: null },
  { channel: "Amazon", totalSales: 51178.52, marketingSellingCost: 9632.21, marketingPayroll: 889.0818, paidAdSales: 15501.69, paidAdSpend: 9604.51 },
  { channel: "TikTok Shop", totalSales: 8863.13, marketingSellingCost: 6516.2611, marketingPayroll: 83.6915, paidAdSales: 5838.14, paidAdSpend: 3297.06 },
  { channel: "Walmart", totalSales: 1125.35, marketingSellingCost: 364.26, marketingPayroll: 0, paidAdSales: 673.47, paidAdSpend: 364.26 },
];

export const merInputs: MerInput[] = MONTHS.flatMap((month, i) => {
  const k = SCALE[i] ?? 1;
  const m = (n: number) => Math.round(n * k * 100) / 100;
  return MER_SEP.map((x) => ({
    ...x,
    month,
    totalSales: month === "2026-09" ? x.totalSales : m(x.totalSales),
    marketingSellingCost: month === "2026-09" ? x.marketingSellingCost : m(x.marketingSellingCost),
    marketingPayroll: x.marketingPayroll,
    paidAdSales: x.paidAdSales === null ? null : month === "2026-09" ? x.paidAdSales : m(x.paidAdSales),
    paidAdSpend: x.paidAdSpend === null ? null : month === "2026-09" ? x.paidAdSpend : m(x.paidAdSpend),
  }));
});
