// Sample stock outflow data for the last ~30 days: ShipStation stock decreases
// and the channel-side records that should explain them (Shopify / TikTok
// orders, Amazon FBA inbound, Walmart WFS inbound, manual requests, transfers,
// distributor shipments). Includes a few unexplained manual outflows and an
// FBA shipment that Amazon received short.

import type { ChannelRecord, Resolution, StockOutflow } from "../engine/outflows.ts";

const o = (
  id: string,
  date: string,
  sku: string,
  qty: number,
  kind: StockOutflow["kind"],
  reference: string,
  location: StockOutflow["location"] = "Brentwood",
): StockOutflow => ({ id, date, sku, location, qty, kind, reference });

const r = (
  id: string,
  source: ChannelRecord["source"],
  date: string,
  sku: string,
  qty: number,
  reference: string,
  extra: Partial<ChannelRecord> = {},
): ChannelRecord => ({
  id,
  source,
  reference,
  date,
  sku,
  qty,
  receivedQty: null,
  closed: false,
  requestedBy: null,
  note: "",
  ...extra,
});

export const stockOutflows: StockOutflow[] = [
  // Shopify / TikTok order shipments (weekly totals per SKU from ShipStation)
  o("SS-101", "2026-10-04", "CONTCHAOSCC5OZ", 186, "Order Shipment", "Shopify orders wk40"),
  o("SS-102", "2026-10-11", "CONTCHAOSCC5OZ", 204, "Order Shipment", "Shopify orders wk41"),
  o("SS-103", "2026-10-18", "CONTCHAOSCC5OZ", 241, "Order Shipment", "Shopify orders wk42"),
  o("SS-104", "2026-10-11", "MOISTAHR8OZPO", 222, "Order Shipment", "Shopify orders wk41"),
  o("SS-105", "2026-10-18", "MOISTAHR8OZPO", 236, "Order Shipment", "Shopify orders wk42"),
  o("SS-106", "2026-10-11", "CONTCHAOSCC5OZ", 92, "Order Shipment", "TikTok orders wk41"),
  o("SS-107", "2026-10-18", "CONTCHAOSCC5OZ", 121, "Order Shipment", "TikTok orders wk42"),
  // Transfers to Amazon FBA / Walmart WFS
  o("SS-201", "2026-10-06", "CONTCHAOSCC5OZ", 1200, "Transfer Out", "FBA15K2QX7"),
  o("SS-202", "2026-10-14", "MOISTAHR8OZPO", 900, "Transfer Out", "FBA15K3MZ1"),
  o("SS-203", "2026-10-21", "CONTCHAOSCC3OZ", 600, "Transfer Out", "FBA15K4TT9"),
  o("SS-204", "2026-10-09", "CLNSAHR8OZGFF", 300, "Transfer Out", "WFS-882104"),
  // Warehouse transfer Georgia → Brentwood
  o("SS-301", "2026-10-16", "CLNSAHR8OZGFF", 1200, "Transfer Out", "TR-GA-BW-1016", "Georgia"),
  // Distributor shipment
  o("SS-401", "2026-10-03", "MOISTAHR8OZPO", 480, "Manual Shipment", "BSE PO 30515"),
  // Manual shipments / adjustments
  o("SS-501", "2026-10-08", "CONTCHAOSCC5OZ", 24, "Manual Shipment", "Influencer kit – @curlqueen"),
  o("SS-502", "2026-10-12", "CCHAIRBRUSH1", 36, "Manual Shipment", "manual"),
  o("SS-503", "2026-10-15", "MOISTAHR8OZPO", 48, "Manual Shipment", "Salon education samples"),
  o("SS-504", "2026-10-19", "CONTCHAOSCC5OZ", 60, "Manual Shipment", "Walmart"),
  o("SS-505", "2026-10-22", "CLNSAHR8OZGFF", 72, "Inventory Adjustment", "damaged"),
  o("SS-506", "2026-09-29", "CCHAIRCOMBPW", 12, "Inventory Adjustment", "count correction"),
];

export const channelRecords: ChannelRecord[] = [
  // Shopify / TikTok fulfilled orders (from their APIs)
  r("SH-40-5", "Shopify", "2026-10-04", "CONTCHAOSCC5OZ", 186, "Shopify orders wk40"),
  r("SH-41-5", "Shopify", "2026-10-11", "CONTCHAOSCC5OZ", 204, "Shopify orders wk41"),
  r("SH-42-5", "Shopify", "2026-10-18", "CONTCHAOSCC5OZ", 241, "Shopify orders wk42"),
  r("SH-41-8", "Shopify", "2026-10-11", "MOISTAHR8OZPO", 222, "Shopify orders wk41"),
  r("SH-42-8", "Shopify", "2026-10-18", "MOISTAHR8OZPO", 236, "Shopify orders wk42"),
  r("TT-41-5", "TikTok Shop", "2026-10-11", "CONTCHAOSCC5OZ", 92, "TikTok orders wk41"),
  r("TT-42-5", "TikTok Shop", "2026-10-18", "CONTCHAOSCC5OZ", 121, "TikTok orders wk42"),
  // Amazon SP-API inbound shipments
  r("FBA-1", "Amazon FBA Inbound", "2026-10-06", "CONTCHAOSCC5OZ", 1200, "FBA15K2QX7", {
    receivedQty: 1152,
    closed: true,
    note: "Amazon closed shipment 18 Oct",
  }),
  r("FBA-2", "Amazon FBA Inbound", "2026-10-14", "MOISTAHR8OZPO", 900, "FBA15K3MZ1", {
    receivedQty: 900,
    closed: true,
  }),
  r("FBA-3", "Amazon FBA Inbound", "2026-10-21", "CONTCHAOSCC3OZ", 600, "FBA15K4TT9", {
    receivedQty: 240,
    closed: false,
    note: "Receiving in progress",
  }),
  // Walmart WFS inbound order
  r("WFS-1", "Walmart WFS Inbound", "2026-10-09", "CLNSAHR8OZGFF", 300, "WFS-882104", {
    receivedQty: 296,
    closed: false,
  }),
  // Warehouse transfer
  r("TR-1", "Warehouse Transfer", "2026-10-16", "CLNSAHR8OZGFF", 1200, "TR-GA-BW-1016", {
    note: "Georgia → Brentwood",
  }),
  // Distributor shipment (QuickBooks invoice 30515 shipped)
  r("DS-1", "Distributor Shipment", "2026-10-02", "MOISTAHR8OZPO", 480, "BSE PO 30515", {
    note: "Beauty Supply East",
  }),
  // Approved manual requests
  r("MR-1", "Manual Request", "2026-10-07", "CONTCHAOSCC5OZ", 24, "Influencer kit – @curlqueen", {
    requestedBy: "Marketing Manager",
  }),
  r("MR-2", "Manual Request", "2026-10-15", "MOISTAHR8OZPO", 24, "Salon education samples", {
    requestedBy: "Salon Rep – Southeast",
    note: "Approved for 24 units",
  }),
];

export const outflowResolutions: Resolution[] = [
  {
    outflowId: "SS-506",
    reason: "Count correction after September count sheet",
    by: "Sr Finance Officer",
    at: "2026-10-01",
  },
];
