import { describe, expect, it } from "vitest";

import { buildCogsBatches, runTubeLedger } from "./cogs.ts";
import { cashFlowOutlook, isValidAllocation, profitability, salesVsCash } from "./finance.ts";
import { calculateCommission, consultantScore, reviewScore, type CommissionPlan, type SalonOrder } from "./people.ts";
import { detectSubscriptions, newCountSheet, sheetProgress, sheetVariances, varianceEmail, type CountSheet } from "./operations.ts";
import type { PurchaseOrder } from "./types.ts";

describe("moving weighted-average tube cost", () => {
  const ledger = runTubeLedger([
    { id: "1", tubeSku: "TB", date: "2026-01-01", type: "Receipt", qty: 10000, unitCost: 0.5 },
    { id: "2", tubeSku: "TB", date: "2026-02-01", type: "Issue to Fill", qty: 6000, batch: "B1" },
    { id: "3", tubeSku: "TB", date: "2026-03-01", type: "Receipt", qty: 6000, unitCost: 0.6 },
    { id: "4", tubeSku: "TB", date: "2026-04-01", type: "Issue to Fill", qty: 5000, batch: "B2" },
  ]);

  it("blends remaining old stock with a new receipt", () => {
    // (4,000 × 0.50 + 6,000 × 0.60) / 10,000 = 0.56
    expect(ledger.rows[2]!.movingAverageAfter).toBe(0.56);
    expect(ledger.positions.get("TB")!.onHand).toBe(5000);
  });

  it("keeps each batch's historical snapshot", () => {
    expect(ledger.rows[1]!.appliedUnitCost).toBe(0.5);
    expect(ledger.rows[3]!.appliedUnitCost).toBe(0.56);
  });

  it("starts a new cost when old stock is fully consumed", () => {
    const r = runTubeLedger([
      { id: "1", tubeSku: "TB", date: "2026-01-01", type: "Receipt", qty: 100, unitCost: 0.5 },
      { id: "2", tubeSku: "TB", date: "2026-01-02", type: "Issue to Fill", qty: 100, batch: "X" },
      { id: "3", tubeSku: "TB", date: "2026-01-03", type: "Receipt", qty: 100, unitCost: 0.7 },
    ]);
    expect(r.positions.get("TB")!.weightedUnitCost).toBeCloseTo(0.7);
  });
});

describe("COGS batches", () => {
  const po = (over: Partial<PurchaseOrder>): PurchaseOrder => ({
    po: "PO-1",
    type: "Finished Goods",
    sku: "FG",
    supplier: "S",
    openDate: "2026-01-01",
    orderedQty: 10000,
    receivedQty: 10000,
    saleableQty: 9800,
    leadTimeDays: 60,
    eta: null,
    status: "Closed",
    notes: "",
    installments: [
      { id: "a", amount: 12000, dueDate: "2026-01-01", paid: true },
      { id: "b", amount: 8000, dueDate: null, paid: false },
    ],
    documents: [],
    ...over,
  });
  const ledger = runTubeLedger([
    { id: "1", tubeSku: "TB", date: "2026-01-01", type: "Receipt", qty: 10000, unitCost: 0.5 },
    { id: "2", tubeSku: "TB", date: "2026-02-01", type: "Issue to Fill", qty: 10000, batch: "B1" },
  ]).rows;

  it("Tube Fill: tentative = PO total / ordered qty + tube snapshot", () => {
    const [b] = buildCogsBatches(
      [{ batchId: "B1", po: "PO-1", sku: "FG", product: "Creme", method: "Tube Fill", linkedTubeSku: "TB", finalization: null }],
      [po({})],
      ledger,
    );
    expect(b!.tentativeBaseUnit).toBe(2);
    expect(b!.tentativeTubeSnapshot).toBe(0.5);
    expect(b!.tentativeFullUnit).toBe(2.5);
    expect(b!.status).toBe("Tentative");
  });

  it("finalization keeps tentative values and uses saleable qty", () => {
    const [b] = buildCogsBatches(
      [
        {
          batchId: "B1",
          po: "PO-1",
          sku: "FG",
          product: "Creme",
          method: "Tube Fill",
          linkedTubeSku: "TB",
          finalization: { finalBaseTotalCost: 20580, finalQty: 9800, finalizedBy: "Director Finance", finalizedAt: "2026-03-01" },
        },
      ],
      [po({})],
      ledger,
    );
    expect(b!.tentativeFullUnit).toBe(2.5);
    expect(b!.finalBaseUnit).toBe(2.1);
    expect(b!.finalFullUnit).toBe(2.6);
    expect(b!.status).toBe("Finalized");
  });

  it("Direct Purchase has no tube cost", () => {
    const [b] = buildCogsBatches(
      [{ batchId: "B9", po: "PO-1", sku: "ACC", product: "Comb", method: "Direct Purchase", linkedTubeSku: null, finalization: null }],
      [po({})],
      ledger,
    );
    expect(b!.tentativeTubeSnapshot).toBeNull();
    expect(b!.tentativeFullUnit).toBe(2);
  });
});

