import { useMemo, useState } from "react";

import { Assume, ModuleGate, ModuleHead, ModuleStat, Section, Source, Tabs } from "@/components/cc/ui";
import type { HealthSignal } from "@/lib/engine/health";
import { LAST_FULL_MONTH, useCashFlow, useDistributors, useHealth, useMarketing, useProfitability } from "@/lib/derived";
import { monthLabel, pct, usd } from "@/lib/format";
import { usePlanning } from "@/lib/store";

type AreaFilter = "All" | HealthSignal["area"];

const AREAS: AreaFilter[] = ["All", "Cash", "Profitability", "Marketing", "Subscriptions", "Inventory", "Collections", "Distributors"];

function scoreColor(score: number): string {
  if (score >= 80) return "#148a60";
  if (score >= 60) return "#e09a25";
  return "#cf3f4f";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Healthy";
  if (score >= 60) return "Needs attention";
  return "At risk";
}

function SignalRow({ s }: { s: HealthSignal }) {
  return (
    <div className={`signal ${s.severity}`}>
      <div className="stripe" />
      <div>
        <div className="signal-title">{s.title}</div>
        <div className="signal-detail">{s.area} · {s.detail}</div>
        {s.suggestion ? <div className="signal-suggest">→ {s.suggestion}</div> : null}
      </div>
      <div className="saving">
        {s.monthlySaving > 0 ? (
          <>
            <strong>{usd(s.monthlySaving)}</strong>
            per month
          </>
        ) : (
          <span>{s.severity === "critical" ? "Critical" : s.severity === "warning" ? "Watch" : "OK"}</span>
        )}
      </div>
    </div>
  );
}

export function HealthPage() {
  return (
    <ModuleGate id="health">
      <HealthContent />
    </ModuleGate>
  );
}

