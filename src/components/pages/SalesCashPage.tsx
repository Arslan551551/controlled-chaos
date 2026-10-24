import { useMemo, useState } from "react";

import { Assume, HBar, ModuleGate, ModuleHead, ModuleStat, Progress, Section, Source, sum } from "@/components/cc/ui";
import { SALES_MONTHS, useSalesCash } from "@/lib/derived";
import { CHANNELS } from "@/lib/engine/finance";
import type { SalesChannel } from "@/lib/engine/types";
import { formatDate, monthLabel, pct, usd } from "@/lib/format";
import { useStore } from "@/lib/store";

const ALL = "all";
const MARKETPLACES: SalesChannel[] = ["Amazon", "Shopify", "TikTok Shop", "Walmart"];

function tone(p: number): "good" | "warn" | "bad" {
  if (p >= 0.95) return "good";
  if (p >= 0.75) return "warn";
  return "bad";
}

export function SalesCashPage() {
  const { data } = useStore();
  const [period, setPeriod] = useState<string>(ALL);
  const months = useMemo(() => (period === ALL ? [...SALES_MONTHS] : [period]), [period]);
  const rows = useSalesCash(months);
  const [channel, setChannel] = useState<SalesChannel>("Amazon");

  const detail = useMemo(() => {
    const s = data.channelSales.filter((x) => months.includes(x.month));
    const by = (ch: SalesChannel) => {
      const r = s.filter((x) => x.channel === ch);
      return { refunds: sum(r, (x) => x.refunds), fees: sum(r, (x) => x.platformFees) };
    };
    return Object.fromEntries(CHANNELS.map((c) => [c, by(c)])) as Record<SalesChannel, { refunds: number; fees: number }>;
  }, [data.channelSales, months]);

  const totals = {
    gross: sum(rows, (r) => r.grossSales),
    refunds: sum(CHANNELS, (c) => detail[c].refunds),
    fees: sum(CHANNELS, (c) => detail[c].fees),
    expected: sum(rows, (r) => r.expectedNet),
    received: sum(rows, (r) => r.received),
    outstanding: sum(rows, (r) => r.outstanding),
  };
  const collected = totals.expected > 0 ? totals.received / totals.expected : 0;
  const maxGross = Math.max(1, ...rows.map((r) => r.grossSales));
  const receipts = data.cashReceipts.filter((r) => r.channel === channel && months.includes(r.settlesMonth)).sort((a, b) => a.date.localeCompare(b.date));
  const selectedRow = rows.find((r) => r.channel === channel);
  const periodLabel = period === ALL ? `${monthLabel(SALES_MONTHS[0] ?? "")} – ${monthLabel(SALES_MONTHS[SALES_MONTHS.length - 1] ?? "")}` : monthLabel(period);

  return (
    <ModuleGate id="sales-cash">
      <section className="screen active" id="screen-sales-cash">
        <ModuleHead title="Sales vs Cash Received" subtitle="What every channel sold, against the cash that actually landed in the bank">
          <div className="row">
            <Source>QuickBooks deposits · marketplace settlement reports</Source>
            <select className="control" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period">
              <option value={ALL}>All months ({periodLabel})</option>
              {SALES_MONTHS.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}{m === "2026-10" ? " (month to date)" : ""}</option>
              ))}
            </select>
          </div>
        </ModuleHead>

        <div className="module-stats">
          <ModuleStat label="Gross sales" value={usd(totals.gross)} note={periodLabel} />
          <ModuleStat label="Expected in bank" value={usd(totals.expected)} note="After refunds and fees withheld" />
          <ModuleStat label="Cash received" value={usd(totals.received)} note={`${pct(collected)} of expected`} />
          <ModuleStat label="Not yet received" value={<span className={totals.outstanding > 0 ? "neg" : ""}>{usd(totals.outstanding)}</span>} note="Held by platforms or unpaid invoices" />
        </div>

        <div className="notice">
          Marketplaces pay out <strong>net</strong>: Amazon, TikTok Shop, Walmart and Shopify Payments deduct their fees and refunds before the money reaches the bank.
          So <em>expected in bank</em> = gross sales − refunds − platform fees withheld. Salons and distributors are invoiced in full and pay against QuickBooks invoices.
        </div>

        <Section title="By Channel" hint="Click a channel to see its deposits">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Channel</th>
                  <th className="num">Gross sales</th>
                  <th className="num">Refunds</th>
                  <th className="num">Fees withheld</th>
                  <th className="num">Expected in bank</th>
                  <th className="num">Cash received</th>
                  <th className="num">Not yet received</th>
                  <th style={{ width: 170 }}>% collected</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.channel} className={`click-row${channel === r.channel ? " selected-row" : ""}`} onClick={() => setChannel(r.channel)}>
                    <td>
                      <strong>{r.channel}</strong>
                      <div className="small">{MARKETPLACES.includes(r.channel) ? "Marketplace payout" : "Invoice / QuickBooks AR"}</div>
                    </td>
                    <td className="num">{usd(r.grossSales)}</td>
                    <td className="num muted">{detail[r.channel].refunds ? `−${usd(detail[r.channel].refunds)}` : "—"}</td>
                    <td className="num muted">{detail[r.channel].fees ? `−${usd(detail[r.channel].fees)}` : "—"}</td>
                    <td className="num strong">{usd(r.expectedNet)}</td>
                    <td className="num pos strong">{usd(r.received)}</td>
                    <td className={`num strong ${r.outstanding > 0 ? "neg" : ""}`}>{r.outstanding > 0 ? usd(r.outstanding) : "—"}</td>
                    <td>
                      <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                        <div style={{ flex: 1 }}><Progress value={r.collectedPct} tone={tone(r.collectedPct)} /></div>
                        <span className="small strong">{pct(r.collectedPct, 0)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td>Total</td>
                  <td className="num">{usd(totals.gross)}</td>
                  <td className="num">−{usd(totals.refunds)}</td>
                  <td className="num">−{usd(totals.fees)}</td>
                  <td className="num">{usd(totals.expected)}</td>
                  <td className="num">{usd(totals.received)}</td>
                  <td className="num">{usd(totals.outstanding)}</td>
                  <td>{pct(collected, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <div className="grid-2 mt">
          <Section title="Sales vs Cash" kicker="COMPARISON">
            <div className="legend" style={{ marginBottom: 8 }}>
              <span><i style={{ background: "#c9d6ea" }} />Gross sales</span>
              <span><i style={{ background: "#2f6fed" }} />Expected in bank</span>
              <span><i style={{ background: "#148a60" }} />Cash received</span>
            </div>
            {rows.map((r) => (
              <div key={r.channel} style={{ marginBottom: 8 }}>
                <HBar label={<strong>{r.channel}</strong>} value={r.grossSales} max={maxGross} display={usd(r.grossSales)} tone="ghost" />
                <HBar label="" value={r.expectedNet} max={maxGross} display={usd(r.expectedNet)} />
                <HBar label="" value={r.received} max={maxGross} display={usd(r.received)} tone="alt" />
              </div>
            ))}
          </Section>

          <Section title={`${channel} deposits`} kicker="CASH RECEIVED" hint={selectedRow ? `${usd(selectedRow.received)} of ${usd(selectedRow.expectedNet)}` : undefined}>
            {receipts.length === 0 ? (
              <div className="empty">No cash received yet for {channel} in this period.</div>
            ) : (
              <div className="table-wrap">
                <table className="compact" style={{ minWidth: 420 }}>
                  <thead>
                    <tr><th>Deposit date</th><th>Reference</th><th>Settles</th><th className="num">Amount</th></tr>
                  </thead>
                  <tbody>
                    {receipts.map((r) => (
                      <tr key={r.id}>
                        <td className="nowrap">{formatDate(r.date)}</td>
                        <td>{r.reference}</td>
                        <td>{monthLabel(r.settlesMonth)} sales</td>
                        <td className="num strong">{usd(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {selectedRow && selectedRow.outstanding > 0 ? (
              <div className="notice readonly mt" style={{ marginBottom: 0 }}>
                {usd(selectedRow.outstanding)} still to arrive from {channel}.{" "}
                {MARKETPLACES.includes(channel) ? "Check the platform's settlement report for reserves or pending payouts." : "Follow up open invoices in QuickBooks."}
              </div>
            ) : null}
            <div className="small mt">
              <Assume title="Each deposit is matched to the sales month it settles using the platform's settlement / payout report">deposits matched to sales month</Assume>
            </div>
          </Section>
        </div>
      </section>
    </ModuleGate>
  );
}
