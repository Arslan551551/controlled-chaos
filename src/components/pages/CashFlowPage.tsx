import { useMemo, useState, type FormEvent } from "react";

import { Assume, Field, Modal, ModalActions, ModuleGate, ModuleHead, ModuleStat, Section, Source, ViewOnlyBanner, sum, useCanEdit } from "@/components/cc/ui";
import { useCashFlow } from "@/lib/derived";
import type { CashFlowMonth } from "@/lib/engine/finance";
import { formatDate, monthLabel, usd } from "@/lib/format";
import { HEALTH_TARGETS } from "@/lib/sample/finance";
import { useStore, type AppData } from "@/lib/store";

type ManualLine = AppData["manualCashLines"][number];
type ManualKind = "Loan Receipt" | "Loan Repayment" | "Payroll" | "Tax";
const KINDS: ManualKind[] = ["Loan Receipt", "Loan Repayment", "Payroll", "Tax"];

function makeLine(kind: ManualKind, date: string, description: string, amount: number): ManualLine {
  switch (kind) {
    case "Loan Receipt":
      return { date, direction: "in", category: "Loan Receipt", description, amount };
    case "Loan Repayment":
      return { date, direction: "out", category: "Loan Repayment", description, amount };
    case "Payroll":
      return { date, direction: "out", category: "Payroll", description, amount };
    case "Tax":
      return { date, direction: "out", category: "Tax", description, amount };
  }
}

const OUT_ORDER = ["PO Payment", "Non-PO Payment", "Payroll", "Subscription", "Loan Repayment", "Tax", "Other Payment"];