describe("cash flow outlook", () => {
  it("rolls month-end cash forward three months", () => {
    const months = cashFlowOutlook(
      [{ id: "a", name: "Chase", balance: 100000, syncedAt: "2026-10-24" }],
      [
        { id: "1", date: "2026-10-28", direction: "out", category: "PO Payment", description: "", amount: 30000, source: "Payment Planner" },
        { id: "2", date: "2026-10-30", direction: "in", category: "Marketplace Payout", description: "", amount: 20000, source: "Payout Forecast" },
        { id: "3", date: "2026-11-05", direction: "in", category: "Loan Receipt", description: "", amount: 50000, source: "Loan Schedule" },
        { id: "4", date: "2026-10-10", direction: "out", category: "PO Payment", description: "already paid", amount: 99999, source: "Payment Planner" },
      ],
      "2026-10-24",
    );
    expect(months).toHaveLength(3);
    expect(months[0]!.closing).toBe(90000);
    expect(months[1]!.opening).toBe(90000);
    expect(months[1]!.loanIn).toBe(50000);
    expect(months[2]!.closing).toBe(140000);
  });
});

describe("sales vs cash and profitability", () => {
  const sales = [{ channel: "Amazon" as const, month: "2026-09", grossSales: 100000, refunds: 5000, platformFees: 15000, expectedNet: 80000 }];

  it("shows the gap between expected payout and cash received", () => {
    const rows = salesVsCash(sales, [{ id: "r", channel: "Amazon", date: "2026-10-03", amount: 60000, reference: "", settlesMonth: "2026-09" }], ["2026-09"]);
    const amazon = rows.find((r) => r.channel === "Amazon")!;
    expect(amazon.outstanding).toBe(20000);
    expect(amazon.collectedPct).toBe(0.75);
  });

  it("splits shared expenses by the entered percentages", () => {
    const { rows, unallocated } = profitability(
      sales,
      [{ channel: "Amazon", month: "2026-09", unitsSold: 1000, cogs: 30000, fulfillment: 5000, adSpend: 10000 }],
      [
        { id: "e1", date: "2026-09-15", vendor: "Agency", category: "Marketing", description: "", amount: 10000, allocation: { Amazon: 40, Shopify: 60 }, source: "Manual" },
        { id: "e2", date: "2026-09-15", vendor: "Rent", category: "Rent", description: "", amount: 5000, allocation: null, source: "QuickBooks" },
      ],
      ["2026-09"],
    );
    const amazon = rows.find((r) => r.channel === "Amazon")!;
    expect(amazon.allocatedExpenses).toBe(4000);
    expect(amazon.netProfit).toBe(100000 - 5000 - 15000 - 30000 - 5000 - 10000 - 4000);
    expect(unallocated.map((e) => e.id)).toEqual(["e2"]);
    expect(isValidAllocation({ Amazon: 50, Shopify: 40 })).toBe(false);
  });
});

