// Stock Outflow Reconciliation.
// Every stock decrease in ShipStation (Brentwood / Georgia) must be explained by
// a channel-side record: a Shopify / TikTok order, an Amazon FBA inbound
// shipment, a Walmart WFS inbound order, an approved manual / sample /
// influencer request, a warehouse transfer or a distributor shipment.
// Anything left unexplained goes to Finance. FBA / WFS shipments where the
// marketplace received fewer units than we sent become claim candidates.

import { daysBetween } from "./dates.ts";

export type OutflowKind = "Order Shipment" | "Manual Shipment" | "Inventory Adjustment" | "Transfer Out";

/** A stock decrease recorded in ShipStation. */
export interface StockOutflow {
  id: string;
  date: string;
  sku: string;
  location: "Brentwood" | "Georgia";
  /** Units that left (positive). */
  qty: number;
  kind: OutflowKind;
  /** Order number, shipment ID or the note typed in ShipStation. */
  reference: string;
}

export type RecordSource =
  | "Shopify"
  | "TikTok Shop"
  | "Amazon FBA Inbound"
  | "Walmart WFS Inbound"
  | "Manual Request"
  | "Warehouse Transfer"
  | "Distributor Shipment";

/** A channel-side record that explains units leaving the warehouse. */
export interface ChannelRecord {
  id: string;
  source: RecordSource;
  reference: string;
  date: string;
  sku: string;
  qty: number;
  /** For FBA / WFS: units the marketplace has received (null = still in transit / not reported). */
  receivedQty: number | null;
  /** For FBA / WFS: shipment closed by the marketplace (receiving finished). */
  closed: boolean;
  /** Who asked for it (manual requests). */
  requestedBy: string | null;
  note: string;
}

export interface Resolution {
  outflowId: string;
  reason: string;
  by: string;
  at: string;
}

export type MatchStatus = "Explained" | "Partly explained" | "Unexplained";

export interface OutflowMatch {
  outflow: StockOutflow;
  matches: { record: ChannelRecord; qty: number }[];
  matchedQty: number;
  unexplainedQty: number;
  status: MatchStatus;
  resolution: Resolution | null;
  unexplainedValue: number;
}

export const MATCH_WINDOW_DAYS = 3;

