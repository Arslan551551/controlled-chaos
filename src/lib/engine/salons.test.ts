import { describe, expect, it } from "vitest";

import {
  autoTagShopifyOrders,
  matchSalon,
  nextClientCode,
  type SalonAccount,
  type ShopifyOrder,
} from "./people.ts";

const addr = { street: "1 Main St", city: "Atlanta", state: "GA", zip: "30301", country: "US" };
const salon = (
  id: string,
  code: number,
  name: string,
  email: string,
  repId = "R1",
): SalonAccount => ({
  id,
  clientCode: code,
  name,
  contactName: "",
  email,
  phone: "",
  shippingAddress: addr,
  billingAddress: addr,
  repId,
  onboardedOn: "2026-01-01",
  shopifyCustomerId: null,
});
const order = (number: string, customer: string, email: string): ShopifyOrder => ({
  number,
  date: "2026-10-20",
  customer,
  email,
  netAmount: 500,
});

const salons = [
  salon("S1", 101, "Crown & Coil Studio", "danielle@crown.example", "R1"),
  salon("S2", 102, "Peachtree Curl Co", "orders@peach.example", "R2"),
];

describe("client codes", () => {
  it("starts at 101", () => expect(nextClientCode([])).toBe(101));
  it("continues from the highest code", () => {
    expect(nextClientCode(salons)).toBe(103);
    expect(nextClientCode([...salons, salon("S9", 150, "X", "x@x")])).toBe(151);
  });
});

describe("Shopify matching", () => {
  it("matches on email, ignoring case", () => {
    const m = matchSalon(order("#1", "Danielle Brooks", "Danielle@Crown.example"), salons);
    expect(m?.account.id).toBe("S1");
    expect(m?.by).toBe("email");
  });
  it("falls back to salon name, ignoring punctuation", () => {
    const m = matchSalon(order("#2", "Peachtree Curl Co.", "someone@else.example"), salons);
    expect(m?.account.id).toBe("S2");
    expect(m?.by).toBe("name");
  });
  it("returns null when nothing matches", () => {
    expect(matchSalon(order("#3", "Bloom Salon", "bloom@example.com"), salons)).toBeNull();
  });
  it("tags matched orders to the salon's rep and leaves the rest", () => {
    let n = 0;
    const res = autoTagShopifyOrders(
      [
        order("#1", "Danielle Brooks", "danielle@crown.example"),
        order("#2", "Bloom Salon", "bloom@example.com"),
      ],
      salons,
      (p) => `${p}-${++n}`,
    );
    expect(res.tagged).toHaveLength(1);
    expect(res.tagged[0]).toMatchObject({
      accountId: "S1",
      repId: "R1",
      status: "Pending Review",
      shopifyOrderNumber: "#1",
      matchedBy: "email",
    });
    expect(res.untagged.map((o) => o.number)).toEqual(["#2"]);
  });
});
