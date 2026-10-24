// Pay / KPI / bonus plans and month-end metric snapshots, rebuilt from the
// files Arslan shared (see docs/excel-analysis/). Figures are the real Aug-26 /
// Sep-26 inputs. No bank details or ID numbers are stored here.

import type {
  Band,
  Condition,
  MetricSnapshot,
  PayAdjustment,
  PayPlan,
  PlanComponent,
  Rating,
  ReviewRating,
  Tier,
} from "../engine/kpiPlans.ts";

export interface PlanPerson {
  id: string;
  name: string;
  code: string;
  role: string;
  department: string;
  managerId: string | null;
}

export const planPeople: PlanPerson[] = [
  {
    id: "P-ARSLAN",
    name: "Arslan Nasir",
    code: "CDC-011-22",
    role: "Director Finance",
    department: "Finance",
    managerId: null,
  },
  {
    id: "P-ASIM",
    name: "Asim Javed Butt",
    code: "CDC-013-26",
    role: "Creative Manager",
    department: "Digital Marketing",
    managerId: null,
  },
  {
    id: "P-AYAZ",
    name: "Ayaz Yasin",
    code: "CDC-012-26",
    role: "Google AdWords Manager",
    department: "Digital Marketing",
    managerId: null,
  },
  {
    id: "P-SHAHRUKH",
    name: "Muhammad Shahrukh Khan",
    code: "CDC-001-24",
    role: "Creative Content Strategist",
    department: "Digital Marketing",
    managerId: "P-ASIM",
  },
  {
    id: "P-SOMAN",
    name: "Soman Yasir",
    code: "CDC-003-24",
    role: "Jr Graphic Designer",
    department: "Digital Marketing",
    managerId: "P-ASIM",
  },
  {
    id: "P-NAZMA",
    name: "Nazma Shareef",
    code: "CDC-004-24",
    role: "Graphic Designer",
    department: "Digital Marketing",
    managerId: "P-ASIM",
  },
  {
    id: "P-HNAVEED",
    name: "Hamza Naveed",
    code: "CDC-008-26",
    role: "Finance Officer",
    department: "Finance",
    managerId: "P-ARSLAN",
  },
  {
    id: "P-HBILAL",
    name: "Hamza Bilal",
    code: "CDC-010-25",
    role: "Deputy Finance Manager",
    department: "Finance",
    managerId: "P-ARSLAN",
  },
  {
    id: "P-ZUBIYA",
    name: "Zubiya Shahid",
    code: "CDC-007-25",
    role: "Social Media & Research Intern",
    department: "Digital Marketing",
    managerId: "P-ASIM",
  },
  {
    id: "P-SADAM",
    name: "Sadam Hussain",
    code: "CDC-014-26",
    role: "Google Ads (Shopify)",
    department: "Digital Marketing",
    managerId: null,
  },
  {
    id: "P-RAFAY",
    name: "Muhammad Rafay",
    code: "CDC-015-26",
    role: "Meta Ads (Shopify)",
    department: "Digital Marketing",
    managerId: null,
  },
  {
    id: "P-MEHRAN",
    name: "Mehran",
    code: "CDC-009-26",
    role: "Amazon Account Manager",
    department: "Brands Management",
    managerId: null,
  },
  {
    id: "P-SHUMAILA",
    name: "Shumaila Mazhar",
    code: "CDC-006-25",
    role: "TikTok Shop",
    department: "Brands Management",
    managerId: null,
  },
  {
    id: "P-GMVMAX",
    name: "TikTok GMV Max Consultant",
    code: "VENDOR",
    role: "External consultant",
    department: "Marketing",
    managerId: null,
  },
  {
    id: "P-WALMART",
    name: "Walmart Channel Owner",
    code: "TBC",
    role: "Walmart owner (payee to confirm)",
    department: "Marketing",
    managerId: null,
  },
];

// ---------------------------------------------------------------- snapshots

