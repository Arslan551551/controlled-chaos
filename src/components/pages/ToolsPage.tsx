import { useMemo, useState } from "react";

import { Assume, Badge, Field, HBar, Modal, ModalActions, ModuleGate, ModuleHead, ModuleStat, Progress, Section, Source, StatusBadge, ViewOnlyBanner, useCanEdit } from "@/components/cc/ui";
import { useDetectedSubscriptions } from "@/lib/derived";
import { monthlyCost, type DetectedSubscription, type Subscription } from "@/lib/engine/operations";
import { formatDate, money, usd } from "@/lib/format";
import { newId, useStore } from "@/lib/store";

const DEPARTMENTS = ["Company-wide", "Finance", "Supply Chain", "Warehouse", "Marketing", "Sales", "Customer Service"];

type Draft = Omit<Subscription, "id">;

function emptyDraft(): Draft {
  return {
    tool: "",
    merchantMatch: "",
    department: "Marketing",
    owner: "",
    category: "",
    billingCycle: "Monthly",
    cost: 0,
    nextRenewal: "2026-11-24",
    seats: 1,
    seatsUsed: 1,
    status: "Active",
  };
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ToolsPage() {
  return (
    <ModuleGate id="tools">
      <ToolsInner />
    </ModuleGate>
  );
}

function ToolsInner() {
  const { data, update, flash } = useStore();
  const canEdit = useCanEdit("tools");
  const detected = useDetectedSubscriptions();
  const [dept, setDept] = useState("All");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);

  const subs = data.subscriptions;
  const filtered = subs.filter((s) => dept === "All" || s.department === dept);
  const active = subs.filter((s) => s.status !== "Cancelled");
  const monthlyTotal = active.reduce((a, s) => a + monthlyCost(s), 0);
  const filteredMonthly = filtered.filter((s) => s.status !== "Cancelled").reduce((a, s) => a + monthlyCost(s), 0);
  const unusedSeats = active.reduce((a, s) => a + Math.max(0, s.seats - s.seatsUsed), 0);
  const unusedValue = active.reduce((a, s) => a + (s.seats > 0 ? (monthlyCost(s) / s.seats) * Math.max(0, s.seats - s.seatsUsed) : 0), 0);

  const byDept = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of active) m.set(s.department, (m.get(s.department) ?? 0) + monthlyCost(s));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [active]);
  const maxDept = Math.max(1, ...byDept.map(([, v]) => v));

  const findings = detected.filter((d) => !dismissed.includes(d.merchant));
  const needsAction = findings.filter((d) => d.finding !== "Matches register");
  const departments = ["All", ...DEPARTMENTS.filter((d) => subs.some((s) => s.department === d))];

  const openFromDetected = (d: DetectedSubscription) => {
    if (d.matched) {
      setEditing({ id: d.matched.id, draft: { ...d.matched, cost: d.matched.billingCycle === "Monthly" ? d.lastAmount : d.matched.cost } });
      return;
    }
    const next = new Date(`${d.lastDate}T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    setEditing({
      id: null,
      draft: { ...emptyDraft(), tool: titleCase(d.merchant), merchantMatch: d.merchant, cost: Math.round(d.averageAmount * 100) / 100, nextRenewal: next.toISOString().slice(0, 10) },
    });
  };

  return (
    <section className="screen active" id="screen-tools">
      <ModuleHead title="Tools & Subscriptions" subtitle="Every department's tools, with recurring charges detected from QuickBooks bank & card feeds">
        {canEdit ? (
          <button className="btn primary" type="button" onClick={() => setEditing({ id: null, draft: emptyDraft() })}>+ Add Tool</button>
        ) : null}
      </ModuleHead>

      <ViewOnlyBanner id="tools" text="View only for this role. Finance maintains the tools register." />

      <div className="module-stats stat-strip">
        <ModuleStat label="Monthly tool spend" value={usd(monthlyTotal)} note={`${active.length} active tools`} />
        <ModuleStat label="Annualised" value={usd(monthlyTotal * 12)} note="Monthly × 12 (annual plans spread)" />
        <ModuleStat label="Unused seats" value={unusedSeats} note={`≈ ${usd(unusedValue)} / month`} />
        <ModuleStat label="Needs attention" value={needsAction.length} note="Unregistered or price-changed charges" />
      </div>

      <Section
        title="Detected from bank & card charges"
        kicker="AUTO-DETECTION"
        hint={<Source>QuickBooks bank & card feed · last 3 months</Source>}
      >
        <div className="small" style={{ marginBottom: 10 }}>
          A merchant charged in 2+ different months with a similar amount (±15%) is treated as a subscription. It is checked against the register by merchant name.
        </div>
        <div className="table-wrap">
          <table style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th>Merchant</th>
                <th>Finding</th>
                <th>Registered tool</th>
                <th className="num">Months seen</th>
                <th className="num">Average charge</th>
                <th className="num">Last charge</th>
                <th>Last date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {findings.length === 0 ? (
                <tr><td colSpan={8} className="empty">No recurring charges to review.</td></tr>
              ) : (
                findings.map((d) => (
                  <tr key={d.merchant}>
                    <td><strong>{d.merchant}</strong></td>
                    <td>
                      {d.finding === "Price increase" ? <Badge tone="amber">Price increase</Badge> : <StatusBadge status={d.finding} />}
                    </td>
                    <td>{d.matched ? d.matched.tool : <span className="muted">—</span>}</td>
                    <td className="num">{d.months}</td>
                    <td className="num">{money(d.averageAmount)}</td>
                    <td className={`num ${d.finding === "Price increase" ? "neg strong" : ""}`}>{money(d.lastAmount)}</td>
                    <td>{formatDate(d.lastDate)}</td>
                    <td>
                      {canEdit && d.finding !== "Matches register" ? (
                        <div className="row" style={{ gap: 6 }}>
                          <button className="btn" type="button" onClick={() => openFromDetected(d)}>
                            {d.finding === "Not registered" ? "Add to register" : "Update cost"}
                          </button>
                          {d.finding === "Not registered" ? (
                            <button
                              className="btn ghost"
                              type="button"
                              onClick={() => {
                                setDismissed((x) => [...x, d.merchant]);
                                flash(`${d.merchant} marked as not a subscription`);
                              }}
                            >
                              Not a subscription
                            </button>
                          ) : null}
                        </div>
                      ) : d.finding === "Matches register" ? (
                        <span className="small">OK</span>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid-main-side mt">
        <Section
          title="Tools register"
          kicker="ALL DEPARTMENTS"
          actions={
            <select className="control" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
              {departments.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          }
        >
          <div className="table-wrap">
            <table style={{ minWidth: 1120 }}>
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Department</th>
                  <th>Owner</th>
                  <th>Category</th>
                  <th>Cycle</th>
                  <th className="num">Cost</th>
                  <th className="num">Monthly</th>
                  <th>Seats used</th>
                  <th>Next renewal</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const use = s.seats > 0 ? s.seatsUsed / s.seats : 0;
                  return (
                    <tr key={s.id}>
                      <td><strong>{s.tool}</strong></td>
                      <td>{s.department}</td>
                      <td>{s.owner}</td>
                      <td>{s.category}</td>
                      <td>{s.billingCycle}</td>
                      <td className="num">{money(s.cost)}</td>
                      <td className="num">{money(monthlyCost(s))}</td>
                      <td>
                        <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                          <span className="nowrap">{s.seatsUsed} / {s.seats}</span>
                          <Progress value={use} tone={use >= 0.7 ? "good" : use >= 0.5 ? "warn" : "bad"} />
                        </div>
                      </td>
                      <td>{formatDate(s.nextRenewal)}</td>
                      <td>{s.status === "Cancel Requested" ? <Badge tone="amber">Cancel Requested</Badge> : <StatusBadge status={s.status} />}</td>
                      <td>{canEdit ? <button className="btn" type="button" onClick={() => setEditing({ id: s.id, draft: { ...s } })}>Edit</button> : "View"}</td>
                    </tr>
                  );
                })}
                <tr className="total-row">
                  <td colSpan={6}>{dept === "All" ? "Total (excluding cancelled)" : `${dept} total (excluding cancelled)`}</td>
                  <td className="num">{money(filteredMonthly)}</td>
                  <td colSpan={4}>Annualised {usd(filteredMonthly * 12)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Monthly spend by department" kicker="SUMMARY">
          {byDept.map(([d, v]) => (
            <HBar key={d} label={d} value={v} max={maxDept} display={usd(v)} />
          ))}
          <div className="notice" style={{ marginTop: 12, marginBottom: 0 }}>
            Duplicate tools in the same category and unused seats feed the CEO's Company Health cost-cut suggestions.{" "}
            <Assume title="Seat usage is entered by the tool owner in the prototype; some tools can report it automatically later">seat usage entered manually</Assume>
          </div>
        </Section>
      </div>

      {editing ? (
        <ToolModal
          key={editing.id ?? "new"}
          isNew={editing.id === null}
          initial={editing.draft}
          onClose={() => setEditing(null)}
          onSave={(draft) => {
            if (editing.id) {
              const id = editing.id;
              update("subscriptions", (prev) => prev.map((s) => (s.id === id ? { ...draft, id } : s)));
              flash(`${draft.tool} updated`);
            } else {
              update("subscriptions", (prev) => [...prev, { ...draft, id: newId("S") }]);
              flash(`${draft.tool} added to the register`);
            }
            setEditing(null);
          }}
        />
      ) : null}
    </section>
  );
}

function ToolModal({ isNew, initial, onClose, onSave }: { isNew: boolean; initial: Draft; onClose: () => void; onSave: (d: Draft) => void }) {
  const [d, setD] = useState<Draft>(initial);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const valid = d.tool.trim() !== "" && d.owner.trim() !== "" && d.cost >= 0 && d.seats >= 1 && d.seatsUsed >= 0 && d.seatsUsed <= d.seats;
  return (
    <Modal open title={isNew ? "Add Tool / Subscription" : `Edit ${initial.tool}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSave({ ...d, tool: d.tool.trim(), owner: d.owner.trim(), merchantMatch: d.merchantMatch.trim() || d.tool.trim().toUpperCase() });
        }}
      >
        <div className="form-grid">
          <Field label="Tool">
            <input value={d.tool} onChange={(e) => set("tool", e.target.value)} required />
          </Field>
          <Field label="Merchant name on bank / card charge">
            <input value={d.merchantMatch} onChange={(e) => set("merchantMatch", e.target.value)} placeholder="e.g. CANVA" />
          </Field>
          <Field label="Department">
            <select value={d.department} onChange={(e) => set("department", e.target.value)}>
              {DEPARTMENTS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Owner">
            <input value={d.owner} onChange={(e) => set("owner", e.target.value)} required />
          </Field>
          <Field label="Category">
            <input value={d.category} onChange={(e) => set("category", e.target.value)} placeholder="e.g. Design, Email marketing" />
          </Field>
          <Field label="Billing cycle">
            <select value={d.billingCycle} onChange={(e) => set("billingCycle", e.target.value as Draft["billingCycle"])}>
              <option>Monthly</option>
              <option>Annual</option>
            </select>
          </Field>
          <Field label={d.billingCycle === "Annual" ? "Annual cost ($)" : "Monthly cost ($)"}>
            <input type="number" min={0} step="0.01" value={d.cost} onChange={(e) => set("cost", Number(e.target.value))} />
          </Field>
          <Field label="Next renewal">
            <input type="date" value={d.nextRenewal} onChange={(e) => set("nextRenewal", e.target.value)} />
          </Field>
          <Field label="Seats paid">
            <input type="number" min={1} value={d.seats} onChange={(e) => set("seats", Number(e.target.value))} />
          </Field>
          <Field label="Seats in use">
            <input type="number" min={0} value={d.seatsUsed} onChange={(e) => set("seatsUsed", Number(e.target.value))} />
          </Field>
          <Field label="Status">
            <select value={d.status} onChange={(e) => set("status", e.target.value as Draft["status"])}>
              <option>Active</option>
              <option>Cancel Requested</option>
              <option>Cancelled</option>
            </select>
          </Field>
          <Field label="Monthly equivalent">
            <input readOnly value={money(d.billingCycle === "Annual" ? d.cost / 12 : d.cost)} />
          </Field>
        </div>
        {d.seatsUsed > d.seats ? <div className="notice readonly" style={{ marginTop: 12 }}>Seats in use cannot be more than seats paid.</div> : null}
        <ModalActions onCancel={onClose} submitLabel={isNew ? "Add Tool" : "Save"} disabled={!valid} />
      </form>
    </Modal>
  );
}
