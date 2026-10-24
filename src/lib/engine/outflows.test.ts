import { describe, expect, it } from "vitest";

import { inboundShortfalls, reconcileOutflows, reconEmail, reconSummary, type ChannelRecord, type StockOutflow } from "./outflows.ts";

const out = (id: string, date: string, qty: number, reference = "", sku = "A"): StockOutflow => ({ id, date, sku, location: "Brentwood", qty, kind: "Manual Shipment", reference });
const rec = (id: string, source: ChannelRecord["source"], date: string, qty: number, reference = "", over: Partial<ChannelRecord> = {}): ChannelRecord => ({
  id, source, reference, date, sku: "A", qty, receivedQty: null, closed: false, requestedBy: null, note: "", ...over,
});
const cost = () => 2;

describe("stock outflow matching", () => {
  it("explains an outflow with a record for the same SKU within ±3 days", () => {
    const [m] = reconcileOutflows([out("o1", "2026-10-10", 600, "FBA15ABC")], [rec("r1", "Amazon FBA Inbound", "2026-10-08", 600, "FBA15ABC")], [], cost);
    expect(m!.status).toBe("Explained");
    expect(m!.matches[0]!.record.id).toBe("r1");
  });

  it("leaves outflows outside the date window unexplained", () => {
    const [m] = reconcileOutflows([out("o1", "2026-10-10", 50)], [rec("r1", "Manual Request", "2026-10-01", 50)], [], cost);
    expect(m!.status).toBe("Unexplained");
    expect(m!.unexplainedValue).toBe(100);
  });

  it("never uses one record twice", () => {
    const ms = reconcileOutflows([out("o1", "2026-10-10", 40), out("o2", "2026-10-11", 40)], [rec("r1", "Manual Request", "2026-10-10", 60)], [], cost);
    const byId = new Map(ms.map((m) => [m.outflow.id, m]));
    expect(byId.get("o1")!.status).toBe("Explained");
    expect(byId.get("o2")!.status).toBe("Partly explained");
    expect(byId.get("o2")!.unexplainedQty).toBe(20);
  });

  it("prefers the record with the matching reference", () => {
    const [m] = reconcileOutflows([out("o1", "2026-10-10", 10, "#S1300")], [rec("r1", "Shopify", "2026-10-10", 10, "#S1299"), rec("r2", "Shopify", "2026-10-12", 10, "S1300")], [], cost);
    expect(m!.matches[0]!.record.id).toBe("r2");
  });

  it("treats a Finance resolution as explained", () => {
    const ms = reconcileOutflows([out("o1", "2026-10-10", 30)], [], [{ outflowId: "o1", reason: "Photo shoot samples", by: "Director Finance", at: "2026-10-12" }], cost);
    expect(ms[0]!.status).toBe("Explained");
    expect(reconSummary(ms).unexplainedUnits).toBe(0);
  });

  it("summarises explained share", () => {
    const ms = reconcileOutflows([out("o1", "2026-10-10", 75), out("o2", "2026-10-10", 25)], [rec("r1", "TikTok Shop", "2026-10-10", 75)], [], cost);
    expect(reconSummary(ms).explainedPct).toBe(0.75);
  });
});

describe("FBA / WFS shortfalls", () => {
  it("flags shipments received short and marks closed ones claimable", () => {
    const f = inboundShortfalls(
      [
        rec("r1", "Amazon FBA Inbound", "2026-10-01", 1200, "FBA1", { receivedQty: 1152, closed: true }),
        rec("r2", "Walmart WFS Inbound", "2026-10-15", 300, "WFS1", { receivedQty: 280, closed: false }),
        rec("r3", "Amazon FBA Inbound", "2026-10-20", 500, "FBA2"),
      ],
      cost,
    );
    expect(f).toHaveLength(2);
    expect(f[0]!.shortQty).toBe(48);
    expect(f[0]!.value).toBe(96);
    expect(f[0]!.claimable).toBe(true);
    expect(f[1]!.claimable).toBe(false);
  });

  it("writes the weekly Finance email", () => {
    const ms = reconcileOutflows([out("o1", "2026-10-20", 12, "samples")], [], [], cost);
    const e = reconEmail(ms, [], "2026-10-18", "2026-10-24", "finance@cc.example");
    expect(e.to).toBe("finance@cc.example");
    expect(e.subject.includes("1 open item")).toBe(true);
  });
});
