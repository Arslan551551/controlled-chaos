// PO Projection — replica of v16 #screen-projection, driven by the planning engine.

import { useMemo, useState, type FormEvent } from "react";

import {
  Assume,
  Badge,
  Field,
  Modal,
  ModalActions,
  ModuleGate,
  StatusBadge,
  Tabs,
  ViewOnlyBanner,
  useCanEdit,
  type Tone,
} from "@/components/cc/ui";
import { isFinance } from "@/lib/access";
import { addDays, formatDate, monthLabel } from "@/lib/engine/dates";
import { isActivePlanned, type SkuPlan } from "@/lib/engine/planning";
import type { PlannedSale, PlannedSaleStatus } from "@/lib/engine/types";
import { int } from "@/lib/format";
import { newId, usePlanning, useStore } from "@/lib/store";

type ProjTab = "fg" | "tube" | "transfer";

export function ProjectionPage() {
  return (
    <ModuleGate id="projection">
      <ProjectionInner />
    </ModuleGate>
  );
}

function trendTone(t: SkuPlan["salesTrend"]): Tone {
  return t === "Accelerating" ? "amber" : t === "Declining" ? "blue" : "green";
}

function ProjectionInner() {
  const { role, data } = useStore();
  const plan = usePlanning();
  const canEdit = useCanEdit("projection");
  const finance = isFinance(role);
  const [tab, setTab] = useState<ProjTab>("fg");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "planned" | "direct" | "list">(null);
  const [syncText, setSyncText] = useState("Projection up to date");

  const announce = (msg: string) => {
    setSyncText(msg);
    window.setTimeout(() => setSyncText("Projection up to date"), 1900);
  };

  const rows = plan.finishedGoods.filter((x) =>
    `${x.sku} ${x.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  const sel = plan.finishedGoods.find((x) => x.sku === selected) ?? null;
  const active = data.plannedSales.filter(isActivePlanned);
  const activeQty = active.reduce((a, p) => a + p.qty, 0);
  const pastDue = plan.finishedGoods.flatMap((p) => p.pastDuePlanned);

  return (
    <section className="screen active" id="screen-projection">
      <div className="module-head">
        <div>
          <h2>PO Projection</h2>
          <div className="muted">12-month stock projection</div>
        </div>
        <Tabs<ProjTab>
          className="projection-tabs"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "fg", label: "Finished Goods" },
            { id: "tube", label: "Empty Tubes" },
            { id: "transfer", label: "Internal Transfer" },
          ]}
        />
      </div>

      <ViewOnlyBanner id="projection" />

      {tab === "fg" ? (
        <div id="proj-fg">
          <div className="projection-actions">
            <div className="search-wrap">
              <span className="search-icon">⌕</span>
              <input
                className="control"
                placeholder="Search SKU or product"
                aria-label="Search SKU or product"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="projection-action-right">
              <div className="sync-state">
                <span className="sync-dot" />
                <span>{syncText}</span>
              </div>
              {finance ? (
                <>
                  <button
                    className="btn"
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setModal("planned")}
                  >
                    + Add Planned Sale
                  </button>
                  <button
                    className="btn primary"
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setModal("direct")}
                  >
                    + Add Direct Sale
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="planned-demand-bar">
            <div>
              <span className="planned-label">Known Future Demand</span>
              <strong>
                {active.length} active planned sale{active.length === 1 ? "" : "s"} ·{" "}
                {int(activeQty)} units
                {pastDue.length ? ` · ${pastDue.length} past due — review` : ""}
              </strong>
            </div>
            <button className="text-link" type="button" onClick={() => setModal("list")}>
              View planned sales →
            </button>
          </div>

          <div className="po-layout">
            <div className="card">
              <div className="section-title">
                <h3>Finished Goods Projection</h3>
                <span className="hint">Click a SKU for 12-month detail</span>
              </div>
              <div className="table-wrap">
                <table id="fgTable">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Product</th>
                      <th>Brentwood Stock</th>
                      <th>Georgia Stock</th>
                      <th>Current Burn / Day</th>
                      <th>Sales Trend</th>
                      <th>Days of Stock Left</th>
                      <th>Lead Time</th>
                      <th>Existing Open PO</th>
                      <th>PO Open By</th>
                      <th>Recommended PO Qty</th>
                      <th>PO Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((x) => (
                      <tr
                        key={x.sku}
                        className={`click-row${selected === x.sku ? " selected-row" : ""}`}
                        onClick={() => setSelected(x.sku)}
                      >
                        <td>
                          <strong>{x.sku}</strong>
                        </td>
                        <td>{x.description}</td>
                        <td>{int(x.brentwood)}</td>
                        <td>{int(x.georgia)}</td>
                        <td>
                          <strong>{int(x.projectionBurn)}/day</strong>
                          {x.spike ? (
                            <div className="small" style={{ color: "#b96a00" }}>
                              7-day spike
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <Badge tone={trendTone(x.salesTrend)}>{x.salesTrend}</Badge>
                        </td>
                        <td>
                          <strong>
                            {x.daysOfStockLeft === null ? "—" : `${x.daysOfStockLeft} days`}
                          </strong>
                        </td>
                        <td>{x.leadTimeDays} d</td>
                        <td>
                          {x.openPOQty
                            ? `${int(x.openPOQty)} · ${formatDate(x.nextInboundEta)}`
                            : "—"}
                        </td>
                        <td>{formatDate(x.poOpenBy)}</td>
                        <td>{x.recommendedQty ? int(x.recommendedQty) : "—"}</td>
                        <td>
                          <StatusBadge status={x.poStatus} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card detail-card" id="fgDetail">
              {sel ? (
                <FgDetail x={sel} />
              ) : (
                <>
                  <h3>Select a SKU</h3>
                  <div className="muted">Choose a row to inspect the 12-month projection.</div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "tube" ? <TubeTab /> : null}
      {tab === "transfer" ? <TransferTab /> : null}

      <PlannedSaleModal
        open={modal === "planned"}
        onClose={() => setModal(null)}
        onSaved={() => announce("Planned sale saved · projection recalculated")}
      />
      <DirectSaleModal
        open={modal === "direct"}
        onClose={() => setModal(null)}
        onSaved={() => announce("Direct sale saved · projection recalculated")}
      />
      <PlannedListModal
        open={modal === "list"}
        onClose={() => setModal(null)}
        onChanged={announce}
      />
    </section>
  );
}

function FgDetail({ x }: { x: SkuPlan }) {
  const max = Math.max(...x.months.map((m) => m.closingStock), 1);
  return (
    <>
      <div className="section-title">
        <h3>
          {x.sku} · {x.description}
        </h3>
        <StatusBadge status={x.poStatus} />
      </div>
      <div className="metric-grid">
        <div className="metric">
          <div className="small">Combined Stock</div>
          <div className="v">{int(x.combined)}</div>
        </div>
        <div className="metric">
          <div className="small">Days of Stock Left</div>
          <div className="v">{x.daysOfStockLeft ?? "—"}</div>
        </div>
        <div className="metric">
          <div className="small">Current Burn</div>
          <div className="v">{int(x.projectionBurn)}/day</div>
        </div>
        <div className="metric">
          <div className="small">Lead Time</div>
          <div className="v">{x.leadTimeDays} days</div>
        </div>
        <div className="metric">
          <div className="small">PO Open By</div>
          <div className="v" style={{ fontSize: 14 }}>
            {formatDate(x.poOpenBy)}
          </div>
        </div>
        <div className="metric">
          <div className="small">Recommended PO</div>
          <div className="v">{x.recommendedQty ? int(x.recommendedQty) : "—"}</div>
        </div>
        <div className="metric">
          <div className="small">Confirmed Planned Demand</div>
          <div className="v">{int(x.activePlannedQty)}</div>
        </div>
        <div className="metric">
          <div className="small">Cover at PO Arrival</div>
          <div className="v">
            {x.projectedCoverAtArrival === null ? "—" : `${x.projectedCoverAtArrival} d`}
          </div>
        </div>
        <div className="metric">
          <div className="small">MOQ applied</div>
          <div className="v" style={{ fontSize: 14 }}>
            {x.moqApplied ? "Yes" : "No"}
          </div>
        </div>
      </div>
      <div className="notice" style={{ marginTop: 10, marginBottom: 0 }}>
        <strong>Why: </strong>
        {x.reason}
        {x.stockoutBeforeArrival ? (
          <div style={{ color: "#cf3f4f", marginTop: 4 }}>
            Stock is projected to run out before a new PO can arrive.
          </div>
        ) : null}
      </div>
      <div className="mini-chart">
        {x.months.map((m) => (
          <div
            key={m.month}
            className="bar"
            title={`${monthLabel(m.month)}: ${int(m.closingStock)} closing`}
            style={{ height: `${Math.max(4, (m.closingStock / max) * 100)}%` }}
          >
            <span>{m.closingStock ? `${Math.round(m.closingStock / 1000)}k` : "0"}</span>
          </div>
        ))}
      </div>
      <div className="chart-labels">
        {x.months.map((m) => (
          <span key={m.month}>{monthLabel(m.month)}</span>
        ))}
      </div>
      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table style={{ minWidth: 560 }}>
          <thead>
            <tr>
              <th>Month</th>
              <th>Projected Burn</th>
              <th>Planned Demand</th>
              <th>Inbound</th>
              <th>Closing Stock</th>
            </tr>
          </thead>
          <tbody>
            {x.months.map((m) => (
              <tr key={m.month}>
                <td>{monthLabel(m.month)}</td>
                <td>{int(m.projectedBurn)}</td>
                <td>{m.plannedDemand ? <strong>{int(m.plannedDemand)}</strong> : "—"}</td>
                <td>{m.inbound ? int(m.inbound) : "—"}</td>
                <td>{int(m.closingStock)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="small" style={{ marginTop: 8 }}>
        Burn: 7-day {int(x.burn7)} · 14-day {int(x.burn14)} · 30-day {int(x.burn30)} per day
        {x.lowStockException ? " · low-stock exception: planning on 7-day burn" : ""}
      </div>
    </>
  );
}

function TubeTab() {
  const plan = usePlanning();
  return (
    <div id="proj-tube">
      <div className="card">
        <div className="section-title">
          <h3>Empty Tube Projection</h3>
          <span className="hint">
            Triggered by Finished Goods requirements ·{" "}
            <Assume title="Tubes are assumed to be needed at the filler 14 days after the Finished Goods PO is opened. Confirm with Viviene.">
              tubes needed 14 days after FG PO
            </Assume>
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tube SKU</th>
                <th>Description</th>
                <th>Related Finished Good</th>
                <th>Current Qty</th>
                <th>Confirmed Inbound (in time)</th>
                <th>Threshold</th>
                <th>Finished Goods Requirement</th>
                <th>Recommended Tube PO</th>
                <th>Required By</th>
                <th>Tube PO Open By</th>
                <th>Lead Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {plan.tubes.map((t) => (
                <tr key={t.tubeSku}>
                  <td>
                    <strong>{t.tubeSku}</strong>
                  </td>
                  <td>{t.description}</td>
                  <td>{t.relatedFinishedGoods.join(", ") || "—"}</td>
                  <td>{int(t.currentQty)}</td>
                  <td>{int(t.inboundInTime)}</td>
                  <td>{t.thresholdQty ? int(t.thresholdQty) : "—"}</td>
                  <td>{t.fgRequirement ? int(t.fgRequirement) : "—"}</td>
                  <td>
                    <strong>{t.recommendedQty ? int(t.recommendedQty) : "0"}</strong>
                    {t.moqApplied ? <div className="small">MOQ applied</div> : null}
                  </td>
                  <td>{formatDate(t.requiredBy)}</td>
                  <td>{formatDate(t.tubeOpenBy)}</td>
                  <td>{t.leadTimeDays} days</td>
                  <td>
                    {t.status === "Open Tube PO" ? (
                      <Badge tone={t.urgent ? "red" : "amber"}>Open Tube PO</Badge>
                    ) : (
                      <Badge tone="green">No Tube PO Required</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="transfer-footnote">
          Recommended Tube PO = Finished Goods tube requirement + threshold − tube stock − inbound
          tubes arriving in time (never below zero; MOQ applied when positive).
        </div>
      </div>
    </div>
  );
}

function TransferTab() {
  const plan = usePlanning();
  return (
    <div id="proj-transfer">
      <div className="grid transfer-summary">
        <div className="card transfer-location">
          <div className="location-label">Primary Fulfillment Warehouse</div>
          <div className="location-name">Brentwood</div>
          <div className="location-note">
            Maintain operational stock for normal customer fulfillment
          </div>
        </div>
        <div className="card transfer-arrow">
          Georgia <span>→</span> Brentwood
        </div>
        <div className="card transfer-location">
          <div className="location-label">Prep / Overflow Warehouse</div>
          <div className="location-name">Georgia</div>
          <div className="location-note">Storage source for internal replenishment</div>
        </div>
      </div>
      <div className="card">
        <div className="section-title">
          <h3>Internal Transfer Watch</h3>
          <span className="hint">
            Trigger when Brentwood reaches or is projected to reach 60 days of cover
          </span>
        </div>
        <div className="table-wrap">
          <table id="transferTable">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Brentwood Stock</th>
                <th>Georgia Stock</th>
                <th>Current Burn / Day</th>
                <th>Brentwood Days Left</th>
                <th>Reaches 60 Days</th>
                <th>Transfer Status</th>
                <th>Transfer Qty</th>
              </tr>
            </thead>
            <tbody>
              {plan.finishedGoods.map((x) => (
                <tr key={x.sku}>
                  <td>
                    <strong>{x.sku}</strong>
                  </td>
                  <td>{x.description}</td>
                  <td>{int(x.brentwood)}</td>
                  <td>{int(x.georgia)}</td>
                  <td>{int(x.projectionBurn)}/day</td>
                  <td>
                    <strong>
                      {x.transfer.brentwoodDaysLeft === null
                        ? "—"
                        : `${x.transfer.brentwoodDaysLeft} days`}
                    </strong>
                  </td>
                  <td>{formatDate(x.transfer.projectedFloorDate)}</td>
                  <td>
                    <StatusBadge status={x.transfer.status} />
                  </td>
                  <td>
                    {x.transfer.status === "Transfer Required" ? (
                      <>
                        <strong>Warehouse decides</strong>
                        <div className="small">
                          Minimum to move above 60 days: {int(x.transfer.minimumReferenceQty)}
                        </div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="transfer-footnote">
          Actual transfer quantity is decided by the warehouse team based on available Brentwood
          space. Purchasing still uses combined Brentwood + Georgia stock plus inbound POs.
        </div>
      </div>
    </div>
  );
}

const PLANNABLE = (t: string) => t === "Finished Goods" || t === "Accessory";

function PlannedSaleModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data, update, asOf } = useStore();
  const options = data.skus.filter((s) => s.active && PLANNABLE(s.type));
  const [sku, setSku] = useState(options[0]?.sku ?? "");
  const [date, setDate] = useState(addDays(asOf, 45));
  const [qty, setQty] = useState("");
  const [status, setStatus] = useState<PlannedSaleStatus>("Confirmed");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = Number(qty);
    if (!(q > 0) || !sku || date < asOf) return;
    update("plannedSales", (prev) => [
      ...prev,
      {
        id: newId("PS"),
        sku,
        expectedDate: date,
        qty: q,
        reference: ref.trim(),
        status,
        notes: notes.trim(),
        delays: [],
      },
    ]);
    setQty("");
    setRef("");
    setNotes("");
    onClose();
    onSaved();
  };

  return (
    <Modal open={open} title="Add Planned Sale" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="SKU">
            <select value={sku} onChange={(e) => setSku(e.target.value)} required>
              {options.map((s) => (
                <option key={s.sku} value={s.sku}>
                  {s.sku} — {s.description}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Expected Ship / Fulfillment Date">
            <input
              type="date"
              min={asOf}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </Field>
          <Field label="Quantity">
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
            />
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as PlannedSaleStatus)}>
              <option>Confirmed</option>
              <option>Tentative</option>
            </select>
          </Field>
          <Field label="Customer / Reference" span2>
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="Bulk order / customer reference"
            />
          </Field>
          <Field label="Notes" span2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </Field>
        </div>
        <div className="notice" style={{ marginTop: 12, marginBottom: 0 }}>
          Confirmed planned sales are added directly to the future stock projection on the expected
          ship date. They do not change historical burn. Tentative sales are visible but do not
          drive purchasing.
        </div>
        <ModalActions onCancel={onClose} submitLabel="Save Planned Sale" />
      </form>
    </Modal>
  );
}

function DirectSaleModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data, update, asOf } = useStore();
  const options = data.skus.filter((s) => s.active && PLANNABLE(s.type));
  const [sku, setSku] = useState(options[0]?.sku ?? "");
  const [date, setDate] = useState(asOf);
  const [qty, setQty] = useState("");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = Number(qty);
    if (!(q > 0) || !sku || date > asOf) return;
    const reference = [ref.trim(), notes.trim()].filter(Boolean).join(" · ");
    update("actualSales", (prev) => [
      ...prev,
      { id: newId("DS"), sku, channel: "Direct Sale", date, qty: q, reference },
    ]);
    setQty("");
    setRef("");
    setNotes("");
    onClose();
    onSaved();
  };

  return (
    <Modal open={open} title="Add Direct Sale" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="SKU">
            <select value={sku} onChange={(e) => setSku(e.target.value)} required>
              {options.map((s) => (
                <option key={s.sku} value={s.sku}>
                  {s.sku} — {s.description}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sale Date">
            <input
              type="date"
              max={asOf}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </Field>
          <Field label="Quantity Sold">
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
            />
          </Field>
          <Field label="Reference / Customer">
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="Optional reference"
            />
          </Field>
          <Field label="Notes" span2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </Field>
        </div>
        <div className="notice" style={{ marginTop: 12, marginBottom: 0 }}>
          Use this only for direct sales that are not already captured through Amazon, Shopify,
          TikTok, Walmart or another connected sales source. It counts as actual sales and updates
          burn.
        </div>
        <ModalActions onCancel={onClose} submitLabel="Save Direct Sale" />
      </form>
    </Modal>
  );
}

const STATUS_TONE: Record<PlannedSaleStatus, Tone> = {
  Confirmed: "green",
  Tentative: "amber",
  Delayed: "blue",
  Fulfilled: "purple",
  Cancelled: "red",
};

function PlannedListModal({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: (msg: string) => void;
}) {
  const { data, update, role, asOf } = useStore();
  const canEdit = isFinance(role);
  const [delaying, setDelaying] = useState<PlannedSale | null>(null);
  const [newDate, setNewDate] = useState("");
  const [note, setNote] = useState("");
  const sorted = useMemo(
    () => [...data.plannedSales].sort((a, b) => a.expectedDate.localeCompare(b.expectedDate)),
    [data.plannedSales],
  );

  const setStatus = (id: string, status: PlannedSaleStatus) => {
    update("plannedSales", (prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    onChanged(`Planned sale ${status.toLowerCase()} · projection recalculated`);
  };

  const saveDelay = (e: FormEvent) => {
    e.preventDefault();
    if (!delaying || !newDate || newDate === delaying.expectedDate) return;
    const target = delaying;
    update("plannedSales", (prev) =>
      prev.map((p) =>
        p.id === target.id
          ? {
              ...p,
              status: "Delayed",
              expectedDate: newDate,
              delays: [...p.delays, { from: p.expectedDate, to: newDate, note: note.trim() }],
              notes: note.trim() || p.notes,
            }
          : p,
      ),
    );
    setDelaying(null);
    onChanged("Planned sale delayed · projection recalculated");
  };

  return (
    <>
      <Modal open={open && !delaying} title="Known Future Sales" onClose={onClose}>
        <div className="table-wrap">
          <table style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Expected Date</th>
                <th>Quantity</th>
                <th>Reference</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const live = p.status !== "Cancelled" && p.status !== "Fulfilled";
                const overdue = isActivePlanned(p) && p.expectedDate < asOf;
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.sku}</strong>
                    </td>
                    <td>
                      {formatDate(p.expectedDate)}
                      {overdue ? (
                        <div className="small" style={{ color: "#cf3f4f" }}>
                          Past due — review
                        </div>
                      ) : null}
                      {p.delays.length ? (
                        <div className="small">
                          Delayed {p.delays.length}× (was {formatDate(p.delays[0]?.from)})
                        </div>
                      ) : null}
                    </td>
                    <td>{int(p.qty)}</td>
                    <td>{p.reference || "—"}</td>
                    <td>
                      <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                    </td>
                    <td>
                      {canEdit && live ? (
                        <div className="planned-actions">
                          <button
                            className="mini-action"
                            type="button"
                            onClick={() => {
                              setDelaying(p);
                              setNewDate(p.expectedDate);
                              setNote("");
                            }}
                          >
                            Delay
                          </button>
                          <button
                            className="mini-action"
                            type="button"
                            onClick={() => setStatus(p.id, "Fulfilled")}
                          >
                            Fulfilled
                          </button>
                          {p.status === "Tentative" ? (
                            <button
                              className="mini-action"
                              type="button"
                              onClick={() => setStatus(p.id, "Confirmed")}
                            >
                              Confirm
                            </button>
                          ) : null}
                          <button
                            className="mini-action danger"
                            type="button"
                            onClick={() => setStatus(p.id, "Cancelled")}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <span className="small">
                          {live ? "View only" : "Closed · kept for history"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Modal>
      <Modal
        open={delaying !== null}
        title="Delay Planned Sale"
        onClose={() => setDelaying(null)}
        width={520}
      >
        <form onSubmit={saveDelay}>
          <div className="form-grid">
            <Field label="New Expected Ship / Fulfillment Date" span2>
              <input
                type="date"
                min={asOf}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                required
              />
            </Field>
            <Field label="Reason / Note" span2>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional"
              />
            </Field>
          </div>
          {delaying && newDate === delaying.expectedDate ? (
            <div className="notice readonly" style={{ marginTop: 10 }}>
              Choose a different date to record a delay.
            </div>
          ) : null}
          <div className="notice" style={{ marginTop: 12, marginBottom: 0 }}>
            The planned quantity remains active, but moves to the revised date and the PO projection
            recalculates automatically.
          </div>
          <ModalActions
            onCancel={() => setDelaying(null)}
            submitLabel="Save Delay"
            disabled={!delaying || newDate === delaying.expectedDate}
          />
        </form>
      </Modal>
    </>
  );
}
