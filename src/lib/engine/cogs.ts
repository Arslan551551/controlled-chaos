// CC05 COGS Engine + moving weighted-average tube costing (Living Blueprint §19, §20, §25).

import type { CogsMethod, PurchaseOrder, TubeLedgerEvent } from "./types.ts";

export interface TubeLedgerRow extends TubeLedgerEvent {
  /** Unit cost applied: receipt cost, or moving average at time of issue. */
  appliedUnitCost: number;
  balanceAfter: number;
  valueAfter: number;
  movingAverageAfter: number;
}

export interface TubePosition {
  tubeSku: string;
  onHand: number;
  weightedUnitCost: number;
  inventoryValue: number;
}

/**
 * Runs the perpetual moving-average ledger for each tube SKU in date order.
 * - Receipt: new average = (remaining value + receipt value) / (remaining qty + receipt qty).
 *   If old stock is fully consumed, the receipt cost becomes the new average.
 * - Issue to Fill: removes qty at the current average; that average is the batch's tube snapshot.
 */
export function runTubeLedger(events: TubeLedgerEvent[]): {
  rows: TubeLedgerRow[];
  positions: Map<string, TubePosition>;
} {
  const sorted = [...events].sort((a, b) =>
    a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date),
  );
  const positions = new Map<string, TubePosition>();
  const rows: TubeLedgerRow[] = [];
  for (const e of sorted) {
    const pos = positions.get(e.tubeSku) ?? {
      tubeSku: e.tubeSku,
      onHand: 0,
      weightedUnitCost: 0,
      inventoryValue: 0,
    };
    let applied = pos.weightedUnitCost;
    if (e.type === "Receipt") {
      const cost = e.unitCost ?? 0;
      applied = cost;
      if (pos.onHand <= 0) {
        pos.onHand = e.qty;
        pos.inventoryValue = e.qty * cost;
      } else {
        pos.onHand += e.qty;
        pos.inventoryValue += e.qty * cost;
      }
      pos.weightedUnitCost = pos.onHand > 0 ? pos.inventoryValue / pos.onHand : 0;
    } else {
      // Issue to Fill (positive qty) or Adjustment (signed qty) at current average.
      const delta = e.type === "Issue to Fill" ? -Math.abs(e.qty) : e.qty;
      pos.onHand += delta;
      pos.inventoryValue = Math.max(0, pos.onHand) * pos.weightedUnitCost;
    }
    positions.set(e.tubeSku, pos);
    rows.push({
      ...e,
      appliedUnitCost: round4(applied),
      balanceAfter: pos.onHand,
      valueAfter: round2(pos.inventoryValue),
      movingAverageAfter: round4(pos.weightedUnitCost),
    });
  }
  return { rows, positions };
}

/** Tube cost snapshot for a fill batch = the moving average applied on its Issue to Fill event. */
export function tubeSnapshotForBatch(rows: TubeLedgerRow[], batch: string): number | null {
  const issue = rows.find((r) => r.batch === batch && r.type === "Issue to Fill");
  return issue ? issue.appliedUnitCost : null;
}

export function tentativePOTotal(po: PurchaseOrder): number {
  return po.installments.reduce((a, i) => a + (Number.isFinite(i.amount) ? i.amount : 0), 0);
}

/** Tentative fill / direct unit cost = Tentative PO Total / PO Ordered Qty. */
export function tentativeBaseUnitCost(po: PurchaseOrder): number {
  return po.orderedQty > 0 ? tentativePOTotal(po) / po.orderedQty : 0;
}

export interface CogsFinalization {
  finalBaseTotalCost: number;
  finalQty: number;
  finalizedBy: string;
  finalizedAt: string;
}

export interface CogsBatchInput {
  batchId: string;
  po: string;
  sku: string;
  product: string;
  method: Extract<CogsMethod, "Tube Fill" | "Direct Purchase">;
  linkedTubeSku: string | null;
  finalization: CogsFinalization | null;
}

export interface CogsBatch extends CogsBatchInput {
  batchQty: number;
  tentativeBaseUnit: number;
  tentativeTubeSnapshot: number | null;
  tentativeFullUnit: number;
  finalBaseUnit: number | null;
  finalTubeSnapshot: number | null;
  finalFullUnit: number | null;
  status: "Tentative" | "Finalized";
  /** The value to report: final when finalized, else tentative. */
  currentFullUnit: number;
}

/**
 * Builds COGS batches. Tentative and final values are both preserved.
 * The tube snapshot always comes from the ledger (never typed in), so later
 * tube purchases cannot reprice a past fill.
 */
export function buildCogsBatches(
  inputs: CogsBatchInput[],
  pos: PurchaseOrder[],
  ledgerRows: TubeLedgerRow[],
): CogsBatch[] {
  return inputs.map((b) => {
    const po = pos.find((p) => p.po === b.po);
    const tentativeBaseUnit = po ? tentativeBaseUnitCost(po) : 0;
    const isTube = b.method === "Tube Fill";
    const snapshot = isTube ? tubeSnapshotForBatch(ledgerRows, b.batchId) : null;
    const tentativeFullUnit = tentativeBaseUnit + (snapshot ?? 0);
    const f = b.finalization;
    const finalBaseUnit = f && f.finalQty > 0 ? f.finalBaseTotalCost / f.finalQty : null;
    const finalTubeSnapshot = f && isTube ? snapshot : null;
    const finalFullUnit = finalBaseUnit === null ? null : finalBaseUnit + (finalTubeSnapshot ?? 0);
    return {
      ...b,
      batchQty: f?.finalQty ?? po?.saleableQty ?? po?.receivedQty ?? po?.orderedQty ?? 0,
      tentativeBaseUnit: round4(tentativeBaseUnit),
      tentativeTubeSnapshot: snapshot,
      tentativeFullUnit: round4(tentativeFullUnit),
      finalBaseUnit: finalBaseUnit === null ? null : round4(finalBaseUnit),
      finalTubeSnapshot,
      finalFullUnit: finalFullUnit === null ? null : round4(finalFullUnit),
      status: f ? "Finalized" : "Tentative",
      currentFullUnit: round4(finalFullUnit ?? tentativeFullUnit),
    };
  });
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