describe("Salon Direct commission", () => {
  const plans: CommissionPlan[] = [
    { id: "p1", name: "Standard", repId: "r1", accountId: null, firstOrderPct: 10, recurringPct: 5, recurringMonths: 6, effectiveFrom: "2026-01-01", effectiveTo: null },
    { id: "p2", name: "Key account forever", repId: "r1", accountId: "acc-key", firstOrderPct: 12, recurringPct: 3, recurringMonths: null, effectiveFrom: "2026-01-01", effectiveTo: null },
  ];
  const order = (id: string, accountId: string, date: string, netAmount = 1000): SalonOrder => ({
    id, accountId, repId: "r1", date, netAmount, source: "Manual", shopifyOrderNumber: null, status: "Approved",
  });

  it("pays first-order rate once, then recurring within the window", () => {
    const lines = calculateCommission(
      [order("o1", "acc", "2026-02-01"), order("o2", "acc", "2026-05-01"), order("o3", "acc", "2026-09-01")],
      plans,
    );
    expect(lines.map((l) => [l.basis, l.commission])).toEqual([
      ["First Order", 100],
      ["Recurring", 50],
      ["Outside Recurring Window", 0],
    ]);
  });

  it("uses an account override with recurring forever", () => {
    const lines = calculateCommission([order("o1", "acc-key", "2026-02-01"), order("o2", "acc-key", "2028-02-01")], plans);
    expect(lines.map((l) => l.commission)).toEqual([120, 30]);
  });
});

describe("KPIs", () => {
  it("weights manager review scores (4/5 = 100%)", () => {
    const template = { id: "t", name: "", department: "", criteria: [{ id: "a", name: "", weight: 60 }, { id: "b", name: "", weight: 40 }] };
    expect(reviewScore({ id: "r", employeeId: "e", month: "2026-10", reviewerId: "m", scores: { a: 4, b: 5 }, comments: "", status: "Submitted" }, template)).toBe(110);
  });

  it("scores consultants on ROAS (higher better) and TACoS (lower better)", () => {
    const s = consultantScore({ consultantId: "c", scope: "", targetRoas: 4, targetTacos: 0.1, roasWeight: 50, tacosWeight: 50 }, 3, 0.125);
    expect(s.roasPct).toBe(75);
    expect(s.tacosPct).toBe(80);
    expect(s.score).toBe(77.5);
  });
});

describe("stock count and subscriptions", () => {
  const sheet: CountSheet = {
    id: "cs",
    month: "2026-10",
    location: "Brentwood",
    status: "In Progress",
    notes: "",
    sentAt: null,
    adjustedBy: null,
    adjustedAt: null,
    lines: [
      { sku: "A", countedAt: "2026-10-20T10:00", boxes: 81, unitsPerBox: 12, looseUnits: 8, systemQty: 1000, counter: "W" },
      { sku: "B", countedAt: "2026-10-21T09:00", boxes: null, unitsPerBox: 0, looseUnits: 500, systemQty: 500, counter: "W" },
      { sku: "C", countedAt: "2026-10-22T09:00", boxes: 197, unitsPerBox: 4925, looseUnits: null, systemQty: 4700, counter: "W" },
      { sku: "D", countedAt: null, boxes: null, unitsPerBox: 24, looseUnits: null, systemQty: null, counter: null },
    ],
  };
  const master = (sku: string) => (sku === "C" ? 24 : sku === "A" ? 12 : 0);

  it("counts boxes × units/box + loose units against ShipStation", () => {
    const lines = sheetVariances(sheet, () => 2.5, master);
    expect(lines[0]!.counted).toBe(980);
    expect(lines[0]!.variance).toBe(-20);
    expect(lines[0]!.valueImpact).toBe(-50);
    expect(lines[0]!.needsReview).toBe(true);
    expect(lines[1]!.variance).toBe(0);
    expect(lines[3]!.counted).toBeNull();
  });

  it("tracks progress across different count days", () => {
    expect(sheetProgress(sheet).counted).toBe(3);
    expect(sheetProgress(sheet).total).toBe(4);
  });

  it("flags a units/box typo like the 4,925 on the Sep sheet", () => {
    const lines = sheetVariances(sheet, () => 1, master);
    expect(lines[2]!.anomaly).toBe(true);
    expect(lines[0]!.anomaly).toBe(false);
  });

  it("emails Finance only the counted lines with a difference", () => {
    const email = varianceEmail(sheet, sheetVariances(sheet, () => 1, master), "f@x.com");
    expect(email.subject.includes("(2 SKUs)")).toBe(true);
    expect(email.body.includes("• B")).toBe(false);
  });

  it("lists SKUs fastest burn first, like the Excel sheet", () => {
    const s = newCountSheet("n", "2026-11", "Georgia", [
      { sku: "slow", unitsPerBox: 12, burnPerDay: 5 },
      { sku: "fast", unitsPerBox: 24, burnPerDay: 150 },
    ]);
    expect(s.lines.map((l) => l.sku)).toEqual(["fast", "slow"]);
    expect(s.status).toBe("In Progress");
  });

  it("detects unregistered recurring merchants", () => {
    const found = detectSubscriptions(
      [
        { id: "1", date: "2026-08-03", merchant: "CANVA* 1234", amount: 120, account: "Amex" },
        { id: "2", date: "2026-09-03", merchant: "CANVA* 9876", amount: 120, account: "Amex" },
        { id: "3", date: "2026-09-10", merchant: "UBER EATS", amount: 45, account: "Amex" },
      ],
      [],
    );
    expect(found).toHaveLength(1);
    expect(found[0]!.merchant).toBe("CANVA");
    expect(found[0]!.finding).toBe("Not registered");
  });
});

