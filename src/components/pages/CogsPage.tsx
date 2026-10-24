// COGS — replica of v16 #screen-cogs. Method-aware detail panel; tentative and
// final values are both kept; tube snapshot comes from the moving-average ledger.

import { useMemo, useState, type FormEvent } from "react";

import { Assume, Field, Modal, ModalActions, ModuleGate, StatusBadge, ViewOnlyBanner, useCanEdit } from "@/components/cc/ui";
import type { CogsBatch } from "@/lib/engine/cogs";
import { formatDate } from "@/lib/engine/dates";
import { int, money } from "@/lib/format";
import { useCosting, useStore } from "@/lib/store";

export function CogsPage() {
  return (
    <ModuleGate id="cogs">
      <CogsInner />
    </ModuleGate>
  );
}

type Filter = "all" | "Tentative" | "Finalized";

function CogsInner() {
  const { batches, ledger } = useCosting();
  const canEdit = useCanEdit("cogs");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(batches[0]?.batchId ?? null);
  const [finalizing, setFinalizing] = useState<CogsBatch | null>(null);
  const [showLedger, setShowLedger] = useState(false);

  const rows = batches.filter((b) => filter === "all" || b.status === filter);
  const selected = batches.find((b) => b.batchId === selectedId) ?? null;
  const tentative = batches.filter((b) => b.status === "Tentative").length;
  const finalized = batches.length - tentative;
  const methods = new Set(batches.map((b) => b.method)).size;

  const nextFilter: Record<Filter, Filter> = { all: "Tentative", Tentative: "Finalized", Finalized: "all" };
  const filterLabel: Record<Filter, string> = { all: "Show All", Tentative: "Showing Tentative", Finalized: "Showing Finalized" };

  return (
    <section className="screen active" id="screen-cogs">
      <div className="module-head">
        <div>
          <h2>COGS</h2>
          <div className="muted">SKU / batch cost using the correct COGS method for each product</div>
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={() => setShowLedger(true)}>Tube Cost Ledger</button>
          <button className="btn" type="button" onClick={() => setFilter(nextFilter[filter])}>{filterLabel[filter]}</button>
        </div>
      </div>
      <ViewOnlyBanner id="cogs" />
      <div className="module-stats">
        <div className="module-stat"><span className="stat-label">Tentative batches</span><strong>{tentative}</strong><small>Awaiting final invoice / qty</small></div>
        <div className="module-stat"><span className="stat-label">Finalized batches</span><strong>{finalized}</strong><small>Historical cost locked</small></div>
        <div className="module-stat"><span className="stat-label">COGS methods in use</span><strong>{methods}</strong><small>Tube Fill + Direct Purchase</small></div>
      </div>
      <div className="grid cogs-layout">
        <div className="card">
          <div className="section-title"><h3>SKU / Batch COGS</h3><span className="hint">Tentative = PO installments ÷ ordered qty</span></div>
          <div className="table-wrap">
            <table id="cogsTable">
              <thead><tr><th>PO / Batch</th><th>SKU</th><th>Product</th><th>COGS Method</th><th>Qty</th><th>Product / Fill COGS</th><th>Tube COGS</th><th>Full COGS</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((b) => {
                  const isTube = b.method === "Tube Fill";
                  const base = b.finalBaseUnit ?? b.tentativeBaseUnit;
                  const tube = b.finalTubeSnapshot ?? b.tentativeTubeSnapshot;
                  return (
                    <tr
                      key={b.batchId}
                      className={`cogs-select-row${selectedId === b.batchId ? " selected-row" : ""}`}
                      tabIndex={0}
                      role="button"
                      onClick={() => setSelectedId(b.batchId)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(b.batchId); } }}
                    >
                      <td><strong>{b.po}</strong><div className="small">{b.batchId}</div></td>
                      <td>{b.sku}</td>
                      <td>{b.product}</td>
                      <td><span className={`method-badge ${isTube ? "tube-fill" : "direct-purchase"}`}>{b.method}</span></td>
                      <td>{int(b.batchQty)}</td>
                      <td>{money(base)}</td>
                      <td>{isTube ? money(tube) : <span className="muted">N/A</span>}</td>
                      <td><strong>{money(b.currentFullUnit)}</strong></td>
                      <td><StatusBadge status={b.status} /></td>
                      <td>
                        {canEdit && b.status === "Tentative" ? (
                          <button className="btn blue" type="button" onClick={(e) => { e.stopPropagation(); setSelectedId(b.batchId); setFinalizing(b); }}>Finalize</button>
                        ) : <span className="view-cue">View →</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card" id="cogsDetailPanel">
          {selected ? <CogsDetail b={selected} canEdit={canEdit} onFinalize={() => setFinalizing(selected)} tubePos={selected.linkedTubeSku ? ledger.positions.get(selected.linkedTubeSku) ?? null : null} /> : (
            <>
              <div className="section-title"><div><span className="section-kicker">SELECTED BATCH</span><h3>COGS Detail</h3></div><span className="hint">Select a row on the left</span></div>
              <div className="cogs-empty-state">
                <div className="empty-icon">$</div>
                <strong>Select a PO / Batch</strong>
                <span>The detail changes automatically for Tube Fill versus Direct Purchase products.</span>
              </div>
            </>
          )}
        </div>
      </div>
      {finalizing ? <FinalizeModal b={finalizing} onClose={() => setFinalizing(null)} /> : null}
      <LedgerModal open={showLedger} onClose={() => setShowLedger(false)} />
    </section>
  );
}

function CogsDetail({ b, canEdit, onFinalize, tubePos }: { b: CogsBatch; canEdit: boolean; onFinalize: () => void; tubePos: { onHand: number; weightedUnitCost: number; inventoryValue: number } | null }) {
  const isTube = b.method === "Tube Fill";
  const snapshot = b.finalTubeSnapshot ?? b.tentativeTubeSnapshot;
  return (
    <>
      <div className="section-title">
        <div>
          <span className="section-kicker">{b.status === "Finalized" ? "FINALIZED BATCH" : "TENTATIVE BATCH"}</span>
          <h3>{b.product}</h3>
          <div className="small">{b.po} · {b.sku}</div>
        </div>
        <StatusBadge status={b.status} />
      </div>
      <div className="selected-cogs-hero">
        <div><span>Full COGS / Unit</span><strong>{money(b.currentFullUnit)}</strong></div>
        <div className="selected-cogs-qty"><span>Batch Qty</span><strong>{int(b.batchQty)}</strong></div>
      </div>
      <div className="cogs-method-line"><span>COGS Method</span><strong>{b.method}</strong></div>
      {isTube ? (
        <>
          <div className="cogs-detail-grid">
            <div className="cogs-detail-box"><span>Fill / Manufacturing COGS</span><strong>{money(b.finalBaseUnit ?? b.tentativeBaseUnit)}</strong></div>
            <div className="cogs-detail-box"><span>Tube COGS Snapshot</span><strong>{snapshot === null ? "Not issued" : money(snapshot)}</strong></div>
            <div className="cogs-detail-box"><span>Linked Empty Tube</span><strong>{b.linkedTubeSku ?? "Not mapped"}</strong></div>
            <div className="cogs-detail-box"><span>Full Packaged COGS</span><strong>{money(b.currentFullUnit)}</strong></div>
          </div>
          {tubePos ? (
            <div className="tube-reference">
              <div className="section-kicker">CURRENT LINKED TUBE INVENTORY</div>
              <div className="summary-line"><span>{b.linkedTubeSku} on hand</span><strong>{int(tubePos.onHand)}</strong></div>
              <div className="summary-line"><span>Current weighted tube cost</span><strong>{money(tubePos.weightedUnitCost, 4)}</strong></div>
              <div className="summary-line"><span>Current tube inventory value</span><strong>{money(tubePos.inventoryValue)}</strong></div>
            </div>
          ) : null}
          <div className="notice cogs-history-note">This batch keeps the {snapshot === null ? "—" : money(snapshot, 4)} tube-cost snapshot from when its tubes were issued to the fill. Later tube purchases do not reprice this batch.</div>
        </>
      ) : (
        <>
          <div className="cogs-detail-grid">
            <div className="cogs-detail-box"><span>Direct Purchase COGS / Unit</span><strong>{money(b.finalBaseUnit ?? b.tentativeBaseUnit)}</strong></div>
            <div className="cogs-detail-box"><span>Tube COGS</span><strong>N/A</strong></div>
            <div className="cogs-detail-box"><span>COGS Method</span><strong>Direct Purchase</strong></div>
            <div className="cogs-detail-box"><span>Full COGS / Unit</span><strong>{money(b.currentFullUnit)}</strong></div>
          </div>
          <div className="notice cogs-history-note">This is a complete purchased item. No Empty Tube cost is added to this SKU.</div>
        </>
      )}
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table className="compact" style={{ minWidth: 0 }}>
          <thead><tr><th /><th className="num">Tentative</th><th className="num">Final</th></tr></thead>
          <tbody>
            <tr><td>{isTube ? "Fill" : "Direct"} cost / unit</td><td className="num">{money(b.tentativeBaseUnit, 4)}</td><td className="num">{b.finalBaseUnit === null ? "—" : money(b.finalBaseUnit, 4)}</td></tr>
            {isTube ? <tr><td>Tube snapshot / unit</td><td className="num">{b.tentativeTubeSnapshot === null ? "—" : money(b.tentativeTubeSnapshot, 4)}</td><td className="num">{b.finalTubeSnapshot === null ? "—" : money(b.finalTubeSnapshot, 4)}</td></tr> : null}
            <tr className="total-row"><td>Full COGS / unit</td><td className="num">{money(b.tentativeFullUnit, 4)}</td><td className="num">{b.finalFullUnit === null ? "—" : money(b.finalFullUnit, 4)}</td></tr>
          </tbody>
        </table>
      </div>
      {b.finalization ? <div className="small" style={{ marginTop: 8 }}>Finalized by {b.finalization.finalizedBy} on {formatDate(b.finalization.finalizedAt)}. Tentative values are kept for audit.</div> : null}
      {canEdit && b.status === "Tentative" ? <button className="btn primary full-width-action" type="button" onClick={onFinalize}>Finalize COGS</button> : null}
    </>
  );
}

function FinalizeModal({ b, onClose }: { b: CogsBatch; onClose: () => void }) {
  const { update, role, asOf, flash } = useStore();
  const isTube = b.method === "Tube Fill";
  const [total, setTotal] = useState(String(Math.round(b.tentativeBaseUnit * b.batchQty * 100) / 100));
  const [qty, setQty] = useState(String(b.batchQty));
  const [invoice, setInvoice] = useState("");
  const q = Math.max(1, Number(qty) || 1);
  const finalFull = Number(total || 0) / q + (isTube ? (b.tentativeTubeSnapshot ?? 0) : 0);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    update("cogsBatches", (prev) =>
      prev.map((x) => (x.batchId === b.batchId ? { ...x, finalization: { finalBaseTotalCost: Number(total), finalQty: q, finalizedBy: role, finalizedAt: asOf } } : x)),
    );
    if (invoice.trim()) {
      update("purchaseOrders", (prev) => prev.map((p) => (p.po === b.po ? { ...p, documents: [...p.documents, { id: `DOC-${b.batchId}`, name: invoice.trim(), type: "COGS Support" as const, uploadedBy: role, uploadedAt: asOf }] } : p)));
    }
    flash(`${b.po} COGS finalized at ${money(finalFull)} / unit`);
    onClose();
  };

  return (
    <Modal open title="Finalize COGS" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="PO / Batch"><input value={`${b.po} · ${b.batchId}`} readOnly /></Field>
          <Field label="SKU"><input value={b.sku} readOnly /></Field>
          <Field label={isTube ? "Final Actual Fill / Manufacturing Cost (total)" : "Final Actual Direct Purchase Cost (total, landed)"}>
            <input type="number" min={0} step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} required />
          </Field>
          <Field label="Actual Received / Saleable Qty"><input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} required /></Field>
          {isTube ? (
            <Field label="Tube Cost Snapshot / Unit (from tube ledger)">
              <input value={b.tentativeTubeSnapshot === null ? "No tubes issued to this batch" : money(b.tentativeTubeSnapshot, 4)} readOnly />
            </Field>
          ) : null}
          <Field label="Calculated Final Full COGS / Unit"><input value={money(finalFull, 4)} readOnly /></Field>
          <Field label="Final invoice / support (file name)" span2>
            <input value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="Optional · e.g. PO-2011 final invoice.pdf" />
          </Field>
        </div>
        <div className="notice" style={{ marginTop: 12, marginBottom: 0 }}>
          The tube snapshot is fixed by the moving-average ledger when tubes were issued to this fill, so it cannot be typed over. Tentative values are kept alongside the final values. <Assume title="Live version attaches the invoice to the document store.">upload in live version</Assume>
        </div>
        <ModalActions onCancel={onClose} submitLabel="Finalize COGS" />
      </form>
    </Modal>
  );
}

function LedgerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ledger } = useCosting();
  const [tube, setTube] = useState<string>("all");
  const tubes = useMemo(() => [...ledger.positions.keys()].sort(), [ledger]);
  const rows = ledger.rows.filter((r) => tube === "all" || r.tubeSku === tube);
  return (
    <Modal open={open} title="Empty Tube Cost Ledger (moving weighted average)" onClose={onClose} width={900}>
      <div className="toolbar">
        <select className="control" value={tube} onChange={(e) => setTube(e.target.value)}>
          <option value="all">All tube SKUs</option>
          {tubes.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Tube SKU</th><th>Event</th><th>Ref</th><th className="num">Qty</th><th className="num">Unit Cost</th><th className="num">Balance</th><th className="num">Value</th><th className="num">Moving Avg</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatDate(r.date)}</td>
                <td>{r.tubeSku}</td>
                <td>{r.type}</td>
                <td>{r.batch ?? r.po ?? "—"}</td>
                <td className="num">{r.type === "Issue to Fill" ? `−${int(r.qty)}` : int(r.qty)}</td>
                <td className="num">{money(r.appliedUnitCost, 4)}</td>
                <td className="num">{int(r.balanceAfter)}</td>
                <td className="num">{money(r.valueAfter)}</td>
                <td className="num">{money(r.movingAverageAfter, 4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
