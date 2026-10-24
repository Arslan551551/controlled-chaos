// Home — in order of priority: purchase orders, cash, marketing, then everything else.
// Each block is one visual summary with a link into the page where the work is done.
// Every role only sees the blocks it has access to.

import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SOON_DAYS, useAttentionItems, type Item } from "@/components/cc/attention";
import { access, ROLE_PERSON, type ModuleId, type Role } from "@/lib/access";
import {
  LAST_FULL_MONTH,
  useArInvoices,
  useCashCompare,
  useCashFlow,
  useMarketing,
  usePayments,
  useProfitability,
} from "@/lib/derived";
import { arPosition } from "@/lib/engine/ar";
import { addDays, daysBetween, formatDate } from "@/lib/engine/dates";
import { sheetProgress } from "@/lib/engine/operations";
import { calculateCommission } from "@/lib/engine/people";
import { remainingQty, type SkuPlan } from "@/lib/engine/planning";
import { int, money, monthLabel, pct, usd, usdK } from "@/lib/format";
import { HEALTH_TARGETS } from "@/lib/sample/finance";
import { usePlanning, useStore } from "@/lib/store";

const PO_KEYS = ["po-", "tube-", "ps-", "tr-"];
const CASH_KEYS = ["late-", "due-soon", "ar-", "cash-"];
const MKT_KEYS = ["camp-"];
const has = (i: Item, keys: string[]) => keys.some((k) => i.key.startsWith(k));

export function DashboardPage() {
  const { role } = useStore();
  const can = (m: ModuleId) => access(role, m) !== null;
  const items = useAttentionItems();
  return (
    <section className="screen active home" id="screen-dashboard">
      <HomeHeader items={items} />
      {can("projection") ? <PoBlock /> : null}
      {can("cash-flow") || can("payments") || can("ar") ? (
        <CashBlock items={items.filter((i) => has(i, CASH_KEYS))} />
      ) : null}
      {can("marketing") ? <MarketingBlock items={items.filter((i) => has(i, MKT_KEYS))} /> : null}
      <WorkspaceBlock role={role} />
      <OtherBlock items={items.filter((i) => !has(i, [...PO_KEYS, ...CASH_KEYS, ...MKT_KEYS]))} />
    </section>
  );
}

// ---------------------------------------------------------------- shared pieces

