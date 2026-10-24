import { useMemo, useState, type FormEvent } from "react";

import { Assume, Field, HBar, Modal, ModalActions, ModuleGate, ModuleHead, ModuleStat, Section, Source, Tabs, ViewOnlyBanner, sum, useCanEdit } from "@/components/cc/ui";
import { SALES_MONTHS, useProfitability } from "@/lib/derived";
import { monthKey } from "@/lib/engine/dates";
import { CHANNELS, allocationTotal, isValidAllocation, type Expense, type ProfitRow } from "@/lib/engine/finance";
import type { SalesChannel } from "@/lib/engine/types";
import { formatDate, monthLabel, pct, usd } from "@/lib/format";
import { useStore } from "@/lib/store";

const ALL = "all";
type ExpenseFilter = "all" | "unallocated" | "allocated";

type LineKey = Exclude<keyof ProfitRow, "channel">;
const LINES: { key: LineKey; label: string; kind: "plus" | "minus" | "subtotal" | "pct" }[] = [
  { key: "revenue", label: "Gross revenue", kind: "plus" },
  { key: "refunds", label: "− Refunds", kind: "minus" },
  { key: "netRevenue", label: "Net revenue", kind: "subtotal" },
  { key: "platformFees", label: "− Platform fees", kind: "minus" },
  { key: "cogs", label: "− COGS", kind: "minus" },
  { key: "grossProfit", label: "Gross profit", kind: "subtotal" },
  { key: "fulfillment", label: "− Fulfillment & shipping", kind: "minus" },
  { key: "adSpend", label: "− Ad spend", kind: "minus" },
  { key: "contribution", label: "Contribution", kind: "subtotal" },
  { key: "allocatedExpenses", label: "− Allocated expenses", kind: "minus" },
  { key: "netProfit", label: "Net profit", kind: "subtotal" },
  { key: "netMarginPct", label: "Net margin", kind: "pct" },
];

type SplitForm = { expense: Expense; values: Record<SalesChannel, string> };

function emptyValues(a: Expense["allocation"]): Record<SalesChannel, string> {
  return Object.fromEntries(CHANNELS.map((c) => [c, a?.[c] ? String(a[c]) : ""])) as Record<SalesChannel, string>;
}

