// AR & Collections — everything customers owe us (QuickBooks open invoices) with
// aging, and internal reminders to the people who manage each account.

import { useMemo, useState, type FormEvent } from "react";

import { Assume, Badge, Field, Modal, ModuleGate, ModuleHead, ModuleStat, Section, Source, Tabs, ViewOnlyBanner, useCanEdit } from "@/components/cc/ui";
import { ROLE_PERSON } from "@/lib/access";
import { agingBy, arPosition, bucketOf, BUCKETS, daysOverdue, dso, generateReminders, openUsd, type ArInvoice, type CustomerType, type Reminder, type ReminderRules } from "@/lib/engine/ar";
import { formatDate } from "@/lib/engine/dates";
import { invoicePaid } from "@/lib/engine/distributors";
import { money, usd } from "@/lib/format";
import { newId, useStore, type OutboxEmail } from "@/lib/store";

const FINANCE_OWNER = { ownerId: "E-DF", ownerName: "Director Finance", ownerEmail: "finance@controlledchaoshair.com" };

/** All AR invoices: salon & wholesale from the AR sample + distributor invoices (converted to USD). */
function useArInvoices(): ArInvoice[] {
  const { data } = useStore();
  return useMemo(() => {
    const dist: ArInvoice[] = data.distributorInvoices.map((i) => {
      const d = data.distributors.find((x) => x.id === i.distributorId);
      return {
        id: i.id,
        customerId: i.distributorId,
        customerName: d?.name ?? i.distributorId,
        customerType: "Distributor" as const,
        ...FINANCE_OWNER,
        date: i.date,
        dueDate: i.dueDate,
        amount: i.amount,
        paid: invoicePaid(i),
        currency: d?.currency ?? "USD",
        fxToUsd: d?.fxToUsd ?? 1,
      };
    });
    return [...data.arInvoices, ...dist];
  }, [data.arInvoices, data.distributorInvoices, data.distributors]);
}

type ArTab = "position" | "invoices" | "reminders" | "rules";

export function ArPage() {
  return (
    <ModuleGate id="ar">
      <ArInner />
    </ModuleGate>
  );
}

function ArInner() {
  const { role, asOf, data } = useStore();
  const all = useArInvoices();
  const isRep = role === "Salon Sales Rep";
  const me = ROLE_PERSON[role];
  const scoped = isRep ? all.filter((i) => i.ownerId === me) : all;
  const [tab, setTab] = useState<ArTab>("position");
  const [type, setType] = useState<"all" | CustomerType>("all");
  const [owner, setOwner] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const owners = [...new Map(scoped.map((i) => [i.ownerId, i.ownerName])).entries()];
  const filtered = scoped.filter(
    (i) => (type === "all" || i.customerType === type) && (owner === "all" || i.ownerId === owner) && openUsd(i) > 0 && (!overdueOnly || bucketOf(i, asOf) !== "Current"),
  );
  const pos = arPosition(scoped, asOf);
  const reminders = generateReminders(scoped, data.arRules, asOf, data.arReminderLog);

  const tabs: { id: ArTab; label: string }[] = [
    { id: "position", label: "AR Position" },
    { id: "invoices", label: "Open Invoices" },
    { id: "reminders", label: `Reminders (${reminders.length})` },
    ...(isRep ? [] : [{ id: "rules" as const, label: "Reminder Rules & Log" }]),
  ];

  return (
    <section className="screen active" id="screen-ar">
      <ModuleHead title="AR & Collections" subtitle={isRep ? "Your salon accounts — what they owe and what to chase" : "What customers owe us, by customer, owner and age"}>
        <Tabs<ArTab> value={tab} onChange={setTab} tabs={tabs} />
      </ModuleHead>
      {isRep ? <ViewOnlyBanner id="ar" text="You see your own accounts. Finance records payments in QuickBooks." /> : <ViewOnlyBanner id="ar" />}
      <div className="row" style={{ marginBottom: 10 }}>
        <Source>QuickBooks open invoices · synced 24 Oct 06:00</Source>
        <span className="small">Reminders go to the internal account owner — never to the customer.</span>
      </div>
      <div className="module-stats">
        <ModuleStat label="Total open AR" value={usd(pos.open)} note={`${scoped.filter((i) => openUsd(i) > 0).length} open invoices · USD (EUR converted)`} />
        <ModuleStat label="Overdue" value={usd(pos.overdue)} note={`${pos.open ? Math.round((pos.overdue / pos.open) * 100) : 0}% of open AR`} />
        <ModuleStat label="Over 60 days" value={usd(pos.over60)} note={`DSO ≈ ${dso(scoped, asOf)} days (last 90 days billed)`} />
      </div>

      {tab !== "rules" ? (
        <div className="toolbar">
          <select className="control" value={type} onChange={(e) => setType(e.target.value as "all" | CustomerType)}>
            <option value="all">All customer types</option>
            <option>Distributor</option>
            <option>Salon</option>
            <option>Wholesale</option>
          </select>
          {!isRep ? (
            <select className="control" value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="all">All owners</option>
              {owners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          ) : null}
          <label className="small row" style={{ gap: 6 }}>
            <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} /> Overdue only
          </label>
        </div>
      ) : null}

      {tab === "position" ? <PositionTab invoices={filtered} /> : null}
      {tab === "invoices" ? <InvoicesTab invoices={filtered} /> : null}
      {tab === "reminders" ? <RemindersTab reminders={reminders.filter((r) => filtered.some((i) => i.id === r.invoiceId))} /> : null}
      {tab === "rules" && !isRep ? <RulesTab /> : null}
    </section>
  );
}

