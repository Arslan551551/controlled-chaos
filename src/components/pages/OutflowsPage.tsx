// Stock Outflow Reconciliation — every ShipStation stock decrease matched to a
// channel record (Shopify / TikTok orders, Amazon FBA inbound, Walmart WFS,
// manual requests, transfers, distributor shipments). Unexplained outflows and
// FBA / WFS shortfalls go to Finance.

import { useMemo, useState, type FormEvent } from "react";

import {
  Assume,
  Badge,
  Field,
  Modal,
  ModalActions,
  ModuleGate,
  ModuleHead,
  ModuleStat,
  Section,
  Source,
  Tabs,
  ViewOnlyBanner,
  useCanEdit,
  type Tone,
} from "@/components/cc/ui";
import { isFinance } from "@/lib/access";
import { addDays, formatDate } from "@/lib/engine/dates";
import {
  inboundShortfalls,
  MATCH_WINDOW_DAYS,
  reconcileOutflows,
  reconEmail,
  reconSummary,
  type ChannelRecord,
  type MatchStatus,
  type OutflowMatch,
} from "@/lib/engine/outflows";
import { useOutflowRecords } from "@/lib/derived";
import { int, money, pct } from "@/lib/format";
import { FINANCE_EMAIL } from "@/lib/sample/people";
import { newId, useCosting, useStore, type OutboxEmail } from "@/lib/store";

type Tab = "outflows" | "inbound" | "requests";

const STATUS_TONE: Record<MatchStatus, Tone> = {
  Explained: "green",
  "Partly explained": "amber",
  Unexplained: "red",
};

export function OutflowsPage() {
  return (
    <ModuleGate id="outflows">
      <OutflowsInner />
    </ModuleGate>
  );
}