export function ProfitabilityPage() {
  const { data, update, flash } = useStore();
  const canEdit = useCanEdit("profitability");
  const [period, setPeriod] = useState<string>("2026-09");
  const months = useMemo(() => (period === ALL ? [...SALES_MONTHS] : [period]), [period]);
  const { rows, unallocated } = useProfitability(months);
  const [filter, setFilter] = useState<ExpenseFilter>("all");
  const [split, setSplit] = useState<SplitForm | null>(null);

  const total = useMemo(() => {
    const t = {} as Record<LineKey, number>;
    for (const l of LINES) t[l.key] = sum(rows, (r) => r[l.key]);
    t.netMarginPct = t.netRevenue > 0 ? t.netProfit / t.netRevenue : 0;
    return t;
  }, [rows]);

  const periodExpenses = data.expenses.filter((e) => months.includes(monthKey(e.date)));
  const shown = periodExpenses.filter((e) => (filter === "all" ? true : filter === "unallocated" ? !isValidAllocation(e.allocation) : isValidAllocation(e.allocation)));
  const maxRev = Math.max(1, ...rows.map((r) => r.netRevenue));
  const best = [...rows].filter((r) => r.netRevenue > 0).sort((a, b) => b.netMarginPct - a.netMarginPct)[0];
  const worst = [...rows].filter((r) => r.netRevenue > 0).sort((a, b) => a.netMarginPct - b.netMarginPct)[0];

  const splitTotal = split ? sum(CHANNELS, (c) => Number(split.values[c] || 0)) : 0;

  function saveSplit(e: FormEvent) {
    e.preventDefault();
    if (!split || !canEdit) return;
    const allocation: Partial<Record<SalesChannel, number>> = {};
    for (const c of CHANNELS) {
      const v = Number(split.values[c] || 0);
      if (v > 0) allocation[c] = v;
    }
    if (!isValidAllocation(allocation)) return;
    const id = split.expense.id;
    update("expenses", (prev) => prev.map((x) => (x.id === id ? { ...x, allocation } : x)));
    flash("Expense split saved · channel profit recalculated");
    setSplit(null);
  }

  function evenSplit(channels: SalesChannel[]) {
    if (!split) return;
    const base = Math.floor((100 / channels.length) * 100) / 100;
    const values = emptyValues(null);
    channels.forEach((c, i) => {
      values[c] = String(i === channels.length - 1 ? Math.round((100 - base * (channels.length - 1)) * 100) / 100 : base);
    });
    setSplit({ ...split, values });
  }

  const fmt = (v: number, kind: "plus" | "minus" | "subtotal" | "pct") => {
    if (kind === "pct") return pct(v);
    if (v === 0) return <span className="muted">—</span>;
    if (kind === "minus") return `−${usd(v)}`;
    return usd(v);
  };

  return (
    <ModuleGate id="profitability">
      <section className="screen active" id="screen-profitability">
        <ModuleHead title="Marketplace Profitability" subtitle="Profit by channel after fees, COGS, fulfillment, ads and shared expenses">
          <div className="row">
            <Source>QuickBooks expenses · marketplace reports · ad platforms</Source>
            <select className="control" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period">
              {SALES_MONTHS.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}{m === "2026-10" ? " (month to date)" : ""}</option>
              ))}
              <option value={ALL}>All months</option>
            </select>
          </div>
        </ModuleHead>

        <ViewOnlyBanner id="profitability" text="View only for this role. Finance splits shared expenses across channels." />

        <div className="module-stats">
          <ModuleStat label="Net revenue" value={usd(total.netRevenue)} note={period === ALL ? "All months" : monthLabel(period)} />
          <ModuleStat label="Net profit" value={<span className={total.netProfit < 0 ? "neg" : ""}>{usd(total.netProfit)}</span>} note={`${pct(total.netMarginPct)} net margin`} />
          <ModuleStat label="Best channel" value={best ? best.channel : "—"} note={best ? `${pct(best.netMarginPct)} net margin` : ""} />
          <ModuleStat label="Weakest channel" value={worst ? worst.channel : "—"} note={worst ? `${pct(worst.netMarginPct)} net margin` : ""} />
        </div>

        {unallocated.length > 0 ? (
          <div className="notice readonly">
            <strong>{unallocated.length} expense{unallocated.length === 1 ? "" : "s"} ({usd(sum(unallocated, (e) => e.amount))})</strong> not yet split across channels, so they are not in channel profit yet.{" "}
            {canEdit ? (
              <button className="text-link" type="button" onClick={() => setFilter("unallocated")}>Split them below →</button>
            ) : null}
          </div>
        ) : null}

        <Section title={"Channel P&L"} hint={<Assume title="COGS per unit uses each product's latest full COGS (final if finalized, otherwise tentative)">COGS uses latest full COGS per unit</Assume>}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th />
                  {rows.map((r) => <th key={r.channel} className="num">{r.channel}</th>)}
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {LINES.map((l) => (
                  <tr key={l.key} className={l.kind === "subtotal" && l.key === "netProfit" ? "total-row" : ""}>
                    <td className={l.kind === "subtotal" ? "strong" : l.kind === "minus" ? "muted" : ""}>{l.label}</td>
                    {rows.map((r) => {
                      const v = r[l.key];
                      const negative = (l.kind === "subtotal" || l.kind === "pct") && v < 0;
                      return (
                        <td key={r.channel} className={`num ${l.kind === "subtotal" ? "strong" : ""} ${negative ? "neg" : ""}`}>
                          {fmt(v, l.kind)}
                        </td>
                      );
                    })}
                    <td className={`num strong ${(l.kind === "subtotal" || l.kind === "pct") && total[l.key] < 0 ? "neg" : ""}`}>{fmt(total[l.key], l.kind)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <div className="grid-main-side mt">
          <Section title="Expense Splits" kicker="SHARED COSTS" hint={`${periodExpenses.length} expenses in period`}>
            <div className="toolbar">
              <Tabs<ExpenseFilter>
                tabs={[
                  { id: "all", label: "All" },
                  { id: "unallocated", label: `Not split (${periodExpenses.filter((e) => !isValidAllocation(e.allocation)).length})` },
                  { id: "allocated", label: "Split" },
                ]}
                value={filter}
                onChange={setFilter}
              />
            </div>
            <div className="table-wrap">
              <table style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Vendor</th>
                    <th>Category</th>
                    <th className="num">Amount</th>
                    <th>Split across channels</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 ? (
                    <tr><td colSpan={6} className="empty">No expenses in this view.</td></tr>
                  ) : (
                    shown.map((e) => {
                      const ok = isValidAllocation(e.allocation);
                      return (
                        <tr key={e.id} className={ok ? "" : "selected-row"}>
                          <td className="nowrap">{formatDate(e.date)}</td>
                          <td>
                            <strong>{e.vendor}</strong>
                            <div className="small">{e.description} · {e.source}</div>
                          </td>
                          <td>{e.category}</td>
                          <td className="num strong">{usd(e.amount)}</td>
                          <td>
                            {ok && e.allocation ? (
                              <span className="small">
                                {CHANNELS.filter((c) => (e.allocation?.[c] ?? 0) > 0).map((c) => `${c} ${e.allocation?.[c] ?? 0}%`).join(" · ")}
                              </span>
                            ) : (
                              <span className="badge b-amber">Not split</span>
                            )}
                          </td>
                          <td>
                            {canEdit ? (
                              <button className="btn" type="button" onClick={() => setSplit({ expense: e, values: emptyValues(e.allocation) })}>{ok ? "Edit split" : "Split"}</button>
                            ) : (
                              <span className="small">View</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Net Profit by Channel" kicker="COMPARISON">
            {rows.map((r) => (
              <HBar
                key={r.channel}
                label={r.channel}
                value={Math.max(0, r.netProfit)}
                max={Math.max(1, ...rows.map((x) => Math.max(0, x.netProfit)))}
                display={<span className={r.netProfit < 0 ? "neg" : ""}>{usd(r.netProfit)}</span>}
                tone={r.netProfit < 0 ? "bad" : r.netMarginPct < 0.08 ? "warn" : "alt"}
              />
            ))}
            <div className="section-kicker mt">NET REVENUE</div>
            {rows.map((r) => (
              <HBar key={r.channel} label={r.channel} value={r.netRevenue} max={maxRev} display={usd(r.netRevenue)} />
            ))}
          </Section>
        </div>

        <Modal open={split !== null} title="Split Expense Across Channels" onClose={() => setSplit(null)} width={620}>
          {split ? (
            <form onSubmit={saveSplit}>
              <div className="notice">
                <strong>{split.expense.vendor}</strong> · {split.expense.description} · {usd(split.expense.amount)} · {formatDate(split.expense.date)}
              </div>
              <div className="toolbar">
                <button className="btn" type="button" onClick={() => evenSplit(CHANNELS)}>Even across all</button>
                <button className="btn" type="button" onClick={() => evenSplit(["Amazon", "Shopify", "TikTok Shop", "Walmart"])}>Even across marketplaces</button>
                <button className="btn ghost" type="button" onClick={() => setSplit({ ...split, values: emptyValues(null) })}>Clear</button>
              </div>
              <div className="form-grid">
                {CHANNELS.map((c) => {
                  const v = Number(split.values[c] || 0);
                  return (
                    <Field key={c} label={`${c} %`}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={split.values[c]}
                        onChange={(e) => setSplit({ ...split, values: { ...split.values, [c]: e.target.value } })}
                      />
                      <span className="small">{v > 0 ? usd((split.expense.amount * v) / 100) : "—"}</span>
                    </Field>
                  );
                })}
              </div>
              <div className={`notice ${Math.abs(splitTotal - 100) < 0.001 ? "" : "readonly"}`} style={{ marginTop: 12, marginBottom: 0 }}>
                Total: <strong>{Math.round(splitTotal * 100) / 100}%</strong>
                {Math.abs(splitTotal - 100) < 0.001 ? " ✓ ready to save" : ` — must equal 100% (${Math.round((100 - splitTotal) * 100) / 100}% ${splitTotal < 100 ? "left" : "over"})`}
                {split.expense.allocation ? <span className="small"> · current split totals {allocationTotal(split.expense.allocation)}%</span> : null}
              </div>
              <ModalActions onCancel={() => setSplit(null)} submitLabel="Save split" disabled={Math.abs(splitTotal - 100) >= 0.001} />
            </form>
          ) : null}
        </Modal>
      </section>
    </ModuleGate>
  );
}
