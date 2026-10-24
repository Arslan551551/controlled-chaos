// Weekly cash: what we expected to come in and go out vs what really happened in the
// bank (QuickBooks), for the last 4 weeks, and the plan for the next 8.

import { Fragment, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge, Section, Source, type Tone } from "@/components/cc/ui";
import { useCashCompare } from "@/lib/derived";
import type { CashCompareWeek, CashLineStatus } from "@/lib/engine/finance";
import { formatDate, usd, usdK } from "@/lib/format";

const STATUS_TONE: Record<CashLineStatus, Tone> = {
  Received: "green",
  Paid: "green",
  "Partly received": "amber",
  "Received more": "blue",
  "Paid more": "red",
  "Paid less": "blue",
  Late: "red",
  Unplanned: "purple",
  Expected: "grey",
};

const short = (iso: string) => formatDate(iso).replace(/ \d{4}$/, "");

function Diff({ v, goodWhenPositive }: { v: number; goodWhenPositive: boolean }) {
  if (Math.abs(v) < 1) return <span className="muted">—</span>;
  const good = goodWhenPositive ? v > 0 : v < 0;
  return (
    <span className={good ? "pos" : "neg"}>
      {v > 0 ? "+" : "−"}
      {usd(Math.abs(v))}
    </span>
  );
}

