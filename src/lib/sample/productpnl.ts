// Sample SKU × channel × month sales and variable costs (Jul–Oct 2026) for
// product profitability. Live: Amazon settlements / Sellerboard, Shopify orders,
// TikTok and Walmart settlements, wholesale invoices, ad platforms.
//
// Note: these SKUs cover roughly 75% of each channel's gross sales in
// sample/finance.ts channelSales — the rest is products not in the prototype
// catalogue (men's line, scrunchies, gels…). Ad spend is the channel's ad spend
// from adMetrics, attributed to SKUs by revenue share × an ad-intensity factor.
// Built-in leaks: TikTok shipping and samples, Amazon fees ~31%, Walmart
// refunds, brush and hair pick thin on TikTok.

import type { SkuChannelMonth } from "../engine/productProfit.ts";
import type { SalesChannel } from "../engine/types.ts";
import { adMetrics, channelSales, SALES_MONTHS } from "./finance.ts";

/** Product family used for grouping ("Brush + Hair Pick on all platforms"). */
export const productFamilies: Record<string, string> = {
  CONTCHAOSCC5OZ: "Curl Creme",
  CONTCHAOSCC3OZ: "Curl Creme",
  "32-OZ-CURLCREME": "Curl Creme",
  MOISTAHR8OZPO: "Moisturizer",
  "32-OZ-HAIRMOISTURIZER": "Moisturizer",
  CLNSAHR8OZGFF: "Cleanser",
  "32-OZ-HAIRCLEANSER": "Cleanser",
  "CC-LICS-8OZ": "Leave-In Spray",
  "CC-LICS-3.4OZ": "Leave-In Spray",
  CCHAIRBRUSH1: "Brushes, Combs & Picks",
  CCHAIRCOMBPW: "Brushes, Combs & Picks",
  "IE-O3AV-F28K": "Brushes, Combs & Picks",
};

/** Retail price per SKU; salons pay ~55% and distributors ~45% of retail. */
const RETAIL: Record<string, number> = {
  CONTCHAOSCC5OZ: 17.99,
  MOISTAHR8OZPO: 15.99,
  CONTCHAOSCC3OZ: 12.99,
  CLNSAHR8OZGFF: 15.99,
  CCHAIRCOMBPW: 9.99,
  CCHAIRBRUSH1: 14.99,
  "32-OZ-CURLCREME": 49.99,
  "32-OZ-HAIRMOISTURIZER": 44.99,
  "32-OZ-HAIRCLEANSER": 42.99,
  "CC-LICS-8OZ": 16.99,
  "CC-LICS-3.4OZ": 9.99,
  "IE-O3AV-F28K": 8.99,
};

/** Share of the channel's gross sales by SKU (sums to ~0.75). */
const RETAIL_MIX: Record<string, number> = {
  CONTCHAOSCC5OZ: 0.2,
  MOISTAHR8OZPO: 0.14,
  CONTCHAOSCC3OZ: 0.1,
  CLNSAHR8OZGFF: 0.1,
  CCHAIRCOMBPW: 0.03,
  CCHAIRBRUSH1: 0.04,
  "32-OZ-CURLCREME": 0.03,
  "32-OZ-HAIRMOISTURIZER": 0.025,
  "32-OZ-HAIRCLEANSER": 0.015,
  "CC-LICS-8OZ": 0.03,
  "CC-LICS-3.4OZ": 0.02,
  "IE-O3AV-F28K": 0.015,
};
const TRADE_MIX: Record<string, number> = {
  CONTCHAOSCC5OZ: 0.18,
  MOISTAHR8OZPO: 0.14,
  CONTCHAOSCC3OZ: 0.06,
  CLNSAHR8OZGFF: 0.1,
  CCHAIRCOMBPW: 0.02,
  CCHAIRBRUSH1: 0.02,
  "32-OZ-CURLCREME": 0.08,
  "32-OZ-HAIRMOISTURIZER": 0.06,
  "32-OZ-HAIRCLEANSER": 0.04,
  "CC-LICS-8OZ": 0.03,
  "CC-LICS-3.4OZ": 0.01,
  "IE-O3AV-F28K": 0.01,
};

interface ChannelRates {
  priceFactor: number;
  discountPct: number;
  refundPct: number;
  platformFeePct: number;
  fulfilPerUnit: number;
  shipPerUnit: number;
  samplePct: number;
  otherPct: number;
  /** Extra ad intensity for small accessories (pushed with ads on social). */
  accessoryAdBoost: number;
}