function HealthContent() {
  const { signals, score, targets } = useHealth();
  const cash = useCashFlow();
  const profit = useProfitability(LAST_FULL_MONTH);
  const marketing = useMarketing(LAST_FULL_MONTH);
  const distributors = useDistributors();
  const planning = usePlanning();

  const [area, setArea] = useState<AreaFilter>("All");
  const [planned, setPlanned] = useState<Record<string, boolean>>({});

  const critical = signals.filter((s) => s.severity === "critical").length;
  const warning = signals.filter((s) => s.severity === "warning").length;
  const savings = signals.filter((s) => s.monthlySaving > 0).sort((a, b) => b.monthlySaving - a.monthlySaving);
  const totalSavings = savings.reduce((a, s) => a + s.monthlySaving, 0);
  const plannedTotal = savings.filter((s) => planned[s.id]).reduce((a, s) => a + s.monthlySaving, 0);

  const lowest = [...cash.months].sort((a, b) => a.closing - b.closing)[0];
  const netProfit = profit.rows.reduce((a, r) => a + r.netProfit, 0);
  const netRevenue = profit.rows.reduce((a, r) => a + r.netRevenue, 0);
  const openAR = distributors.reduce((a, d) => a + d.openAR, 0);
  const poNow = planning.finishedGoods.filter((p) => p.poStatus === "PO Now" || p.poStatus === "Additional PO Required");

  const filtered = area === "All" ? signals : signals.filter((s) => s.area === area);

  const summary = useMemo(() => {
    const withRevenue = profit.rows.filter((r) => r.netRevenue > 0);
    const best = [...withRevenue].sort((a, b) => b.netMarginPct - a.netMarginPct)[0];
    const worst = [...withRevenue].sort((a, b) => a.netMarginPct - b.netMarginPct)[0];
    const weakAds = [...marketing.byPlatform].filter((m) => m.spend > 0).sort((a, b) => a.roas - b.roas)[0];
    const top3 = savings.slice(0, 3);
    const paras: string[] = [];
    paras.push(
      `Overall health is ${score}/100 (${scoreLabel(score).toLowerCase()}), with ${critical} critical and ${warning} warning signal${warning === 1 ? "" : "s"}. ` +
        `Cash in QuickBooks today is ${usd(cash.opening)}` +
        (lowest
          ? `; the lowest projected month-end balance is ${usd(lowest.closing)} in ${monthLabel(lowest.month)}, ${lowest.closing < targets.minimumCashBuffer ? "below" : "above"} the ${usd(targets.minimumCashBuffer)} buffer.`
          : "."),
    );
    if (best && worst) {
      paras.push(
        `In ${monthLabel(LAST_FULL_MONTH[0] ?? "")}, all channels together made ${usd(netProfit)} net profit (${pct(netRevenue > 0 ? netProfit / netRevenue : 0)} margin). ` +
          `${best.channel} was the strongest at ${pct(best.netMarginPct)}; ${worst.channel} was the weakest at ${pct(worst.netMarginPct)}.`,
      );
    }
    if (weakAds) {
      paras.push(
        `Blended ROAS was ${marketing.total.roas.toFixed(2)} against a ${targets.targetRoas.toFixed(1)} target. ` +
          `${weakAds.key} is the least efficient at ${weakAds.roas.toFixed(2)} on ${usd(weakAds.spend)} of spend.`,
      );
    }
    if (top3.length > 0) {
      paras.push(
        `Biggest savings available: ${top3.map((s) => `${s.title} (~${usd(s.monthlySaving)}/month)`).join("; ")}. ` +
          `Together the listed cuts are worth about ${usd(totalSavings)} per month.`,
      );
    }
    if (poNow.length > 0) {
      paras.push(`${poNow.length} SKU${poNow.length === 1 ? " needs" : "s need"} a purchase order now: ${poNow.map((p) => p.sku).join(", ")}.`);
    }
    return paras;
  }, [profit.rows, marketing, savings, score, critical, warning, cash.opening, lowest, targets, netProfit, netRevenue, totalSavings, poNow]);

  const color = scoreColor(score);

  return (
    <section className="screen active" id="screen-health">
      <ModuleHead title="Company Health" subtitle="Overall health and where to cut">
        <Source>Recalculated from live data on every sync</Source>
      </ModuleHead>

      <div className="module-stats">
        <ModuleStat label="Cash today" value={usd(cash.opening)} note="QuickBooks bank balances" />
        <ModuleStat label="Lowest month-end cash" value={lowest ? usd(lowest.closing) : "—"} note={lowest ? `${monthLabel(lowest.month)} · 3-month outlook` : ""} />
        <ModuleStat label={`${monthLabel(LAST_FULL_MONTH[0] ?? "")} net profit`} value={usd(netProfit)} note="All channels, after allocated expenses" />
      </div>
      <div className="module-stats">
        <ModuleStat label="Blended ROAS" value={marketing.total.roas.toFixed(2)} note={`Target ${targets.targetRoas.toFixed(1)}`} />
        <ModuleStat label="Distributor open AR" value={usd(openAR)} note={`${distributors.filter((d) => d.overdue > 0).length} with overdue invoices`} />
        <ModuleStat label="SKUs needing PO" value={poNow.length} note={poNow.map((p) => p.sku).join(", ") || "None"} />
      </div>

      <div className="grid-main-side">
        <div className="stack">
          <div className="card">
            <div className="row" style={{ gap: 22, alignItems: "center" }}>
              <div className="score-ring" style={{ background: `conic-gradient(${color} ${score * 3.6}deg, #eef1f5 0deg)` }}>
                <div className="inner">
                  <div>
                    <strong>{score}</strong>
                    <small>out of 100</small>
                  </div>
                </div>
              </div>
              <div className="stack" style={{ gap: 6 }}>
                <span className="section-kicker">OVERALL</span>
                <h3 style={{ margin: 0 }}>{scoreLabel(score)}</h3>
                <div className="row">
                  <span className="badge b-red">{critical} critical</span>
                  <span className="badge b-amber">{warning} warning</span>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Possible savings: <strong className="pos">{usd(totalSavings)}</strong> per month
                </div>
                <Assume title="Score starts at 100: −15 per critical signal, −5 per warning. Targets can be changed.">How the score works</Assume>
              </div>
            </div>
          </div>

          <Section title="Signals" kicker="WHAT NEEDS ATTENTION" hint={`${filtered.length} shown`}>
            <div style={{ marginBottom: 12 }}>
              <Tabs tabs={AREAS.map((a) => ({ id: a, label: a }))} value={area} onChange={setArea} />
            </div>
            {filtered.length === 0 ? <div className="empty">No signals in this area.</div> : filtered.map((s) => <SignalRow key={s.id} s={s} />)}
          </Section>
        </div>

        <div className="stack">
          <div className="ai-card">
            <span className="section-kicker">AI SUMMARY (SAMPLE)</span>
            <h3>This morning's read</h3>
            {summary.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <Assume title="The live version is written by AI each morning from these same signals and numbers.">Live version written by AI each morning</Assume>
          </div>

          <Section title="Where to cut" kicker="COST SAVINGS" hint={`Planned: ${usd(plannedTotal)}/mo`}>
            {savings.length === 0 ? (
              <div className="empty">No cost-cut suggestions right now.</div>
            ) : (
              <div className="table-wrap">
                <table className="compact">
                  <thead>
                    <tr>
                      <th>Plan</th>
                      <th>Suggestion</th>
                      <th className="num">Monthly</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savings.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Plan this cut: ${s.title}`}
                            checked={planned[s.id] ?? false}
                            onChange={(e) => setPlanned((p) => ({ ...p, [s.id]: e.target.checked }))}
                          />
                        </td>
                        <td>
                          <strong>{s.title}</strong>
                          <div className="small">{s.suggestion ?? s.detail}</div>
                        </td>
                        <td className="num">{usd(s.monthlySaving)}</td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td />
                      <td>Planned cuts · {usd(plannedTotal * 12)} per year</td>
                      <td className="num">{usd(plannedTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      </div>
    </section>
  );
}
