// Pay & Bonus tab of Team KPIs: every person's monthly pay / KPI bonus from
// their dated plan and the locked month-end metric snapshot, with the full
// calculation trace, Director Finance plan editing, CEO approval and hand-off
// to payroll. Individual pay is confidential.

import { useMemo, useState, type FormEvent } from "react";

import {
  Assume,
  Badge,
  Field,
  Modal,
  ModalActions,
  ModuleStat,
  Section,
  Source,
  Tabs,
  type Tone,
} from "@/components/cc/ui";
import type { Role } from "@/lib/access";
import {
  calculatePay,
  describeComponent,
  planForPeriod,
  type Currency,
  type PayPlan,
  type PayResult,
  type PlanComponent,
} from "@/lib/engine/kpiPlans";
import { formatDate, monthLabel } from "@/lib/format";
import type { PayRunStatus } from "@/lib/sample/kpiPlans";
import { newId, useStore } from "@/lib/store";

const PAY_MONTHS = ["2026-08", "2026-09"];

/** Which plan person each preview role is (for "see your own pay"). */
const ROLE_PLAN_PERSON: Partial<Record<Role, string>> = {
  "Director Finance": "P-ARSLAN",
  "Deputy Manager Finance": "P-HBILAL",
  "Sr Finance Officer": "P-HNAVEED",
  Consultant: "P-GMVMAX",
};

const STATUS_TONE: Record<PayRunStatus, Tone> = {
  Draft: "amber",
  "Approved by CEO": "blue",
  "Sent to payroll": "green",
};

const money = (n: number, c: Currency) =>
  `${c === "USD" ? "$" : "PKR "}${n.toLocaleString("en-US", { minimumFractionDigits: c === "USD" ? 2 : 0, maximumFractionDigits: 2 })}`;