const RATES: Record<SalesChannel, ChannelRates> = {
  Amazon: {
    priceFactor: 1,
    discountPct: 0.03,
    refundPct: 0.03,
    platformFeePct: 0.155,
    fulfilPerUnit: 2.9,
    shipPerUnit: 0,
    samplePct: 0,
    otherPct: 0.005,
    accessoryAdBoost: 1.2,
  },
  Shopify: {
    priceFactor: 1,
    discountPct: 0.08,
    refundPct: 0.04,
    platformFeePct: 0.035,
    fulfilPerUnit: 1.2,
    shipPerUnit: 2.6,
    samplePct: 0.01,
    otherPct: 0,
    accessoryAdBoost: 1.3,
  },
  "TikTok Shop": {
    priceFactor: 0.94,
    discountPct: 0.1,
    refundPct: 0.06,
    platformFeePct: 0.08,
    fulfilPerUnit: 1.2,
    shipPerUnit: 4.1,
    samplePct: 0.045,
    otherPct: 0,
    accessoryAdBoost: 2.2,
  },
  Walmart: {
    priceFactor: 1,
    discountPct: 0.02,
    refundPct: 0.07,
    platformFeePct: 0.15,
    fulfilPerUnit: 4.4,
    shipPerUnit: 0,
    samplePct: 0,
    otherPct: 0,
    accessoryAdBoost: 1,
  },
  "Salon Direct": {
    priceFactor: 0.55,
    discountPct: 0.05,
    refundPct: 0.01,
    platformFeePct: 0,
    fulfilPerUnit: 0.6,
    shipPerUnit: 1.1,
    samplePct: 0.01,
    otherPct: 0.07,
    accessoryAdBoost: 1,
  },
  Distributor: {
    priceFactor: 0.45,
    discountPct: 0,
    refundPct: 0,
    platformFeePct: 0,
    fulfilPerUnit: 0.35,
    shipPerUnit: 0.4,
    samplePct: 0,
    otherPct: 0.04,
    accessoryAdBoost: 1,
  },
};

/** SKU × channel overrides: the brush is heavily discounted on TikTok to compete. */
const OVERRIDES: Record<string, Partial<ChannelRates>> = {
  "CCHAIRBRUSH1|TikTok Shop": { discountPct: 0.22, samplePct: 0.07 },
  "IE-O3AV-F28K|TikTok Shop": { discountPct: 0.15 },
};

const ACCESSORIES = new Set(["CCHAIRBRUSH1", "CCHAIRCOMBPW", "IE-O3AV-F28K"]);
const r2 = (n: number) => Math.round(n * 100) / 100;

function build(): SkuChannelMonth[] {
  const out: SkuChannelMonth[] = [];
  const channels = Object.keys(RATES) as SalesChannel[];
  for (const channel of channels) {
    const rate = RATES[channel];
    const mix = channel === "Salon Direct" || channel === "Distributor" ? TRADE_MIX : RETAIL_MIX;
    for (const month of SALES_MONTHS) {
      const channelGross =
        channelSales.find((c) => c.channel === channel && c.month === month)?.grossSales ?? 0;
      const channelAds = adMetrics
        .filter((a) => a.channel === channel && a.month === month)
        .reduce((t, a) => t + a.spend, 0);
      const weights = Object.entries(mix).map(
        ([sku, w]) => [sku, w * (ACCESSORIES.has(sku) ? rate.accessoryAdBoost : 1)] as const,
      );
      const weightTotal = weights.reduce((t, [, w]) => t + w, 0);
      // Ads attributed to our SKUs: their share of channel gross (~75%) of the channel's spend
      const attributableAds = channelAds * Object.values(mix).reduce((t, w) => t + w, 0);
      for (const [sku, share] of Object.entries(mix)) {
        const r = { ...rate, ...OVERRIDES[`${sku}|${channel}`] };
        const price = r2((RETAIL[sku] ?? 10) * rate.priceFactor);
        const units = Math.round((channelGross * share) / price);
        if (units <= 0) continue;
        const gross = r2(units * price);
        const adWeight = (weights.find(([s]) => s === sku)?.[1] ?? 0) / (weightTotal || 1);
        out.push({
          sku,
          channel,
          month,
          units,
          grossSales: gross,
          discounts: r2(gross * r.discountPct),
          refunds: r2(gross * r.refundPct),
          platformFees: r2(gross * r.platformFeePct),
          fulfillmentFees: r2(units * r.fulfilPerUnit),
          shippingCost: r2(units * r.shipPerUnit),
          adSpend: r2(attributableAds * adWeight),
          sampleCost: r2(gross * r.samplePct * (ACCESSORIES.has(sku) ? 1.6 : 1)),
          otherVariable: r2(gross * r.otherPct),
        });
      }
    }
  }
  return out;
}

export const skuChannelMonth: SkuChannelMonth[] = build();
