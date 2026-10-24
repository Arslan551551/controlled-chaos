import { describe, expect, it } from "vitest";

import { addDays } from "./dates.ts";
import { burnOver, classifyTrend, planTransfer, runPlanning, type PlanningInput } from "./planning.ts";
import type { ActualSale, PlannedSale, PurchaseOrder, Sku } from "./types.ts";

const ASOF = "2026-10-24";

function sku(over: Partial<Sku> = {}): Sku {
  return {
    sku: "FG-1",
    description: "Test Creme",
    type: "Finished Goods",
    cogsMethod: "Tube Fill",
    linkedTubeSku: "TB-1",
    supplier: "Filler",
    moq: 5000,
    leadTimeDays: 60,
    tubeThresholdQty: 0,
    unitsPerBox: 0,
    active: true,
    shipStationStatus: "Complete",
    ...over,
  };
}

/** Flat daily sales for the last `days` days. */
function dailySales(skuCode: string, perDay: number, days = 30): ActualSale[] {
  return Array.from({ length: days }, (_, i) => ({
    id: `${skuCode}-${i}`,
    sku: skuCode,
    channel: "Amazon" as const,
    date: addDays(ASOF, -i),
    qty: perDay,
  }));
}

function po(over: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    po: "PO-1",
    type: "Finished Goods",
    sku: "FG-1",
    supplier: "Filler",
    openDate: "2026-10-01",
    orderedQty: 10000,
    receivedQty: 0,
    saleableQty: null,
    leadTimeDays: 60,
    eta: "2026-11-30",
    status: "Open",
    notes: "",
    installments: [],
    documents: [],
    ...over,
  };
}

function input(over: Partial<PlanningInput> = {}): PlanningInput {
  return {
    asOf: ASOF,
    skus: [sku()],
    stock: [
      { sku: "FG-1", location: "Brentwood", qty: 10000, sourceUpdatedAt: ASOF },
      { sku: "FG-1", location: "Georgia", qty: 10000, sourceUpdatedAt: ASOF },
    ],
    sales: dailySales("FG-1", 100),
    plannedSales: [],
    purchaseOrders: [],
    ...over,
  };
}

const first = (r: ReturnType<typeof runPlanning>) => r.finishedGoods[0]!;

describe("burn windows and Sales Trend", () => {
  it("averages 7/14/30-day fulfilled units", () => {
    const sales = [...dailySales("FG-1", 100, 30), ...dailySales("FG-1", 50, 7).map((s) => ({ ...s, id: s.id + "x" }))];
    expect(burnOver(sales, "FG-1", ASOF, 7)).toBe(150);
    expect(burnOver(sales, "FG-1", ASOF, 14)).toBe(125);
    expect(burnOver(sales, "FG-1", ASOF, 30)).toBeCloseTo(111.67, 1);
  });

  it("classifies trend from 14-day vs 30-day", () => {
    expect(classifyTrend(125, 100)).toBe("Accelerating");
    expect(classifyTrend(110, 100)).toBe("Stable");
    expect(classifyTrend(80, 100)).toBe("Declining");
  });

  it("flags a 7-day spike at 25%+ above the 30-day burn", () => {
    const sales = [...dailySales("FG-1", 100, 30), ...dailySales("FG-1", 50, 7).map((s) => ({ ...s, id: s.id + "s" }))];
    expect(first(runPlanning(input({ sales }))).spike).toBe(true);
    expect(first(runPlanning(input())).spike).toBe(false);
  });
});

describe("135-day trigger with lead-time safety", () => {
  it("says PO Now when cover is already below 135 days", () => {
    // 12,000 units / 100 per day = 120 days < 135
    const r = first(runPlanning(input({ stock: [{ sku: "FG-1", location: "Brentwood", qty: 12000, sourceUpdatedAt: ASOF }] })));
    expect(r.daysOfStockLeft).toBe(120);
    expect(r.poStatus).toBe("PO Now");
    expect(r.poOpenBy! <= ASOF).toBe(true);
  });

  it("moves PO Open By earlier by the lead time", () => {
    // 20,000 / 100 = 200 days. Cover reaches 135 days on day 65; open by = day 65 − 60 = day 5.
    const r = first(runPlanning(input()));
    expect(r.coverBreachDate).toBe(addDays(ASOF, 65));
    expect(r.poOpenBy).toBe(addDays(ASOF, 5));
    expect(r.poStatus).toBe("PO Due Soon");
  });

  it("reports No PO Required when cover is far above the floor", () => {
    const r = first(runPlanning(input({ stock: [{ sku: "FG-1", location: "Brentwood", qty: 40000, sourceUpdatedAt: ASOF }] })));
    expect(r.poStatus).toBe("No PO Required");
    expect(r.recommendedQty).toBe(0);
  });
});