export function CashCompare({ buffer }: { buffer: number }) {
  const weeks = useCashCompare();
  const [open, setOpen] = useState<string | null>(
    weeks.find((w) => w.kind === "current")?.weekStart ?? null,
  );
  const done = weeks.filter((w) => w.kind !== "future");
  const lines = done.flatMap((w) => w.lines);
  const expIn = done.reduce((a, w) => a + w.expectedIn, 0);
  const actIn = done.reduce((a, w) => a + w.actualIn, 0);
  const expOut = done.reduce((a, w) => a + w.expectedOut, 0);
  const actOut = done.reduce((a, w) => a + w.actualOut, 0);
  const late = lines.filter((l) => l.status === "Late");
  const unplanned = lines.filter((l) => l.status === "Unplanned" && l.direction === "out");

  const chart = weeks.map((w) => ({
    week: short(w.weekStart),
    "Expected in": w.expectedIn,
    "Actual in": w.kind === "future" ? null : w.actualIn,
    "Expected out": -w.expectedOut,
    "Actual out": w.kind === "future" ? null : -w.actualOut,
    "Bank balance": w.closing,
  }));

  return (
    <div className="stack">
      <div className="cash-compare-summary">
        <div className="cc-sum">
          <span>Money in · last 4 weeks</span>
          <strong>{usd(actIn)}</strong>
          <small>
            of {usd(expIn)} expected · <Diff v={actIn - expIn} goodWhenPositive />
          </small>
        </div>
        <div className="cc-sum">
          <span>Money out · last 4 weeks</span>
          <strong>{usd(actOut)}</strong>
          <small>
            of {usd(expOut)} planned · <Diff v={actOut - expOut} goodWhenPositive={false} />
          </small>
        </div>
        <div className={`cc-sum${late.length ? " alert" : ""}`}>
          <span>Expected but not arrived</span>
          <strong>{usd(late.reduce((a, l) => a + l.expected, 0))}</strong>
          <small>
            {late.length
              ? late.map((l) => l.description).join(" · ")
              : "Everything expected has arrived"}
          </small>
        </div>
        <div className="cc-sum">
          <span>Unplanned spending</span>
          <strong>{usd(unplanned.reduce((a, l) => a + l.actual, 0))}</strong>
          <small>{unplanned.map((l) => l.description).join(" · ") || "None"}</small>
        </div>
      </div>

      <Section
        title="Expected vs actual, week by week"
        kicker="CASH IN & OUT"
        hint={<Source>Plan: Payment Planner, payouts, AR · Actual: QuickBooks bank</Source>}
      >
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <ComposedChart data={chart} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid stroke="#eef1f5" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis
                yAxisId="flow"
                tickFormatter={(v: number) => usdK(v)}
                tick={{ fontSize: 12 }}
                width={60}
              />
              <YAxis
                yAxisId="bank"
                orientation="right"
                tickFormatter={(v: number) => usdK(v)}
                tick={{ fontSize: 12 }}
                width={60}
              />
              <Tooltip formatter={(v) => usd(Math.abs(Number(v)))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="flow" dataKey="Expected in" fill="#bfe5d4" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="flow" dataKey="Actual in" fill="#148a60" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="flow" dataKey="Expected out" fill="#f3c6cb" radius={[0, 0, 4, 4]} />
              <Bar yAxisId="flow" dataKey="Actual out" fill="#cf3f4f" radius={[0, 0, 4, 4]} />
              <Line
                yAxisId="bank"
                type="monotone"
                dataKey="Bank balance"
                stroke="#12345a"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="small muted" style={{ marginTop: 4 }}>
          Bank balance is the real QuickBooks balance for past weeks and the projection from this
          week on. Minimum buffer {usd(buffer)}.
        </div>
      </Section>

      <Section title="Weekly schedule" hint="Click a week to see every line">
        <div className="table-wrap">
          <table className="cash-compare">
            <thead>
              <tr>
                <th rowSpan={2}>Week</th>
                <th colSpan={3} className="center grp-in">
                  Money in
                </th>
                <th colSpan={3} className="center grp-out">
                  Money out
                </th>
                <th rowSpan={2} className="num">
                  Bank at week end
                </th>
              </tr>
              <tr>
                <th className="num">Expected</th>
                <th className="num">Actual</th>
                <th className="num">Difference</th>
                <th className="num">Expected</th>
                <th className="num">Actual</th>
                <th className="num">Difference</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <WeekRows
                  key={w.weekStart}
                  w={w}
                  buffer={buffer}
                  open={open === w.weekStart}
                  onToggle={() => setOpen(open === w.weekStart ? null : w.weekStart)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function WeekRows({
  w,
  buffer,
  open,
  onToggle,
}: {
  w: CashCompareWeek;
  buffer: number;
  open: boolean;
  onToggle: () => void;
}) {
  const future = w.kind === "future";
  const actual = (v: number) => (future ? <span className="muted">—</span> : usd(v));
  return (
    <Fragment>
      <tr className={`clickable week-${w.kind}`} onClick={onToggle}>
        <td className="nowrap">
          <span className="caret">{open ? "▾" : "▸"}</span> {short(w.weekStart)} –{" "}
          {short(w.weekEnd)}
          {w.kind === "current" ? (
            <Badge tone="blue">This week</Badge>
          ) : w.kind === "past" ? (
            <Badge tone="grey">Done</Badge>
          ) : null}
        </td>
        <td className="num">{usd(w.expectedIn)}</td>
        <td className="num">{actual(w.actualIn)}</td>
        <td className="num">
          {future ? (
            <span className="muted">—</span>
          ) : (
            <Diff v={w.actualIn - w.expectedIn} goodWhenPositive />
          )}
        </td>
        <td className="num">{usd(w.expectedOut)}</td>
        <td className="num">{actual(w.actualOut)}</td>
        <td className="num">
          {future ? (
            <span className="muted">—</span>
          ) : (
            <Diff v={w.actualOut - w.expectedOut} goodWhenPositive={false} />
          )}
        </td>
        <td className={`num ${w.closing < buffer ? "neg" : ""}`}>
          <strong>{usd(w.closing)}</strong>
          <div className="small">{w.closingIsActual ? "actual" : "projected"}</div>
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={8} className="week-detail">
            <table>
              <thead>
                <tr>
                  <th>In / Out</th>
                  <th>What</th>
                  <th>Expected</th>
                  <th className="num">Expected amount</th>
                  <th>Actual</th>
                  <th className="num">Actual amount</th>
                  <th className="num">Difference</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {w.lines.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Badge tone={l.direction === "in" ? "green" : "red"}>
                        {l.direction === "in" ? "In" : "Out"}
                      </Badge>
                    </td>
                    <td>
                      {l.description}
                      <div className="small">{l.category}</div>
                    </td>
                    <td className="nowrap">{l.expectedDate ? formatDate(l.expectedDate) : "—"}</td>
                    <td className="num">{l.expectedDate ? usd(l.expected) : "—"}</td>
                    <td className="nowrap">{l.actualDate ? formatDate(l.actualDate) : "—"}</td>
                    <td className="num">{l.actualDate ? usd(l.actual) : "—"}</td>
                    <td className="num">
                      {l.status === "Expected" || l.status === "Late" ? (
                        <span className="muted">—</span>
                      ) : (
                        <Diff v={l.difference} goodWhenPositive={l.direction === "in"} />
                      )}
                    </td>
                    <td>
                      <Badge tone={STATUS_TONE[l.status]}>{l.status}</Badge>
                    </td>
                  </tr>
                ))}
                {w.lines.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty">
                      Nothing planned or moved this week.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}
