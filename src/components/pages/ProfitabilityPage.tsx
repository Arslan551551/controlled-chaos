import { useMemo, useState, type FormEvent } from "react";

import {
  Assume,
  Field,
  HBar,
  Modal,
  ModalActions,
  ModuleGate,
  ModuleHead,
  ModuleStat,
  Section,
  Source,
  Tabs,
  ViewOnlyBanner,
  sum,
  useCanEdit,
} from "@/components/cc/ui";
import { SALES_MONTHS, useProductProfit, useProfitability } from "@/lib/derived";
import {
  actualRoas,
  breakevenRoas,
  COST_LINES,
  DEFAULT_BENCHMARKS,
  margin,
  type Leak,
  type PnlLayers,
  type PnlLine,
} from "@/lib/engine/productProfit";
import { monthKey } from "@/lib/engine/dates";
import {
  CHANNELS,
  allocationTotal,
  isValidAllocation,
  type Expense,
  type ProfitRow,
} from "@/lib/engine/finance";
import type { SalesChannel } from "@/lib/engine/types";
import { formatDate, int, money, monthLabel, pct, usd } from "@/lib/format";
import { useStore } from "@/lib/store";

const ALL = "all";
type ExpenseFilter = "all" | "unallocated" | "allocated";
type PageTab = "pnl" | "layers" | "product" | "drivers";

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
  return Object.fromEntries(CHANNELS.map((c) => [c, a?.[c] ? String(a[c]) : ""])) as Record<
    SalesChannel,
    string
  >;
}