function BucketCells({ b }: { b: Record<string, number> }) {
  return (
    <>
      {BUCKETS.map((k) => (
        <td key={k} className={`num${k !== "Current" && (b[k] ?? 0) > 0 ? (k === "61–90" || k === "90+" ? " neg strong" : " neg") : ""}`}>{(b[k] ?? 0) > 0 ? usd(b[k] ?? 0) : "—"}</td>
      ))}
    </>
  );
}

function PositionTab({ invoices }: { invoices: ArInvoice[] }) {
  const { asOf } = useStore();
  const byCustomer = agingBy(invoices, asOf, (i) => ({ key: i.customerId, label: i.customerName, type: i.customerType, ownerName: i.ownerName }));
  const byOwner = agingBy(invoices, asOf, (i) => ({ key: i.ownerId, label: i.ownerName, type: null, ownerName: i.ownerName }));
  const byType = agingBy(invoices, asOf, (i) => ({ key: i.customerType, label: i.customerType, type: i.customerType, ownerName: "" }));
  const total = arPosition(invoices, asOf);
  return (
    <div className="stack">
      <Section title="Aging by customer" hint="USD; EUR invoices converted at the distributor's rate">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Customer</th><th>Type</th><th>Owner</th><th className="num">Invoices</th>{BUCKETS.map((b) => <th key={b} className="num">{b === "Current" ? "Current" : `${b} days`}</th>)}<th className="num">Total open</th><th className="num">Oldest overdue</th></tr>
            </thead>
            <tbody>
              {byCustomer.map((r) => (
                <tr key={r.key}>
                  <td><strong>{r.label}</strong></td>
                  <td>{r.type ? <Badge tone={r.type === "Distributor" ? "purple" : r.type === "Salon" ? "blue" : "grey"}>{r.type}</Badge> : null}</td>
                  <td>{r.ownerName}</td>
                  <td className="num">{r.invoices}</td>
                  <BucketCells b={r.buckets} />
                  <td className="num strong">{usd(r.open)}</td>
                  <td className="num">{r.oldestDaysOverdue ? `${r.oldestDaysOverdue} d` : "—"}</td>
                </tr>
              ))}
              {byCustomer.length === 0 ? <tr><td colSpan={11} className="empty">Nothing open.</td></tr> : null}
              <tr className="total-row">
                <td colSpan={4}>Total</td>
                <BucketCells b={total.buckets} />
                <td className="num">{usd(total.open)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
      <div className="grid-2">
        <Section title="By owner" hint="Who should be chasing">
          <div className="table-wrap">
            <table className="compact">
              <thead><tr><th>Owner</th><th className="num">Open</th><th className="num">Overdue</th><th className="num">60+ days</th></tr></thead>
              <tbody>
                {byOwner.map((r) => (
                  <tr key={r.key}><td>{r.label}</td><td className="num">{usd(r.open)}</td><td className="num">{r.overdue ? usd(r.overdue) : "—"}</td><td className="num">{r.buckets["61–90"] + r.buckets["90+"] > 0 ? usd(r.buckets["61–90"] + r.buckets["90+"]) : "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
        <Section title="By customer type">
          <div className="table-wrap">
            <table className="compact">
              <thead><tr><th>Type</th><th className="num">Open</th><th className="num">Overdue</th><th className="num">% overdue</th></tr></thead>
              <tbody>
                {byType.map((r) => (
                  <tr key={r.key}><td>{r.label}</td><td className="num">{usd(r.open)}</td><td className="num">{r.overdue ? usd(r.overdue) : "—"}</td><td className="num">{r.open ? `${Math.round((r.overdue / r.open) * 100)}%` : "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </div>
  );
}

function InvoicesTab({ invoices }: { invoices: ArInvoice[] }) {
  const { asOf } = useStore();
  const rows = [...invoices].sort((a, b) => daysOverdue(b, asOf) - daysOverdue(a, asOf) || a.dueDate.localeCompare(b.dueDate));
  return (
    <Section title="Open invoices" hint="From QuickBooks">
      <div className="table-wrap">
        <table>
          <thead><tr><th>Invoice</th><th>Customer</th><th>Type</th><th>Owner</th><th>Date</th><th>Due</th><th className="num">Amount</th><th className="num">Paid / applied</th><th className="num">Open</th><th className="num">Open (USD)</th><th>Age</th></tr></thead>
          <tbody>
            {rows.map((i) => {
              const b = bucketOf(i, asOf);
              const cur = (n: number) => (i.currency === "USD" ? money(n) : `${i.currency} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
              return (
                <tr key={`${i.customerType}-${i.id}`}>
                  <td><strong>{i.id}</strong></td>
                  <td>{i.customerName}</td>
                  <td>{i.customerType}</td>
                  <td>{i.ownerName}</td>
                  <td>{formatDate(i.date)}</td>
                  <td>{formatDate(i.dueDate)}</td>
                  <td className="num">{cur(i.amount)}</td>
                  <td className="num">{i.paid ? cur(i.paid) : "—"}</td>
                  <td className="num strong">{cur(i.amount - i.paid)}</td>
                  <td className="num">{usd(openUsd(i))}</td>
                  <td>{b === "Current" ? <Badge tone="green">Current</Badge> : <Badge tone={b === "1–30" ? "amber" : "red"}>{daysOverdue(i, asOf)} d overdue</Badge>}</td>
                </tr>
              );
            })}
            {rows.length === 0 ? <tr><td colSpan={11} className="empty">Nothing open.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function RemindersTab({ reminders }: { reminders: Reminder[] }) {
  const { update, asOf, flash, data } = useStore();
  const canEdit = useCanEdit("ar");
  const [preview, setPreview] = useState<Reminder | null>(null);

  const send = (list: Reminder[]) => {
    if (list.length === 0) return;
    const emails: OutboxEmail[] = list.map((r) => ({
      id: newId("AR"),
      to: r.cc.length ? `${r.to}; cc: ${r.cc.join(", ")}` : r.to,
      subject: r.subject,
      body: r.body,
      queuedAt: `${asOf}T08:00`,
      status: "Queued (Gmail not connected yet)",
    }));
    update("outbox", (prev) => [...prev, ...emails]);
    update("arReminderLog", (prev) => [...prev, ...list.map((r) => ({ invoiceId: r.invoiceId, sentOn: asOf, kind: r.kind, to: r.to }))]);
    flash(`${list.length} internal reminder${list.length === 1 ? "" : "s"} queued`);
  };

  const queued = data.outbox.filter((e) => e.subject.startsWith("[AR "));

  return (
    <div className="stack">
      <Section
        title="Today's internal reminders"
        kicker={formatDate(asOf)}
        hint="Generated daily from the rules · sent to account owners, never to customers"
        actions={canEdit ? <button className="btn primary" type="button" disabled={reminders.length === 0} onClick={() => send(reminders)}>Send all now</button> : null}
      >
        <div className="table-wrap">
          <table>
            <thead><tr><th>Kind</th><th>Customer</th><th>Invoice</th><th className="num">Open (USD)</th><th>To (owner)</th><th>Escalated to</th><th /></tr></thead>
            <tbody>
              {reminders.map((r) => (
                <tr key={r.id}>
                  <td><Badge tone={r.kind === "Overdue" ? "red" : r.kind === "Due today" ? "amber" : "blue"}>{r.kind}{r.daysOverdue ? ` · ${r.daysOverdue} d` : ""}</Badge></td>
                  <td>{r.customerName}</td>
                  <td>{r.invoiceId}</td>
                  <td className="num">{usd(r.amountUsd)}</td>
                  <td>{r.ownerName}<div className="small">{r.to}</div></td>
                  <td>{r.cc.length ? r.cc.join(", ") : "—"}</td>
                  <td className="nowrap">
                    <button className="btn ghost" type="button" onClick={() => setPreview(r)}>Preview</button>{" "}
                    {canEdit ? <button className="btn" type="button" onClick={() => send([r])}>Send now</button> : null}
                  </td>
                </tr>
              ))}
              {reminders.length === 0 ? <tr><td colSpan={7} className="empty">No reminders due today.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Section>
      {queued.length ? (
        <Section title="Queued in outbox" hint={<Assume title="Emails are sent from Gmail once the Gmail connector is set up.">Gmail not connected yet</Assume>}>
          <ul>{queued.map((e) => <li key={e.id} className="small">{e.subject} → {e.to}</li>)}</ul>
        </Section>
      ) : null}
      <Modal open={preview !== null} title="Reminder preview" onClose={() => setPreview(null)} width={620}>
        {preview ? (
          <>
            <div className="small"><strong>To:</strong> {preview.to}{preview.cc.length ? ` · cc ${preview.cc.join(", ")}` : ""}</div>
            <div className="small" style={{ margin: "4px 0 10px" }}><strong>Subject:</strong> {preview.subject}</div>
            <div className="email-preview">{preview.body}</div>
          </>
        ) : null}
      </Modal>
    </div>
  );
}

function RulesTab() {
  const { data, update, flash } = useStore();
  const canEdit = useCanEdit("ar");
  const [r, setR] = useState<ReminderRules>(data.arRules);
  const set = <K extends keyof ReminderRules>(k: K, v: ReminderRules[K]) => setR((x) => ({ ...x, [k]: v }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    update("arRules", () => r);
    flash("Reminder rules saved");
  };
  const log = [...data.arReminderLog].sort((a, b) => b.sentOn.localeCompare(a.sentOn));
  return (
    <div className="grid-2">
      <Section title="Reminder rules" hint="Applies to every account owner">
        <form onSubmit={submit}>
          <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="form-grid">
              <Field label="Remind owner days before due (0 = off)"><input type="number" min={0} value={r.daysBeforeDue} onChange={(e) => set("daysBeforeDue", Number(e.target.value))} /></Field>
              <Field label="Remind on the due date">
                <select value={r.onDueDate ? "Yes" : "No"} onChange={(e) => set("onDueDate", e.target.value === "Yes")}><option>Yes</option><option>No</option></select>
              </Field>
              <Field label="Repeat every N days while overdue (0 = off)"><input type="number" min={0} value={r.overdueEveryDays} onChange={(e) => set("overdueEveryDays", Number(e.target.value))} /></Field>
              <Field label="Copy Director Finance at days overdue"><input type="number" min={1} value={r.escalateFinanceAt} onChange={(e) => set("escalateFinanceAt", Number(e.target.value))} /></Field>
              <Field label="Copy CEO at days overdue"><input type="number" min={1} value={r.escalateCeoAt} onChange={(e) => set("escalateCeoAt", Number(e.target.value))} /></Field>
              <Field label="Finance email"><input type="email" value={r.financeEmail} onChange={(e) => set("financeEmail", e.target.value)} /></Field>
              <Field label="CEO email" span2><input type="email" value={r.ceoEmail} onChange={(e) => set("ceoEmail", e.target.value)} /></Field>
            </div>
          </fieldset>
          <div className="notice" style={{ marginTop: 12, marginBottom: 0 }}>Reminders are internal only. Customers never receive emails from these rules.</div>
          {canEdit ? <div className="toolbar" style={{ justifyContent: "flex-end", marginTop: 12, marginBottom: 0 }}><button className="btn primary" type="submit">Save rules</button></div> : null}
        </form>
      </Section>
      <Section title="Reminder log" hint="Most recent first">
        <div className="table-wrap">
          <table className="compact">
            <thead><tr><th>Sent</th><th>Invoice</th><th>Kind</th><th>To</th></tr></thead>
            <tbody>
              {log.map((l, i) => <tr key={`${l.invoiceId}-${l.sentOn}-${i}`}><td>{formatDate(l.sentOn)}</td><td>{l.invoiceId}</td><td>{l.kind}</td><td className="small">{l.to}</td></tr>)}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