function norm(ref: string) {
  return ref.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Matches each ShipStation decrease to channel records for the same SKU within
 * ±3 days. A matching reference wins; otherwise the closest date. Records are
 * consumed, so one record never explains more units than it contains.
 * A Finance resolution ("Mark explained") marks the remainder as explained.
 */
export function reconcileOutflows(
  outflows: StockOutflow[],
  records: ChannelRecord[],
  resolutions: Resolution[],
  unitCost: (sku: string) => number,
): OutflowMatch[] {
  const remaining = new Map(records.map((r) => [r.id, r.qty]));
  const sorted = [...outflows].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const result = new Map<string, OutflowMatch>();
  for (const o of sorted) {
    const cands = records
      .filter((r) => r.sku === o.sku && Math.abs(daysBetween(r.date, o.date)) <= MATCH_WINDOW_DAYS && (remaining.get(r.id) ?? 0) > 0)
      .sort((a, b) => {
        const ra = norm(a.reference) === norm(o.reference) ? 0 : 1;
        const rb = norm(b.reference) === norm(o.reference) ? 0 : 1;
        return ra - rb || Math.abs(daysBetween(a.date, o.date)) - Math.abs(daysBetween(b.date, o.date)) || a.id.localeCompare(b.id);
      });
    let need = o.qty;
    const matches: { record: ChannelRecord; qty: number }[] = [];
    for (const c of cands) {
      if (need <= 0) break;
      const left = remaining.get(c.id) ?? 0;
      const take = Math.min(left, need);
      if (take <= 0) continue;
      remaining.set(c.id, left - take);
      need -= take;
      matches.push({ record: c, qty: take });
    }
    const matchedQty = o.qty - need;
    const resolution = resolutions.find((r) => r.outflowId === o.id) ?? null;
    const unexplainedQty = resolution ? 0 : need;
    const status: MatchStatus = unexplainedQty === 0 ? "Explained" : matchedQty > 0 ? "Partly explained" : "Unexplained";
    result.set(o.id, {
      outflow: o,
      matches,
      matchedQty,
      unexplainedQty,
      status,
      resolution,
      unexplainedValue: Math.round(unexplainedQty * unitCost(o.sku) * 100) / 100,
    });
  }
  return outflows.map((o) => result.get(o.id)!).sort((a, b) => b.outflow.date.localeCompare(a.outflow.date) || a.outflow.id.localeCompare(b.outflow.id));
}

export interface InboundShortfall {
  record: ChannelRecord;
  shortQty: number;
  value: number;
  /** Claim candidate once the marketplace has closed the shipment. */
  claimable: boolean;
}

/** FBA / WFS shipments where the marketplace received fewer units than we sent. */
export function inboundShortfalls(records: ChannelRecord[], unitCost: (sku: string) => number): InboundShortfall[] {
  return records
    .filter((r) => (r.source === "Amazon FBA Inbound" || r.source === "Walmart WFS Inbound") && r.receivedQty !== null && r.receivedQty < r.qty)
    .map((r) => {
      const shortQty = r.qty - (r.receivedQty ?? 0);
      return { record: r, shortQty, value: Math.round(shortQty * unitCost(r.sku) * 100) / 100, claimable: r.closed };
    });
}

export function reconSummary(matches: OutflowMatch[]) {
  const units = matches.reduce((a, m) => a + m.outflow.qty, 0);
  const unexplainedUnits = matches.reduce((a, m) => a + m.unexplainedQty, 0);
  const unexplainedValue = Math.round(matches.reduce((a, m) => a + m.unexplainedValue, 0) * 100) / 100;
  return {
    outflows: matches.length,
    units,
    explainedPct: units > 0 ? (units - unexplainedUnits) / units : 1,
    unexplainedUnits,
    unexplainedValue,
    openItems: matches.filter((m) => m.status !== "Explained").length,
  };
}

/** Weekly reconciliation email to Finance (queued in the outbox). */
export function reconEmail(matches: OutflowMatch[], shortfalls: InboundShortfall[], periodFrom: string, periodTo: string, financeEmail: string) {
  const s = reconSummary(matches.filter((m) => m.outflow.date >= periodFrom && m.outflow.date <= periodTo));
  const open = matches.filter((m) => m.status !== "Explained" && m.outflow.date >= periodFrom && m.outflow.date <= periodTo);
  const lines = [
    `Stock outflow reconciliation ${periodFrom} to ${periodTo}.`,
    "",
    `${s.units.toLocaleString("en-US")} units left Brentwood / Georgia in ShipStation; ${(s.explainedPct * 100).toFixed(1)}% matched to a channel record.`,
    open.length === 0 ? "Every outflow is explained." : `Unexplained: ${s.unexplainedUnits.toLocaleString("en-US")} units (≈ $${s.unexplainedValue.toLocaleString("en-US", { minimumFractionDigits: 2 })} at cost):`,
    ...open.map((m) => `• ${m.outflow.date} ${m.outflow.location} ${m.outflow.sku}: ${m.unexplainedQty} of ${m.outflow.qty} units — ShipStation "${m.outflow.kind}" ref "${m.outflow.reference}"`),
    "",
    shortfalls.length ? "FBA / WFS shipments received short:" : "",
    ...shortfalls.map((f) => `• ${f.record.source} ${f.record.reference} ${f.record.sku}: sent ${f.record.qty}, received ${f.record.receivedQty ?? 0} (short ${f.shortQty})${f.claimable ? " — claim candidate" : " — still receiving"}`),
  ].filter((x, i, a) => !(x === "" && (a[i - 1] === "" || i === a.length - 1)));
  return {
    to: financeEmail,
    subject: `Stock outflow recon ${periodFrom} – ${periodTo}: ${open.length} open item${open.length === 1 ? "" : "s"}`,
    body: lines.join("\n"),
  };
}