describe("180-day recommended quantity and MOQ", () => {
  it("recommends 180 days of demand", () => {
    const r = first(runPlanning(input({ stock: [{ sku: "FG-1", location: "Brentwood", qty: 12000, sourceUpdatedAt: ASOF }] })));
    expect(r.recommendedQty).toBe(18000);
    expect(r.moqApplied).toBe(false);
  });

  it("raises the quantity to MOQ when 180 days is smaller", () => {
    const r = first(
      runPlanning(input({ skus: [sku({ moq: 25000 })], stock: [{ sku: "FG-1", location: "Brentwood", qty: 12000, sourceUpdatedAt: ASOF }] })),
    );
    expect(r.recommendedQty).toBe(25000);
    expect(r.moqApplied).toBe(true);
  });
});

describe("Additional PO", () => {
  it("never lets an existing open PO suppress a further requirement", () => {
    const r = first(
      runPlanning(
        input({
          stock: [{ sku: "FG-1", location: "Brentwood", qty: 12000, sourceUpdatedAt: ASOF }],
          purchaseOrders: [po({ orderedQty: 3000, eta: addDays(ASOF, 30) })],
        }),
      ),
    );
    expect(r.openPOQty).toBe(3000);
    expect(r.poStatus).toBe("Additional PO Required");
  });

  it("clears the requirement when the open PO restores cover", () => {
    const r = first(
      runPlanning(
        input({
          stock: [{ sku: "FG-1", location: "Brentwood", qty: 14000, sourceUpdatedAt: ASOF }],
          purchaseOrders: [po({ orderedQty: 30000, eta: addDays(ASOF, 2) })],
        }),
      ),
    );
    expect(r.poStatus).toBe("No PO Required");
  });
});

describe("partial receipt and closing with shortage", () => {
  it("uses only the remaining quantity while the PO is open", () => {
    const r = first(runPlanning(input({ purchaseOrders: [po({ orderedQty: 10000, receivedQty: 6000 })] })));
    expect(r.openPOQty).toBe(4000);
  });

  it("expects nothing more once the PO is closed", () => {
    const r = first(runPlanning(input({ purchaseOrders: [po({ orderedQty: 10000, receivedQty: 6000, status: "Closed" })] })));
    expect(r.openPOQty).toBe(0);
  });
});

describe("planned sales", () => {
  const big: PlannedSale = {
    id: "P1",
    sku: "FG-1",
    expectedDate: "2026-12-15",
    qty: 15000,
    reference: "Holiday bulk",
    status: "Confirmed",
    notes: "",
    delays: [],
  };

  it("pulls PO Open By earlier for a confirmed future sale", () => {
    const without = first(runPlanning(input({ stock: [{ sku: "FG-1", location: "Brentwood", qty: 30000, sourceUpdatedAt: ASOF }] })));
    const withSale = first(
      runPlanning(input({ stock: [{ sku: "FG-1", location: "Brentwood", qty: 30000, sourceUpdatedAt: ASOF }], plannedSales: [big] })),
    );
    expect(withSale.poOpenBy! < without.poOpenBy!).toBe(true);
    expect(withSale.activePlannedQty).toBe(15000);
  });

  it("does not change historical burn", () => {
    const r = first(runPlanning(input({ plannedSales: [big] })));
    expect(r.burn14).toBe(100);
  });

  it("ignores Tentative, Cancelled and Fulfilled sales", () => {
    for (const status of ["Tentative", "Cancelled", "Fulfilled"] as const) {
      const r = first(runPlanning(input({ plannedSales: [{ ...big, status }] })));
      expect(r.activePlannedQty).toBe(0);
    }
  });

  it("keeps Delayed sales as demand on the new date", () => {
    const delayed = { ...big, status: "Delayed" as const, expectedDate: "2027-01-20" };
    const r = first(runPlanning(input({ plannedSales: [delayed] })));
    expect(r.activePlannedQty).toBe(15000);
    const jan = r.months.find((m) => m.month === "2027-01")!;
    expect(jan.plannedDemand).toBe(15000);
  });

  it("flags past-due confirmed sales for review instead of cancelling", () => {
    const r = first(runPlanning(input({ plannedSales: [{ ...big, expectedDate: "2026-10-01" }] })));
    expect(r.pastDuePlanned).toHaveLength(1);
    expect(r.activePlannedQty).toBe(15000);
  });
});