export const metricSnapshots: MetricSnapshot[] = [
  {
    id: "SNAP-2026-08",
    period: "2026-08",
    status: "Locked",
    lockedBy: "Director Finance",
    lockedAt: "2026-09-06T10:00",
    // The August files use 277.4 / 277.8 / 277.85 / 278.5; the portal uses one rate per month.
    pkrPerUsd: 277.85,
    values: {
      "amazon.sales": 57804.79,
      "amazon.netProfit": 6479.32,
      "google.newCustomers": 29,
      "meta.newCustomers": 10,
      "google.revenue": 4466.84,
      "meta.revenue": 1277.46,
      "google.roas": 2.3282,
      "meta.roas": 0.3548,
      "shopify.revenue": 13334.63,
      "tiktok.gmv": 6725.85,
      "walmart.netSales": 365.8,
      "walmart.roas": 0,
    },
    sources: {
      "amazon.sales": "Sellerboard",
      "amazon.netProfit": "Sellerboard (after FMO indirect expenses)",
      "google.newCustomers": "Shopify first-click",
      "meta.newCustomers": "Shopify first-click",
      "google.revenue": "Shopify first-click",
      "meta.revenue": "Shopify first-click",
      "google.roas": "Shopify first-click ÷ Google Ads spend",
      "meta.roas": "Shopify first-click ÷ Meta spend",
      "shopify.revenue": "Shopify (base used in bonus sheet)",
      "tiktok.gmv": "QuickBooks TikTok revenue",
      "walmart.netSales": "QuickBooks Walmart sales",
      "walmart.roas": "Walmart Connect (not available)",
    },
  },
  {
    id: "SNAP-2026-09",
    period: "2026-09",
    status: "Draft",
    lockedBy: null,
    lockedAt: null,
    pkrPerUsd: 278.22,
    values: {
      "amazon.sales": 50983.59,
      "amazon.netProfit": 6523.12,
      "amazon.adSpend": 9604.51,
      "tiktok.gmv": 8863.13,
      "gmvmax.gmv": 5838.14,
      "gmvmax.roas": 1.7707,
      "gmvmax.growth": 0,
      "walmart.netSales": 1125.35,
      "walmart.roas": 1.8489,
    },
    sources: {
      "amazon.sales": "Sellerboard (pull 2 — differs from pull 1: 51,178.52)",
      "amazon.netProfit": "Sellerboard",
      "amazon.adSpend": "Sellerboard",
      "tiktok.gmv": "TikTok settlement net sales",
      "gmvmax.gmv": "TikTok Ads (source to confirm)",
      "gmvmax.roas": "TikTok Ads (source to confirm)",
      "gmvmax.growth": "Not yet calculated",
      "walmart.netSales": "CEO summary",
      "walmart.roas": "Walmart Connect",
    },
  },
];

// ---------------------------------------------------------------- reviews (Aug-26, from the bonus workbook)

const all = (n: number, r: Rating = "Excellent") =>
  Array.from({ length: n }, (_, i) => ({
    question: `Question ${i + 1}`,
    rating: r as Rating | null,
  }));

export const reviewRatings: ReviewRating[] = [
  {
    personId: "P-ARSLAN",
    period: "2026-08",
    reviewer: "CEO",
    answers: [
      { question: "Financial reporting accuracy & timeliness", rating: "Excellent" },
      { question: "Internal control", rating: "Excellent" },
      { question: "Cost reduction", rating: "Excellent" },
      { question: "AR efficiency", rating: "Excellent" },
      { question: "Team management", rating: "Good" },
      { question: "Cross-department coordination", rating: "Excellent" },
    ],
  },
  {
    personId: "P-ASIM",
    period: "2026-08",
    reviewer: "CEO",
    answers: [
      { question: "On-time video delivery", rating: "Excellent" },
      { question: "Quality / revisions", rating: "Excellent" },
      { question: "Creative CTR / conversion", rating: "Excellent" },
      { question: "Brand guidelines", rating: "Excellent" },
    ],
  },
  { personId: "P-AYAZ", period: "2026-08", reviewer: "CEO", answers: all(5) },
  { personId: "P-SHAHRUKH", period: "2026-08", reviewer: "Asim Javed Butt", answers: all(4) },
  { personId: "P-SOMAN", period: "2026-08", reviewer: "Asim Javed Butt", answers: all(4) },
  { personId: "P-NAZMA", period: "2026-08", reviewer: "Asim Javed Butt", answers: all(5) },
  { personId: "P-HNAVEED", period: "2026-08", reviewer: "Arslan Nasir", answers: all(7) },
  { personId: "P-HBILAL", period: "2026-08", reviewer: "Arslan Nasir", answers: all(7) },
  { personId: "P-ZUBIYA", period: "2026-08", reviewer: "Asim Javed Butt", answers: all(5) },
];

// ---------------------------------------------------------------- plans

const none = {
  conditions: [] as Condition[],
  conditionMode: "all" as const,
  cap: null,
  floor: null,
};

