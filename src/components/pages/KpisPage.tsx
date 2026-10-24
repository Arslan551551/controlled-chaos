import { useMemo, useState } from "react";

import { Assume, Badge, Field, Modal, ModuleGate, ModuleHead, ModuleStat, Progress, Section, Source, StatusBadge, Tabs, useCanEdit, type Tone } from "@/components/cc/ui";
import { ROLE_PERSON } from "@/lib/access";
import { useMarketing } from "@/lib/derived";
import { summarize } from "@/lib/engine/marketing";
import { consultantScore, rating, reviewScore, type Employee, type KpiReview, type Rating, type ReviewTemplate } from "@/lib/engine/people";
import { monthLabel, pct, ratio } from "@/lib/format";
import { newId, useStore } from "@/lib/store";

const REVIEW_MONTHS = ["2026-08", "2026-09", "2026-10"];

const RATING_TONE: Record<Rating, Tone> = {
  Exceeds: "green",
  Meets: "blue",
  "Needs Improvement": "amber",
  "Below Expectations": "red",
};

function RatingBadge({ score }: { score: number }) {
  const r = rating(score);
  return <Badge tone={RATING_TONE[r]}>{r}</Badge>;
}

function scoreTone(score: number): "good" | "warn" | "bad" {
  return score >= 85 ? "good" : score >= 70 ? "warn" : "bad";
}

const CONSULTANT_PLATFORMS: Record<string, string[]> = {
  "C-AMZ": ["Amazon Ads"],
  "C-META": ["Meta Ads", "TikTok Ads"],
};

type TabId = "reviews" | "consultants" | "history";

export function KpisPage() {
  return (
    <ModuleGate id="kpis">
      <KpisInner />
    </ModuleGate>
  );
}

