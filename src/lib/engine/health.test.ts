import { describe, expect, it } from "vitest";

import { healthScore, type HealthSignal } from "./health.ts";

const sig = (area: HealthSignal["area"], severity: HealthSignal["severity"]): HealthSignal => ({
  id: `${area}-${severity}-${Math.random()}`,
  area,
  severity,
  title: "",
  detail: "",
  monthlySaving: 0,
  suggestion: null,
});

describe("healthScore", () => {
  it("is 100 with no problems", () => {
    expect(healthScore([sig("Cash", "good")])).toBe(100);
  });

  it("counts each area once, by its worst signal", () => {
    const many = Array.from({ length: 12 }, () => sig("Subscriptions", "warning"));
    expect(healthScore(many)).toBe(92);
    expect(
      healthScore([...many, sig("Profitability", "critical"), sig("Profitability", "warning")]),
    ).toBe(72);
  });

  it("never goes below 0", () => {
    const areas: HealthSignal["area"][] = [
      "Cash",
      "Profitability",
      "Marketing",
      "Subscriptions",
      "Inventory",
      "Collections",
      "Distributors",
    ];
    expect(healthScore(areas.map((a) => sig(a, "critical")))).toBe(0);
  });
});
