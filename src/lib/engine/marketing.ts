// Marketing portal metrics. Ad platform data (Amazon Ads, Meta, Google Ads,
// TikTok Ads) is synced into one normalized table, like sales.

import type { SalesChannel } from "./types.ts";

export type AdPlatform = "Amazon Ads" | "Meta Ads" | "Google Ads" | "TikTok Ads";
export const AD_PLATFORMS: AdPlatform[] = ["Amazon Ads", "Meta Ads", "Google Ads", "TikTok Ads"];

export interface AdMetric {
  platform: AdPlatform;
  /** Sales channel the ads drive (Meta/Google mostly drive Shopify). */
  channel: SalesChannel;
  month: string;
  spend: number;
  impressions: number;
  clicks: number;
  orders: number;
  adSales: number;
}

export interface MarketingSummary {
  key: string;
  spend: number;
  adSales: number;
  impressions: number;
  clicks: number;
  orders: number;
  /** Ad sales / spend */
  roas: number;
  /** Spend / ad sales */
  acos: number;
  /** Spend / total channel sales (ad + organic) */
  tacos: number;
  ctr: number;
  cpc: number;
  cvr: number;
  cpa: number;
}

export function summarize(key: string, rows: AdMetric[], totalSales: number): MarketingSummary {
  const spend = sum(rows, (r) => r.spend);
  const adSales = sum(rows, (r) => r.adSales);
  const impressions = sum(rows, (r) => r.impressions);
  const clicks = sum(rows, (r) => r.clicks);
  const orders = sum(rows, (r) => r.orders);
  return {
    key,
    spend,
    adSales,
    impressions,
    clicks,
    orders,
    roas: div(adSales, spend),
    acos: div(spend, adSales),
    tacos: div(spend, totalSales),
    ctr: div(clicks, impressions),
    cpc: div(spend, clicks),
    cvr: div(orders, clicks),
    cpa: div(spend, orders),
  };
}

function sum<T>(rows: T[], f: (r: T) => number) {
  return rows.reduce((a, r) => a + f(r), 0);
}
function div(a: number, b: number) {
  return b > 0 ? a / b : 0;
}