function OutflowsInner() {
  const { data, role, asOf, update, flash } = useStore();
  const { unitCost } = useCosting();
  const records = useOutflowRecords();
  const canEdit = useCanEdit("outflows");
  const finance = isFinance(role);
  const [tab, setTab] = useState<Tab>("outflows");
  const [status, setStatus] = useState<"all" | MatchStatus>("all");
  const [location, setLocation] = useState<"all" | "Brentwood" | "Georgia">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [resolving, setResolving] = useState<OutflowMatch | null>(null);
  const [emailPreview, setEmailPreview] = useState<OutboxEmail | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);

  const matches = useMemo(
    () => reconcileOutflows(data.stockOutflows, records, data.outflowResolutions, unitCost),
    [data.stockOutflows, records, data.outflowResolutions, unitCost],
  );
  const shortfalls = useMemo(() => inboundShortfalls(records, unitCost), [records, unitCost]);
  const summary = reconSummary(matches);
  const rows = matches.filter(
    (m) =>
      (status === "all" || m.status === status) &&
      (location === "all" || m.outflow.location === location),
  );
  const sel = matches.find((m) => m.outflow.id === selected) ?? null;
  const descOf = (sku: string) => data.skus.find((s) => s.sku === sku)?.description ?? sku;
  const claims = data.outbox.filter(
    (e) => e.subject.startsWith("Amazon claim") || e.subject.startsWith("Walmart claim"),
  );

  const sendRecon = () => {
    const e = reconEmail(matches, shortfalls, addDays(asOf, -6), asOf, FINANCE_EMAIL);
    const email: OutboxEmail = {
      id: newId("RECON"),
      ...e,
      queuedAt: `${asOf}T08:00`,
      status: "Queued (Gmail not connected yet)",
    };
    update("outbox", (prev) => [...prev, email]);
    setEmailPreview(email);
  };

  const raiseClaim = (r: ChannelRecord, shortQty: number) => {
    const isAmazon = r.source === "Amazon FBA Inbound";
    const email: OutboxEmail = {
      id: newId("CLAIM"),
      to: FINANCE_EMAIL,
      subject: `${isAmazon ? "Amazon" : "Walmart"} claim to file – ${r.reference} – ${r.sku} short ${shortQty}`,
      body: `${r.source} shipment ${r.reference} (${formatDate(r.date)}): we sent ${r.qty} × ${r.sku}, ${isAmazon ? "Amazon" : "Walmart"} received ${r.receivedQty ?? 0}.\nFile a ${isAmazon ? "Seller Central inbound shipment reimbursement" : "WFS inbound discrepancy"} claim for ${shortQty} units (≈ ${money(shortQty * unitCost(r.sku))} at cost).`,
      queuedAt: `${asOf}T08:00`,
      status: "Queued (Gmail not connected yet)",
    };
    update("outbox", (prev) => [...prev, email]);
    flash(`Claim task queued for ${r.reference}`);
  };

  return (
    <section className="screen active" id="screen-outflows">
      <ModuleHead
        title="Stock Outflow Recon"
        subtitle="Every stock decrease in ShipStation explained by a channel record — the rest goes to Finance"
      >
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "outflows", label: "ShipStation Outflows" },
            { id: "inbound", label: `FBA / WFS Shortfalls (${shortfalls.length})` },
            { id: "requests", label: "Manual Shipment Requests" },
          ]}
        />
      </ModuleHead>
      <ViewOnlyBanner id="outflows" />
      <div className="row" style={{ marginBottom: 10 }}>
        <Source>ShipStation stock movements</Source>
        <Source>Amazon SP-API Inbound</Source>
        <Source>Walmart WFS</Source>
        <Source>Shopify</Source>
        <Source>TikTok</Source>
        <span className="small">
          Matched by SKU and reference within ±{MATCH_WINDOW_DAYS} days.
        </span>
      </div>
      <div className="module-stats">
        <ModuleStat
          label="Units out (last 30 days)"
          value={int(summary.units)}
          note={`${summary.outflows} ShipStation decreases`}
        />
        <ModuleStat
          label="Explained"
          value={pct(summary.explainedPct)}
          note={`${summary.openItems} open item${summary.openItems === 1 ? "" : "s"}`}
        />
        <ModuleStat
          label="Unexplained"
          value={`${int(summary.unexplainedUnits)} units`}
          note={`≈ ${money(summary.unexplainedValue)} at cost`}
        />
        <ModuleStat
          label="FBA / WFS received short"
          value={`${int(shortfalls.reduce((a, f) => a + f.shortQty, 0))} units`}
          note={`${shortfalls.filter((f) => f.claimable).length} ready to claim · ${money(shortfalls.reduce((a, f) => a + f.value, 0))}`}
        />
      </div>

      {tab === "outflows" ? (
        <>
          <div className="toolbar">
            <select
              className="control"
              value={status}
              onChange={(e) => setStatus(e.target.value as "all" | MatchStatus)}
            >
              <option value="all">All statuses</option>
              <option>Unexplained</option>
              <option>Partly explained</option>
              <option>Explained</option>
            </select>
            <select
              className="control"
              value={location}
              onChange={(e) => setLocation(e.target.value as "all" | "Brentwood" | "Georgia")}
            >
              <option value="all">Brentwood + Georgia</option>
              <option>Brentwood</option>
              <option>Georgia</option>
            </select>
            <span className="spacer" />
            {finance ? (
              <button className="btn primary" type="button" onClick={sendRecon}>
                Send weekly recon to Finance
              </button>
            ) : null}
          </div>
          <div className="grid-main-side">
            <Section title="ShipStation stock decreases" hint="Click a row for detail">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Location</th>
                      <th>SKU</th>
                      <th>ShipStation type</th>
                      <th>Reference</th>
                      <th className="num">Units</th>
                      <th>Matched to</th>
                      <th className="num">Unexplained</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((m) => (
                      <tr
                        key={m.outflow.id}
                        className={`click-row${selected === m.outflow.id ? " selected-row" : ""}`}
                        onClick={() => setSelected(m.outflow.id)}
                      >
                        <td>{formatDate(m.outflow.date)}</td>
                        <td>{m.outflow.location}</td>
                        <td>
                          <strong>{m.outflow.sku}</strong>
                        </td>
                        <td>{m.outflow.kind}</td>
                        <td>{m.outflow.reference || "—"}</td>
                        <td className="num">{int(m.outflow.qty)}</td>
                        <td>
                          {m.matches.length
                            ? m.matches
                                .map((x) => x.record.source)
                                .filter((v, i, a) => a.indexOf(v) === i)
                                .join(", ")
                            : m.resolution
                              ? "Finance note"
                              : "—"}
                        </td>
                        <td className="num">
                          {m.unexplainedQty ? (
                            <span className="neg strong">{int(m.unexplainedQty)}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <Badge tone={STATUS_TONE[m.status]}>
                            {m.resolution && m.matchedQty < m.outflow.qty
                              ? "Explained by Finance"
                              : m.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="empty">
                          No outflows match the filters.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Section>
            <div className="card">
              {sel ? (
                <>
                  <div className="section-title">
                    <div>
                      <span className="section-kicker">
                        {sel.outflow.id} · {sel.outflow.location}
                      </span>
                      <h3>{sel.outflow.sku}</h3>
                      <div className="small">{descOf(sel.outflow.sku)}</div>
                    </div>
                    <Badge tone={STATUS_TONE[sel.status]}>{sel.status}</Badge>
                  </div>
                  <div className="summary-line">
                    <span>ShipStation {sel.outflow.kind.toLowerCase()}</span>
                    <strong>{formatDate(sel.outflow.date)}</strong>
                  </div>
                  <div className="summary-line">
                    <span>Reference typed in ShipStation</span>
                    <strong>{sel.outflow.reference || "—"}</strong>
                  </div>
                  <div className="summary-line">
                    <span>Units out</span>
                    <strong>{int(sel.outflow.qty)}</strong>
                  </div>
                  <div className="summary-line">
                    <span>Matched units</span>
                    <strong>{int(sel.matchedQty)}</strong>
                  </div>
                  <div className="summary-line">
                    <span>Unexplained</span>
                    <strong className={sel.unexplainedQty ? "neg" : ""}>
                      {int(sel.unexplainedQty)} · {money(sel.unexplainedValue)}
                    </strong>
                  </div>
                  <h4>Matched records</h4>
                  {sel.matches.length ? (
                    <ul>
                      {sel.matches.map((x) => (
                        <li key={x.record.id} className="small">
                          <strong>{x.record.source}</strong> · {x.record.reference} ·{" "}
                          {formatDate(x.record.date)} · {int(x.qty)} of {int(x.record.qty)} units
                          {x.record.requestedBy ? ` · requested by ${x.record.requestedBy}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="small">
                      No channel record found for this SKU within ±{MATCH_WINDOW_DAYS} days.
                    </div>
                  )}
                  {sel.resolution ? (
                    <div className="notice" style={{ marginTop: 10 }}>
                      Explained by {sel.resolution.by} on {formatDate(sel.resolution.at)}:{" "}
                      {sel.resolution.reason}
                    </div>
                  ) : null}
                  {finance && canEdit && sel.unexplainedQty > 0 ? (
                    <button
                      className="btn primary full-width-action"
                      type="button"
                      onClick={() => setResolving(sel)}
                    >
                      Mark explained…
                    </button>
                  ) : null}
                </>
              ) : (
                <div className="empty">Select an outflow to see what explains it.</div>
              )}
            </div>
          </div>
        </>
      ) : null}

      {tab === "inbound" ? (
        <Section
          title="Shipments to Amazon FBA / Walmart WFS"
          hint="Units we sent vs units the marketplace received"
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Shipment</th>
                  <th>Date sent</th>
                  <th>SKU</th>
                  <th className="num">Sent</th>
                  <th className="num">Received</th>
                  <th className="num">Short</th>
                  <th className="num">Value at cost</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {records
                  .filter(
                    (r) => r.source === "Amazon FBA Inbound" || r.source === "Walmart WFS Inbound",
                  )
                  .map((r) => {
                    const f = shortfalls.find((x) => x.record.id === r.id);
                    const queued = claims.some((c) => c.subject.includes(r.reference));
                    return (
                      <tr key={r.id}>
                        <td>{r.source === "Amazon FBA Inbound" ? "Amazon FBA" : "Walmart WFS"}</td>
                        <td>
                          <strong>{r.reference}</strong>
                          {r.note ? <div className="small">{r.note}</div> : null}
                        </td>
                        <td>{formatDate(r.date)}</td>
                        <td>{r.sku}</td>
                        <td className="num">{int(r.qty)}</td>
                        <td className="num">{r.receivedQty === null ? "—" : int(r.receivedQty)}</td>
                        <td className="num">
                          {f ? <span className="neg strong">{int(f.shortQty)}</span> : "—"}
                        </td>
                        <td className="num">{f ? money(f.value) : "—"}</td>
                        <td>
                          {r.receivedQty === null ? (
                            <Badge tone="blue">In transit</Badge>
                          ) : !r.closed ? (
                            <Badge tone="amber">Receiving</Badge>
                          ) : f ? (
                            <Badge tone="red">Closed short</Badge>
                          ) : (
                            <Badge tone="green">Received in full</Badge>
                          )}
                        </td>
                        <td>
                          {f && f.claimable && finance && canEdit ? (
                            queued ? (
                              <span className="small">Claim queued</span>
                            ) : (
                              <button
                                className="btn"
                                type="button"
                                onClick={() => raiseClaim(r, f.shortQty)}
                              >
                                Raise claim with{" "}
                                {r.source === "Amazon FBA Inbound" ? "Amazon" : "Walmart"}
                              </button>
                            )
                          ) : f && !f.claimable ? (
                            <span className="small">Wait until closed</span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <div className="transfer-footnote">
            Live version reads inbound shipments from Amazon SP-API (Fulfillment Inbound) and
            Walmart WFS inbound orders.{" "}
            <Assume title="Claim filing stays manual in Seller Central / Seller Center; the portal queues the task with the numbers.">
              claims filed manually
            </Assume>
          </div>
        </Section>
      ) : null}

      {tab === "requests" ? (
        <Section
          title="Manual shipment requests"
          hint="Samples, influencer kits, salon education, replacements — log them so the outflow matches"
          actions={
            canEdit ? (
              <button className="btn primary" type="button" onClick={() => setRequestOpen(true)}>
                + Log manual shipment
              </button>
            ) : null
          }
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>SKU</th>
                  <th className="num">Units</th>
                  <th>Reference</th>
                  <th>Requested by</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {data.channelRecords
                  .filter((r) => r.source === "Manual Request")
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((r) => (
                    <tr key={r.id}>
                      <td>{formatDate(r.date)}</td>
                      <td>{r.sku}</td>
                      <td className="num">{int(r.qty)}</td>
                      <td>{r.reference}</td>
                      <td>{r.requestedBy ?? "—"}</td>
                      <td className="small">{r.note || "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      {resolving ? <ResolveModal m={resolving} onClose={() => setResolving(null)} /> : null}
      {requestOpen ? <RequestModal onClose={() => setRequestOpen(false)} /> : null}
      <Modal
        open={emailPreview !== null}
        title="Recon queued for Finance"
        onClose={() => setEmailPreview(null)}
        width={680}
      >
        {emailPreview ? (
          <>
            <div className="small">
              <strong>To:</strong> {emailPreview.to} · <strong>Status:</strong>{" "}
              {emailPreview.status}
            </div>
            <div className="small" style={{ margin: "4px 0 10px" }}>
              <strong>Subject:</strong> {emailPreview.subject}
            </div>
            <div className="email-preview">{emailPreview.body}</div>
          </>
        ) : null}
      </Modal>
    </section>
  );
}

function ResolveModal({ m, onClose }: { m: OutflowMatch; onClose: () => void }) {
  const { update, role, asOf, flash } = useStore();
  const [reason, setReason] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    update("outflowResolutions", (prev) => [
      ...prev.filter((r) => r.outflowId !== m.outflow.id),
      { outflowId: m.outflow.id, reason: reason.trim(), by: role, at: asOf },
    ]);
    flash(`${m.outflow.id} marked explained`);
    onClose();
  };
  return (
    <Modal open title={`Mark ${m.outflow.id} explained`} onClose={onClose} width={520}>
      <form onSubmit={submit}>
        <div className="notice">
          {int(m.unexplainedQty)} × {m.outflow.sku} left {m.outflow.location} on{" "}
          {formatDate(m.outflow.date)} with ShipStation reference “{m.outflow.reference || "—"}”.
        </div>
        <Field label="What happened? (kept for audit)">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Walmart WFS shipment not created in Seller Center; damaged stock written off"
            required
          />
        </Field>
        <ModalActions onCancel={onClose} submitLabel="Mark explained" />
      </form>
    </Modal>
  );
}

function RequestModal({ onClose }: { onClose: () => void }) {
  const { data, update, role, asOf, flash } = useStore();
  const options = data.skus.filter((s) => s.active && s.type !== "Empty Tube");
  const [sku, setSku] = useState(options[0]?.sku ?? "");
  const [qty, setQty] = useState("");
  const [date, setDate] = useState(asOf);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = Number(qty);
    if (!(q > 0) || !reference.trim()) return;
    const rec: ChannelRecord = {
      id: newId("MR"),
      source: "Manual Request",
      reference: reference.trim(),
      date,
      sku,
      qty: q,
      receivedQty: null,
      closed: false,
      requestedBy: role,
      note: note.trim(),
    };
    update("channelRecords", (prev) => [...prev, rec]);
    flash("Manual shipment logged · use the same reference in ShipStation");
    onClose();
  };
  return (
    <Modal open title="Log manual shipment" onClose={onClose} width={620}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="SKU">
            <select value={sku} onChange={(e) => setSku(e.target.value)}>
              {options.map((s) => (
                <option key={s.sku} value={s.sku}>
                  {s.sku} — {s.description}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Units">
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
            />
          </Field>
          <Field label="Ship date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Reference (type the same in ShipStation)">
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. Influencer kit – @name"
              required
            />
          </Field>
          <Field label="Note" span2>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Purpose, recipient, approval"
            />
          </Field>
        </div>
        <ModalActions onCancel={onClose} submitLabel="Log shipment" />
      </form>
    </Modal>
  );
}