function KpisInner() {
  const { data, role, update, flash } = useStore();
  const canEditModule = useCanEdit("kpis");
  const person = ROLE_PERSON[role] ?? null;
  const seeAll = role === "CEO" || role === "Director Finance";
  const [tab, setTab] = useState<TabId>("reviews");
  const [month, setMonth] = useState("2026-09");
  const [editing, setEditing] = useState<{ employee: Employee; template: ReviewTemplate; review: KpiReview | null } | null>(null);

  const nameOf = (id: string | null) => (id ? data.employees.find((e) => e.id === id)?.name ?? id : "—");

  const visibleEmployees = useMemo(
    () =>
      data.employees.filter((e) => {
        if (seeAll) return true;
        if (!person) return false;
        return e.id === person || e.managerId === person;
      }),
    [data.employees, seeAll, person],
  );

  const canFill = (e: Employee) =>
    canEditModule && e.templateId !== null && e.id !== person && (role === "Director Finance" || (person !== null && e.managerId === person));

  const reviewFor = (employeeId: string, m: string) => data.kpiReviews.find((r) => r.employeeId === employeeId && r.month === m) ?? null;
  const templateOf = (e: Employee) => data.reviewTemplates.find((t) => t.id === e.templateId) ?? null;

  const staff = visibleEmployees.filter((e) => e.kind === "Employee" && e.templateId);
  const monthRows = staff.map((e) => {
    const t = templateOf(e);
    const r = reviewFor(e.id, month);
    const score = r && t ? reviewScore(r, t) : null;
    return { e, t, r, score };
  });
  const submitted = monthRows.filter((x) => x.r?.status === "Submitted");
  const avg = submitted.length ? submitted.reduce((a, x) => a + (x.score ?? 0), 0) / submitted.length : 0;
  const missing = monthRows.filter((x) => !x.r).length;
  const drafts = monthRows.filter((x) => x.r?.status === "Draft").length;

  return (
    <section className="screen active" id="screen-kpis">
      <ModuleHead title="Team KPIs" subtitle="Monthly manager reviews and consultant KPIs from ROAS / TACoS">
        <Tabs
          tabs={[
            { id: "reviews", label: "Monthly Reviews" },
            { id: "consultants", label: "Consultants" },
            { id: "history", label: "Score History" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </ModuleHead>

      {!seeAll ? (
        <div className="notice">
          {canEditModule
            ? "You can see your own scores and fill monthly reviews for your direct reports."
            : "You can see your own KPI scores" + (visibleEmployees.length > 1 ? " and your team's." : ".")}
        </div>
      ) : null}

      {tab === "reviews" ? (
        <>
          <div className="toolbar">
            <select className="control" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Review month">
              {REVIEW_MONTHS.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
            <span className="small">Reviews are filled by each person's manager once a month.</span>
          </div>

          <div className="module-stats">
            <ModuleStat label="Average score" value={submitted.length ? `${avg.toFixed(1)}%` : "—"} note={`${submitted.length} submitted review${submitted.length === 1 ? "" : "s"}`} />
            <ModuleStat label="Drafts" value={drafts} note="Started, not submitted" />
            <ModuleStat label="Missing" value={missing} note={`Not yet started for ${monthLabel(month)}`} />
          </div>

          <Section title={`Reviews · ${monthLabel(month)}`} hint="4 / 5 on a criterion = meets target (100%) · 5 / 5 = 125%">
            <div className="table-wrap">
              <table style={{ minWidth: 980 }}>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Review form</th>
                    <th>Reviewer</th>
                    <th>Score</th>
                    <th>Rating</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {monthRows.length === 0 ? (
                    <tr><td colSpan={8} className="empty">No reviews visible for this role.</td></tr>
                  ) : (
                    monthRows.map(({ e, t, r, score }) => (
                      <tr key={e.id}>
                        <td><strong>{e.name}</strong><div className="small">{e.title}</div></td>
                        <td>{e.department}</td>
                        <td>{t?.name ?? "—"}</td>
                        <td>{nameOf(e.managerId)}</td>
                        <td>
                          {score !== null ? (
                            <div className="row" style={{ gap: 8 }}>
                              <strong style={{ minWidth: 52 }}>{score.toFixed(1)}%</strong>
                              <Progress value={Math.min(1, score / 125)} tone={scoreTone(score)} />
                            </div>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>{score !== null && r?.status === "Submitted" ? <RatingBadge score={score} /> : <span className="muted">—</span>}</td>
                        <td>{r ? <StatusBadge status={r.status} /> : <Badge tone="grey">Missing</Badge>}</td>
                        <td>
                          {t && canFill(e) ? (
                            <button className="btn" type="button" onClick={() => setEditing({ employee: e, template: t, review: r })}>
                              {r ? (r.status === "Draft" ? "Continue" : "Edit") : "Fill review"}
                            </button>
                          ) : t && r ? (
                            <button className="btn ghost" type="button" onClick={() => setEditing({ employee: e, template: t, review: r })}>View</button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      ) : null}

      {tab === "consultants" ? <ConsultantsTab month={month} setMonth={setMonth} visibleIds={visibleEmployees.map((e) => e.id)} /> : null}

      {tab === "history" ? (
        <Section title="Score history" kicker="SUBMITTED REVIEWS" hint="Monthly weighted score">
          <div className="table-wrap">
            <table style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  {REVIEW_MONTHS.map((m) => (
                    <th key={m} className="num">{monthLabel(m)}</th>
                  ))}
                  <th>Latest rating</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((e) => {
                  const t = templateOf(e);
                  const scores = REVIEW_MONTHS.map((m) => {
                    const r = reviewFor(e.id, m);
                    return r && t && r.status === "Submitted" ? reviewScore(r, t) : null;
                  });
                  const latest = [...scores].reverse().find((s) => s !== null) ?? null;
                  return (
                    <tr key={e.id}>
                      <td><strong>{e.name}</strong></td>
                      <td>{e.department}</td>
                      {scores.map((s, i) => (
                        <td key={REVIEW_MONTHS[i]} className="num">{s === null ? <span className="muted">—</span> : `${s.toFixed(1)}%`}</td>
                      ))}
                      <td>{latest !== null ? <RatingBadge score={latest} /> : <span className="muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="small" style={{ marginTop: 8 }}>
            Bands: Exceeds ≥ 100% · Meets ≥ 85% · Needs Improvement ≥ 70% · Below Expectations &lt; 70%. <Assume title="Rating bands are a proposal — confirm or replace with your HR bands">rating bands</Assume>
          </div>
        </Section>
      ) : null}

      {editing ? (
        <ReviewModal
          key={`${editing.employee.id}-${month}`}
          employee={editing.employee}
          template={editing.template}
          review={editing.review}
          month={month}
          readOnly={!canFill(editing.employee)}
          reviewerName={nameOf(person)}
          onClose={() => setEditing(null)}
          onSave={(scores, comments, status) => {
            const existing = editing.review;
            const reviewerId = person ?? "E-DF";
            update("kpiReviews", (prev) =>
              existing
                ? prev.map((r) => (r.id === existing.id ? { ...r, scores, comments, status, reviewerId } : r))
                : [...prev, { id: newId("R"), employeeId: editing.employee.id, month, reviewerId, scores, comments, status }],
            );
            flash(status === "Submitted" ? `Review submitted for ${editing.employee.name}` : "Draft saved");
            setEditing(null);
          }}
        />
      ) : null}
    </section>
  );
}

function ReviewModal({
  employee,
  template,
  review,
  month,
  readOnly,
  reviewerName,
  onClose,
  onSave,
}: {
  employee: Employee;
  template: ReviewTemplate;
  review: KpiReview | null;
  month: string;
  readOnly: boolean;
  reviewerName: string;
  onClose: () => void;
  onSave: (scores: Record<string, number>, comments: string, status: KpiReview["status"]) => void;
}) {
  const [scores, setScores] = useState<Record<string, number>>(() => ({ ...(review?.scores ?? {}) }));
  const [comments, setComments] = useState(review?.comments ?? "");
  const live: KpiReview = { id: "live", employeeId: employee.id, month, reviewerId: "", scores, comments, status: "Draft" };
  const score = reviewScore(live, template);
  const complete = template.criteria.every((c) => (scores[c.id] ?? 0) >= 1);

  return (
    <Modal open title={`${readOnly ? "Review" : "Monthly review"} · ${employee.name} · ${monthLabel(month)}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!readOnly && complete) onSave(scores, comments.trim(), "Submitted");
        }}
      >
        <div className="small" style={{ marginBottom: 10 }}>
          Form: {template.name} · Reviewer: {readOnly ? "—" : reviewerName}. Score each criterion 1–5; 4 = meets target.
        </div>
        <div className="table-wrap">
          <table className="compact">
            <thead>
              <tr>
                <th>Criterion</th>
                <th className="num">Weight</th>
                <th>Score (1–5)</th>
              </tr>
            </thead>
            <tbody>
              {template.criteria.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="num">{c.weight}%</td>
                  <td>
                    <select
                      className="control"
                      disabled={readOnly}
                      value={scores[c.id] ?? ""}
                      onChange={(e) => setScores({ ...scores, [c.id]: Number(e.target.value) })}
                    >
                      <option value="">—</option>
                      <option value={1}>1 · Well below</option>
                      <option value={2}>2 · Below</option>
                      <option value={3}>3 · Nearly there</option>
                      <option value={4}>4 · Meets target</option>
                      <option value={5}>5 · Exceeds</option>
                    </select>
                  </td>
                </tr>
              ))}
              <tr className="total-row">
                <td>Weighted score</td>
                <td className="num">100%</td>
                <td>
                  {score.toFixed(1)}% · <RatingBadge score={score} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="form-grid mt">
          <Field label="Comments" span2>
            <textarea value={comments} disabled={readOnly} onChange={(e) => setComments(e.target.value)} placeholder="Optional" />
          </Field>
        </div>
        <div className="toolbar" style={{ justifyContent: "flex-end", marginTop: 16, marginBottom: 0 }}>
          <button className="btn" type="button" onClick={onClose}>{readOnly ? "Close" : "Cancel"}</button>
          {!readOnly ? (
            <>
              <button className="btn" type="button" onClick={() => onSave(scores, comments.trim(), "Draft")}>Save draft</button>
              <button className="btn primary" type="submit" disabled={!complete}>Submit review</button>
            </>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}

function ConsultantsTab({ month, setMonth, visibleIds }: { month: string; setMonth: (m: string) => void; visibleIds: string[] }) {
  const { data } = useStore();
  const months = useMemo(() => [month], [month]);
  const m = useMarketing(months);

  const rows = data.consultantTargets
    .filter((t) => visibleIds.includes(t.consultantId))
    .map((t) => {
      const platforms = CONSULTANT_PLATFORMS[t.consultantId] ?? [];
      const adRows = m.rows.filter((r) => platforms.includes(r.platform));
      const channels = [...new Set(adRows.map((r) => r.channel))];
      const channelSales = data.channelSales.filter((s) => channels.includes(s.channel) && s.month === month).reduce((a, s) => a + s.grossSales, 0);
      const s = summarize(t.scope, adRows, channelSales);
      const result = consultantScore(t, s.roas, s.tacos);
      const consultant = data.employees.find((e) => e.id === t.consultantId);
      return { t, s, result, consultant };
    });

  return (
    <>
      <div className="toolbar">
        <select className="control" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
          {REVIEW_MONTHS.map((mo) => (
            <option key={mo} value={mo}>{monthLabel(mo)}{mo === "2026-10" ? " (month to date)" : ""}</option>
          ))}
        </select>
        <Source>Calculated from ad platform data</Source>
        <span className="small">ROAS higher is better · TACoS lower is better · each component capped at 120%.</span>
      </div>
      <Section title={`Consultant KPIs · ${monthLabel(month)}`} kicker="AUTO-CALCULATED">
        <div className="table-wrap">
          <table style={{ minWidth: 1040 }}>
            <thead>
              <tr>
                <th>Consultant</th>
                <th>Scope</th>
                <th className="num">Spend</th>
                <th className="num">Target ROAS</th>
                <th className="num">Actual ROAS</th>
                <th className="num">ROAS score</th>
                <th className="num">Target TACoS</th>
                <th className="num">Actual TACoS</th>
                <th className="num">TACoS score</th>
                <th>Weights</th>
                <th>KPI score</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={12} className="empty">No consultants in your team.</td></tr>
              ) : (
                rows.map(({ t, s, result, consultant }) => (
                  <tr key={t.consultantId}>
                    <td><strong>{consultant?.name ?? t.consultantId}</strong></td>
                    <td>{t.scope}</td>
                    <td className="num">${Math.round(s.spend).toLocaleString("en-US")}</td>
                    <td className="num">{ratio(t.targetRoas)}</td>
                    <td className={`num ${s.roas >= t.targetRoas ? "pos" : "neg"}`}>{ratio(s.roas)}</td>
                    <td className="num">{result.roasPct.toFixed(0)}%</td>
                    <td className="num">{pct(t.targetTacos)}</td>
                    <td className={`num ${s.tacos <= t.targetTacos ? "pos" : "neg"}`}>{pct(s.tacos)}</td>
                    <td className="num">{result.tacosPct.toFixed(0)}%</td>
                    <td className="small">ROAS {t.roasWeight}% · TACoS {t.tacosWeight}%</td>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <strong style={{ minWidth: 52 }}>{result.score.toFixed(1)}%</strong>
                        <Progress value={result.score / 120} tone={scoreTone(result.score)} />
                      </div>
                    </td>
                    <td><RatingBadge score={result.score} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="small" style={{ marginTop: 8 }}>
          Score = ROAS score × ROAS weight + TACoS score × TACoS weight. TACoS uses total sales (ad + organic) of the channels the consultant's ads drive.{" "}
          <Assume title="Confirm the ROAS / TACoS weighting and whether other KPIs (e.g. sales growth) should count">weights & caps</Assume>
        </div>
      </Section>
    </>
  );
}
