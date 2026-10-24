import { describe, expect, it } from "vitest";

import {
  calculatePay,
  planForPeriod,
  reviewScore,
  type MetricSnapshot,
  type PayPlan,
  type ReviewRating,
} from "./kpiPlans.ts";
import { metricSnapshots, payPlans, reviewRatings } from "../sample/kpiPlans.ts";

const plan = (id: string): PayPlan => {
  const p = payPlans.find((x) => x.id === id);
  if (!p) throw new Error(`missing plan ${id}`);
  return p;
};
const snap = (period: string, over: Partial<MetricSnapshot> = {}): MetricSnapshot => {
  const s = metricSnapshots.find((x) => x.period === period);
  if (!s) throw new Error(`missing snapshot ${period}`);
  return { ...s, ...over, values: { ...s.values, ...(over.values ?? {}) } };
};
const ctx = (snapshot: MetricSnapshot, reviews: ReviewRating[] = reviewRatings) => ({
  snapshot,
  reviews,
  adjustments: [],
});
const custom = (
  period: string,
  values: Record<string, number>,
  pkrPerUsd = 278,
): MetricSnapshot => ({
  id: "T",
  period,
  values,
  sources: {},
  status: "Locked",
  lockedBy: "test",
  lockedAt: "2026-10-01",
  pkrPerUsd,
});

describe("Mehran — Amazon account manager", () => {
  it("Sep-26: 350 + 5% × (6,523.12 − 6,000) + 2% × (50,983.59 − 50,000) = 395.83", () => {
    const r = calculatePay(plan("PLAN-MEHRAN-1"), ctx(snap("2026-09")));
    expect(r.lines.map((l) => Math.round(l.amount * 100) / 100)).toEqual([350, 26.16, 19.67]);
    expect(r.totalUsd).toBeCloseTo(395.8278, 4);
    expect(r.lines[1]!.explanation).toBe("5% × (6,523.12 − 6,000.00) = 26.16");
  });

  it("Aug-26 inputs give 530.06", () => {
    const r = calculatePay(plan("PLAN-MEHRAN-1"), ctx(snap("2026-08")));
    expect(r.totalUsd).toBeCloseTo(530.06, 2);
  });

  it("follows the sheet (no zero floor) and warns when below threshold", () => {
    const r = calculatePay(
      plan("PLAN-MEHRAN-1"),
      ctx(custom("2026-10", { "amazon.sales": 49000, "amazon.netProfit": 5000 })),
    );
    expect(r.totalUsd).toBe(350 - 50 - 20);
    expect(r.lines[1]!.warnings).toHaveLength(1);
  });

  it("can floor variable parts at zero instead", () => {
    const p = plan("PLAN-MEHRAN-1");
    const floored: PayPlan = {
      ...p,
      components: p.components.map((c) =>
        c.kind === "pctAboveThreshold" ? { ...c, floorAtZero: true } : c,
      ),
    };
    expect(
      calculatePay(
        floored,
        ctx(custom("2026-10", { "amazon.sales": 49000, "amazon.netProfit": 5000 })),
      ).totalUsd,
    ).toBe(350);
  });
});

describe("Sadam & Rafay — Shopify acquisition + dual ROAS gate", () => {
  it("Sadam Aug-26: 29 × $5 = $145 = PKR 40,281 @ 277.8; ROAS incentive gated off", () => {
    const r = calculatePay(plan("PLAN-SADAM-1"), ctx(snap("2026-08", { pkrPerUsd: 277.8 })));
    expect(r.totalUsd).toBe(145);
    expect(r.totalPkr).toBe(40281);
    expect(r.lines[1]!.gated).toBe(true);
    expect(r.lines[1]!.conditions.map((c) => c.passed)).toEqual([false, false]);
  });

  it("Rafay Aug-26: 10 × $3 = $30 = PKR 8,322 @ 277.4", () => {
    const r = calculatePay(plan("PLAN-RAFAY-1"), ctx(snap("2026-08", { pkrPerUsd: 277.4 })));
    expect(r.totalUsd).toBe(30);
    expect(r.totalPkr).toBe(8322);
  });

  it("pays 5% of channel revenue when both ROAS targets are beaten", () => {
    const r = calculatePay(
      plan("PLAN-SADAM-1"),
      ctx(snap("2026-08", { values: { "google.roas": 2.6, "meta.roas": 1.6 } })),
    );
    expect(r.totalUsd).toBeCloseTo(145 + 0.05 * 4466.84, 4);
  });

  it("whole-count bands use the band the count falls in; marginal bands split the count", () => {
    const p = plan("PLAN-SADAM-1");
    const s = custom("2026-10", {
      "google.newCustomers": 50,
      "google.roas": 0,
      "meta.roas": 0,
      "google.revenue": 0,
    });
    expect(calculatePay(p, ctx(s)).totalUsd).toBe(350);
    const marginal: PayPlan = {
      ...p,
      components: p.components.map((c) =>
        c.kind === "perUnit" ? { ...c, mode: "marginal" as const } : c,
      ),
    };
    expect(calculatePay(marginal, ctx(s)).totalUsd).toBe(40 * 5 + 10 * 7);
  });
});