export function ProfitabilityPage() {
  const { data, update, flash } = useStore();
  const canEdit = useCanEdit("profitability");
  const [period, setPeriod] = useState<string>("2026-09");
  const months = useMemo(() => (period === ALL ? [...SALES_MONTHS] : [period]), [period]);
  const { rows, unallocated } = useProfitability(months);
  const [filter, setFilter] = useState<ExpenseFilter>("all");
  const [split, setSplit] = useState<SplitForm | null>(null);
  const [tab, setTab] = useState<PageTab>("pnl");
  const previousMonths = useMemo(() => {
    if (period === ALL) return [] as string[];
    const i = SALES_MONTHS.indexOf(period);
    const prev = i > 0 ? SALES_MONTHS[i - 1] : undefined;
    return prev ? [prev] : ([] as string[]);
  }, [period]);
  const product = useProductProfit(months, previousMonths);

  const total = useMemo(() => {
    const t = {} as Record<LineKey, number>;
    for (const l of LINES) t[l.key] = sum(rows, (r) => r[l.key]);
    t.netMarginPct = t.netRevenue > 0 ? t.netProfit / t.netRevenue : 0;
    return t;
  }, [rows]);

  const periodExpenses = data.expenses.filter((e) => months.includes(monthKey(e.date)));
  const shown = periodExpenses.filter((e) =>
    filter === "all"
      ? true
      : filter === "unallocated"
        ? !isValidAllocation(e.allocation)
        : isValidAllocation(e.allocation),
  );
  const maxRev = Math.max(1, ...rows.map((r) => r.netRevenue));
  const best = [...rows]
    .filter((r) => r.netRevenue > 0)
    .sort((a, b) => b.netMarginPct - a.netMarginPct)[0];
  const worst = [...rows]
    .filter((r) => r.netRevenue > 0)
    .sort((a, b) => a.netMarginPct - b.netMarginPct)[0];

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
      values[c] = String(
        i === channels.length - 1
          ? Math.round((100 - base * (channels.length - 1)) * 100) / 100
          : base,
      );
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
        <ModuleHead
          title="Marketplace Profitability"
          subtitle="Profit by channel after fees, COGS, fulfillment, ads and shared expenses"
        >
          <div className="row">
            <Source>QuickBooks expenses · marketplace reports · ad platforms</Source>
            <select
              className="control"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              aria-label="Period"
            >
              {SALES_MONTHS.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                  {m === "2026-10" ? " (month to date)" : ""}
                </option>
              ))}
              <option value={ALL}>All months</option>
            </select>
          </div>
        </ModuleHead>

        <ViewOnlyBanner
          id="profitability"
          text="View only for this role. Finance splits shared expenses across channels."
        />

        <div className="module-stats">
          <ModuleStat
            label="Net revenue"
            value={usd(total.netRevenue)}
            note={period === ALL ? "All months" : monthLabel(period)}
          />
          <ModuleStat
            label="Net profit"
            value={<span className={total.netProfit < 0 ? "neg" : ""}>{usd(total.netProfit)}</span>}
            note={`${pct(total.netMarginPct)} net margin`}
          />
          <ModuleStat
            label="Best channel"
            value={best ? best.channel : "—"}
            note={best ? `${pct(best.netMarginPct)} net margin` : ""}
          />
          <ModuleStat
            label="Weakest channel"
            value={worst ? worst.channel : "—"}
            note={worst ? `${pct(worst.netMarginPct)} net margin` : ""}
          />
        </div>

        {unallocated.length > 0 ? (
          <div className="notice readonly">
            <strong>
              {unallocated.length} expense{unallocated.length === 1 ? "" : "s"} (
              {usd(sum(unallocated, (e) => e.amount))})
            </strong>{" "}
            not yet split across channels, so they are not in channel profit yet.{" "}
            {canEdit ? (
              <button className="text-link" type="button" onClick={() => setFilter("unallocated")}>
                Split them below →
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="toolbar">
          <Tabs<PageTab>
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "pnl", label: "Channel P&L & Expense Splits" },
              { id: "layers", label: "By Channel (GP / CM / NP)" },
              { id: "product", label: "By Product" },
              { id: "drivers", label: "Profit Drivers" },
            ]}
          />
        </div>

        {tab === "layers" ? (
          <LayeredChannels lines={product.current.byChannel} total={product.current.total} />
        ) : null}
        {tab === "product" ? <ByProduct product={product} /> : null}
        {tab === "drivers" ? (
          <Drivers
            product={product}
            monthCount={months.length}
            hasPrevious={previousMonths.length > 0}
          />
        ) : null}

        {tab === "pnl" ? (
          <>
            <Section
              title={"Channel P&L"}
              hint={
                <Assume title="COGS per unit uses each product's latest full COGS (final if finalized, otherwise tentative)">
                  COGS uses latest full COGS per unit
                </Assume>
              }
            >
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th />
                      {rows.map((r) => (
                        <th key={r.channel} className="num">
                          {r.channel}
                        </th>
                      ))}
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LINES.map((l) => (
                      <tr
                        key={l.key}
                        className={
                          l.kind === "subtotal" && l.key === "netProfit" ? "total-row" : ""
                        }
                      >
                        <td
                          className={
                            l.kind === "subtotal" ? "strong" : l.kind === "minus" ? "muted" : ""
                          }
                        >
                          {l.label}
                        </td>
                        {rows.map((r) => {
                          const v = r[l.key];
                          const negative = (l.kind === "subtotal" || l.kind === "pct") && v < 0;
                          return (
                            <td
                              key={r.channel}
                              className={`num ${l.kind === "subtotal" ? "strong" : ""} ${negative ? "neg" : ""}`}
                            >
                              {fmt(v, l.kind)}
                            </td>
                          );
                        })}
                        <td
                          className={`num strong ${(l.kind === "subtotal" || l.kind === "pct") && total[l.key] < 0 ? "neg" : ""}`}
                        >
                          {fmt(total[l.key], l.kind)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <div className="grid-main-side mt">
              <Section
                title="Expense Splits"
                kicker="SHARED COSTS"
                hint={`${periodExpenses.length} expenses in period`}
              >
                <div className="toolbar">
                  <Tabs<ExpenseFilter>
                    tabs={[
                      { id: "all", label: "All" },
                      {
                        id: "unallocated",
                        label: `Not split (${periodExpenses.filter((e) => !isValidAllocation(e.allocation)).length})`,
                      },
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
                        <tr>
                          <td colSpan={6} className="empty">
                            No expenses in this view.
                          </td>
                        </tr>
                      ) : (
                        shown.map((e) => {
                          const ok = isValidAllocation(e.allocation);
                          return (
                            <tr key={e.id} className={ok ? "" : "selected-row"}>
                              <td className="nowrap">{formatDate(e.date)}</td>
                              <td>
                                <strong>{e.vendor}</strong>
                                <div className="small">
                                  {e.description} · {e.source}
                                </div>
                              </td>
                              <td>{e.category}</td>
                              <td className="num strong">{usd(e.amount)}</td>
                              <td>
                                {ok && e.allocation ? (
                                  <span className="small">
                                    {CHANNELS.filter((c) => (e.allocation?.[c] ?? 0) > 0)
                                      .map((c) => `${c} ${e.allocation?.[c] ?? 0}%`)
                                      .join(" · ")}
                                  </span>
                                ) : (
                                  <span className="badge b-amber">Not split</span>
                                )}
                              </td>
                              <td>
                                {canEdit ? (
                                  <button
                                    className="btn"
                                    type="button"
                                    onClick={() =>
                                      setSplit({ expense: e, values: emptyValues(e.allocation) })
                                    }
                                  >
                                    {ok ? "Edit split" : "Split"}
                                  </button>
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
                    display={
                      <span className={r.netProfit < 0 ? "neg" : ""}>{usd(r.netProfit)}</span>
                    }
                    tone={r.netProfit < 0 ? "bad" : r.netMarginPct < 0.08 ? "warn" : "alt"}
                  />
                ))}
                <div className="section-kicker mt">NET REVENUE</div>
                {rows.map((r) => (
                  <HBar
                    key={r.channel}
                    label={r.channel}
                    value={r.netRevenue}
                    max={maxRev}
                    display={usd(r.netRevenue)}
                  />
                ))}
              </Section>
            </div>
          </>
        ) : null}

        <Modal
          open={split !== null}
          title="Split Expense Across Channels"
          onClose={() => setSplit(null)}
          width={620}
        >
          {split ? (
            <form onSubmit={saveSplit}>
              <div className="notice">
                <strong>{split.expense.vendor}</strong> · {split.expense.description} ·{" "}
                {usd(split.expense.amount)} · {formatDate(split.expense.date)}
              </div>
              <div className="toolbar">
                <button className="btn" type="button" onClick={() => evenSplit(CHANNELS)}>
                  Even across all
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => evenSplit(["Amazon", "Shopify", "TikTok Shop", "Walmart"])}
                >
                  Even across marketplaces
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => setSplit({ ...split, values: emptyValues(null) })}
                >
                  Clear
                </button>
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
                        onChange={(e) =>
                          setSplit({ ...split, values: { ...split.values, [c]: e.target.value } })
                        }
                      />
                      <span className="small">
                        {v > 0 ? usd((split.expense.amount * v) / 100) : "—"}
                      </span>
                    </Field>
                  );
                })}
              </div>
              <div
                className={`notice ${Math.abs(splitTotal - 100) < 0.001 ? "" : "readonly"}`}
                style={{ marginTop: 12, marginBottom: 0 }}
              >
                Total: <strong>{Math.round(splitTotal * 100) / 100}%</strong>
                {Math.abs(splitTotal - 100) < 0.001
                  ? " ✓ ready to save"
                  : ` — must equal 100% (${Math.round((100 - splitTotal) * 100) / 100}% ${splitTotal < 100 ? "left" : "over"})`}
                {split.expense.allocation ? (
                  <span className="small">
                    {" "}
                    · current split totals {allocationTotal(split.expense.allocation)}%
                  </span>
                ) : null}
              </div>
              <ModalActions
                onCancel={() => setSplit(null)}
                submitLabel="Save split"
                disabled={Math.abs(splitTotal - 100) >= 0.001}
              />
            </form>
          ) : null}
        </Modal>
      </section>
    </ModuleGate>
  );
}