describe("12-month projection", () => {
  it("puts inbound in the month of the real ETA", () => {
    const r = first(runPlanning(input({ purchaseOrders: [po({ orderedQty: 10000, eta: "2027-02-10" })] })));
    expect(r.months.find((m) => m.month === "2027-02")!.inbound).toBe(10000);
    expect(r.months.find((m) => m.month === "2026-11")!.inbound).toBe(0);
  });

  it("does not count the recommended quantity as inbound", () => {
    const r = first(runPlanning(input({ stock: [{ sku: "FG-1", location: "Brentwood", qty: 12000, sourceUpdatedAt: ASOF }] })));
    expect(r.months.reduce((a, m) => a + m.inbound, 0)).toBe(0);
  });
});

describe("60-day Brentwood transfer", () => {
  it("requires a transfer at or below 60 days when Georgia has stock", () => {
    const t = planTransfer(ASOF, 5000, 8000, 100);
    expect(t.status).toBe("Transfer Required");
    expect(t.minimumReferenceQty).toBe(1100);
  });

  it("warns ahead when Brentwood is projected to reach 60 days soon", () => {
    expect(planTransfer(ASOF, 7000, 8000, 100).status).toBe("Transfer Due Soon");
  });

  it("does not transfer when Georgia is empty", () => {
    expect(planTransfer(ASOF, 5000, 0, 100).status).toBe("No Georgia Stock");
  });
});

describe("Empty Tube requirement", () => {
  const tube = sku({ sku: "TB-1", description: "Tube", type: "Empty Tube", cogsMethod: "Component / Empty Tube", linkedTubeSku: null, moq: 5000, leadTimeDays: 40, tubeThresholdQty: 10000 });
  const fg = sku({ moq: 20000 });
  const base = {
    skus: [fg, tube],
    stock: [{ sku: "FG-1", location: "Brentwood" as const, qty: 12000, sourceUpdatedAt: ASOF }],
  };

  it("FG fill 20,000 + threshold 10,000 − stock 10,000 = 20,000 tubes", () => {
    const r = runPlanning(input({ ...base, stock: [...base.stock, { sku: "TB-1", location: "Tube Store", qty: 10000, sourceUpdatedAt: ASOF }] }));
    expect(r.tubes[0]!.fgRequirement).toBe(20000);
    expect(r.tubes[0]!.recommendedQty).toBe(20000);
    expect(r.tubes[0]!.status).toBe("Open Tube PO");
  });

  it("FG fill 20,000 + threshold 10,000 − stock 20,000 = 10,000 tubes", () => {
    const r = runPlanning(input({ ...base, stock: [...base.stock, { sku: "TB-1", location: "Tube Store", qty: 20000, sourceUpdatedAt: ASOF }] }));
    expect(r.tubes[0]!.recommendedQty).toBe(10000);
  });

  it("subtracts inbound tubes arriving in time and never goes below zero", () => {
    const r = runPlanning(
      input({
        ...base,
        stock: [...base.stock, { sku: "TB-1", location: "Tube Store", qty: 20000, sourceUpdatedAt: ASOF }],
        purchaseOrders: [po({ po: "PO-T", type: "Empty Tube", sku: "TB-1", orderedQty: 15000, eta: addDays(ASOF, 1) })],
      }),
    );
    expect(r.tubes[0]!.inboundInTime).toBe(15000);
    expect(r.tubes[0]!.recommendedQty).toBe(0);
    expect(r.tubes[0]!.status).toBe("No Tube PO Required");
  });

  it("applies tube MOQ when the calculated quantity is positive but small", () => {
    const r = runPlanning(input({ ...base, stock: [...base.stock, { sku: "TB-1", location: "Tube Store", qty: 28000, sourceUpdatedAt: ASOF }] }));
    expect(r.tubes[0]!.calculatedQty).toBe(2000);
    expect(r.tubes[0]!.recommendedQty).toBe(5000);
  });

  it("creates no tube requirement for Direct Purchase accessories", () => {
    const comb = sku({ sku: "ACC-1", type: "Accessory", cogsMethod: "Direct Purchase", linkedTubeSku: null });
    const r = runPlanning(input({ skus: [comb, tube], stock: [{ sku: "ACC-1", location: "Brentwood", qty: 1000, sourceUpdatedAt: ASOF }], sales: dailySales("ACC-1", 100) }));
    expect(r.finishedGoods[0]!.poStatus).toBe("PO Now");
    expect(r.tubes[0]!.fgRequirement).toBe(0);
  });
});
