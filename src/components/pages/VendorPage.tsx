// PO & Vendor Management — replica of v16 #screen-vendor, extended with
// receipts, documents, cancellation, SKU edit and a Vendors register.

import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { Assume, Badge, Field, Modal, ModalActions, ModuleGate, ModuleStat, StatusBadge, Tabs } from "@/components/cc/ui";
import { isFinance } from "@/lib/access";
import { tentativePOTotal } from "@/lib/engine/cogs";
import { formatDate } from "@/lib/engine/dates";
import type { Vendor } from "@/lib/engine/finance";
import { remainingQty } from "@/lib/engine/planning";
import type { CogsMethod, DocumentRef, POInstallment, POStatus, POType, ProductType, PurchaseOrder, Sku } from "@/lib/engine/types";
import { int, money, usd } from "@/lib/format";
import { newId, useStore } from "@/lib/store";

type VendorTab = "openpo" | "sku" | "vendors" | "nonpo";

export function VendorPage() {
  return (
    <ModuleGate id="vendor">
      <VendorInner />
    </ModuleGate>
  );
}

function VendorInner() {
  const { role, data } = useStore();
  const supplyChain = role === "Supply Chain / Viviene";
  const canEditVendors = supplyChain || isFinance(role);
  const [tab, setTab] = useState<VendorTab>("openpo");

  const open = data.purchaseOrders.filter((p) => p.status === "Open");
  const outstanding = open.reduce((a, p) => a + remainingQty(p), 0);
  const nextPay = data.purchaseOrders
    .flatMap((p) => p.installments.filter((i) => !i.paid && i.dueDate).map((i) => ({ po: p.po, ...i })))
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))[0];

  return (
    <section className="screen active" id="screen-vendor">
      <div className="module-head">
        <div>
          <h2>PO &amp; Vendor Management</h2>
          <div className="muted">Supply Chain operational workspace</div>
        </div>
        <Tabs<VendorTab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "openpo", label: "Open PO Management" },
            { id: "sku", label: "SKU / MOQ Setup" },
            { id: "vendors", label: "Vendors" },
            { id: "nonpo", label: "Non-PO Payments" },
          ]}
        />
      </div>
      {!supplyChain ? (
        <div className="permission-banner notice readonly show">
          {canEditVendors
            ? "POs and SKUs are view only for this role — Viviene / Supply Chain owns them. Finance can maintain the Vendors register."
            : "View only for this role. Viviene / Supply Chain owns edits here."}
        </div>
      ) : null}
      <div className="module-stats">
        <ModuleStat label="Open POs" value={open.length} note="FG + Empty Tube + Accessory" />
        <ModuleStat label="Units outstanding" value={int(outstanding)} note="Across open POs" />
        <ModuleStat label="Next scheduled payment" value={nextPay ? usd(nextPay.amount) : "—"} note={nextPay ? `${formatDate(nextPay.dueDate)} · ${nextPay.po}` : "No unpaid installments"} />
      </div>

      {tab === "openpo" ? <OpenPOTab canEdit={supplyChain} /> : null}
      {tab === "sku" ? <SkuTab canEdit={supplyChain} /> : null}
      {tab === "vendors" ? <VendorsTab canEdit={canEditVendors} /> : null}
      {tab === "nonpo" ? <NonPOTab /> : null}
    </section>
  );
}

// ---------------------------------------------------------------- Open POs