function Block({
  icon,
  tone,
  title,
  summary,
  link,
  children,
}: {
  icon: string;
  tone: "red" | "blue" | "green" | "purple" | "amber";
  title: string;
  summary: ReactNode;
  link?: { to: string; label: string } | undefined;
  children: ReactNode;
}) {
  return (
    <div className="hs">
      <div className="hs-head">
        <div className={`hs-icon t-${tone}`}>{icon}</div>
        <div className="hs-title">
          <h2>{title}</h2>
          <p>{summary}</p>
        </div>
        {link ? (
          <Link className="hs-link" to={link.to}>
            {link.label} →
          </Link>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  to,
  tone,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  to: string;
  tone?: "bad" | "good" | undefined;
}) {
  return (
    <Link className="hstat" to={to}>
      <span className="hstat-label">{label}</span>
      <strong className={tone ?? ""}>{value}</strong>
      {note ? <span className="hstat-note">{note}</span> : null}
    </Link>
  );
}

function ItemRow({ i }: { i: Item }) {
  return (
    <Link className={`hitem l-${i.level}`} to={i.to}>
      <span className="hitem-dot" />
      <span className="hitem-copy">
        <strong>{i.title}</strong>
        <small>{i.detail}</small>
      </span>
      <span className="hitem-value">{i.value}</span>
    </Link>
  );
}

function HomeHeader({ items }: { items: Item[] }) {
  const { role, asOf } = useStore();
  const urgent = items.filter((i) => i.level === "critical").length;
  const day = new Date(`${asOf}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return (
    <div className="home-hero">
      <div>
        <span className="home-hero-date">{day}</span>
        <h1>Good morning{role === "CEO" ? "" : `, ${role}`}</h1>
        <p>
          {urgent
            ? `${urgent} urgent item${urgent === 1 ? "" : "s"} and ${items.length - urgent} more to look at today.`
            : items.length
              ? `Nothing urgent. ${items.length} item${items.length === 1 ? "" : "s"} to look at.`
              : "Everything is on track."}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 1. purchase orders

const RUNWAY_MAX = 270;
const COVER_TRIGGER = 135;

function Runway({ p }: { p: SkuPlan }) {
  const days = p.daysOfStockLeft ?? RUNWAY_MAX;
  const pos = (d: number) => `${Math.min(100, (d / RUNWAY_MAX) * 100)}%`;
  const tone =
    p.poStatus === "PO Now" || p.stockoutBeforeArrival
      ? "bad"
      : p.poStatus === "No PO Required"
        ? "good"
        : "warn";
  return (
    <div className="runway" title={`${days} days of stock left`}>
      <div className={`runway-fill ${tone}`} style={{ width: pos(days) }} />
      <div className="runway-mark lead" style={{ left: pos(p.leadTimeDays) }}>
        <span>lead {p.leadTimeDays}d</span>
      </div>
      <div className="runway-mark trigger" style={{ left: pos(COVER_TRIGGER) }}>
        <span>{COVER_TRIGGER}d</span>
      </div>
    </div>
  );
}

const PO_LABEL: Record<SkuPlan["poStatus"], { text: string; cls: string }> = {
  "PO Now": { text: "Order now", cls: "b-red" },
  "Additional PO Required": { text: "Order more", cls: "b-amber" },
  "PO Due Soon": { text: "Due soon", cls: "b-blue" },
  "No PO Required": { text: "OK", cls: "b-green" },
};
const PO_ORDER: Record<SkuPlan["poStatus"], number> = {
  "PO Now": 0,
  "Additional PO Required": 1,
  "PO Due Soon": 2,
  "No PO Required": 3,
};

function PoBlock() {
  const { data, asOf } = useStore();
  const plan = usePlanning();
  const [showAll, setShowAll] = useState(false);
  const needs = [...plan.finishedGoods]
    .filter((p) => p.poStatus !== "No PO Required")
    .sort(
      (a, b) =>
        PO_ORDER[a.poStatus] - PO_ORDER[b.poStatus] ||
        (a.daysOfStockLeft ?? 999) - (b.daysOfStockLeft ?? 999),
    );
  const ok = plan.finishedGoods.filter((p) => p.poStatus === "No PO Required");
  const rows = showAll ? [...needs, ...ok] : needs;
  const now = needs.filter((p) => p.poStatus === "PO Now").length;
  const incoming = data.purchaseOrders
    .filter((p) => p.status === "Open" && remainingQty(p) > 0)
    .sort((a, b) => (a.eta ?? "9999").localeCompare(b.eta ?? "9999"));
  const transfers = plan.finishedGoods.filter((p) => p.transfer.status === "Transfer Required");
  const tubes = plan.tubes.filter((t) => t.status === "Open Tube PO");
  const desc = (sku: string) => data.skus.find((s) => s.sku === sku)?.description ?? sku;

  return (
    <Block
      icon="PO"
      tone="red"
      title="Purchase orders"
      summary={
        needs.length ? (
          <>
            <strong>{needs.length} products need a PO</strong> ({now} right now) · {incoming.length}{" "}
            POs on the way · {tubes.length} tube POs · {transfers.length} transfers
          </>
        ) : (
          "Stock cover is healthy for every product."
        )
      }
      link={{ to: "/projection", label: "Open PO planning" }}
    >
      <div className="po-grid">
        <div className="po-runways">
          <div className="po-legend">
            <span>Days of stock left</span>
            <span className="muted">
              │ lead = supplier lead time · {COVER_TRIGGER}d = reorder trigger
            </span>
          </div>
          {rows.map((p) => (
            <Link key={p.sku} to="/projection" className="po-row">
              <div className="po-name">
                <strong>{p.description}</strong>
                <small>
                  {p.sku} · selling {int(p.projectionBurn)}/day
                </small>
              </div>
              <div className="po-bar">
                <Runway p={p} />
                <small>
                  <strong>{p.daysOfStockLeft ?? "—"} days</strong>
                  {p.stockoutBeforeArrival ? " · runs out before a new PO would arrive" : ""}
                  {p.nextInboundEta ? ` · next delivery ${formatDate(p.nextInboundEta)}` : ""}
                </small>
              </div>
              <div className="po-action">
                <span className={`badge ${PO_LABEL[p.poStatus].cls}`}>
                  {PO_LABEL[p.poStatus].text}
                </span>
                {p.recommendedQty > 0 ? <strong>{int(p.recommendedQty)} units</strong> : null}
                {p.poOpenBy ? (
                  p.poOpenBy < asOf ? (
                    <small className="neg">
                      overdue · {daysBetween(p.poOpenBy, asOf)} days late
                    </small>
                  ) : (
                    <small>order by {formatDate(p.poOpenBy)}</small>
                  )
                ) : null}
              </div>
            </Link>
          ))}
          {ok.length ? (
            <button type="button" className="link-btn" onClick={() => setShowAll((x) => !x)}>
              {showAll ? "Hide healthy products" : `Show ${ok.length} healthy products`}
            </button>
          ) : null}
        </div>

        <div className="po-side">
          <h4>On the way</h4>
          {incoming.length === 0 ? <p className="muted">No open POs.</p> : null}
          {incoming.map((po) => {
            const total = po.eta ? Math.max(1, daysBetween(po.openDate, po.eta)) : 1;
            const gone = po.eta ? Math.max(0, daysBetween(po.openDate, asOf)) : 0;
            const left = po.eta ? daysBetween(asOf, po.eta) : null;
            return (
              <Link key={po.po} to="/vendor" className="eta-row">
                <div className="eta-top">
                  <strong>{desc(po.sku)}</strong>
                  <span>{int(remainingQty(po))}</span>
                </div>
                <div className="eta-track">
                  <div style={{ width: `${Math.min(100, (gone / total) * 100)}%` }} />
                </div>
                <small>
                  {po.po} · {po.supplier} ·{" "}
                  {po.eta
                    ? left !== null && left < 0
                      ? `late by ${-left} days`
                      : `arrives ${formatDate(po.eta)} (${left}d)`
                    : "no ETA"}
                </small>
              </Link>
            );
          })}
          {tubes.length || transfers.length ? (
            <div className="po-chips">
              {tubes.map((t) => (
                <Link key={t.tubeSku} to="/projection" className="chip purple">
                  Tube PO · {t.description} · by {formatDate(t.tubeOpenBy)}
                </Link>
              ))}
              {transfers.map((t) => (
                <Link key={t.sku} to="/projection" className="chip blue">
                  Move to Brentwood · {t.description}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Block>
  );
}

// ---------------------------------------------------------------- 2. cash

function CashBlock({ items }: { items: Item[] }) {
  const { role, asOf } = useStore();
  const can = (m: ModuleId) => access(role, m) !== null;
  const cash = useCashFlow();
  const weeks = useCashCompare(3, 8);
  const payments = usePayments();
  const ar = arPosition(useArInvoices(), asOf);
  const buffer = HEALTH_TARGETS.minimumCashBuffer;

  const lowest = [...weeks].sort((a, b) => a.closing - b.closing)[0];
  const soon = addDays(asOf, SOON_DAYS);
  const due = payments.all.filter((p) => p.status !== "Paid" && p.dueDate && p.dueDate <= soon);
  const thisWeek = weeks.find((w) => w.kind === "current");
  const chart = weeks.map((w) => ({
    week: formatDate(w.weekStart).replace(/ \d{4}$/, ""),
    Actual: w.kind === "future" ? null : w.closing,
    Projected: w.kind === "past" ? null : w.closing,
  }));

  return (
    <Block
      icon="$"
      tone="green"
      title="Cash"
      summary={
        <>
          <strong>{usd(cash.opening)} in the bank</strong>
          {lowest ? ` · lowest point ${usdK(lowest.closing)} in the next 8 weeks` : ""}
          {thisWeek
            ? ` · this week ${usdK(thisWeek.actualIn)} received of ${usdK(thisWeek.expectedIn)} expected`
            : ""}
        </>
      }
      link={can("cash-flow") ? { to: "/cash-flow", label: "Open cash flow" } : undefined}
    >
      <div className="hstats">
        {can("cash-flow") ? (
          <Stat
            label="Cash now"
            value={usdK(cash.opening)}
            note="QuickBooks banks"
            to="/cash-flow"
          />
        ) : null}
        {can("cash-flow") && lowest ? (
          <Stat
            label="Lowest, next 8 weeks"
            value={usdK(lowest.closing)}
            note={`buffer ${usdK(buffer)}`}
            to="/cash-flow"
            tone={lowest.closing < buffer ? "bad" : undefined}
          />
        ) : null}
        {can("payments") ? (
          <Stat
            label={`To pay, ${SOON_DAYS} days`}
            value={usdK(due.reduce((a, p) => a + p.amount, 0))}
            note={`${due.length} payments`}
            to="/payments"
          />
        ) : null}
        {can("ar") ? (
          <Stat
            label="Owed to us"
            value={usdK(ar.open)}
            note={`${usdK(ar.overdue)} overdue`}
            to="/ar"
            tone={ar.over60 > 0 ? "bad" : undefined}
          />
        ) : null}
      </div>
      <div className="cash-grid">
        {can("cash-flow") ? (
          <div className="cash-chart">
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <AreaChart data={chart} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cashFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#148a60" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#148a60" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#eef1f5" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} interval={1} />
                  <YAxis
                    tickFormatter={(v: number) => usdK(v)}
                    tick={{ fontSize: 11 }}
                    width={52}
                  />
                  <Tooltip formatter={(v) => usd(Number(v))} />
                  <ReferenceLine
                    y={buffer}
                    stroke="#cf3f4f"
                    strokeDasharray="4 4"
                    label={{ value: "buffer", fontSize: 11, fill: "#cf3f4f", position: "right" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Actual"
                    stroke="#148a60"
                    strokeWidth={2.5}
                    fill="url(#cashFill)"
                    connectNulls
                  />
                  <Area
                    type="monotone"
                    dataKey="Projected"
                    stroke="#148a60"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    fill="none"
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <small className="muted">
              Bank balance by week · solid = actual, dashed = projected
            </small>
          </div>
        ) : null}
        <div className="cash-items">
          <h4>Needs action</h4>
          {items.length === 0 ? <p className="muted">Nothing overdue.</p> : null}
          {items.slice(0, 6).map((i) => (
            <ItemRow key={i.key} i={i} />
          ))}
          {items.length > 6 ? (
            <Link className="hs-link" to="/payments">
              {items.length - 6} more →
            </Link>
          ) : null}
        </div>
      </div>
    </Block>
  );
}

// ---------------------------------------------------------------- 3. marketing

function MarketingBlock({ items }: { items: Item[] }) {
  const { role } = useStore();
  const mkt = useMarketing(LAST_FULL_MONTH);
  const profit = useProfitability(LAST_FULL_MONTH).rows;
  const target = HEALTH_TARGETS.targetRoas;
  const platforms = mkt.byPlatform.filter((p) => p.spend > 0).sort((a, b) => b.spend - a.spend);
  const max = Math.max(target * 1.6, ...platforms.map((p) => p.roas));
  const sales = profit.reduce((a, r) => a + r.netRevenue, 0);
  const net = profit.reduce((a, r) => a + r.netProfit, 0);
  const month = monthLabel(LAST_FULL_MONTH[0]!);

  return (
    <Block
      icon="◎"
      tone="purple"
      title="Marketing"
      summary={
        <>
          <strong>
            ROAS {mkt.total.roas.toFixed(2)} on {usd(mkt.total.spend)} ad spend
          </strong>{" "}
          in {month} · TACoS {pct(mkt.total.tacos)}
          {access(role, "profitability")
            ? ` · net sales ${usdK(sales)}, net profit ${usdK(net)} (${pct(sales ? net / sales : 0)})`
            : ""}
        </>
      }
      link={{ to: "/marketing", label: "Open ads & campaigns" }}
    >
      <div className="mkt-grid">
        <div className="roas-bars">
          {platforms.map((p) => {
            const good = p.roas >= target;
            return (
              <Link key={p.key} to="/marketing" className="roas-row">
                <span className="roas-name">{p.key}</span>
                <div className="roas-track">
                  <div
                    className={`roas-fill ${good ? "good" : "bad"}`}
                    style={{ width: `${(p.roas / max) * 100}%` }}
                  />
                  <div className="roas-target" style={{ left: `${(target / max) * 100}%` }} />
                </div>
                <strong className={good ? "" : "neg"}>{p.roas.toFixed(2)}</strong>
                <small>{usdK(p.spend)}</small>
              </Link>
            );
          })}
          <small className="muted">Return on ad spend by platform · line = target {target}</small>
        </div>
        <div className="cash-items">
          <h4>Campaigns</h4>
          {items.length === 0 ? <p className="muted">No campaign lost money.</p> : null}
          {items.slice(0, 5).map((i) => (
            <ItemRow key={i.key} i={i} />
          ))}
        </div>
      </div>
    </Block>
  );
}

// ---------------------------------------------------------------- roles without the blocks above

function WorkspaceBlock({ role }: { role: Role }) {
  const { data } = useStore();
  const person = ROLE_PERSON[role];

  if (role === "Warehouse") {
    const sheet = data.stockCounts.find((s) => s.status === "In Progress");
    const prog = sheet ? sheetProgress(sheet) : null;
    return (
      <Block
        icon="✓"
        tone="blue"
        title="Your work"
        summary="This month's stock count and stock movements"
        link={{ to: "/stock-count", label: "Open stock count" }}
      >
        <div className="hstats">
          <Stat
            label="Stock count"
            value={prog ? `${prog.counted}/${prog.total}` : "Not started"}
            note={sheet ? `${sheet.location} · ${sheet.month}` : "Start the count sheet"}
            to="/stock-count"
          />
        </div>
      </Block>
    );
  }
  if (role === "Salon Sales Rep") {
    const lines = calculateCommission(data.salonOrders, data.commissionPlans).filter(
      (l) => l.order.repId === person,
    );
    const month = lines.filter((l) => l.order.date.startsWith("2026-10"));
    const mine = data.salonAccounts.filter((a) => a.repId === person);
    return (
      <Block
        icon="✂"
        tone="purple"
        title="My salons"
        summary={`${mine.length} salons · Shopify orders are tagged to you automatically`}
        link={{ to: "/salons", label: "Onboard a new salon" }}
      >
        <div className="hstats">
          <Stat
            label="My commission · Oct"
            value={money(month.reduce((a, l) => a + l.commission, 0))}
            note={`${month.length} orders`}
            to="/salons"
          />
          <Stat
            label="Waiting for Finance"
            value={lines.filter((l) => l.order.status === "Pending Review").length}
            note="orders pending review"
            to="/salons"
          />
          <Stat
            label="Shopify orders to tag"
            value={data.untaggedShopifyOrders.length}
            note="no matching salon yet"
            to="/salons"
          />
        </div>
      </Block>
    );
  }
  return null;
}

// ---------------------------------------------------------------- 4. everything else

function OtherBlock({ items }: { items: Item[] }) {
  const [all, setAll] = useState(false);
  if (items.length === 0) return null;
  const shown = all ? items : items.slice(0, 6);
  return (
    <Block
      icon="•••"
      tone="amber"
      title="Also needs attention"
      summary="Stock counts, stock movements, product cost, profit and team"
    >
      <div className="other-list">
        {shown.map((i) => (
          <ItemRow key={i.key} i={i} />
        ))}
      </div>
      {items.length > 6 ? (
        <button type="button" className="link-btn" onClick={() => setAll((x) => !x)}>
          {all ? "Show fewer" : `Show all ${items.length}`}
        </button>
      ) : null}
    </Block>
  );
}
