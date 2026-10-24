import { describe, expect, it } from "vitest";

import { batchTotals, departmentTotals, toPlannedPayment } from "./payroll.ts";
import { payrollBatches } from "../sample/payroll.ts";

const oct = payrollBatches[0]!;

describe("Pakistan payroll batch (Payroll New CDC Oct 26)", () => {
  it("matches the file's totals", () => {
    const t = batchTotals(oct);
    expect(t.employees).toBe(13);
    expect(t.grossPkr).toBe(1398451.87);
    expect(t.pfReleasePkr).toBe(12206.27);
    expect(t.netPkr).toBe(1410658.14);
    // USD = PKR / 278.22 → 5,070.30 in the Emp Wise Summary
    expect(t.netUsd).toBe(5070.3);
  });

  it("matches the Payroll Summary department totals", () => {
    const d = departmentTotals(oct);
    expect(d.find((x) => x.department === "Finance")!.netPkr).toBe(328750);
    expect(d.find((x) => x.department === "Digital Marketing")!.netPkr).toBe(1025508.14);
    expect(d.find((x) => x.department === "Brands Management Division")!.netPkr).toBe(56400);
  });

  it("becomes one planner row in USD", () => {
    const p = toPlannedPayment(oct);
    expect(p.source).toBe("Payroll");
    expect(p.amount).toBe(5070.3);
    expect(p.dueDate).toBe("2026-11-01");
    expect(p.status).toBe("Planned");
    expect(toPlannedPayment({ ...oct, status: "Paid" }).status).toBe("Paid");
  });
});
