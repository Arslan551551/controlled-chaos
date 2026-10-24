import { Fragment, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

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
  StatusBadge,
  Tabs,
  ViewOnlyBanner,
  sum,
  useCanEdit,
} from "@/components/cc/ui";
import { isFinance } from "@/lib/access";
import { usePayments, useWeeklyCash } from "@/lib/derived";
import { addMonths, monthKey } from "@/lib/engine/dates";
import type { NonPOPayment, PaymentStatus, PlannedPayment } from "@/lib/engine/finance";
import {
  batchTotals,
  departmentTotals,
  lineNetUsd,
  type PayrollBatch,
  type PayrollStatus,
} from "@/lib/engine/payroll";
import { formatDate, int, monthLabel, usd } from "@/lib/format";
import { HEALTH_TARGETS } from "@/lib/sample/finance";
import { newId, useStore } from "@/lib/store";

type View = "weekly" | "monthly" | "payroll";
type SourceFilter = "all" | "PO Installment" | "Non-PO" | "Payroll";
type StatusFilter = "all" | "open" | PaymentStatus;
type Recurring = NonPOPayment["recurring"];

const CATEGORIES = [
  "Rent",
  "3PL / Storage",
  "Freight",
  "Marketing",
  "Professional Fees",
  "Insurance",
  "Packaging",
  "Utilities",
  "Software",
  "Other",
];
const RECURRING: Recurring[] = ["None", "Monthly", "Quarterly", "Annual"];

interface FormState {
  id: string | null;
  vendorId: string;
  category: string;
  description: string;
  amount: string;
  dueDate: string;
  tbd: boolean;
  recurring: Recurring;
  status: PaymentStatus;
}