// ---------------------------------------------------------------- GP / CM / NP views

type ProductProfit = ReturnType<typeof useProductProfit>;

type LayerKey = keyof PnlLayers;
const LAYERS: { key: LayerKey; label: string; kind: "plus" | "minus" | "subtotal" }[] = [
  { key: "grossSales", label: "Gross sales", kind: "plus" },
  { key: "discounts", label: "− Discounts", kind: "minus" },
  { key: "refunds", label: "− Refunds", kind: "minus" },
  { key: "netRevenue", label: "Net revenue", kind: "subtotal" },
  { key: "cogs", label: "− Product COGS", kind: "minus" },
  { key: "gp", label: "GP · gross profit", kind: "subtotal" },
  { key: "platformFees", label: "− Platform fees", kind: "minus" },
  { key: "fulfillmentFees", label: "− Fulfilment fees", kind: "minus" },
  { key: "shippingCost", label: "− Shipping", kind: "minus" },
  { key: "cm1", label: "CM1 · after fulfilment", kind: "subtotal" },
  { key: "adSpend", label: "− Ad spend", kind: "minus" },
  { key: "sampleCost", label: "− Samples", kind: "minus" },
  { key: "otherVariable", label: "− Commission / fund", kind: "minus" },
  { key: "cm2", label: "CM2 · after marketing", kind: "subtotal" },
  { key: "overhead", label: "− Allocated overhead", kind: "minus" },
  { key: "np", label: "NP · net profit", kind: "subtotal" },
];