describe("distributor ledgers (Maly's workbook)", () => {
  it("rebuilds the marketing fund and product credit balances", async () => {
    const { distributorPositions } = await import("./distributors.ts");
    const d = { id: "malys", name: "Maly's", legalName: "Excel Salon Products, Inc d/b/a Malys", contact: "Scott Missad", email: "", city: "Grand Rapids, MI", country: "US", currency: "USD" as const, model: "Wholesale" as const, paymentTermsDays: 30, creditLimit: 50000, marketingFundPct: 4, status: "Active" as const, fxToUsd: 1, priceList: {} };
    const paid = (id: string, date: string, amount: number) => ({ id, distributorId: "malys", date, dueDate: date, amount, payments: [{ date, amount }], link: null });
    const invoices = [
      paid("30001", "2026-02-24", 30202.75), paid("30144", "2026-05-08", 2153.49), paid("30182", "2026-05-08", 196),
      paid("30216", "2026-05-18", 968.13), paid("30221", "2026-06-08", 509), paid("30350", "2026-07-24", 2907.03), paid("30531", "2026-10-02", 448.98),
    ];
    const e = (id: string, ledger: "Marketing Fund" | "Product Credit", date: string, type: any, plus: number, minus: number) => ({ id, distributorId: "malys", ledger, date, type, ref: id, description: "", plus, minus, support: null, source: "Manual" as const });
    const [p] = distributorPositions([d], invoices, [
      e("30072", "Marketing Fund", "2026-03-13", "Goods Issued", 0, 539.28),
      e("30115", "Product Credit", "2026-03-13", "Credit Memo", 1000, 0),
      e("30113", "Product Credit", "2026-03-27", "Credit Memo", 645.25, 0),
      e("30144", "Product Credit", "2026-04-27", "Credit Applied", 0, 1645.25),
      e("30301", "Product Credit", "2026-06-05", "Credit Memo", 1000, 0),
      e("30403", "Product Credit", "2026-07-10", "Credit Memo", 87.78, 0),
      e("30531", "Product Credit", "2026-10-02", "Credit Applied", 0, 87.78),
    ], "2026-10-24", "2026-01-01");
    expect(p!.marketingFund[0]!.plus).toBe(1208.11);
    expect(p!.marketingFundBalance).toBe(956.14);
    expect(p!.productCreditBalance).toBe(1000);
    expect(p!.openAR).toBe(0);
  });

  it("does not create fund on the part of an invoice settled with credit or fund", async () => {
    const { autoFundEntries } = await import("./distributors.ts");
    const d = { id: "x", marketingFundPct: 4 } as any;
    const entries = autoFundEntries(d, [{ id: "1", distributorId: "x", date: "2026-04-01", dueDate: "2026-05-01", amount: 3798.74, link: null,
      payments: [{ date: "2026-04-27", amount: 1645.25, method: "Credit / Fund Applied" }, { date: "2026-05-08", amount: 2153.49, method: "Cash" }] }]);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.plus).toBe(86.14);
  });
});