describe("Support team review bonus (bonus workbook, Aug-26)", () => {
  it("scores Excellent/Good/Fair/Poor as 100/75/35/0", () => {
    const r = reviewRatings.find((x) => x.personId === "P-ARSLAN")!;
    expect(reviewScore(r).score).toBeCloseTo(95.8333, 4);
  });

  it("Arslan: 16,500 × 21/21 × 95.83% = 15,812.50", () => {
    expect(calculatePay(plan("PLAN-ARSLAN-1"), ctx(snap("2026-08"))).totalPkr).toBe(15812.5);
  });

  it("Asim 20,000; Ayaz 20,000 × 25% = 5,000", () => {
    expect(calculatePay(plan("PLAN-ASIM-1"), ctx(snap("2026-08"))).totalPkr).toBe(20000);
    expect(calculatePay(plan("PLAN-AYAZ-1"), ctx(snap("2026-08"))).totalPkr).toBe(5000);
  });

  it("Shahrukh: 1% × 13,334.63 × 277.85 = 37,050.27", () => {
    expect(calculatePay(plan("PLAN-SHAHRUKH-1"), ctx(snap("2026-08"))).totalPkr).toBeCloseTo(
      37050.27,
      2,
    );
  });

  it("Hamza Bilal: 5,000 × 16/30 + 7,500 × 14/30 = 6,167 (rounded) and the September plan version applies after", () => {
    const aug = planForPeriod(payPlans, "P-HBILAL", "2026-08")!;
    expect(aug.id).toBe("PLAN-HBILAL-1");
    expect(calculatePay(aug, ctx(snap("2026-08"))).totalPkr).toBe(6167);
    expect(planForPeriod(payPlans, "P-HBILAL", "2026-09")!.id).toBe("PLAN-HBILAL-2");
  });

  it("the nine review-scored staff total 112,529.77 (register total 191,586.79 also carries typed Sadam 75,723.42 and Rafay 3,333.60)", () => {
    const ids = [
      "PLAN-ARSLAN-1",
      "PLAN-ASIM-1",
      "PLAN-AYAZ-1",
      "PLAN-SHAHRUKH-1",
      "PLAN-SOMAN-1",
      "PLAN-NAZMA-1",
      "PLAN-HNAVEED-1",
      "PLAN-HBILAL-1",
      "PLAN-ZUBIYA-1",
    ];
    const total = ids.reduce(
      (a, id) => a + calculatePay(plan(id), ctx(snap("2026-08"))).totalPkr,
      0,
    );
    expect(Math.round(total * 100) / 100).toBe(112529.77);
    expect(Math.round((total + 75723.4185 + 3333.6) * 100) / 100).toBe(191586.79);
  });

  it("a blank rating scores 0 and is flagged", () => {
    const reviews: ReviewRating[] = [
      {
        personId: "P-SOMAN",
        period: "2026-08",
        reviewer: "x",
        answers: [
          { question: "a", rating: "Excellent" },
          { question: "b", rating: null },
        ],
      },
    ];
    const r = calculatePay(plan("PLAN-SOMAN-1"), ctx(snap("2026-08"), reviews));
    expect(r.totalPkr).toBe(3750);
    expect(r.lines[0]!.warnings).toHaveLength(1);
  });

  it("manual additions and deductions are added to the total", () => {
    const r = calculatePay(plan("PLAN-SOMAN-1"), {
      snapshot: snap("2026-08"),
      reviews: reviewRatings,
      adjustments: [
        {
          id: "a1",
          personId: "P-SOMAN",
          period: "2026-08",
          amount: 1000,
          currency: "PKR",
          reason: "Extra campaign",
          by: "Director Finance",
        },
        {
          id: "a2",
          personId: "P-SOMAN",
          period: "2026-08",
          amount: -500,
          currency: "PKR",
          reason: "Advance",
          by: "Director Finance",
        },
      ],
    });
    expect(r.totalPkr).toBe(8000);
  });
});

describe("Walmart marginal slabs (gate: net sales ≥ 1,000 and ROAS ≥ 2.0)", () => {
  const pay = (sales: number, roas = 2.5) =>
    calculatePay(
      plan("PLAN-WALMART-1"),
      ctx(custom("2026-10", { "walmart.netSales": sales, "walmart.roas": roas })),
    ).totalUsd;
  it("matches the plan's table", () => {
    expect([999.99, 1000, 2500, 5000, 10000, 15000, 20000].map((s) => pay(s))).toEqual([
      0, 30, 75, 143.75, 268.75, 343.75, 418.75,
    ]);
  });
  it("pays nothing below ROAS 2.0 (Sep-26: ROAS 1.85)", () => {
    expect(pay(10000, 1.99)).toBe(0);
    expect(calculatePay(plan("PLAN-WALMART-1"), ctx(snap("2026-09"))).totalUsd).toBe(0);
  });
});

describe("TikTok GMV Max consultant (gate GMV ≥ 10k, max $520)", () => {
  const pay = (gmv: number, roas: number, growth: number) =>
    calculatePay(
      plan("PLAN-GMVMAX-1"),
      ctx(custom("2026-10", { "gmvmax.gmv": gmv, "gmvmax.roas": roas, "gmvmax.growth": growth })),
    ).totalUsd;
  it("reproduces the PDF examples", () => {
    expect(pay(10200, 1.9, 0.1)).toBe(100);
    expect(pay(16000, 3.0, 0.18)).toBe(325);
    expect(pay(27000, 4.6, 0.65)).toBe(520);
    expect(pay(27000, 4.2, 0.4)).toBe(450);
    expect(pay(9999, 6, 1)).toBe(0);
  });
});

describe("Shumaila — TikTok Shop", () => {
  it("GMV $17,000 → $100 GMV bonus on top of base and review bonus", () => {
    const r = calculatePay(
      plan("PLAN-SHUMAILA-1"),
      ctx(custom("2026-10", { "tiktok.gmv": 17000 }, 278), [
        {
          personId: "P-SHUMAILA",
          period: "2026-10",
          reviewer: "CEO",
          answers: [{ question: "q", rating: "Excellent" }],
        },
      ]),
    );
    expect(r.lines.map((l) => l.amount)).toEqual([45000, 10000, 100]);
    expect(r.totalPkr).toBe(45000 + 10000 + 100 * 278);
  });
});