function LayerCell({
  l,
  k,
  kind,
}: {
  l: PnlLayers;
  k: LayerKey;
  kind: "plus" | "minus" | "subtotal";
}) {
  const v = l[k];
  if (kind === "minus") return <td className="num muted">{v ? `−${usd(v)}` : "—"}</td>;
  return (
    <td
      className={`num ${kind === "subtotal" ? "strong" : ""} ${kind === "subtotal" && v < 0 ? "neg" : ""}`}
    >
      {usd(v)}
      {kind === "subtotal" && k !== "netRevenue" ? (
        <div className="small">{pct(margin(v, l))}</div>
      ) : null}
    </td>
  );
}

function LayeredTable({ columns, total }: { columns: PnlLine[]; total: PnlLayers | null }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th />
            {columns.map((c) => (
              <th key={c.key} className="num">
                {c.label}
              </th>
            ))}
            {total ? <th className="num">Total</th> : null}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="muted">Units</td>
            {columns.map((c) => (
              <td key={c.key} className="num">
                {int(c.units)}
              </td>
            ))}
            {total ? <td className="num strong">{int(total.units)}</td> : null}
          </tr>
          {LAYERS.map((row) => (
            <tr key={row.key} className={row.key === "np" ? "total-row" : ""}>
              <td
                className={row.kind === "subtotal" ? "strong" : row.kind === "minus" ? "muted" : ""}
              >
                {row.label}
              </td>
              {columns.map((c) => (
                <LayerCell key={c.key} l={c} k={row.key} kind={row.kind} />
              ))}
              {total ? <LayerCell l={total} k={row.key} kind={row.kind} /> : null}
            </tr>
          ))}
          <tr>
            <td className="muted">Breakeven ROAS</td>
            {columns.map((c) => (
              <td key={c.key} className="num">
                {fmtRoas(breakevenRoas(c))}
              </td>
            ))}
            {total ? <td className="num">{fmtRoas(breakevenRoas(total))}</td> : null}
          </tr>
          <tr>
            <td className="muted">Actual ROAS (net revenue ÷ ads)</td>
            {columns.map((c) => {
              const be = breakevenRoas(c);
              const a = actualRoas(c);
              return (
                <td
                  key={c.key}
                  className={`num ${a !== null && be !== null && a < be ? "neg" : ""}`}
                >
                  {fmtRoas(a)}
                </td>
              );
            })}
            {total ? <td className="num">{fmtRoas(actualRoas(total))}</td> : null}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function fmtRoas(v: number | null) {
  return v === null ? "—" : v.toFixed(2);
}

const LAYER_NOTE = (
  <>
    <Assume title="Each channel's overhead is its share of split shared expenses (Expense splits tab), allocated to SKUs by net revenue. Months without split expenses carry no overhead.">
      overhead by revenue share
    </Assume>{" "}
    <Assume title="Ad spend per channel comes from the ad platforms; it is attributed to SKUs by revenue share, with extra weight for accessories pushed on social. Live: campaign → SKU mapping.">
      ad spend attributed to SKUs
    </Assume>
  </>
);

function LayeredChannels({ lines, total }: { lines: PnlLine[]; total: PnlLayers }) {
  const best = [...lines].sort((a, b) => margin(b.cm2, b) - margin(a.cm2, a))[0];
  const worst = [...lines].sort((a, b) => margin(a.np, a) - margin(b.np, b))[0];
  return (
    <div className="stack">
      <div className="stat-strip">
        <ModuleStat label="GP margin" value={pct(margin(total.gp, total))} note={usd(total.gp)} />
        <ModuleStat
          label="CM1 margin"
          value={pct(margin(total.cm1, total))}
          note="After fees, fulfilment, shipping"
        />
        <ModuleStat
          label="CM2 margin"
          value={pct(margin(total.cm2, total))}
          note="After ads, samples, commission"
        />
        <ModuleStat
          label="NP margin"
          value={<span className={total.np < 0 ? "neg" : ""}>{pct(margin(total.np, total))}</span>}
          note={usd(total.np)}
        />
        <ModuleStat
          label="Best CM2"
          value={best?.label ?? "—"}
          note={best ? pct(margin(best.cm2, best)) : ""}
        />
        <ModuleStat
          label="Weakest NP"
          value={worst?.label ?? "—"}
          note={worst ? pct(margin(worst.np, worst)) : ""}
        />
      </div>
      <Section
        title="Marketplace P&L · GP → CM1 → CM2 → NP"
        kicker="PRODUCTS IN CATALOGUE"
        hint={LAYER_NOTE}
      >
        <LayeredTable columns={lines} total={total} />
        <div className="small mt">
          GP = net revenue − product cost. CM1 = GP − platform fees − fulfilment − shipping. CM2 =
          CM1 − ads − samples − commission. NP = CM2 − allocated overhead. Amazon ads sit below CM1
          like every other channel so channels compare like-for-like. Breakeven ROAS = net revenue ÷
          CM1.
        </div>
      </Section>
      <Section title="Margin by layer" kicker="COMPARISON">
        <div className="legend">
          <span>
            <i style={{ background: "#2f6fed" }} />
            CM1
          </span>
          <span>
            <i style={{ background: "#148a60" }} />
            CM2
          </span>
          <span>
            <i style={{ background: "#b96a00" }} />
            NP
          </span>
        </div>
        {lines.map((l) => (
          <div key={l.key}>
            <div className="small strong mt">{l.label}</div>
            <HBar
              label="CM1"
              value={Math.max(0, margin(l.cm1, l))}
              max={1}
              display={pct(margin(l.cm1, l))}
            />
            <HBar
              label="CM2"
              value={Math.max(0, margin(l.cm2, l))}
              max={1}
              display={pct(margin(l.cm2, l))}
              tone="alt"
            />
            <HBar
              label="NP"
              value={Math.max(0, margin(l.np, l))}
              max={1}
              display={<span className={l.np < 0 ? "neg" : ""}>{pct(margin(l.np, l))}</span>}
              tone={l.np < 0 ? "bad" : "warn"}
            />
          </div>
        ))}
      </Section>
    </div>
  );
}

const QUICK_PICKS: { label: string; skus: string[] }[] = [
  { label: "Brush + Hair Pick", skus: ["CCHAIRBRUSH1", "IE-O3AV-F28K"] },
  { label: "All 32oz", skus: ["32-OZ-CURLCREME", "32-OZ-HAIRMOISTURIZER", "32-OZ-HAIRCLEANSER"] },
  { label: "Curl Creme range", skus: ["CONTCHAOSCC5OZ", "CONTCHAOSCC3OZ", "32-OZ-CURLCREME"] },
];

function ByProduct({ product }: { product: ProductProfit }) {
  const [channel, setChannel] = useState<string>(ALL);
  const [family, setFamily] = useState<string>(ALL);
  const [selected, setSelected] = useState<string[]>(["CCHAIRBRUSH1", "IE-O3AV-F28K"]);
  const families = [...new Set(product.current.bySku.map((l) => l.family ?? "Other"))].sort();

  const skuRows = useMemo(() => {
    const src =
      channel === ALL
        ? product.current.bySku
        : product.current.lines
            .filter((l) => l.channel === channel)
            .map((l) => ({ ...l, key: l.sku ?? l.key, label: product.label(l.sku ?? "") }));
    return src.filter((l) => family === ALL || l.family === family);
  }, [product, channel, family]);

  const toggle = (sku: string) =>
    setSelected((s) => (s.includes(sku) ? s.filter((x) => x !== sku) : [...s, sku]));
  const selLines = product.current.lines.filter((l) => l.sku && selected.includes(l.sku));
  const selByChannel = CHANNELS.map((c) => {
    const ls = selLines.filter((l) => l.channel === c);
    return ls.length ? ({ key: c, label: c, channel: c, ...sumLayersLocal(ls) } as PnlLine) : null;
  }).filter((x): x is PnlLine => x !== null);
  const selTotal = sumLayersLocal(selLines);

  return (
    <div className="stack">
      <Section
        title="Product profitability"
        kicker="SKU × PLATFORM"
        hint={LAYER_NOTE}
        actions={
          <>
            <select
              className="control"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              aria-label="Channel"
            >
              <option value={ALL}>All platforms</option>
              {CHANNELS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              className="control"
              value={family}
              onChange={(e) => setFamily(e.target.value)}
              aria-label="Product family"
            >
              <option value={ALL}>All products</option>
              {families.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </>
        }
      >
        <div className="toolbar">
          <span className="small">Quick compare:</span>
          {QUICK_PICKS.map((q) => (
            <button key={q.label} className="btn" type="button" onClick={() => setSelected(q.skus)}>
              {q.label}
            </button>
          ))}
          <button className="btn ghost" type="button" onClick={() => setSelected([])}>
            Clear selection
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th />
                <th>Product</th>
                <th>Family</th>
                <th className="num">Units</th>
                <th className="num">Net revenue</th>
                <th className="num">GP</th>
                <th className="num">GP %</th>
                <th className="num">CM1 %</th>
                <th className="num">CM2</th>
                <th className="num">CM2 %</th>
                <th className="num">NP</th>
                <th className="num">NP %</th>
                <th className="num">NP / unit</th>
              </tr>
            </thead>
            <tbody>
              {skuRows.map((l) => {
                const sku = l.sku ?? l.key;
                const on = selected.includes(sku);
                return (
                  <tr
                    key={l.key}
                    className={`click-row${on ? " selected-row" : ""}`}
                    onClick={() => toggle(sku)}
                  >
                    <td>
                      <input type="checkbox" checked={on} readOnly aria-label={`Select ${sku}`} />
                    </td>
                    <td>
                      <strong>{product.label(sku)}</strong>
                      <div className="small">{sku}</div>
                    </td>
                    <td>{l.family}</td>
                    <td className="num">{int(l.units)}</td>
                    <td className="num">{usd(l.netRevenue)}</td>
                    <td className="num">{usd(l.gp)}</td>
                    <td className="num">{pct(margin(l.gp, l))}</td>
                    <td className="num">{pct(margin(l.cm1, l))}</td>
                    <td className={`num ${l.cm2 < 0 ? "neg" : ""}`}>{usd(l.cm2)}</td>
                    <td className={`num ${l.cm2 < 0 ? "neg" : ""}`}>{pct(margin(l.cm2, l))}</td>
                    <td className={`num strong ${l.np < 0 ? "neg" : ""}`}>{usd(l.np)}</td>
                    <td className={`num ${l.np < 0 ? "neg" : ""}`}>{pct(margin(l.np, l))}</td>
                    <td className={`num ${l.np < 0 ? "neg" : ""}`}>
                      {l.units ? money(l.np / l.units) : "—"}
                    </td>
                  </tr>
                );
              })}
              {skuRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="empty">
                    No sales for this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title={
          selected.length
            ? `${selected.map((s) => product.label(s)).join(" + ")} on every platform`
            : "Select products above"
        }
        kicker="SELECTED PRODUCTS · BY PLATFORM"
        hint={
          selected.length
            ? `${int(selTotal.units)} units · NP ${usd(selTotal.np)} (${pct(margin(selTotal.np, selTotal))})`
            : undefined
        }
      >
        {selected.length && selByChannel.length ? (
          <LayeredTable columns={selByChannel} total={selTotal} />
        ) : (
          <div className="empty">
            Tick one or more products (or use a quick compare) to see GP, CM and NP on each
            platform.
          </div>
        )}
      </Section>
    </div>
  );
}

function sumLayersLocal(ls: PnlLayers[]): PnlLayers {
  const keys: LayerKey[] = [
    "units",
    "grossSales",
    "discounts",
    "refunds",
    "cogs",
    "platformFees",
    "fulfillmentFees",
    "shippingCost",
    "adSpend",
    "sampleCost",
    "otherVariable",
    "overhead",
  ];
  const t = {
    units: 0,
    grossSales: 0,
    discounts: 0,
    refunds: 0,
    netRevenue: 0,
    cogs: 0,
    gp: 0,
    platformFees: 0,
    fulfillmentFees: 0,
    shippingCost: 0,
    cm1: 0,
    adSpend: 0,
    sampleCost: 0,
    otherVariable: 0,
    cm2: 0,
    overhead: 0,
    np: 0,
  };
  for (const l of ls) for (const k of keys) t[k] += l[k];
  t.netRevenue = t.grossSales - t.discounts - t.refunds;
  t.gp = t.netRevenue - t.cogs;
  t.cm1 = t.gp - t.platformFees - t.fulfillmentFees - t.shippingCost;
  t.cm2 = t.cm1 - t.adSpend - t.sampleCost - t.otherVariable;
  t.np = t.cm2 - t.overhead;
  return t;
}

function Drivers({
  product,
  monthCount,
  hasPrevious,
}: {
  product: ProductProfit;
  monthCount: number;
  hasPrevious: boolean;
}) {
  const [scope, setScope] = useState<"all" | "channel" | "sku">("all");
  const leaks = product.leaks.filter((l) => scope === "all" || l.scope === scope);
  const totalLeak = sum(product.leaks, (l) => l.monthlyImpact);
  const channels = product.current.byChannel;
  const byChannelLeak = CHANNELS.map((c) => ({
    c,
    v: sum(
      product.leaks.filter((l) => l.channel === c),
      (l) => l.monthlyImpact,
    ),
  }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);
  const company = product.current.total;
  const losing = product.current.lines.filter((l) => l.cm2 < 0);

  return (
    <div className="stack">
      <div className="stat-strip">
        <ModuleStat
          label="Profit leaking / month"
          value={<span className="neg">{usd(totalLeak)}</span>}
          note="Cost above target or company average"
        />
        <ModuleStat
          label="Biggest leak"
          value={product.leaks[0] ? `${product.leaks[0].channel}` : "—"}
          note={
            product.leaks[0]
              ? `${product.leaks[0].label} · ${usd(product.leaks[0].monthlyImpact)}/mo`
              : ""
          }
        />
        <ModuleStat
          label="SKU × platform losing money"
          value={losing.length}
          note="Negative CM2 (after marketing)"
        />
        <ModuleStat
          label="Company CM2"
          value={pct(margin(company.cm2, company))}
          note={`NP ${pct(margin(company.np, company))}`}
        />
      </div>

      <div className="grid-main-side">
        <Section
          title="What is reducing profit"
          kicker="RANKED BY $ PER MONTH"
          hint={
            <Assume title="Targets are sample benchmarks per channel (e.g. TikTok shipping 15% of net revenue, Amazon fees 16%). Where no target is set, the company average is used. Agree the targets with the CEO.">
              sample targets
            </Assume>
          }
          actions={
            <Tabs<"all" | "channel" | "sku">
              value={scope}
              onChange={setScope}
              tabs={[
                { id: "all", label: "All" },
                { id: "channel", label: "Cost lines" },
                { id: "sku", label: "Losing SKUs" },
              ]}
            />
          }
        >
          {leaks.length === 0 ? <div className="empty">No leaks found for this period.</div> : null}
          {leaks.slice(0, 15).map((l) => (
            <LeakRow key={l.id} leak={l} hasPrevious={hasPrevious} />
          ))}
        </Section>

        <div className="stack">
          <Section title="Leak by platform" kicker="$ PER MONTH">
            {byChannelLeak.map((x) => (
              <HBar
                key={x.c}
                label={x.c}
                value={x.v}
                max={byChannelLeak[0]?.v ?? 1}
                display={usd(x.v)}
                tone="bad"
              />
            ))}
          </Section>
          <Section title="How to increase profit" kicker="TOP ACTIONS">
            <ol>
              {product.leaks.slice(0, 6).map((l) => (
                <li key={l.id} style={{ marginBottom: 8 }}>
                  <strong>
                    {l.scope === "sku"
                      ? `${product.label(l.sku ?? "")} on ${l.channel}`
                      : `${l.channel} · ${l.label}`}
                  </strong>
                  <div className="small">{l.suggestion}</div>
                  <div className="small pos">
                    Up to {usd(l.monthlyImpact)}/month · {usd(l.monthlyImpact * 12)}/year
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>

      <Section
        title="Cost per unit by platform"
        kicker="WHAT EACH UNIT COSTS TO SELL"
        hint={`${monthCount === 1 ? "Selected month" : `${monthCount} months`} · red = above target / company average`}
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cost line</th>
                {channels.map((c) => (
                  <th key={c.key} className="num">
                    {c.label}
                  </th>
                ))}
                <th className="num">Company</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="muted">Net revenue / unit</td>
                {channels.map((c) => (
                  <td key={c.key} className="num">
                    {c.units ? money(c.netRevenue / c.units) : "—"}
                  </td>
                ))}
                <td className="num">
                  {company.units ? money(company.netRevenue / company.units) : "—"}
                </td>
              </tr>
              {COST_LINES.map(({ key, label }) => (
                <tr key={key}>
                  <td>{label}</td>
                  {channels.map((c) => {
                    const p = c.netRevenue > 0 ? c[key] / c.netRevenue : 0;
                    const bench =
                      (c.channel ? DEFAULT_BENCHMARKS[c.channel]?.[key] : undefined) ??
                      (key === "cogs"
                        ? null
                        : company.netRevenue > 0
                          ? company[key] / company.netRevenue
                          : 0);
                    const high = bench !== null && c[key] > 0 && p > bench + 0.0005;
                    return (
                      <td key={c.key} className={`num ${high ? "neg" : ""}`}>
                        {c[key] ? money(c.units ? c[key] / c.units : 0) : "—"}
                        {c[key] ? <div className="small">{pct(p)}</div> : null}
                      </td>
                    );
                  })}
                  <td className="num">
                    {company[key] ? money(company.units ? company[key] / company.units : 0) : "—"}
                    {company[key] ? (
                      <div className="small">
                        {pct(company.netRevenue > 0 ? company[key] / company.netRevenue : 0)}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              <tr className="total-row">
                <td>CM2 / unit</td>
                {channels.map((c) => (
                  <td key={c.key} className={`num ${c.cm2 < 0 ? "neg" : ""}`}>
                    {c.units ? money(c.cm2 / c.units) : "—"}
                  </td>
                ))}
                <td className="num">{company.units ? money(company.cm2 / company.units) : "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function LeakRow({ leak, hasPrevious }: { leak: Leak; hasPrevious: boolean }) {
  const severity = leak.scope === "sku" || leak.monthlyImpact > 2500 ? "critical" : "warning";
  return (
    <div className={`signal ${severity}`}>
      <div className="stripe" />
      <div>
        <div className="signal-title">{leak.headline}</div>
        <div className="signal-detail">
          {leak.scope === "channel"
            ? `Benchmark: ${leak.benchmarkSource}`
            : "Loses money after ads, samples and commission"}
          {hasPrevious && leak.changePts !== null
            ? ` · ${leak.changePts >= 0 ? "+" : ""}${leak.changePts.toFixed(1)} pts vs previous month`
            : ""}
        </div>
        <div className="signal-suggest">{leak.suggestion}</div>
      </div>
      <div className="saving">
        <strong>{usd(leak.monthlyImpact)}</strong>per month
      </div>
    </div>
  );
}