export function CashFlowPage() {
  const { data, update, flash, asOf } = useStore();
  const canEdit = useCanEdit("cash-flow");
  const cash = useCashFlow();
  const [selected, setSelected] = useState<string | null>(cash.months[0]?.month ?? null);
  const [form, setForm] = useState<{ kind: ManualKind; date: string; description: string; amount: string } | null>(null);

  const buffer = HEALTH_TARGETS.minimumCashBuffer;
  const lowest = useMemo(() => [...cash.months].sort((a, b) => a.closing - b.closing)[0], [cash.months]);
  const outCategories = useMemo(() => {
    const present = new Set(cash.months.flatMap((m) => Object.keys(m.outByCategory)));
    return OUT_ORDER.filter((c) => present.has(c));
  }, [cash.months]);
  const selectedMonth: CashFlowMonth | undefined = cash.months.find((m) => m.month === selected);
  const syncedAt = data.bankAccounts[0]?.syncedAt ?? asOf;

  function save(e: FormEvent) {
    e.preventDefault();
    if (!form || !canEdit) return;
    const amount = Number(form.amount);
    if (!(amount > 0) || !form.description.trim()) return;
    const line = makeLine(form.kind, form.date, form.description.trim(), amount);
    update("manualCashLines", (prev) => [...prev, line]);
    flash("Cash line added · month-end cash recalculated");
    setForm(null);
  }

  const cell = (v: number, sign: "+" | "−" | "") => (v === 0 ? <span className="muted">—</span> : `${sign}${usd(v)}`);

  return (
    <ModuleGate id="cash-flow">
      <section className="screen active" id="screen-cash-flow">
        <ModuleHead title="Cash Flow Outlook" subtitle="Opening QuickBooks bank balance − payments out + sales receipts + loan receipts = projected month-end cash">
          <div className="row">
            <Source>QuickBooks · synced {syncedAt.replace("T", " ")}</Source>
            {canEdit ? <button className="btn primary" type="button" onClick={() => setForm({ kind: "Loan Receipt", date: asOf, description: "", amount: "" })}>+ Add Cash Line</button> : null}
          </div>
        </ModuleHead>

        <ViewOnlyBanner id="cash-flow" text="View only for this role. Director Finance maintains loans, payroll and tax lines." />

        <div className="module-stats">
          <ModuleStat label="Opening bank balance" value={usd(cash.opening)} note={`${data.bankAccounts.length} QuickBooks accounts`} />
          {cash.months.map((m) => (
            <ModuleStat key={m.month} label={`${monthLabel(m.month)} month-end`} value={<span className={m.closing < buffer ? "neg" : ""}>{usd(m.closing)}</span>} note={`${m.closing - m.opening >= 0 ? "+" : "−"}${usd(Math.abs(m.closing - m.opening))} in the month`} />
          ))}
        </div>

        {lowest && lowest.closing < buffer ? (
          <div className="notice readonly">
            Projected cash falls to <strong>{usd(lowest.closing)}</strong> at the end of {monthLabel(lowest.month)}, below the {usd(buffer)} minimum buffer <Assume title="Minimum cash buffer is a placeholder — set the real figure">buffer {usd(buffer)}</Assume>
          </div>
        ) : (
          <div className="notice">Projected cash stays above the {usd(buffer)} minimum buffer for all three months.</div>
        )}

        <div className="grid-main-side">
          <Section title="3-Month Outlook" hint="Click a month for its lines">
            <div className="table-wrap">
              <table className="compact" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th />
                    {cash.months.map((m) => (
                      <th key={m.month} className="num" style={{ cursor: "pointer", color: selected === m.month ? "#0c2748" : undefined }} onClick={() => setSelected(m.month)}>
                        {monthLabel(m.month)}{m.month === asOf.slice(0, 7) ? " (rest of month)" : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="total-row">
                    <td>Opening bank balance</td>
                    {cash.months.map((m) => <td key={m.month} className="num">{usd(m.opening)}</td>)}
                  </tr>
                  <tr>
                    <td><strong>− Cash payments out</strong></td>
                    {cash.months.map((m) => <td key={m.month} className="num neg strong">{cell(m.paymentsOut, "−")}</td>)}
                  </tr>
                  {outCategories.map((c) => (
                    <tr key={c}>
                      <td style={{ paddingLeft: 26 }} className="muted">{c}</td>
                      {cash.months.map((m) => <td key={m.month} className="num muted">{cell(m.outByCategory[c] ?? 0, "−")}</td>)}
                    </tr>
                  ))}
                  <tr>
                    <td><strong>+ Cash sales receipts in</strong></td>
                    {cash.months.map((m) => <td key={m.month} className="num pos strong">{cell(m.salesIn, "+")}</td>)}
                  </tr>
                  {["Marketplace Payout", "Salon / Distributor Receipt"].map((c) => (
                    <tr key={c}>
                      <td style={{ paddingLeft: 26 }} className="muted">{c === "Marketplace Payout" ? "Marketplace payouts" : "Salon & distributor receipts"}</td>
                      {cash.months.map((m) => <td key={m.month} className="num muted">{cell(m.inByCategory[c] ?? 0, "+")}</td>)}
                    </tr>
                  ))}
                  <tr>
                    <td><strong>+ Loan receipts in</strong></td>
                    {cash.months.map((m) => <td key={m.month} className="num pos strong">{cell(m.loanIn, "+")}</td>)}
                  </tr>
                  {cash.months.some((m) => m.otherIn > 0) ? (
                    <tr>
                      <td><strong>+ Other receipts</strong></td>
                      {cash.months.map((m) => <td key={m.month} className="num pos">{cell(m.otherIn, "+")}</td>)}
                    </tr>
                  ) : null}
                  <tr className="total-row">
                    <td>= Projected month-end cash</td>
                    {cash.months.map((m) => (
                      <td key={m.month} className={`num ${m.closing < buffer ? "neg" : ""}`} style={{ fontSize: 15 }}>{usd(m.closing)}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="small mt">
              Payments out come from the Payment Planner (PO installments + Non-PO), active subscriptions, payroll, loan repayments and tax.
              Sales receipts are expected marketplace payouts and open QuickBooks invoices for salons and distributors.{" "}
              <Assume title="Payout amounts are forecast from each platform's payout schedule until the live integrations are connected">payout forecast</Assume>
            </div>
          </Section>

          <div className="stack">
            <Section title="QuickBooks Bank Accounts" kicker="OPENING BALANCE">
              {data.bankAccounts.map((b) => (
                <div className="summary-line" key={b.id}>
                  <span>{b.name}</span>
                  <strong>{usd(b.balance)}</strong>
                </div>
              ))}
              <div className="summary-line">
                <span><strong>Total opening cash</strong></span>
                <strong>{usd(sum(data.bankAccounts, (b) => b.balance))}</strong>
              </div>
              <div className="small mt">Balances are read from QuickBooks, never typed in.</div>
            </Section>

            <Section title={selectedMonth ? `${monthLabel(selectedMonth.month)} lines` : "Month lines"} kicker="DRILL-DOWN" hint={selectedMonth ? `${selectedMonth.lines.length} lines` : undefined}>
              {selectedMonth ? (
                <div className="table-wrap" style={{ maxHeight: 460, overflow: "auto" }}>
                  <table className="compact" style={{ minWidth: 420 }}>
                    <thead>
                      <tr><th>Date</th><th>Line</th><th className="num">Amount</th></tr>
                    </thead>
                    <tbody>
                      {[...selectedMonth.lines].sort((a, b) => a.date.localeCompare(b.date)).map((l) => (
                        <tr key={l.id}>
                          <td className="nowrap">{formatDate(l.date)}</td>
                          <td>
                            {l.description}
                            <div className="small">{l.category} · {l.source}</div>
                          </td>
                          <td className={`num strong ${l.direction === "out" ? "neg" : "pos"}`}>{l.direction === "out" ? "−" : "+"}{usd(l.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty">Select a month.</div>
              )}
            </Section>
          </div>
        </div>

        <Modal open={form !== null} title="Add Cash Line" onClose={() => setForm(null)} width={560}>
          {form ? (
            <form onSubmit={save}>
              <div className="form-grid">
                <Field label="Type">
                  <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ManualKind })}>
                    {KINDS.map((k) => <option key={k}>{k}</option>)}
                  </select>
                </Field>
                <Field label="Date">
                  <input type="date" value={form.date} min={asOf} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                </Field>
                <Field label="Description" span2>
                  <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required placeholder="e.g. Line of credit drawdown" />
                </Field>
                <Field label="Amount (USD)">
                  <input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                </Field>
              </div>
              <div className="notice" style={{ marginTop: 12, marginBottom: 0 }}>
                Supplier and Non-PO payments are added in the Payment Planner; this form is for loans, payroll and tax.
              </div>
              <ModalActions onCancel={() => setForm(null)} submitLabel="Add line" />
            </form>
          ) : null}
        </Modal>
      </section>
    </ModuleGate>
  );
}
