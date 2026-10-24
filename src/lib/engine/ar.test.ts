import { describe, expect, it } from "vitest";

import { agingBy, arPosition, bucketOf, dso, generateReminders, type ArInvoice, type ReminderRules } from "./ar.ts";

const ASOF = "2026-10-24";

function inv(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: "INV-1",
    customerId: "C1",
    customerName: "Glow Studios",
    customerType: "Salon",
    ownerId: "E-SR1",
    ownerName: "Salon Rep – Northeast",
    ownerEmail: "rep@cc.example",
    date: "2026-09-01",
    dueDate: "2026-10-01",
    amount: 1000,
    paid: 0,
    currency: "USD",
    fxToUsd: 1,
    ...over,
  };
}

const rules: ReminderRules = {
  daysBeforeDue: 3,
  onDueDate: true,
  overdueEveryDays: 7,
  escalateFinanceAt: 30,
  escalateCeoAt: 60,
  financeEmail: "finance@cc.example",
  ceoEmail: "ceo@cc.example",
};

describe("AR aging", () => {
  it("buckets by days past due", () => {
    expect(bucketOf(inv({ dueDate: "2026-10-30" }), ASOF)).toBe("Current");
    expect(bucketOf(inv({ dueDate: "2026-10-01" }), ASOF)).toBe("1–30");
    expect(bucketOf(inv({ dueDate: "2026-09-10" }), ASOF)).toBe("31–60");
    expect(bucketOf(inv({ dueDate: "2026-08-10" }), ASOF)).toBe("61–90");
    expect(bucketOf(inv({ dueDate: "2026-06-01" }), ASOF)).toBe("90+");
  });

  it("totals open, overdue and 60+ in USD (EUR converted)", () => {
    const p = arPosition(
      [
        inv({ id: "a", dueDate: "2026-11-10", amount: 500 }),
        inv({ id: "b", dueDate: "2026-10-01", amount: 1000, paid: 400 }),
        inv({ id: "c", dueDate: "2026-08-01", amount: 1000, currency: "EUR", fxToUsd: 1.2 }),
        inv({ id: "d", amount: 300, paid: 300 }),
      ],
      ASOF,
    );
    expect(p.open).toBe(2300);
    expect(p.overdue).toBe(1800);
    expect(p.over60).toBe(1200);
  });

  it("groups by owner", () => {
    const rows = agingBy([inv({ id: "a" }), inv({ id: "b", ownerId: "F", ownerName: "Finance" })], ASOF, (i) => ({ key: i.ownerId, label: i.ownerName, type: null, ownerName: i.ownerName }));
    expect(rows).toHaveLength(2);
    expect(rows[0]!.oldestDaysOverdue).toBe(23);
  });

  it("estimates days sales outstanding", () => {
    expect(dso([inv({ date: "2026-09-01", amount: 9000, paid: 6000 })], ASOF, 90)).toBe(30);
  });
});

describe("internal AR reminders", () => {
  it("reminds the owner before due and on the due date, never the customer", () => {
    const r = generateReminders([inv({ id: "a", dueDate: "2026-10-27" }), inv({ id: "b", dueDate: ASOF })], rules, ASOF, []);
    expect(r.map((x) => x.kind)).toEqual(["Before due", "Due today"]);
    expect(r.every((x) => x.to === "rep@cc.example")).toBe(true);
    expect(r[0]!.body.includes("not sent to the customer")).toBe(true);
  });

  it("repeats overdue reminders every N days", () => {
    const i = inv({ id: "a", dueDate: "2026-10-10" });
    expect(generateReminders([i], rules, ASOF, [{ invoiceId: "a", sentOn: "2026-10-20", kind: "Overdue", to: "rep@cc.example" }])).toHaveLength(0);
    expect(generateReminders([i], rules, ASOF, [{ invoiceId: "a", sentOn: "2026-10-17", kind: "Overdue", to: "rep@cc.example" }])).toHaveLength(1);
  });

  it("escalates to Finance at 30+ and the CEO at 60+ days", () => {
    const r = generateReminders([inv({ id: "a", dueDate: "2026-09-20" }), inv({ id: "b", dueDate: "2026-08-20" })], rules, ASOF, []);
    expect(r[0]!.cc).toEqual(["finance@cc.example", "ceo@cc.example"]);
    expect(r[1]!.cc).toEqual(["finance@cc.example"]);
  });

  it("skips paid invoices", () => {
    expect(generateReminders([inv({ paid: 1000 })], rules, ASOF, [])).toHaveLength(0);
  });
});