describe("consignment distributor", () => {
  it("tracks stock at the distributor and sales still to invoice", async () => {
    const { consignmentPosition } = await import("./distributors.ts");
    const [p] = consignmentPosition(
      [
        { id: "1", distributorId: "nl", date: "2026-06-01", sku: "CC-5OZ", type: "Shipment to Distributor", qty: 5000, reference: "" },
        { id: "2", distributorId: "nl", date: "2026-07-31", sku: "CC-5OZ", type: "Reported Sale", qty: 1200, unitPrice: 6, invoiceId: "INV-1", reference: "" },
        { id: "3", distributorId: "nl", date: "2026-08-31", sku: "CC-5OZ", type: "Reported Sale", qty: 800, unitPrice: 6, invoiceId: null, reference: "" },
        { id: "4", distributorId: "nl", date: "2026-09-10", sku: "CC-5OZ", type: "Return to Us", qty: 100, reference: "" },
      ],
      "nl",
      () => 2.5,
    );
    expect(p!.onHandAtDistributor).toBe(2900);
    expect(p!.soldNotInvoicedQty).toBe(800);
    expect(p!.soldNotInvoicedValue).toBe(4800);
    expect(p!.stockValueAtCost).toBe(7250);
  });
});

describe("JB consignment report", () => {
  it("values remaining stock at the EUR price list in USD", async () => {
    const { consignmentPosition } = await import("./distributors.ts");
    const { consignmentMovements, distributors } = await import("../sample/people.ts");
    const jb = distributors.find((d) => d.id === "D-NL")!;
    const rows = consignmentPosition(consignmentMovements, "D-NL", () => 0, jb);
    const total = Math.round(rows.reduce((a, r) => a + r.remainingValueAtPriceUsd, 0) * 100) / 100;
    expect(total).toBe(37744.97);
    expect(rows.reduce((a, r) => a + r.shipped, 0)).toBe(2688);
    expect(rows.reduce((a, r) => a + r.sold, 0)).toBe(215);
  });
});

describe("weekly cash schedule", () => {
  it("rolls cash week by week (Mon–Sun) from today", async () => {
    const { weeklyCash, weekMonday } = await import("./finance.ts");
    expect(weekMonday("2026-10-24")).toBe("2026-10-19");
    const weeks = weeklyCash(
      [{ id: "a", name: "Chase", balance: 100000, syncedAt: "2026-10-24" }],
      [
        { id: "1", date: "2026-10-25", direction: "out", category: "PO Payment", description: "", amount: 10000, source: "Payment Planner" },
        { id: "2", date: "2026-10-27", direction: "in", category: "Marketplace Payout", description: "", amount: 4000, source: "Payout Forecast" },
        { id: "3", date: "2026-11-01", direction: "out", category: "Payroll", description: "", amount: 5070.3, source: "Payroll file" },
        { id: "4", date: "2026-10-20", direction: "out", category: "PO Payment", description: "past", amount: 999, source: "Payment Planner" },
      ],
      "2026-10-24",
      3,
    );
    expect(weeks).toHaveLength(3);
    expect(weeks[0]!.weekStart).toBe("2026-10-24");
    expect(weeks[0]!.weekEnd).toBe("2026-10-25");
    expect(weeks[0]!.closing).toBe(90000);
    expect(weeks[1]!.weekStart).toBe("2026-10-26");
    expect(weeks[1]!.outByCategory["Payroll"]).toBe(5070.3);
    expect(weeks[1]!.closing).toBeCloseTo(88929.7, 2);
    expect(weeks[2]!.opening).toBeCloseTo(88929.7, 2);
  });
});