const reviewBonus = (
  id: string,
  personId: string,
  name: string,
  amount: number,
  opts: {
    days?: number;
    share?: number;
    scoreOverride?: number;
    ccShare?: number;
    notes?: string;
  } = {},
): PayPlan => ({
  id,
  personId,
  name,
  payCurrency: "PKR",
  effectiveFrom: "2026-08-01",
  effectiveTo: null,
  version: 1,
  controlledChaosShare: opts.ccShare ?? 1,
  cap: null,
  notes: opts.notes ?? "",
  components: [
    {
      id: `${id}-kpi`,
      label: "KPI bonus (review)",
      kind: "scoredReview",
      currency: "PKR",
      ...none,
      base: {
        kind: "amount",
        amount,
        daysWorked: opts.days ?? null,
        basisDays: opts.days === undefined ? null : 21,
        share: opts.share ?? 1,
      },
      scoreOverride: opts.scoreOverride ?? null,
    },
  ],
});

const shopifyBands = (b: Band[]): Band[] => b;

const gmvMaxGate: Condition[] = [{ metric: "gmvmax.gmv", op: ">=", value: 10000 }];
const gmvFixed: Tier[] = [
  { from: 10000, to: 15000, amount: 100 },
  { from: 15000, to: 20000, amount: 150 },
  { from: 20000, to: null, amount: 200 },
];

const comp = (c: PlanComponent) => c;