export function PayBonusTab() {
  const { data, role, update, flash, asOf } = useStore();
  const seeAll = role === "CEO" || role === "Director Finance";
  const me = ROLE_PLAN_PERSON[role] ?? null;
  const [view, setView] = useState<"month" | "plans">("month");
  const [month, setMonth] = useState("2026-09");
  const [selected, setSelected] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<PayPlan | null>(null);
  const [adjusting, setAdjusting] = useState<string | null>(null);

  const snapshot = data.metricSnapshots.find((s) => s.period === month) ?? null;

  const rows = useMemo(() => {
    if (!snapshot) return [];
    return data.planPeople
      .map((p) => {
        const plan = planForPeriod(data.payPlans, p.id, month);
        if (!plan) return null;
        const result = calculatePay(plan, {
          snapshot,
          reviews: data.reviewRatings,
          adjustments: data.payAdjustments,
        });
        const run = data.payRuns.find((r) => r.personId === p.id && r.period === month);
        return { person: p, plan, result, status: (run?.status ?? "Draft") as PayRunStatus };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [
    data.planPeople,
    data.payPlans,
    data.reviewRatings,
    data.payAdjustments,
    data.payRuns,
    snapshot,
    month,
  ]);

  const canSee = (personId: string) => seeAll || personId === me;
  const visible = rows.filter((r) => canSee(r.person.id));
  const totalUsd = visible.reduce((a, r) => a + r.result.totalUsd, 0);
  const totalPkr = visible.reduce((a, r) => a + r.result.totalPkr, 0);
  const sel = rows.find((r) => r.person.id === selected) ?? null;

  const setStatus = (personId: string, status: PayRunStatus) => {
    update("payRuns", (prev) => {
      const rest = prev.filter((r) => !(r.personId === personId && r.period === month));
      return [
        ...rest,
        {
          personId,
          period: month,
          status,
          approvedBy: status === "Draft" ? null : role,
          approvedAt: status === "Draft" ? null : asOf,
        },
      ];
    });
    flash(
      status === "Sent to payroll"
        ? "Sent to payroll · it will appear in the CEO's payroll batch"
        : `Marked ${status.toLowerCase()}`,
    );
  };

  const lockSnapshot = () => {
    if (!snapshot) return;
    update("metricSnapshots", (prev) =>
      prev.map((s) =>
        s.id === snapshot.id
          ? { ...s, status: "Locked", lockedBy: role, lockedAt: `${asOf}T09:00` }
          : s,
      ),
    );
    flash(`${monthLabel(month)} figures locked · pay recalculated from the locked snapshot`);
  };

  return (
    <div className="stack">
      <div className="toolbar">
        <Tabs<"month" | "plans">
          tabs={[
            { id: "month", label: "Monthly pay run" },
            { id: "plans", label: "Plans" },
          ]}
          value={view}
          onChange={setView}
        />
        {view === "month" ? (
          <select
            className="control"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setSelected(null);
            }}
            aria-label="Pay month"
          >
            {PAY_MONTHS.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        ) : null}
        <span className="small">
          Pay and bonus are confidential: CEO, Director Finance and the person only.
        </span>
      </div>

      {view === "month" && snapshot ? (
        <>
          <div className="module-stats">
            <ModuleStat
              label="Month-end figures"
              value={snapshot.status === "Locked" ? "Locked" : "Draft"}
              note={
                snapshot.status === "Locked"
                  ? `by ${snapshot.lockedBy} · ${formatDate(snapshot.lockedAt?.slice(0, 10))}`
                  : "Lock before paying"
              }
            />
            <ModuleStat
              label="FX for the month"
              value={`PKR ${snapshot.pkrPerUsd}`}
              note="One rate for every conversion"
            />
            <ModuleStat
              label={seeAll ? "Total (visible)" : "Your total"}
              value={money(totalPkr, "PKR")}
              note={money(totalUsd, "USD")}
            />
          </div>

          <Section
            title={`Metric snapshot · ${monthLabel(month)}`}
            kicker="ONE LOCKED FIGURE PER METRIC"
            hint={
              <Assume title="Amazon figures exist in two Sellerboard pulls and differ from QuickBooks. Pay must use one locked figure — confirm which source is the truth.">
                Sellerboard vs QuickBooks — one locked figure
              </Assume>
            }
            actions={
              role === "Director Finance" && snapshot.status === "Draft" ? (
                <button className="btn primary" type="button" onClick={lockSnapshot}>
                  Lock month-end figures
                </button>
              ) : null
            }
          >
            {seeAll ? (
              <div className="table-wrap">
                <table className="compact" style={{ minWidth: 0 }}>
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th className="num">Value</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(snapshot.values).map(([k, v]) => (
                      <tr key={k}>
                        <td>{k}</td>
                        <td className="num">
                          {v.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                        </td>
                        <td>
                          <Source>{snapshot.sources[k] ?? "—"}</Source>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="small">Metric values are visible to Finance and the CEO.</div>
            )}
          </Section>

          <div className="grid-main-side">
            <Section
              title="Pay & KPI bonus"
              kicker={monthLabel(month).toUpperCase()}
              hint="Click a person for the calculation"
            >
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Plan</th>
                      <th>Components</th>
                      <th className="num">Total</th>
                      <th className="num">USD</th>
                      <th className="num">PKR</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ person, plan, result, status }) => {
                      const allowed = canSee(person.id);
                      const flags =
                        result.lines.some((l) => l.warnings.length) ||
                        result.missingMetrics.length > 0;
                      return (
                        <tr
                          key={person.id}
                          className={`click-row${selected === person.id ? " selected-row" : ""}`}
                          onClick={() => allowed && setSelected(person.id)}
                        >
                          <td>
                            <strong>{person.name}</strong>
                            <div className="small">
                              {person.code} · {person.role}
                            </div>
                          </td>
                          <td>
                            {plan.name}
                            <div className="small">
                              v{plan.version} from {formatDate(plan.effectiveFrom)}
                            </div>
                          </td>
                          <td>
                            {allowed ? (
                              <span className="small">
                                {plan.components.map((c) => c.label).join(" · ")}
                              </span>
                            ) : (
                              <span className="muted">Restricted</span>
                            )}
                          </td>
                          <td className="num">
                            {allowed ? (
                              <strong>{money(result.total, plan.payCurrency)}</strong>
                            ) : (
                              "Restricted"
                            )}
                            {allowed && flags ? (
                              <div className="small" style={{ color: "#b96a00" }}>
                                check
                              </div>
                            ) : null}
                          </td>
                          <td className="num">{allowed ? money(result.totalUsd, "USD") : "—"}</td>
                          <td className="num">{allowed ? money(result.totalPkr, "PKR") : "—"}</td>
                          <td>
                            <Badge tone={STATUS_TONE[status]}>{status}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>

            <div className="card">
              {sel && canSee(sel.person.id) ? (
                <PayDetail
                  name={sel.person.name}
                  plan={sel.plan}
                  result={sel.result}
                  status={sel.status}
                  locked={snapshot.status === "Locked"}
                  role={role}
                  onEditPlan={() => setEditingPlan(sel.plan)}
                  onAdjust={() => setAdjusting(sel.person.id)}
                  onStatus={(st) => setStatus(sel.person.id, st)}
                />
              ) : (
                <div className="cogs-empty-state">
                  <div className="empty-icon">$</div>
                  <strong>Select a person</strong>
                  <span>
                    Every amount shows the metric values, thresholds, tiers and conditions behind
                    it.
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}

      {view === "plans" ? (
        <Section
          title="Pay plans"
          kicker="DATED VERSIONS"
          hint="Plans change often — each change is a new version from a date"
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Plan</th>
                  <th>Version</th>
                  <th>Effective</th>
                  <th>Pay in</th>
                  <th>Components</th>
                  <th>CC share</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.payPlans.map((p) => {
                  const person = data.planPeople.find((x) => x.id === p.personId);
                  const allowed = canSee(p.personId);
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{person?.name ?? p.personId}</strong>
                      </td>
                      <td>
                        {p.name}
                        {p.notes && allowed ? <div className="small">{p.notes}</div> : null}
                      </td>
                      <td>v{p.version}</td>
                      <td className="nowrap">
                        {formatDate(p.effectiveFrom)} →{" "}
                        {p.effectiveTo ? formatDate(p.effectiveTo) : "open"}
                      </td>
                      <td>{p.payCurrency}</td>
                      <td>
                        {allowed ? (
                          <ul style={{ margin: 0 }}>
                            {p.components.map((c) => (
                              <li key={c.id} className="small">
                                {describeComponent(c)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="muted">Restricted</span>
                        )}
                      </td>
                      <td>{Math.round(p.controlledChaosShare * 100)}%</td>
                      <td>
                        {role === "Director Finance" ? (
                          <button className="btn" type="button" onClick={() => setEditingPlan(p)}>
                            Edit
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      {editingPlan ? <PlanModal plan={editingPlan} onClose={() => setEditingPlan(null)} /> : null}
      {adjusting ? (
        <AdjustmentModal personId={adjusting} period={month} onClose={() => setAdjusting(null)} />
      ) : null}
    </div>
  );
}

function PayDetail({
  name,
  plan,
  result,
  status,
  locked,
  role,
  onEditPlan,
  onAdjust,
  onStatus,
}: {
  name: string;
  plan: PayPlan;
  result: PayResult;
  status: PayRunStatus;
  locked: boolean;
  role: Role;
  onEditPlan: () => void;
  onAdjust: () => void;
  onStatus: (s: PayRunStatus) => void;
}) {
  return (
    <>
      <div className="section-title">
        <div>
          <span className="section-kicker">{plan.name.toUpperCase()}</span>
          <h3>{name}</h3>
          <div className="small">
            Plan v{plan.version} · paid in {plan.payCurrency}
          </div>
        </div>
        <Badge tone={STATUS_TONE[status]}>{status}</Badge>
      </div>
      <div className="selected-cogs-hero">
        <div>
          <span>Total this month</span>
          <strong>{money(result.total, plan.payCurrency)}</strong>
        </div>
        <div className="selected-cogs-qty">
          <span>{plan.payCurrency === "USD" ? "PKR" : "USD"}</span>
          <strong>
            {plan.payCurrency === "USD"
              ? money(result.totalPkr, "PKR")
              : money(result.totalUsd, "USD")}
          </strong>
        </div>
      </div>
      {!locked ? (
        <div className="notice readonly">
          Month-end figures are not locked yet — this is a draft.
        </div>
      ) : null}
      {result.missingMetrics.length ? (
        <div className="notice readonly">Missing metrics: {result.missingMetrics.join(", ")}</div>
      ) : null}
      {result.lines.map((l) => (
        <div
          key={l.componentId}
          className="signal"
          style={{ gridTemplateColumns: "6px minmax(0,1fr) auto" }}
        >
          <div
            className="stripe"
            style={{
              background: l.gated ? "#cf3f4f" : l.kind === "adjustment" ? "#6f52d9" : "#148a60",
            }}
          />
          <div>
            <div className="signal-title">{l.label}</div>
            <div className="signal-detail">{l.explanation}</div>
            {l.conditions.length ? (
              <div className="small" style={{ marginTop: 4 }}>
                {l.conditions.map((c) => (
                  <span
                    key={c.text}
                    style={{ marginRight: 10, color: c.passed ? "#148a60" : "#cf3f4f" }}
                  >
                    {c.passed ? "✓" : "✗"} {c.text} (actual {c.actual ?? "missing"})
                  </span>
                ))}
              </div>
            ) : null}
            {l.warnings.map((w) => (
              <div key={w} className="small" style={{ color: "#b96a00" }}>
                ⚠ {w}
              </div>
            ))}
          </div>
          <div className="saving">
            <strong style={{ color: l.amount < 0 ? "#cf3f4f" : undefined }}>
              {money(l.amount, l.currency)}
            </strong>
            {l.capped ? "capped" : l.floored ? "floored" : ""}
          </div>
        </div>
      ))}
      {result.planCapped ? (
        <div className="notice">
          Total capped at {money(plan.cap ?? 0, plan.payCurrency)} by the plan.
        </div>
      ) : null}
      <div className="small" style={{ marginTop: 8 }}>
        Controlled Chaos share of cost: {Math.round(plan.controlledChaosShare * 100)}% ={" "}
        {money(result.controlledChaosCost, plan.payCurrency)}
      </div>
      <div className="row mt">
        {role === "Director Finance" ? (
          <>
            <button className="btn" type="button" onClick={onEditPlan}>
              Edit plan
            </button>
            <button className="btn" type="button" onClick={onAdjust}>
              + Addition / deduction
            </button>
          </>
        ) : null}
        {role === "CEO" && status === "Draft" ? (
          <button
            className="btn primary"
            type="button"
            disabled={!locked}
            title={locked ? "" : "Lock month-end figures first"}
            onClick={() => onStatus("Approved by CEO")}
          >
            Approve
          </button>
        ) : null}
        {role === "Director Finance" && status === "Approved by CEO" ? (
          <button className="btn primary" type="button" onClick={() => onStatus("Sent to payroll")}>
            Send to payroll
          </button>
        ) : null}
      </div>
    </>
  );
}

/** Edit the numeric parameters of a plan. Saving creates a new dated version. */
function PlanModal({ plan, onClose }: { plan: PayPlan; onClose: () => void }) {
  const { update, flash, asOf } = useStore();
  const [components, setComponents] = useState<PlanComponent[]>(plan.components);
  const [from, setFrom] = useState(`${asOf.slice(0, 7)}-01`);
  const [asNewVersion, setAsNewVersion] = useState(true);
  const patch = (i: number, c: PlanComponent) =>
    setComponents((prev) => prev.map((x, n) => (n === i ? c : x)));
  const num = (v: string) => (v === "" ? 0 : Number(v));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (asNewVersion) {
      const dayBefore = new Date(`${from}T00:00:00Z`);
      dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
      const next: PayPlan = {
        ...plan,
        id: newId("PLAN"),
        version: plan.version + 1,
        effectiveFrom: from,
        effectiveTo: null,
        components,
      };
      update("payPlans", (prev) => [
        ...prev.map((p) =>
          p.id === plan.id ? { ...p, effectiveTo: dayBefore.toISOString().slice(0, 10) } : p,
        ),
        next,
      ]);
      flash(`New plan version v${next.version} from ${formatDate(from)}`);
    } else {
      update("payPlans", (prev) => prev.map((p) => (p.id === plan.id ? { ...p, components } : p)));
      flash("Plan corrected");
    }
    onClose();
  };

  return (
    <Modal open title={`Edit plan · ${plan.name}`} onClose={onClose} width={820}>
      <form onSubmit={submit}>
        {components.map((c, i) => (
          <div key={c.id} className="card" style={{ marginBottom: 10, padding: 12 }}>
            <div className="section-title">
              <h3 style={{ fontSize: 14 }}>{c.label}</h3>
              <span className="hint">{c.kind}</span>
            </div>
            <div className="inline-form">
              {c.kind === "fixed" ? (
                <Field label={`Amount (${c.currency})`}>
                  <input
                    type="number"
                    value={c.amount}
                    onChange={(e) => patch(i, { ...c, amount: num(e.target.value) })}
                  />
                </Field>
              ) : null}
              {c.kind === "pctAboveThreshold" ? (
                <>
                  <Field label="Rate %">
                    <input
                      type="number"
                      step="0.01"
                      value={c.rate * 100}
                      onChange={(e) => patch(i, { ...c, rate: num(e.target.value) / 100 })}
                    />
                  </Field>
                  <Field label={`Threshold (${c.metric})`}>
                    <input
                      type="number"
                      value={c.threshold}
                      onChange={(e) => patch(i, { ...c, threshold: num(e.target.value) })}
                    />
                  </Field>
                  <Field label="Floor at zero">
                    <select
                      value={c.floorAtZero ? "Yes" : "No"}
                      onChange={(e) => patch(i, { ...c, floorAtZero: e.target.value === "Yes" })}
                    >
                      <option>Yes</option>
                      <option>No</option>
                    </select>
                  </Field>
                </>
              ) : null}
              {c.kind === "pctOfMetric" ? (
                <Field label={`Rate % of ${c.metric}`}>
                  <input
                    type="number"
                    step="0.01"
                    value={c.rate * 100}
                    onChange={(e) => patch(i, { ...c, rate: num(e.target.value) / 100 })}
                  />
                </Field>
              ) : null}
              {c.kind === "stepTier"
                ? c.tiers.map((t, ti) => (
                    <Field
                      key={ti}
                      label={`${c.metric} ≥ ${t.from}${t.to === null ? "" : ` < ${t.to}`}`}
                    >
                      <input
                        type="number"
                        value={t.amount}
                        onChange={(e) =>
                          patch(i, {
                            ...c,
                            tiers: c.tiers.map((x, n) =>
                              n === ti ? { ...x, amount: num(e.target.value) } : x,
                            ),
                          })
                        }
                      />
                    </Field>
                  ))
                : null}
              {c.kind === "progressiveSlab" || c.kind === "perUnit"
                ? (c.kind === "progressiveSlab" ? c.slabs : c.bands).map((b, bi) => (
                    <Field
                      key={bi}
                      label={`${b.from}–${b.to ?? "∞"} ${c.kind === "progressiveSlab" ? "rate %" : "per unit"}`}
                    >
                      <input
                        type="number"
                        step="0.01"
                        value={c.kind === "progressiveSlab" ? b.rate * 100 : b.rate}
                        onChange={(e) => {
                          const v = num(e.target.value);
                          if (c.kind === "progressiveSlab")
                            patch(i, {
                              ...c,
                              slabs: c.slabs.map((x, n) =>
                                n === bi ? { ...x, rate: v / 100 } : x,
                              ),
                            });
                          else
                            patch(i, {
                              ...c,
                              bands: c.bands.map((x, n) => (n === bi ? { ...x, rate: v } : x)),
                            });
                        }}
                      />
                    </Field>
                  ))
                : null}
              {c.kind === "scoredReview" && c.base.kind === "amount" ? (
                <Field label="Target bonus (PKR)">
                  <input
                    type="number"
                    value={c.base.amount}
                    onChange={(e) => {
                      const base = c.base;
                      if (base.kind === "amount")
                        patch(i, { ...c, base: { ...base, amount: num(e.target.value) } });
                    }}
                  />
                </Field>
              ) : null}
              {c.conditions.map((k, ki) => (
                <Field key={`k${ki}`} label={`Condition: ${k.metric} ${k.op}`}>
                  <input
                    type="number"
                    step="0.01"
                    value={k.value}
                    onChange={(e) =>
                      patch(i, {
                        ...c,
                        conditions: c.conditions.map((x, n) =>
                          n === ki ? { ...x, value: num(e.target.value) } : x,
                        ),
                      })
                    }
                  />
                </Field>
              ))}
              <Field label="Cap (blank = none)">
                <input
                  type="number"
                  value={c.cap ?? ""}
                  onChange={(e) =>
                    patch(i, { ...c, cap: e.target.value === "" ? null : num(e.target.value) })
                  }
                />
              </Field>
            </div>
          </div>
        ))}
        <div className="inline-form">
          <Field label="Save as">
            <select
              value={asNewVersion ? "new" : "fix"}
              onChange={(e) => setAsNewVersion(e.target.value === "new")}
            >
              <option value="new">New version from a date</option>
              <option value="fix">Correct this version</option>
            </select>
          </Field>
          {asNewVersion ? (
            <Field label="Effective from">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
          ) : null}
        </div>
        <ModalActions onCancel={onClose} submitLabel="Save plan" />
      </form>
    </Modal>
  );
}

function AdjustmentModal({
  personId,
  period,
  onClose,
}: {
  personId: string;
  period: string;
  onClose: () => void;
}) {
  const { update, flash, role } = useStore();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("PKR");
  const [kind, setKind] = useState<"add" | "deduct">("add");
  const [reason, setReason] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const a = Math.abs(Number(amount));
    if (!(a > 0) || !reason.trim()) return;
    update("payAdjustments", (prev) => [
      ...prev,
      {
        id: newId("ADJ"),
        personId,
        period,
        amount: kind === "add" ? a : -a,
        currency,
        reason: reason.trim(),
        by: role,
      },
    ]);
    flash("Adjustment added");
    onClose();
  };
  return (
    <Modal open title="Addition / deduction" onClose={onClose} width={520}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Type">
            <select value={kind} onChange={(e) => setKind(e.target.value as "add" | "deduct")}>
              <option value="add">Addition</option>
              <option value="deduct">Deduction</option>
            </select>
          </Field>
          <Field label="Currency">
            <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              <option>PKR</option>
              <option>USD</option>
            </select>
          </Field>
          <Field label="Amount">
            <input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </Field>
          <Field label="Reason">
            <input value={reason} onChange={(e) => setReason(e.target.value)} required />
          </Field>
        </div>
        <ModalActions onCancel={onClose} submitLabel="Add" />
      </form>
    </Modal>
  );
}
