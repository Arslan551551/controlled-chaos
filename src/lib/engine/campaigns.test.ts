import { describe, expect, it } from "vitest";

import { analyzeCampaign, blended, campaignDays, funnel, merRow, type Campaign, type MerInput } from "./campaigns.ts";

const base: Campaign = {
  id: "C1",
  name: "Test coupon",
  channel: "Amazon",
  type: "Amazon Coupon",
  owner: "Mehran",
  startDate: "2026-09-01",
  endDate: "2026-09-10",
  skus: ["A"],
  discountPct: 20,
  budget: 3000,
  costs: { adSpend: 1000, discountCost: 2000, dealFees: 200, agencyFees: 0, influencerFees: 0, samplesCost: 0 },
  results: { orders: 900, units: 1000, grossSales: 15000, netSales: 12000, newCustomers: 300 },
  baseline: { dailyUnits: 50, dailySales: 750 },
  status: "Ended",
  notes: "",
};

describe("campaign analysis", () => {
  it("counts campaign days inclusively", () => {
    expect(campaignDays(base)).toBe(10);
  });

  it("measures lift over baseline and profit after discount and COGS", () => {
    const a = analyzeCampaign(base, () => 3);
    // baseline 500 units / $7,500; incremental 500 units / $4,500
    expect(a.incrementalUnits).toBe(500);
    expect(a.incrementalSales).toBe(4500);
    expect(a.liftPct).toBe(1);
    // GP = 4,500 − 500 × 3 = 3,000; cash cost = 1,200 → profit 1,800
    expect(a.incrementalGrossProfit).toBe(3000);
    expect(a.incrementalProfit).toBe(1800);
    expect(a.totalCost).toBe(3200);
    expect(a.roi).toBeCloseTo(0.5625, 4);
    expect(a.cac).toBe(10.67);
    expect(a.roas).toBe(12);
    expect(a.verdict).toBe("Profitable");
  });

  it("flags a big-selling campaign that gave the margin away", () => {
    const a = analyzeCampaign({ ...base, costs: { ...base.costs, adSpend: 4000 }, results: { ...base.results, netSales: 9000 } }, () => 3);
    // incremental sales 1,500 − 1,500 COGS = 0 GP; cash cost 4,200
    expect(a.incrementalProfit).toBe(-4200);
    expect(a.verdict).toBe("Lost money");
  });

  it("detects a post-campaign dip", () => {
    expect(analyzeCampaign({ ...base, results: { ...base.results, postDailyUnits: 30 } }, () => 3).postCampaignDip).toBe(true);
    expect(analyzeCampaign(base, () => 3).postCampaignDip).toBe(false);
  });
});

describe("conversion funnel", () => {
  it("computes CVR, AOV, new-customer share and CAC", () => {
    const f = funnel("Shopify", [
      { channel: "Shopify", source: "google", month: "2026-09", sessions: 1000, addToCart: 100, orders: 25, newCustomers: 10, returningCustomers: 15, revenue: 1500, adSpend: 500 },
      { channel: "Shopify", source: "email", month: "2026-09", sessions: 1000, addToCart: 100, orders: 25, newCustomers: 0, returningCustomers: 25, revenue: 1500, adSpend: 0 },
    ]);
    expect(f.conversionRate).toBe(0.025);
    expect(f.atcRate).toBe(0.1);
    expect(f.cartToOrder).toBe(0.25);
    expect(f.aov).toBe(60);
    expect(f.newCustomerShare).toBe(0.2);
    expect(f.cac).toBe(50);
  });
});

describe("MER and ROAS (ROAS Report Summary, Sep 2026)", () => {
  const sep: MerInput[] = [
    { channel: "Shopify", month: "2026-09", totalSales: 11959.16, marketingSellingCost: 7080.79, marketingPayroll: 3016.906, paidAdSales: 3517.35, paidAdSpend: 6133.43 },
    { channel: "Distributor", month: "2026-09", totalSales: 2628.52, marketingSellingCost: 0, marketingPayroll: 91.335, paidAdSales: null, paidAdSpend: null },
    { channel: "Amazon", month: "2026-09", totalSales: 51178.52, marketingSellingCost: 9632.21, marketingPayroll: 889.0818, paidAdSales: 15501.69, paidAdSpend: 9604.51 },
    { channel: "TikTok Shop", month: "2026-09", totalSales: 8863.13, marketingSellingCost: 6516.2611, marketingPayroll: 83.6915, paidAdSales: 5838.14, paidAdSpend: 3297.06 },
    { channel: "Walmart", month: "2026-09", totalSales: 1125.35, marketingSellingCost: 364.26, marketingPayroll: 0, paidAdSales: 673.47, paidAdSpend: 364.26 },
  ];

  it("reproduces channel MER", () => {
    expect(merRow(sep[0]!).mer).toBeCloseTo(1.1843, 4);
    expect(merRow(sep[1]!).mer).toBeCloseTo(28.7789, 4);
    expect(merRow(sep[1]!).roas).toBeNull();
  });

  it("reproduces blended MER 2.7373 and blended ROAS 1.3161", () => {
    const b = blended(sep);
    expect(b.mer).toBeCloseTo(2.7373, 4);
    expect(b.roas).toBeCloseTo(1.3161, 4);
    expect(Math.round(b.paidSales * 100) / 100).toBe(25530.65);
    expect(Math.round(b.paidSpend * 100) / 100).toBe(19399.26);
  });
});