export const payPlans: PayPlan[] = [
  {
    id: "PLAN-MEHRAN-1",
    personId: "P-MEHRAN",
    name: "Amazon account manager",
    payCurrency: "USD",
    effectiveFrom: "2026-08-01",
    effectiveTo: null,
    version: 1,
    controlledChaosShare: 1,
    cap: null,
    notes:
      "Inputs from Sellerboard. TACoS shown but not paid on. Sheet has no zero floor on the variable parts — question for Arslan.",
    components: [
      comp({
        id: "M-1",
        label: "Retainer",
        kind: "fixed",
        currency: "USD",
        ...none,
        amount: 350,
        periods: [],
        roundTo: null,
      }),
      comp({
        id: "M-2",
        label: "Profit share",
        kind: "pctAboveThreshold",
        currency: "USD",
        ...none,
        metric: "amazon.netProfit",
        threshold: 6000,
        rate: 0.05,
        floorAtZero: false,
      }),
      comp({
        id: "M-3",
        label: "Growth commission",
        kind: "pctAboveThreshold",
        currency: "USD",
        ...none,
        metric: "amazon.sales",
        threshold: 50000,
        rate: 0.02,
        floorAtZero: false,
      }),
    ],
  },
  {
    id: "PLAN-SADAM-1",
    personId: "P-SADAM",
    name: "Google Ads (Shopify) incentive",
    payCurrency: "PKR",
    effectiveFrom: "2026-08-01",
    effectiveTo: null,
    version: 1,
    controlledChaosShare: 1,
    cap: null,
    notes:
      "Customer bands: whole-count or marginal not defined in the sheet (identical for counts ≤ 40).",
    components: [
      comp({
        id: "S-1",
        label: "New-customer incentive",
        kind: "perUnit",
        currency: "USD",
        ...none,
        metric: "google.newCustomers",
        mode: "whole",
        bands: shopifyBands([
          { from: 1, to: 40, rate: 5 },
          { from: 41, to: 80, rate: 7 },
          { from: 81, to: null, rate: 9 },
        ]),
      }),
      comp({
        id: "S-2",
        label: "ROAS incentive (5% of Google revenue)",
        kind: "pctOfMetric",
        currency: "USD",
        conditions: [
          { metric: "google.roas", op: ">", value: 2.5 },
          { metric: "meta.roas", op: ">", value: 1.5 },
        ],
        conditionMode: "all",
        cap: null,
        floor: null,
        metric: "google.revenue",
        rate: 0.05,
      }),
    ],
  },
  {
    id: "PLAN-RAFAY-1",
    personId: "P-RAFAY",
    name: "Meta Ads (Shopify) incentive",
    payCurrency: "PKR",
    effectiveFrom: "2026-08-01",
    effectiveTo: null,
    version: 1,
    controlledChaosShare: 1,
    cap: null,
    notes: "Same dual-ROAS gate as Sadam. Sheet converts at 277.4.",
    components: [
      comp({
        id: "R-1",
        label: "New-customer incentive",
        kind: "perUnit",
        currency: "USD",
        ...none,
        metric: "meta.newCustomers",
        mode: "whole",
        bands: [
          { from: 1, to: 50, rate: 3 },
          { from: 51, to: null, rate: 4 },
        ],
      }),
      comp({
        id: "R-2",
        label: "ROAS incentive (5% of Meta revenue)",
        kind: "pctOfMetric",
        currency: "USD",
        conditions: [
          { metric: "google.roas", op: ">", value: 2.5 },
          { metric: "meta.roas", op: ">", value: 1.5 },
        ],
        conditionMode: "all",
        cap: null,
        floor: null,
        metric: "meta.revenue",
        rate: 0.05,
      }),
    ],
  },
  reviewBonus("PLAN-ARSLAN-1", "P-ARSLAN", "Support team KPI bonus", 16500, {
    days: 21,
    ccShare: 0.55,
  }),
  reviewBonus("PLAN-ASIM-1", "P-ASIM", "Support team KPI bonus", 20000, { days: 21 }),
  reviewBonus("PLAN-AYAZ-1", "P-AYAZ", "Support team KPI bonus (25% CC share)", 20000, {
    share: 0.25,
    ccShare: 1,
    notes: "Sheet charges 25% to Controlled Chaos inside the achievable amount.",
  }),
  {
    id: "PLAN-SHAHRUKH-1",
    personId: "P-SHAHRUKH",
    name: "Creative content strategist (1% of Shopify revenue)",
    payCurrency: "PKR",
    effectiveFrom: "2026-08-01",
    effectiveTo: null,
    version: 1,
    controlledChaosShare: 1,
    cap: null,
    notes: "Which Shopify revenue is the base is not confirmed (13,334.63 used).",
    components: [
      comp({
        id: "SK-1",
        label: "KPI bonus (review)",
        kind: "scoredReview",
        currency: "PKR",
        ...none,
        base: {
          kind: "pctOfMetric",
          metric: "shopify.revenue",
          rate: 0.01,
          metricCurrency: "USD",
          share: 1,
        },
        scoreOverride: null,
      }),
    ],
  },
  reviewBonus("PLAN-SOMAN-1", "P-SOMAN", "Support team KPI bonus", 7500),
  reviewBonus("PLAN-NAZMA-1", "P-NAZMA", "Support team KPI bonus", 5000),
  reviewBonus("PLAN-HNAVEED-1", "P-HNAVEED", "Support team KPI bonus", 10000),
  {
    id: "PLAN-HBILAL-1",
    personId: "P-HBILAL",
    name: "Support team KPI bonus (Aug: mid-month raise)",
    payCurrency: "PKR",
    effectiveFrom: "2026-08-01",
    effectiveTo: "2026-08-31",
    version: 1,
    controlledChaosShare: 0.5,
    cap: null,
    notes: "5,000 for 16 days then 7,500 for 14 days, 30-day basis, rounded to whole PKR.",
    components: [
      comp({
        id: "HB-1",
        label: "KPI bonus (review, pro-rata)",
        kind: "scoredReview",
        currency: "PKR",
        ...none,
        base: {
          kind: "periods",
          periods: [
            { amount: 5000, days: 16, basisDays: 30 },
            { amount: 7500, days: 14, basisDays: 30 },
          ],
          roundTo: 1,
          share: 1,
        },
        scoreOverride: null,
      }),
    ],
  },
  {
    ...reviewBonus("PLAN-HBILAL-2", "P-HBILAL", "Support team KPI bonus", 7500, { ccShare: 0.5 }),
    effectiveFrom: "2026-09-01",
    version: 2,
  },
  reviewBonus("PLAN-ZUBIYA-1", "P-ZUBIYA", "Support team KPI bonus", 6000),
  {
    id: "PLAN-SHUMAILA-1",
    personId: "P-SHUMAILA",
    name: "TikTok Shop role",
    payCurrency: "PKR",
    effectiveFrom: "2026-08-01",
    effectiveTo: null,
    version: 1,
    controlledChaosShare: 1,
    cap: null,
    notes: "KPI bonus scoring rule not stated — assumed review-based. GMV definition to confirm.",
    components: [
      comp({
        id: "SH-1",
        label: "Base salary",
        kind: "fixed",
        currency: "PKR",
        ...none,
        amount: 45000,
        periods: [],
        roundTo: null,
      }),
      comp({
        id: "SH-2",
        label: "KPI bonus (review)",
        kind: "scoredReview",
        currency: "PKR",
        ...none,
        base: { kind: "amount", amount: 10000, daysWorked: null, basisDays: null, share: 1 },
        scoreOverride: null,
      }),
      comp({
        id: "SH-3",
        label: "GMV bonus",
        kind: "stepTier",
        currency: "USD",
        ...none,
        metric: "tiktok.gmv",
        tiers: [
          { from: 0, to: 10000, amount: 0 },
          { from: 10000, to: 15000, amount: 50 },
          { from: 15000, to: 20000, amount: 100 },
          { from: 20000, to: null, amount: 200 },
        ],
      }),
    ],
  },
  {
    id: "PLAN-GMVMAX-1",
    personId: "P-GMVMAX",
    name: "TikTok GMV Max consultant",
    payCurrency: "USD",
    effectiveFrom: "2026-08-01",
    effectiveTo: null,
    version: 1,
    controlledChaosShare: 1,
    cap: 520,
    notes: "Nothing paid below $10k GMV. ROAS bands made continuous (3.505 / 4.505).",
    components: [
      comp({
        id: "G-1",
        label: "Fixed (by GMV)",
        kind: "stepTier",
        currency: "USD",
        conditions: gmvMaxGate,
        conditionMode: "all",
        cap: null,
        floor: null,
        metric: "gmvmax.gmv",
        tiers: gmvFixed,
      }),
      comp({
        id: "G-2",
        label: "ROAS commission",
        kind: "stepTier",
        currency: "USD",
        conditions: gmvMaxGate,
        conditionMode: "all",
        cap: null,
        floor: null,
        metric: "gmvmax.roas",
        tiers: [
          { from: 0, to: 3, amount: 0 },
          { from: 3, to: 3.505, amount: 100 },
          { from: 3.505, to: 4.505, amount: 150 },
          { from: 4.505, to: null, amount: 200 },
        ],
      }),
      comp({
        id: "G-3",
        label: "Growth commission",
        kind: "stepTier",
        currency: "USD",
        conditions: gmvMaxGate,
        conditionMode: "all",
        cap: null,
        floor: null,
        metric: "gmvmax.growth",
        tiers: [
          { from: -1000, to: 0.15, amount: 0 },
          { from: 0.15, to: 0.35, amount: 75 },
          { from: 0.35, to: 0.6, amount: 100 },
          { from: 0.6, to: null, amount: 120 },
        ],
      }),
    ],
  },
  {
    id: "PLAN-WALMART-1",
    personId: "P-WALMART",
    name: "Walmart sales commission",
    payCurrency: "USD",
    effectiveFrom: "2026-08-01",
    effectiveTo: null,
    version: 1,
    controlledChaosShare: 1,
    cap: null,
    notes:
      "ROAS definition not in the plan (Walmart Connect attributed ÷ spend assumed). Payee to confirm.",
    components: [
      comp({
        id: "W-1",
        label: "Slab commission on eligible net sales",
        kind: "progressiveSlab",
        currency: "USD",
        conditions: [
          { metric: "walmart.netSales", op: ">=", value: 1000 },
          { metric: "walmart.roas", op: ">=", value: 2 },
        ],
        conditionMode: "all",
        cap: null,
        floor: null,
        metric: "walmart.netSales",
        slabs: [
          { from: 0, to: 2500, rate: 0.03 },
          { from: 2500, to: 5000, rate: 0.0275 },
          { from: 5000, to: 10000, rate: 0.025 },
          { from: 10000, to: null, rate: 0.015 },
        ],
      }),
    ],
  },
];

export const payAdjustments: PayAdjustment[] = [];

export type PayRunStatus = "Draft" | "Approved by CEO" | "Sent to payroll";

export interface PayRun {
  personId: string;
  period: string;
  status: PayRunStatus;
  approvedBy: string | null;
  approvedAt: string | null;
}

export const payRuns: PayRun[] = [
  {
    personId: "P-ARSLAN",
    period: "2026-08",
    status: "Sent to payroll",
    approvedBy: "CEO",
    approvedAt: "2026-09-08",
  },
  {
    personId: "P-ASIM",
    period: "2026-08",
    status: "Sent to payroll",
    approvedBy: "CEO",
    approvedAt: "2026-09-08",
  },
  {
    personId: "P-SADAM",
    period: "2026-08",
    status: "Approved by CEO",
    approvedBy: "CEO",
    approvedAt: "2026-09-08",
  },
];