function OpenPOTab({ canEdit }: { canEdit: boolean }) {
  const { data } = useStore();
  const [search, setSearch] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | "new" | null>(null);
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);
  const desc = (sku: string) => data.skus.find((s) => s.sku === sku)?.description ?? sku;

  const rows = data.purchaseOrders
    .filter((p) => showClosed || p.status === "Open")
    .filter((p) => `${p.po} ${p.sku} ${desc(p.sku)} ${p.supplier}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div id="vendor-openpo">
      <div className="toolbar">
        <button className="btn primary" type="button" disabled={!canEdit} onClick={() => setEditing("new")}>+ New PO</button>
        <input className="control" placeholder="Search PO, SKU or supplier" value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className="small row" style={{ gap: 6 }}>
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Show closed / cancelled
        </label>
      </div>
      <div className="card">
        <div className="section-title"><h3>{showClosed ? "PO Register" : "Open PO Register"}</h3><span className="hint">Finished Goods + Empty Tubes + Accessories</span></div>
        <div className="table-wrap">
          <table id="poTable">
            <thead>
              <tr><th>PO</th><th>Type</th><th>SKU</th><th>Description</th><th>Supplier</th><th>Ordered</th><th>Received</th><th>Remaining</th><th>Lead Time</th><th>ETA</th><th>Tentative PO Total</th><th>Docs</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.po}>
                  <td><strong>{p.po}</strong></td>
                  <td>{p.type}</td>
                  <td>{p.sku}</td>
                  <td>{desc(p.sku)}</td>
                  <td>{p.supplier}</td>
                  <td>{int(p.orderedQty)}</td>
                  <td>{int(p.receivedQty)}</td>
                  <td>{int(remainingQty(p))}</td>
                  <td>{p.leadTimeDays} d</td>
                  <td>{p.eta ? formatDate(p.eta) : "TBD"}</td>
                  <td>{money(tentativePOTotal(p))}</td>
                  <td>{p.documents.length ? <span title={p.documents.map((d) => d.name).join("\n")}>📎 {p.documents.length}</span> : "—"}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td className="nowrap">
                    {canEdit ? (
                      <>
                        <button className="btn" type="button" onClick={() => setEditing(p)}>Edit</button>{" "}
                        {p.status === "Open" ? <button className="btn" type="button" onClick={() => setReceiving(p)}>Receive</button> : null}
                      </>
                    ) : (
                      <button className="btn ghost" type="button" onClick={() => setEditing(p)}>View</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editing ? <POModal po={editing === "new" ? null : editing} readOnly={!canEdit} onClose={() => setEditing(null)} /> : null}
      {receiving ? <ReceiveModal po={receiving} onClose={() => setReceiving(null)} /> : null}
    </div>
  );
}

const DOC_TYPES: DocumentRef["type"][] = ["PO Invoice", "Supplier Quotation", "Shipping Document", "Packing List", "Receipt Evidence", "COGS Support", "Vendor Document", "Other"];

function POModal({ po, readOnly, onClose }: { po: PurchaseOrder | null; readOnly: boolean; onClose: () => void }) {
  const { data, update, flash, asOf, role } = useStore();
  const orderable = data.skus.filter((s) => s.active);
  const first = orderable[0];
  const [form, setForm] = useState<PurchaseOrder>(
    po ?? {
      po: `PO-${1040 + data.purchaseOrders.length}`,
      type: first?.type === "Empty Tube" ? "Empty Tube" : "Finished Goods",
      sku: first?.sku ?? "",
      supplier: first?.supplier ?? "",
      openDate: asOf,
      orderedQty: first?.moq ?? 0,
      receivedQty: 0,
      saleableQty: null,
      leadTimeDays: first?.leadTimeDays ?? 60,
      eta: null,
      status: "Open",
      notes: "",
      installments: [{ id: "1", amount: 0, dueDate: null, paid: false }],
      documents: [],
    },
  );
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState<DocumentRef["type"]>("PO Invoice");
  const set = <K extends keyof PurchaseOrder>(k: K, v: PurchaseOrder[K]) => setForm((f) => ({ ...f, [k]: v }));

  const pickSku = (code: string) => {
    const s = data.skus.find((x) => x.sku === code);
    if (!s) return;
    const type: POType = s.type === "Empty Tube" ? "Empty Tube" : s.type === "Accessory" ? "Accessory" : "Finished Goods";
    setForm((f) => ({ ...f, sku: s.sku, supplier: s.supplier, leadTimeDays: s.leadTimeDays, type }));
  };
  const setInst = (idx: number, patch: Partial<POInstallment>) =>
    setForm((f) => ({ ...f, installments: f.installments.map((i, n) => (n === idx ? { ...i, ...patch } : i)) }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    if (!po && data.purchaseOrders.some((p) => p.po.toLowerCase() === form.po.trim().toLowerCase())) {
      flash("That PO number already exists");
      return;
    }
    const clean: PurchaseOrder = { ...form, po: form.po.trim(), receivedQty: Math.min(form.receivedQty, form.orderedQty) };
    update("purchaseOrders", (prev) => (po ? prev.map((p) => (p.po === po.po ? clean : p)) : [...prev, clean]));
    flash(po ? `${clean.po} updated · projection recalculated` : `${clean.po} created · projection recalculated`);
    onClose();
  };

  const addDoc = () => {
    const name = docName.trim();
    if (!name) return;
    set("documents", [...form.documents, { id: newId("DOC"), name, type: docType, uploadedBy: role, uploadedAt: asOf }]);
    setDocName("");
  };

  return (
    <Modal open title={readOnly ? `PO ${form.po}` : po ? "Edit PO" : "New PO"} onClose={onClose}>
      <form onSubmit={submit}>
        <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid">
            <Field label="PO Number"><input value={form.po} onChange={(e) => set("po", e.target.value)} required disabled={!!po} /></Field>
            <Field label="PO Type">
              <select value={form.type} onChange={(e) => set("type", e.target.value as POType)}>
                <option>Finished Goods</option><option>Empty Tube</option><option>Accessory</option>
              </select>
            </Field>
            <Field label="SKU">
              <select value={form.sku} onChange={(e) => pickSku(e.target.value)}>
                {orderable.map((s) => <option key={s.sku} value={s.sku}>{s.sku} — {s.description}</option>)}
              </select>
            </Field>
            <Field label="Description"><input value={data.skus.find((s) => s.sku === form.sku)?.description ?? ""} readOnly /></Field>
            <Field label="Supplier"><input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} required /></Field>
            <Field label="PO Ordered Qty"><input type="number" min={1} value={form.orderedQty} onChange={(e) => set("orderedQty", Number(e.target.value))} required /></Field>
            <Field label="Qty Received (use Receive for new deliveries)"><input type="number" value={form.receivedQty} readOnly /></Field>
            <Field label="Lead Time (days)"><input type="number" min={1} value={form.leadTimeDays} onChange={(e) => set("leadTimeDays", Number(e.target.value))} required /></Field>
            <Field label="PO Open Date"><input type="date" value={form.openDate} onChange={(e) => set("openDate", e.target.value)} required /></Field>
            <Field label="Expected Arrival / ETA"><input type="date" value={form.eta ?? ""} onChange={(e) => set("eta", e.target.value || null)} /></Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => set("status", e.target.value as POStatus)}>
                <option>Open</option><option>Closed</option><option>Cancelled</option>
              </select>
            </Field>
            <Field label="Actual Received / Saleable Qty">
              <input type="number" min={0} value={form.saleableQty ?? ""} onChange={(e) => set("saleableQty", e.target.value === "" ? null : Number(e.target.value))} />
            </Field>
            <Field label="Notes" span2><textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" /></Field>
            <div className="field span2">
              <label>Payment Installments</label>
              <div className="installments">
                {form.installments.map((i, idx) => (
                  <div className="inst-row" key={i.id}>
                    <div><div className="small">Payment {idx + 1}</div>{i.paid ? <Badge tone="green">Paid</Badge> : null}</div>
                    <div><div className="small">Amount</div><input type="number" min={0} step=".01" value={i.amount} onChange={(e) => setInst(idx, { amount: Number(e.target.value) })} /></div>
                    <div><div className="small">Date (blank = TBD)</div><input type="date" value={i.dueDate ?? ""} onChange={(e) => setInst(idx, { dueDate: e.target.value || null })} /></div>
                    <button className="icon-btn" type="button" title="Remove" onClick={() => set("installments", form.installments.filter((_, n) => n !== idx))}>−</button>
                  </div>
                ))}
              </div>
              <button className="btn" type="button" onClick={() => set("installments", [...form.installments, { id: newId("I"), amount: 0, dueDate: null, paid: false }])}>+ Add Payment</button>
              <div className="right" style={{ marginTop: 8 }}><strong>Tentative PO Total: {money(tentativePOTotal(form))}</strong></div>
            </div>
            <div className="field span2">
              <label>Supporting Documents</label>
              {form.documents.length ? (
                <ul>{form.documents.map((d) => <li key={d.id}>📎 {d.name} <span className="small">· {d.type} · {d.uploadedBy} · {formatDate(d.uploadedAt)}</span></li>)}</ul>
              ) : <div className="small">No documents yet.</div>}
              {!readOnly ? (
                <div className="row">
                  <select className="control" value={docType} onChange={(e) => setDocType(e.target.value as DocumentRef["type"])}>{DOC_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
                  <input className="control" placeholder="File name (upload in live version)" value={docName} onChange={(e) => setDocName(e.target.value)} />
                  <button className="btn" type="button" onClick={addDoc}>Attach</button>
                  <Assume title="Live version uploads the file to the Controlled Chaos document store with PO / SKU / vendor metadata.">file upload</Assume>
                </div>
              ) : null}
            </div>
          </div>
        </fieldset>
        {readOnly ? (
          <div className="toolbar" style={{ justifyContent: "flex-end", marginTop: 16, marginBottom: 0 }}><button className="btn" type="button" onClick={onClose}>Close</button></div>
        ) : (
          <ModalActions onCancel={onClose} submitLabel="Save PO" />
        )}
      </form>
    </Modal>
  );
}

function ReceiveModal({ po, onClose }: { po: PurchaseOrder; onClose: () => void }) {
  const { update, flash, asOf, role } = useStore();
  const remaining = remainingQty(po);
  const [qty, setQty] = useState(String(remaining));
  const [saleable, setSaleable] = useState(String(remaining));
  const [date, setDate] = useState(asOf);
  const [close, setClose] = useState(false);
  const [evidence, setEvidence] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = Number(qty);
    const s = Number(saleable);
    if (!(q > 0) || s < 0 || s > q) return;
    update("purchaseOrders", (prev) =>
      prev.map((p) =>
        p.po === po.po
          ? {
              ...p,
              receivedQty: p.receivedQty + q,
              saleableQty: (p.saleableQty ?? 0) + s,
              status: close || p.receivedQty + q >= p.orderedQty ? "Closed" : "Open",
              notes: [p.notes, `Received ${q.toLocaleString()} on ${formatDate(date)}${s < q ? ` (${(q - s).toLocaleString()} not saleable)` : ""}${close && p.receivedQty + q < p.orderedQty ? " · closed with shortage" : ""}`].filter(Boolean).join(" · "),
              documents: evidence.trim() ? [...p.documents, { id: newId("DOC"), name: evidence.trim(), type: "Receipt Evidence" as const, uploadedBy: role, uploadedAt: date }] : p.documents,
            }
          : p,
      ),
    );
    flash(`${po.po}: receipt recorded · projection recalculated`);
    onClose();
  };

  return (
    <Modal open title={`Receive against ${po.po}`} onClose={onClose} width={560}>
      <form onSubmit={submit}>
        <div className="notice">Ordered {int(po.orderedQty)} · received so far {int(po.receivedQty)} · remaining {int(remaining)}. The ordered quantity is never overwritten.</div>
        <div className="form-grid">
          <Field label="Qty received now"><input type="number" min={1} max={remaining} value={qty} onChange={(e) => setQty(e.target.value)} required /></Field>
          <Field label="Of which saleable"><input type="number" min={0} value={saleable} onChange={(e) => setSaleable(e.target.value)} required /></Field>
          <Field label="Receipt date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
          <Field label="Receipt evidence (file name)"><input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Optional" /></Field>
          <div className="field span2">
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={close} onChange={(e) => setClose(e.target.checked)} /> Close PO — no further quantity expected (close with shortage)
            </label>
          </div>
        </div>
        <ModalActions onCancel={onClose} submitLabel="Record Receipt" />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- SKU / MOQ

function SkuTab({ canEdit }: { canEdit: boolean }) {
  const { data } = useStore();
  const [editing, setEditing] = useState<Sku | "new" | null>(null);
  return (
    <div id="vendor-sku">
      <div className="toolbar">
        <button className="btn primary" type="button" disabled={!canEdit} onClick={() => setEditing("new")}>+ Create New SKU</button>
        <span className="small">Product names are examples; new products are added here without changing the COGS model.</span>
      </div>
      <div className="card">
        <div className="section-title"><h3>SKU / MOQ Setup</h3><span className="hint">Maintained by Viviene</span></div>
        <div className="table-wrap">
          <table id="skuTable">
            <thead><tr><th>SKU</th><th>Description</th><th>Type</th><th>COGS Method</th><th>Linked Empty Tube</th><th>Supplier</th><th>MOQ</th><th>Current Lead Time</th><th>Tube Threshold</th><th>Units / Box</th><th>ShipStation</th><th>Active</th><th /></tr></thead>
            <tbody>
              {data.skus.map((s) => (
                <tr key={s.sku}>
                  <td><strong>{s.sku}</strong></td>
                  <td>{s.description}</td>
                  <td>{s.type}</td>
                  <td>{s.cogsMethod}</td>
                  <td>{s.linkedTubeSku ?? "N/A"}{s.cogsMethod === "Tube Fill" && !s.linkedTubeSku ? <div className="small" style={{ color: "#cf3f4f" }}>Required</div> : null}</td>
                  <td>{s.supplier}</td>
                  <td>{int(s.moq)}</td>
                  <td>{s.leadTimeDays} d</td>
                  <td>{s.tubeThresholdQty ? int(s.tubeThresholdQty) : "—"}</td>
                  <td>{s.unitsPerBox ? int(s.unitsPerBox) : "Loose"}</td>
                  <td><StatusBadge status={s.shipStationStatus} /></td>
                  <td>{s.active ? <Badge tone="green">Active</Badge> : <Badge tone="grey">Inactive</Badge>}</td>
                  <td>{canEdit ? <button className="btn" type="button" onClick={() => setEditing(s)}>Edit</button> : "View"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editing ? <SkuModal sku={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function SkuModal({ sku, onClose }: { sku: Sku | null; onClose: () => void }) {
  const { data, update, flash } = useStore();
  const tubes = data.skus.filter((s) => s.type === "Empty Tube");
  const [f, setF] = useState<Sku>(
    sku ?? { sku: "", description: "", type: "Finished Goods", cogsMethod: "Tube Fill", linkedTubeSku: null, supplier: "", moq: 0, leadTimeDays: 60, tubeThresholdQty: 0, unitsPerBox: 0, active: true, shipStationStatus: "Pending Setup" },
  );
  const [error, setError] = useState("");
  const set = <K extends keyof Sku>(k: K, v: Sku[K]) => setF((x) => ({ ...x, [k]: v }));

  const setType = (t: ProductType) =>
    setF((x) => ({ ...x, type: t, cogsMethod: t === "Empty Tube" ? "Component / Empty Tube" : t === "Accessory" ? "Direct Purchase" : x.cogsMethod === "Component / Empty Tube" ? "Tube Fill" : x.cogsMethod, linkedTubeSku: t === "Finished Goods" ? x.linkedTubeSku : null }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const code = f.sku.trim();
    if (!sku && data.skus.some((s) => s.sku.toLowerCase() === code.toLowerCase())) return setError("SKU already exists.");
    if (f.cogsMethod === "Tube Fill" && !f.linkedTubeSku) return setError("Tube Fill products need a Linked Empty Tube SKU.");
    const clean: Sku = { ...f, sku: code, linkedTubeSku: f.cogsMethod === "Tube Fill" ? f.linkedTubeSku : null };
    update("skus", (prev) => (sku ? prev.map((s) => (s.sku === sku.sku ? clean : s)) : [...prev, clean]));
    flash(sku ? `${code} updated` : `${code} created${clean.shipStationStatus === "Pending Setup" ? " · Finance to set up in ShipStation" : ""}`);
    onClose();
  };

  return (
    <Modal open title={sku ? `Edit ${sku.sku}` : "Create New SKU"} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="SKU Number"><input value={f.sku} onChange={(e) => set("sku", e.target.value)} required disabled={!!sku} /></Field>
          <Field label="Description"><input value={f.description} onChange={(e) => set("description", e.target.value)} required /></Field>
          <Field label="Type">
            <select value={f.type} onChange={(e) => setType(e.target.value as ProductType)}>
              <option>Finished Goods</option><option>Accessory</option><option>Empty Tube</option>
            </select>
          </Field>
          <Field label="COGS Method">
            <select value={f.cogsMethod} onChange={(e) => set("cogsMethod", e.target.value as CogsMethod)} disabled={f.type !== "Finished Goods"}>
              <option>Tube Fill</option><option>Direct Purchase</option><option>Component / Empty Tube</option>
            </select>
          </Field>
          <Field label="Linked Empty Tube SKU">
            <select value={f.linkedTubeSku ?? ""} onChange={(e) => set("linkedTubeSku", e.target.value || null)} disabled={f.cogsMethod !== "Tube Fill"}>
              <option value="">N/A</option>
              {tubes.map((t) => <option key={t.sku} value={t.sku}>{t.sku} — {t.description}</option>)}
            </select>
          </Field>
          <Field label="Supplier"><input value={f.supplier} onChange={(e) => set("supplier", e.target.value)} required /></Field>
          <Field label="MOQ"><input type="number" min={0} value={f.moq} onChange={(e) => set("moq", Number(e.target.value))} required /></Field>
          <Field label="Current Lead Time (days)"><input type="number" min={1} value={f.leadTimeDays} onChange={(e) => set("leadTimeDays", Number(e.target.value))} required /></Field>
          <Field label="Tube Threshold Qty"><input type="number" min={0} value={f.tubeThresholdQty} onChange={(e) => set("tubeThresholdQty", Number(e.target.value))} disabled={f.type !== "Empty Tube"} /></Field>
          <Field label="Units per Box (0 = counted loose)"><input type="number" min={0} value={f.unitsPerBox} onChange={(e) => set("unitsPerBox", Number(e.target.value))} /></Field>
          <Field label="ShipStation Status">
            <select value={f.shipStationStatus} onChange={(e) => set("shipStationStatus", e.target.value as Sku["shipStationStatus"])}>
              <option>Pending Setup</option><option>Complete</option>
            </select>
          </Field>
          <Field label="Active">
            <select value={f.active ? "Active" : "Inactive"} onChange={(e) => set("active", e.target.value === "Active")}>
              <option>Active</option><option>Inactive</option>
            </select>
          </Field>
        </div>
        {error ? <div className="notice readonly" style={{ marginTop: 12, marginBottom: 0 }}>{error}</div> : null}
        <ModalActions onCancel={onClose} submitLabel="Save SKU" />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- Vendors

const VENDOR_CATEGORIES: Vendor["category"][] = ["PO Supplier", "Packaging", "Logistics", "Marketing", "Software", "Professional Services", "Facilities", "Other"];

function VendorsTab({ canEdit }: { canEdit: boolean }) {
  const { data } = useStore();
  const [editing, setEditing] = useState<Vendor | "new" | null>(null);
  const spend = (name: string) =>
    data.purchaseOrders.filter((p) => p.supplier === name).reduce((a, p) => a + tentativePOTotal(p), 0) +
    data.nonPOPayments.filter((n) => data.vendors.find((v) => v.id === n.vendorId)?.name === name).reduce((a, n) => a + n.amount, 0);
  return (
    <div>
      <div className="toolbar">
        <button className="btn primary" type="button" disabled={!canEdit} onClick={() => setEditing("new")}>+ Add Vendor</button>
        <span className="small">Viviene maintains supply vendors; Finance maintains service and overhead vendors.</span>
      </div>
      <div className="card">
        <div className="section-title"><h3>Vendor Register</h3><span className="hint">Used by POs, Non-PO payments and the Payment Planner</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Vendor</th><th>Category</th><th>Payment Terms</th><th>Currency</th><th>Contact</th><th>Maintained By</th><th className="num">Committed Spend</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.vendors.map((v) => (
                <tr key={v.id}>
                  <td><strong>{v.name}</strong><div className="small">{v.email}</div></td>
                  <td>{v.category}</td>
                  <td>{v.paymentTerms}</td>
                  <td>{v.currency}</td>
                  <td>{v.contact}</td>
                  <td>{v.maintainedBy}</td>
                  <td className="num">{usd(spend(v.name))}</td>
                  <td><StatusBadge status={v.status} /></td>
                  <td>{canEdit ? <button className="btn" type="button" onClick={() => setEditing(v)}>Edit</button> : "View"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editing ? <VendorModal vendor={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function VendorModal({ vendor, onClose }: { vendor: Vendor | null; onClose: () => void }) {
  const { update, flash, role } = useStore();
  const [f, setF] = useState<Vendor>(
    vendor ?? { id: newId("V"), name: "", category: "Other", paymentTerms: "Net 30", currency: "USD", contact: "", email: "", maintainedBy: role === "Supply Chain / Viviene" ? "Supply Chain" : "Finance", status: "Active" },
  );
  const set = <K extends keyof Vendor>(k: K, v: Vendor[K]) => setF((x) => ({ ...x, [k]: v }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    update("vendors", (prev) => (vendor ? prev.map((v) => (v.id === vendor.id ? f : v)) : [...prev, f]));
    flash(vendor ? `${f.name} updated` : `${f.name} added`);
    onClose();
  };
  return (
    <Modal open title={vendor ? `Edit ${vendor.name}` : "Add Vendor"} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Vendor Name"><input value={f.name} onChange={(e) => set("name", e.target.value)} required /></Field>
          <Field label="Category"><select value={f.category} onChange={(e) => set("category", e.target.value as Vendor["category"])}>{VENDOR_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Payment Terms"><input value={f.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} /></Field>
          <Field label="Currency"><select value={f.currency} onChange={(e) => set("currency", e.target.value as Vendor["currency"])}><option>USD</option><option>CNY</option><option>EUR</option><option>GBP</option></select></Field>
          <Field label="Contact"><input value={f.contact} onChange={(e) => set("contact", e.target.value)} /></Field>
          <Field label="Email"><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Maintained By"><select value={f.maintainedBy} onChange={(e) => set("maintainedBy", e.target.value as Vendor["maintainedBy"])}><option>Supply Chain</option><option>Finance</option></select></Field>
          <Field label="Status"><select value={f.status} onChange={(e) => set("status", e.target.value as Vendor["status"])}><option>Active</option><option>On Hold</option><option>Inactive</option></select></Field>
        </div>
        <ModalActions onCancel={onClose} submitLabel="Save Vendor" />
      </form>
    </Modal>
  );
}

function NonPOTab() {
  const { data } = useStore();
  const open = data.nonPOPayments.filter((n) => n.status !== "Paid");
  return (
    <div className="card">
      <div className="section-title">
        <div>
          <span className="section-kicker">NOW LIVE</span>
          <h3>Non-PO Payments</h3>
        </div>
        <Link className="text-link" to="/payments">Open Payment Planner →</Link>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Rent, 3PL, freight, agency, professional fees, insurance and other payments that have no PO. Viviene and Finance enter them in the Payment Planner, where the CEO sees them with PO installments by week and month.
      </p>
      <div className="table-wrap">
        <table className="compact">
          <thead><tr><th>Vendor</th><th>Description</th><th>Category</th><th>Due</th><th className="num">Amount</th><th>Status</th></tr></thead>
          <tbody>
            {open.map((n) => (
              <tr key={n.id}>
                <td>{data.vendors.find((v) => v.id === n.vendorId)?.name ?? n.vendorId}</td>
                <td>{n.description}</td>
                <td>{n.category}</td>
                <td>{n.dueDate ? formatDate(n.dueDate) : <span className="muted">Date TBD</span>}</td>
                <td className="num">{usd(n.amount)}</td>
                <td><StatusBadge status={n.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