export function PaymentsPage() {
  const { data, update, role, flash, asOf } = useStore();
  const canEdit = useCanEdit("payments");
  const payments = usePayments();
  const [source, setSource] = useState<SourceFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("open");
  const [vendor, setVendor] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [view, setView] = useState<View>(role === "CEO" ? "weekly" : "monthly");

  const vendors = useMemo(
    () => [...new Set(payments.all.map((p) => p.vendor))].sort(),
    [payments.all],
  );

  const rows = useMemo(
    () =>
      payments.all.filter((p) => {
        if (source !== "all" && p.source !== source) return false;
        if (status === "open" && p.status === "Paid") return false;
        if (status !== "all" && status !== "open" && p.status !== status) return false;
        if (vendor !== "all" && p.vendor !== vendor) return false;
        if (selectedMonth === "overdue")
          return (
            p.dueDate !== null &&
            p.status !== "Paid" &&
            p.dueDate < `${payments.plan[0]?.month ?? asOf.slice(0, 7)}-01`
          );
        if (selectedMonth === "tbd") return p.dueDate === null;
        if (selectedMonth) return p.dueDate !== null && monthKey(p.dueDate) === selectedMonth;
        return true;
      }),
    [payments.all, payments.plan, source, status, vendor, selectedMonth, asOf],
  );

  const next3 = sum(payments.plan, (m) => m.total);
  const overdueTotal = sum(payments.overdue, (p) => p.amount);
  const tbdTotal = sum(payments.tbd, (p) => p.amount);
  const nonPoOpen = data.nonPOPayments.filter((n) => n.status !== "Paid");

  const nonPoById = (id: string) => data.nonPOPayments.find((n) => n.id === id);

  function openNew() {
    setForm({
      id: null,
      vendorId: data.vendors[0]?.id ?? "",
      category: "Other",
      description: "",
      amount: "",
      dueDate: asOf,
      tbd: false,
      recurring: "None",
      status: "Planned",
    });
  }

  function openEdit(p: PlannedPayment) {
    const n = nonPoById(p.id);
    if (!n) return;
    setForm({
      id: n.id,
      vendorId: n.vendorId,
      category: n.category,
      description: n.description,
      amount: String(n.amount),
      dueDate: n.dueDate ?? asOf,
      tbd: n.dueDate === null,
      recurring: n.recurring,
      status: n.status,
    });
  }

  function setPaymentStatus(id: string, s: PaymentStatus) {
    update("nonPOPayments", (prev) => prev.map((n) => (n.id === id ? { ...n, status: s } : n)));
    flash(`${id} marked ${s}`);
  }

  function save(e: FormEvent) {
    e.preventDefault();
    if (!form || !canEdit) return;
    const amount = Number(form.amount);
    if (!(amount > 0) || !form.vendorId || !form.description.trim()) return;
    const enteredBy: NonPOPayment["enteredBy"] =
      role === "Supply Chain / Viviene" ? "Supply Chain" : "Finance";
    const record: NonPOPayment = {
      id: form.id ?? newId("NP"),
      vendorId: form.vendorId,
      category: form.category,
      description: form.description.trim(),
      amount,
      dueDate: form.tbd ? null : form.dueDate,
      status: form.status,
      enteredBy: form.id ? (nonPoById(form.id)?.enteredBy ?? enteredBy) : enteredBy,
      recurring: form.recurring,
    };
    update("nonPOPayments", (prev) =>
      form.id ? prev.map((n) => (n.id === form.id ? record : n)) : [...prev, record],
    );
    flash(
      form.id
        ? "Payment updated · payment plan and cash flow recalculated"
        : "Non-PO payment added · payment plan and cash flow recalculated",
    );
    setForm(null);
  }

  return (
    <ModuleGate id="payments">
      <section className="screen active" id="screen-payments">
        <ModuleHead
          title="Payment Planner"
          subtitle="Every committed payment by month: PO installments plus Non-PO payments"
        >
          {canEdit ? (
            <button className="btn primary" type="button" onClick={openNew}>
              + Add Non-PO Payment
            </button>
          ) : null}
        </ModuleHead>

        <ViewOnlyBanner
          id="payments"
          text="View only for this role. Viviene / Supply Chain and Finance enter payments here."
        />

        <div className="notice">
          PO installments come from <strong>Open PO Management</strong> and are edited there. Non-PO
          payments (rent, freight, agencies, insurance…) are entered here by Supply Chain or
          Finance. Non-PO Payments was disabled in v1 and is now live.
        </div>

        <div className="toolbar">
          <Tabs<View>
            tabs={[
              { id: "weekly", label: "Weekly plan" },
              { id: "monthly", label: "Monthly plan" },
              { id: "payroll", label: "Pakistan payroll" },
            ]}
            value={view}
            onChange={setView}
          />
        </div>

        {view === "weekly" ? <WeeklyPlan /> : null}
        {view === "payroll" ? <PayrollPanel /> : null}

        {view === "monthly" ? (
          <>
            <div className="module-stats">
              <ModuleStat
                label="Next 3 months"
                value={usd(next3)}
                note={`${payments.plan.reduce((a, m) => a + m.items.length, 0)} unpaid payments`}
              />
              <ModuleStat
                label="Overdue"
                value={usd(overdueTotal)}
                note={`${payments.overdue.length} past due date`}
              />
              <ModuleStat
                label="Date TBD"
                value={usd(tbdTotal)}
                note={`${payments.tbd.length} without a due date`}
              />
              <ModuleStat
                label="Open Non-PO"
                value={usd(sum(nonPoOpen, (n) => n.amount))}
                note={`${nonPoOpen.length} payments`}
              />
            </div>

            <div className="grid-3" style={{ marginBottom: 14 }}>
              {payments.plan.map((m) => (
                <button
                  key={m.month}
                  type="button"
                  className={`report-card${selectedMonth === m.month ? " active" : ""}`}
                  onClick={() => setSelectedMonth(selectedMonth === m.month ? null : m.month)}
                >
                  <span className="section-kicker">{monthLabel(m.month)}</span>
                  <strong style={{ fontSize: 26 }}>{usd(m.total)}</strong>
                  <span>
                    PO installments {usd(m.poTotal)} · Non-PO {usd(m.nonPoTotal)}
                    {m.payrollTotal ? ` · Payroll ${usd(m.payrollTotal)}` : ""}
                  </span>
                  <span>
                    {m.items.length} payment{m.items.length === 1 ? "" : "s"} · click to filter
                  </span>
                </button>
              ))}
            </div>

            <Section
              title={
                selectedMonth === "overdue"
                  ? "Overdue payments"
                  : selectedMonth === "tbd"
                    ? "Payments with date TBD"
                    : selectedMonth
                      ? `Payments due ${monthLabel(selectedMonth)}`
                      : "All payments"
              }
              hint={`${rows.length} shown`}
              actions={
                selectedMonth ? (
                  <button className="btn" type="button" onClick={() => setSelectedMonth(null)}>
                    Clear month
                  </button>
                ) : null
              }
            >
              <div className="toolbar">
                <Tabs<SourceFilter>
                  tabs={[
                    { id: "all", label: "All" },
                    { id: "PO Installment", label: "PO installments" },
                    { id: "Non-PO", label: "Non-PO" },
                    { id: "Payroll", label: "Payroll" },
                  ]}
                  value={source}
                  onChange={setSource}
                />
                <select
                  className="control"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StatusFilter)}
                  aria-label="Status"
                >
                  <option value="open">Unpaid</option>
                  <option value="all">All statuses</option>
                  <option value="Planned">Planned</option>
                  <option value="Approved">Approved</option>
                  <option value="Paid">Paid</option>
                </select>
                <select
                  className="control"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  aria-label="Vendor"
                >
                  <option value="all">All vendors</option>
                  {vendors.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
                <button
                  className={`btn${selectedMonth === "overdue" ? " blue" : ""}`}
                  type="button"
                  onClick={() => setSelectedMonth(selectedMonth === "overdue" ? null : "overdue")}
                >
                  Overdue ({payments.overdue.length})
                </button>
                <button
                  className={`btn${selectedMonth === "tbd" ? " blue" : ""}`}
                  type="button"
                  onClick={() => setSelectedMonth(selectedMonth === "tbd" ? null : "tbd")}
                >
                  Date TBD ({payments.tbd.length})
                </button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Due</th>
                      <th>Source</th>
                      <th>Reference</th>
                      <th>Vendor</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Entered by</th>
                      <th className="num">Amount</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="empty">
                          No payments match these filters.
                        </td>
                      </tr>
                    ) : (
                      rows.map((p) => {
                        const n = p.source === "Non-PO" ? nonPoById(p.id) : undefined;
                        const overdue =
                          p.dueDate !== null && p.status !== "Paid" && p.dueDate < asOf;
                        return (
                          <tr key={p.id}>
                            <td className="nowrap">
                              {p.dueDate ? (
                                <span className={overdue ? "neg strong" : ""}>
                                  {formatDate(p.dueDate)}
                                </span>
                              ) : (
                                <span className="muted">Date TBD</span>
                              )}
                            </td>
                            <td>{p.source}</td>
                            <td>
                              <strong>{p.reference}</strong>
                            </td>
                            <td>{p.vendor}</td>
                            <td>
                              {p.description}
                              {n && n.recurring !== "None" ? (
                                <div className="small">Recurring · {n.recurring}</div>
                              ) : null}
                            </td>
                            <td>{p.category}</td>
                            <td>
                              {n
                                ? n.enteredBy
                                : p.source === "Payroll"
                                  ? "Finance (payroll file)"
                                  : "Supply Chain (PO)"}
                            </td>
                            <td className="num strong">{usd(p.amount)}</td>
                            <td>
                              <StatusBadge status={p.status} />
                            </td>
                            <td className="nowrap">
                              {n && canEdit ? (
                                <div className="row">
                                  <button className="btn" type="button" onClick={() => openEdit(p)}>
                                    Edit
                                  </button>
                                  {n.status === "Planned" ? (
                                    <button
                                      className="btn"
                                      type="button"
                                      onClick={() => setPaymentStatus(n.id, "Approved")}
                                    >
                                      Approve
                                    </button>
                                  ) : null}
                                  {n.status !== "Paid" ? (
                                    <button
                                      className="btn blue"
                                      type="button"
                                      onClick={() => setPaymentStatus(n.id, "Paid")}
                                    >
                                      Mark paid
                                    </button>
                                  ) : null}
                                </div>
                              ) : p.source === "Payroll" ? (
                                <button
                                  className="btn"
                                  type="button"
                                  onClick={() => setView("payroll")}
                                >
                                  View batch
                                </button>
                              ) : p.source === "PO Installment" ? (
                                <span className="small">Edit in PO &amp; Vendor</span>
                              ) : (
                                <span className="small">View only</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {rows.length > 0 ? (
                    <tfoot>
                      <tr className="total-row">
                        <td colSpan={7}>Total</td>
                        <td className="num">{usd(sum(rows, (r) => r.amount))}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
              <div className="small mt">
                PO installment status:{" "}
                <Assume title="PO installments don't have an approval step in the blueprint">
                  unpaid installments show as Approved; paid ones as Paid
                </Assume>
              </div>
            </Section>
          </>
        ) : null}

        <Modal
          open={form !== null}
          title={form?.id ? "Edit Non-PO Payment" : "Add Non-PO Payment"}
          onClose={() => setForm(null)}
        >
          {form ? (
            <form onSubmit={save}>
              <div className="form-grid">
                <Field label="Vendor">
                  <select
                    value={form.vendorId}
                    onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
                    required
                  >
                    {data.vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Category">
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    {(CATEGORIES.includes(form.category)
                      ? CATEGORIES
                      : [form.category, ...CATEGORIES]
                    ).map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Description" span2>
                  <input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    required
                    placeholder="e.g. Georgia storage & prep – Dec"
                  />
                </Field>
                <Field label="Amount (USD)">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Due date">
                  <input
                    type="date"
                    value={form.dueDate}
                    disabled={form.tbd}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    required={!form.tbd}
                  />
                  <label className="small row" style={{ gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={form.tbd}
                      onChange={(e) => setForm({ ...form, tbd: e.target.checked })}
                    />{" "}
                    Date not known yet (TBD)
                  </label>
                </Field>
                <Field label="Recurring">
                  <select
                    value={form.recurring}
                    onChange={(e) => setForm({ ...form, recurring: e.target.value as Recurring })}
                  >
                    {RECURRING.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Status">
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as PaymentStatus })}
                  >
                    <option>Planned</option>
                    <option>Approved</option>
                    <option>Paid</option>
                  </select>
                </Field>
              </div>
              <div className="notice" style={{ marginTop: 12, marginBottom: 0 }}>
                An unknown amount or date never blocks entry — use TBD and update later. Saved
                payments flow straight into the CEO's monthly plan and the Cash Flow outlook.
              </div>
              <ModalActions
                onCancel={() => setForm(null)}
                submitLabel={form.id ? "Save changes" : "Add payment"}
              />
            </form>
          ) : null}
        </Modal>
      </section>
    </ModuleGate>
  );
}

// ---------------------------------------------------------------- weekly plan

function WeeklyPlan() {
  const weeks = useWeeklyCash(8);
  const buffer = HEALTH_TARGETS.minimumCashBuffer;
  const [open, setOpen] = useState<string | null>(weeks[0]?.weekStart ?? null);
  const plannerLines = (lines: (typeof weeks)[number]["lines"]) =>
    lines.filter(
      (l) =>
        l.direction === "out" && (l.source === "Payment Planner" || l.source === "Payroll file"),
    );
  const thisWeek = weeks[0];
  const lowest = [...weeks].sort((a, b) => a.closing - b.closing)[0];

  return (
    <>
      <div className="module-stats">
        <ModuleStat
          label="To pay this week"
          value={usd(thisWeek ? sum(plannerLines(thisWeek.lines), (l) => l.amount) : 0)}
          note={
            thisWeek ? `${formatDate(thisWeek.weekStart)} – ${formatDate(thisWeek.weekEnd)}` : ""
          }
        />
        <ModuleStat
          label="Cash left after this week"
          value={
            <span className={thisWeek && thisWeek.closing < buffer ? "neg" : ""}>
              {usd(thisWeek?.closing ?? 0)}
            </span>
          }
          note="QuickBooks bank − all payments + receipts"
        />
        <ModuleStat
          label="Lowest point (8 weeks)"
          value={
            <span className={lowest && lowest.closing < buffer ? "neg" : ""}>
              {usd(lowest?.closing ?? 0)}
            </span>
          }
          note={lowest ? `Week of ${formatDate(lowest.weekStart)}` : ""}
        />
        <ModuleStat
          label="Payments next 8 weeks"
          value={usd(sum(weeks, (w) => sum(plannerLines(w.lines), (l) => l.amount)))}
          note="PO + Non-PO + Payroll"
        />
      </div>
      <Section
        title="Weekly payment plan"
        hint="Mon–Sun · click a week to see what to pay"
        actions={
          <Assume title="Minimum cash buffer is a placeholder — set the real figure">
            buffer {usd(buffer)}
          </Assume>
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Week</th>
                <th className="num">PO installments</th>
                <th className="num">Non-PO</th>
                <th className="num">Payroll</th>
                <th className="num">Other out</th>
                <th className="num">Receipts in</th>
                <th className="num">Cash left after week</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => {
                const po = w.outByCategory["PO Payment"] ?? 0;
                const nonPo = w.outByCategory["Non-PO Payment"] ?? 0;
                const payroll = w.outByCategory["Payroll"] ?? 0;
                const other = w.paymentsOut - po - nonPo - payroll;
                const isOpen = open === w.weekStart;
                return (
                  <Fragment key={w.weekStart}>
                    <tr
                      className={`click-row${isOpen ? " selected-row" : ""}`}
                      onClick={() => setOpen(isOpen ? null : w.weekStart)}
                    >
                      <td className="nowrap">
                        <strong>{formatDate(w.weekStart)}</strong> – {formatDate(w.weekEnd)}
                      </td>
                      <td className="num">{po ? usd(po) : "—"}</td>
                      <td className="num">{nonPo ? usd(nonPo) : "—"}</td>
                      <td className="num">{payroll ? usd(payroll) : "—"}</td>
                      <td className="num muted">{other ? usd(other) : "—"}</td>
                      <td className="num pos">{w.receiptsIn ? `+${usd(w.receiptsIn)}` : "—"}</td>
                      <td className={`num strong ${w.closing < buffer ? "neg" : ""}`}>
                        {usd(w.closing)}
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr>
                        <td colSpan={7} style={{ background: "#f8fbff" }}>
                          {w.lines.length === 0 ? (
                            <div className="small">Nothing scheduled this week.</div>
                          ) : (
                            <table className="compact" style={{ minWidth: 0 }}>
                              <tbody>
                                {[...w.lines]
                                  .sort(
                                    (a, b) =>
                                      a.date.localeCompare(b.date) ||
                                      a.direction.localeCompare(b.direction),
                                  )
                                  .map((l) => (
                                    <tr key={l.id}>
                                      <td className="nowrap">{formatDate(l.date)}</td>
                                      <td>
                                        {l.description}
                                        <div className="small">
                                          {l.category} · {l.source}
                                        </div>
                                      </td>
                                      <td
                                        className={`num strong ${l.direction === "out" ? "neg" : "pos"}`}
                                      >
                                        {l.direction === "out" ? "−" : "+"}
                                        {usd(l.amount)}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="small mt">
          "Other out" = subscriptions, US payroll, loan repayments and tax from Cash Flow. Receipts
          are expected marketplace payouts and open QuickBooks invoices.
        </div>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------- Pakistan payroll

const PAYROLL_TONE: Record<PayrollStatus, "amber" | "blue" | "green"> = {
  Uploaded: "amber",
  "Approved by CEO": "blue",
  Paid: "green",
};

function PayrollPanel() {
  const { data, update, role, flash, asOf } = useStore();
  const batches = useMemo(
    () => [...data.payrollBatches].sort((a, b) => b.month.localeCompare(a.month)),
    [data.payrollBatches],
  );
  const [selectedId, setSelectedId] = useState<string | null>(batches[0]?.id ?? null);
  const [showBank, setShowBank] = useState(false);
  const batch = batches.find((b) => b.id === selectedId) ?? batches[0] ?? null;
  const canUpload = isFinance(role);
  const isCeo = role === "CEO";
  const canSeeBank = role === "CEO" || role === "Director Finance";

  function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !canUpload) return;
    const latest = batches[0];
    if (!latest) return;
    const month = monthKey(addMonths(`${latest.month}-01`, 1));
    if (data.payrollBatches.some((b) => b.month === month)) {
      flash(`Payroll for ${monthLabel(month)} is already uploaded`);
      return;
    }
    const copy: PayrollBatch = {
      ...latest,
      id: `PR-${month}`,
      month,
      uploadedBy: role,
      uploadedAt: asOf,
      fileName: file.name,
      payDate: addMonths(latest.payDate, 1),
      status: "Uploaded",
      lines: latest.lines.map((l) => ({ ...l, bank: { ...l.bank } })),
    };
    update("payrollBatches", (prev) => [...prev, copy]);
    setSelectedId(copy.id);
    flash(`Payroll ${monthLabel(month)} uploaded · now in the CEO's payment plan`);
  }

  function setStatus(id: string, status: PayrollStatus) {
    update("payrollBatches", (prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    flash(
      status === "Paid"
        ? "Payroll marked paid · removed from the payment plan"
        : "Payroll approved",
    );
  }

  if (!batch) return <div className="card empty">No payroll uploaded yet.</div>;
  const t = batchTotals(batch);
  const depts = departmentTotals(batch);

  return (
    <>
      <div className="module-stats">
        <ModuleStat
          label="Net payable (PKR)"
          value={`PKR ${int(t.netPkr)}`}
          note={`${t.employees} employees · ${batch.entity}`}
        />
        <ModuleStat
          label="Net payable (USD)"
          value={usd(t.netUsd)}
          note={`at ${batch.fxRate} PKR / USD`}
        />
        <ModuleStat
          label="Pay date"
          value={formatDate(batch.payDate)}
          note={<Badge tone={PAYROLL_TONE[batch.status]}>{batch.status}</Badge>}
        />
        <ModuleStat
          label="PF released"
          value={`PKR ${int(t.pfReleasePkr)}`}
          note="Included in net payable"
        />
      </div>

      <Section
        title={`Payroll ${monthLabel(batch.month)}`}
        kicker="PAKISTAN PAYROLL · URTASKER (CDC)"
        hint={`${batch.fileName} · uploaded by ${batch.uploadedBy} on ${formatDate(batch.uploadedAt)}`}
        actions={
          <div className="row">
            <select
              className="control"
              value={batch.id}
              onChange={(e) => setSelectedId(e.target.value)}
              aria-label="Payroll month"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {monthLabel(b.month)} · {b.status}
                </option>
              ))}
            </select>
            {canUpload ? (
              <label className="btn primary" style={{ cursor: "pointer" }}>
                Upload payroll file
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={upload}
                  style={{ display: "none" }}
                />
              </label>
            ) : null}
            {isCeo && batch.status === "Uploaded" ? (
              <button
                className="btn"
                type="button"
                onClick={() => setStatus(batch.id, "Approved by CEO")}
              >
                Approve
              </button>
            ) : null}
            {isCeo && batch.status !== "Paid" ? (
              <button
                className="btn blue"
                type="button"
                onClick={() => setStatus(batch.id, "Paid")}
              >
                Mark paid
              </button>
            ) : null}
            {canSeeBank ? (
              <button className="btn" type="button" onClick={() => setShowBank((v) => !v)}>
                {showBank ? "Hide bank details" : "Show bank details"}
              </button>
            ) : null}
          </div>
        }
      >
        {canUpload ? (
          <div className="small" style={{ marginBottom: 10 }}>
            <Assume title="The prototype copies last month's batch. The live version reads the Emp Wise Summary and Payroll File sheets (net pay, PF release, deductions, bank transfer columns, FX rate).">
              live version reads the Excel
            </Assume>
          </div>
        ) : null}
        <div className="grid-main-side">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th className="num">Payroll (PKR)</th>
                  <th className="num">PF release</th>
                  <th className="num">Net PKR</th>
                  <th className="num">Net USD</th>
                  <th>Bank</th>
                  <th>Account</th>
                </tr>
              </thead>
              <tbody>
                {batch.lines.map((l) => (
                  <tr key={l.empCode}>
                    <td className="nowrap">
                      <strong>{l.empCode}</strong>
                    </td>
                    <td>{showBank && canSeeBank ? l.bank.beneficiary : l.name}</td>
                    <td>{l.department}</td>
                    <td className="num">{int(l.grossPkr)}</td>
                    <td className="num">{l.pfReleasePkr ? int(l.pfReleasePkr) : "—"}</td>
                    <td className="num strong">{int(l.netPkr)}</td>
                    <td className="num">{usd(lineNetUsd(l, batch.fxRate))}</td>
                    <td>{l.bank.bankName}</td>
                    <td className="nowrap">
                      {showBank && canSeeBank ? (
                        l.bank.accountMasked
                      ) : (
                        <span className="muted">•••• hidden</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={3}>Total · {t.employees} employees</td>
                  <td className="num">{int(t.grossPkr)}</td>
                  <td className="num">{int(t.pfReleasePkr)}</td>
                  <td className="num">{int(t.netPkr)}</td>
                  <td className="num">{usd(t.netUsd)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="stack">
            <div className="card" style={{ boxShadow: "none" }}>
              <div className="section-title">
                <h3>By department</h3>
              </div>
              {depts.map((d) => (
                <div className="summary-line" key={d.department}>
                  <span>
                    {d.department} <span className="small">· {d.employees}</span>
                  </span>
                  <strong>
                    PKR {int(d.netPkr)} <span className="small">({usd(d.netUsd)})</span>
                  </strong>
                </div>
              ))}
            </div>
            <div className="notice" style={{ marginBottom: 0 }}>
              {canSeeBank
                ? "Bank transfer details are shown only to the CEO and Director Finance. Use them to pay each employee, then mark the batch paid."
                : "Bank transfer details are visible to the CEO and Director Finance only."}
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
