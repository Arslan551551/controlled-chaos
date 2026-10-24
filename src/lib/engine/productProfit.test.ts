import { describe, expect, it } from "vitest";

import { actualRoas, breakevenRoas, buildProductPnl, margin, profitDrivers, type SkuChannelMonth } from "./productProfit.ts";

const row = (over: Partial<SkuChannelMonth>): SkuChannelMonth => ({
  sku: "A",
  channel: "Amazon",
  month: "2026-09",
  units: 100,
  grossSales: 2000,
  discounts: 100,
  refunds: 100,
  platformFees: 300,
  fulfillmentFees: 200,
  shippingCost: 0,
  adSpend: 150,
  sampleCost: 0,
  otherVariable: 0,
  ...over,
});

const base = {
  months: ["2026-09"],
  unitCost: (sku: string) => (sku === "A" ? 5 : 2),
  family: (sku: string) => (sku === "A" ? "Creme" : "Brushes"),
  label: (sku: string) => sku,
};

describe("layered product P&L", () => {
  const pnl = buildProductPnl({
    ...base,
    rows: [row({}), row({ sku: "B", channel: "TikTok Shop", units: 50, grossSales: 600, discounts: 60, refunds: 30, platformFees: 48, fulfillmentFees: 60, shippingCost: 205, adSpend: 120, sampleCost: 40 })],
    channelOverhead: { Amazon: 90 },
  });
  const a = pnl.lines.find((l) => l.sku === "A")!;

  it("builds net revenue → GP → CM1 → CM2 → NP", () => {
    expect(a.netRevenue).toBe(1800);
    expect(a.cogs).toBe(500);
    expect(a.gp).toBe(1300);
    expect(a.cm1).toBe(800);
    expect(a.cm2).toBe(650);
    expect(a.overhead).toBe(90);
    expect(a.np).toBe(560);
    expect(margin(a.gp, a)).toBeCloseTo(0.7222, 3);
  });

  it("totals reconcile across SKU, channel and family", () => {
    expect(pnl.total.np).toBe(pnl.bySku.reduce((t, x) => t + x.np, 0));
    expect(pnl.byChannel).toHaveLength(2);
    expect(pnl.byFamily.find((f) => f.family === "Brushes")!.cm2).toBe(510 - 100 - 48 - 60 - 205 - 120 - 40);
  });

  it("computes breakeven ROAS = net revenue ÷ CM1", () => {
    expect(breakevenRoas(a)).toBe(2.25);
    expect(actualRoas(a)).toBe(12);
  });

  it("filters to the selected months", () => {
    const p = buildProductPnl({ ...base, rows: [row({ month: "2026-08" })], channelOverhead: {} });
    expect(p.lines).toHaveLength(0);
  });
});

describe("profit drivers", () => {
  const current = buildProductPnl({
    ...base,
    rows: [row({}), row({ sku: "B", channel: "TikTok Shop", units: 50, grossSales: 600, discounts: 60, refunds: 30, platformFees: 48, fulfillmentFees: 60, shippingCost: 205, adSpend: 120, sampleCost: 40 })],
    channelOverhead: {},
  });
  const leaks = profitDrivers(current, 1, null, { "TikTok Shop": { shippingCost: 0.15 } });

  it("flags TikTok shipping above target with its monthly cost", () => {
    const ship = leaks.find((l) => l.id === "ch-TikTok Shop-shippingCost")!;
    expect(ship.perUnit).toBe(4.1);
    expect(ship.pctOfNet).toBeCloseTo(0.402, 3);
    expect(ship.monthlyImpact).toBeCloseTo(205 - 0.15 * 510, 2);
    expect(ship.benchmarkSource).toBe("target");
  });

  it("flags SKU × channel lines that lose money after marketing", () => {
    const sku = leaks.find((l) => l.id === "sku-B-TikTok Shop")!;
    expect(sku.monthlyImpact).toBe(-(510 - 100 - 48 - 60 - 205 - 120 - 40));
  });

  it("ranks biggest leaks first", () => {
    for (let i = 1; i < leaks.length; i++) expect(leaks[i - 1]!.monthlyImpact >= leaks[i]!.monthlyImpact).toBe(true);
  });
});
