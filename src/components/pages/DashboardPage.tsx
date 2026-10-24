// Home — one screen that pulls from every area: money first, then sales & profit,
// then a single "Needs attention" list. Every tile and item opens the right tab.
// Each role only sees the parts it has access to.

import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";

import { access, MODULES, ROLE_PERSON, sectionOf, type ModuleId, type Role } from "@/lib/access";
import {
  LAST_FULL_MONTH,
  useArInvoices,
  useCashFlow,
  useHealth,
  useMarketing,
  useOutflowRecords,
  usePayments,
  useProfitability,
  useSalesCash,
} from "@/lib/derived";
import { arPosition, daysOverdue, openUsd } from "@/lib/engine/ar";
import { analyzeCampaign } from "@/lib/engine/campaigns";
import { addDays, formatDate } from "@/lib/engine/dates";
import { sheetProgress, sheetVariances } from "@/lib/engine/operations";
import { reconcileOutflows, reconSummary } from "@/lib/engine/outflows";
import { calculateCommission } from "@/lib/engine/people";
import { int, money, monthLabel, pct, usd, usdK } from "@/lib/format";
import { HEALTH_TARGETS } from "@/lib/sample/finance";
import { useCosting, usePlanning, useStore } from "@/lib/store";

const PREV_MONTH = ["2026-08"];
const SOON_DAYS = 14;

type Area = "Money" | "Stock" | "Sales & Marketing" | "Profit" | "Team";
type Level = "critical" | "warning" | "info";

interface Item {
  key: string;
  level: Level;
  area: Area;
  title: string;
  detail: ReactNode;
  value: string;
  to: string;
  action: string;
}

const LEVEL_ORDER: Record<Level, number> = { critical: 0, warning: 1, info: 2 };
const LEVEL_CLASS: Record<Level, string> = {
  critical: "critical",
  warning: "warning",
  info: "info",
};
const LEVEL_BADGE: Record<Level, ReactNode> = {
  critical: <span className="badge b-red">Urgent</span>,
  warning: <span className="badge b-amber">Soon</span>,
  info: <span className="badge b-blue">FYI</span>,
};

export function DashboardPage() {
  const { role } = useStore();
  const can = (m: ModuleId) => access(role, m) !== null;
  const showMoney = can("cash-flow") || can("payments") || can("ar");
  const showSales = can("profitability") || can("marketing") || can("health");
  return (
    <section className="screen active" id="screen-dashboard">
      {showMoney ? <MoneyBand /> : null}
      {showSales ? <SalesBand /> : null}
      {!showMoney && !showSales ? <WorkspaceBand role={role} /> : null}
      <div className="dashboard-focus">
        <NeedsAttention />
        <SidePanel />
      </div>
    </section>
  );
}

function Tile({
  label,
  value,
  note,
  to,
  bad,
}: {
  label: string;
  value: ReactNode;
  note: ReactNode;
  to: string;
  bad?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <button className="card kpi kpi-click" type="button" onClick={() => navigate({ to })}>
      <div>
        <div className="kpi-label">{label}</div>
        <div className={`kpi-value${bad ? " bad" : ""}`}>{value}</div>
        <div className="kpi-note">{note}</div>
      </div>
    </button>
  );
}

function Band({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="home-band">
      <div className="home-band-title">{title}</div>
      <div className="home-kpis">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- money (top of Home)

function MoneyBand() {
  const { role, asOf } = useStore();
  const can = (m: ModuleId) => access(role, m) !== null;
  const cash = useCashFlow();
  const payments = usePayments();
  const ar = arPosition(useArInvoices(), asOf);
  const sc = useSalesCash();

  const lowest = [...cash.months].sort((a, b) => a.closing - b.closing)[0];
  const soon = addDays(asOf, SOON_DAYS);
  const due = payments.all.filter((p) => p.status !== "Paid" && p.dueDate && p.dueDate <= soon);
  const late = due.filter((p) => p.dueDate! < asOf);
  const notReceived = sc.reduce((a, r) => a + r.outstanding, 0);

  return (
    <Band title="Cash & money">
      {can("cash-flow") ? (
        <Tile
          label="Cash in bank"
          value={usdK(cash.opening)}
          note="All accounts · QuickBooks"
          to="/cash-flow"
        />
      ) : null}
      {can("cash-flow") && lowest ? (
        <Tile
          label="Lowest cash, next 3 months"
          value={usdK(lowest.closing)}
          note={`End of ${monthLabel(lowest.month)} · buffer ${usdK(HEALTH_TARGETS.minimumCashBuffer)}`}
          to="/cash-flow"
          bad={lowest.closing < HEALTH_TARGETS.minimumCashBuffer}
        />
      ) : null}
      {can("payments") ? (
        <Tile
          label={`To pay, next ${SOON_DAYS} days`}
          value={usdK(due.reduce((a, p) => a + p.amount, 0))}
          note={`${due.length} payments${late.length ? ` · ${late.length} overdue` : ""}`}
          to="/payments"
          bad={late.length > 0}
        />
      ) : null}
      {can("ar") ? (
        <Tile
          label="Owed to us"
          value={usdK(ar.open)}
          note={`${usdK(ar.overdue)} overdue · ${usdK(ar.over60)} over 60 days`}
          to="/ar"
          bad={ar.over60 > 0}
        />
      ) : null}
      {can("sales-cash") ? (
        <Tile
          label="Sales not yet paid out"
          value={usdK(notReceived)}
          note="Marketplace payouts still to land"
          to="/sales-cash"
        />
      ) : null}
    </Band>
  );
}

// ---------------------------------------------------------------- sales & profit

function SalesBand() {
  const { role } = useStore();
  const can = (m: ModuleId) => access(role, m) !== null;
  const now = useProfitability(LAST_FULL_MONTH).rows;
  const prev = useProfitability(PREV_MONTH).rows;
  const mkt = useMarketing(LAST_FULL_MONTH);
  const health = useHealth();

  const sales = now.reduce((a, r) => a + r.netRevenue, 0);
  const prevSales = prev.reduce((a, r) => a + r.netRevenue, 0);
  const profit = now.reduce((a, r) => a + r.netProfit, 0);
  const change = prevSales ? (sales - prevSales) / prevSales : 0;
  const month = monthLabel(LAST_FULL_MONTH[0]!);
  const critical = health.signals.filter((s) => s.severity === "critical").length;

  return (
    <Band title={`Sales & profit · ${month}`}>
      {can("profitability") ? (
        <>
          <Tile
            label="Net sales"
            value={usdK(sales)}
            note={`${change >= 0 ? "▲" : "▼"} ${pct(Math.abs(change))} vs ${monthLabel(PREV_MONTH[0]!)}`}
            to="/profitability"
            bad={change < 0}
          />
          <Tile
            label="Net profit"
            value={usdK(profit)}
            note={`${pct(sales ? profit / sales : 0)} margin · target ${pct(HEALTH_TARGETS.targetNetMarginPct, 0)}`}
            to="/profitability"
            bad={sales ? profit / sales < HEALTH_TARGETS.targetNetMarginPct : true}
          />
        </>
      ) : null}
      {can("marketing") ? (
        <Tile
          label="Ad return (ROAS)"
          value={mkt.total.roas.toFixed(2)}
          note={`Spend ${usdK(mkt.total.spend)} · target ${HEALTH_TARGETS.targetRoas.toFixed(1)}`}
          to="/marketing"
          bad={mkt.total.roas < HEALTH_TARGETS.targetRoas}
        />
      ) : null}
      {can("health") ? (
        <Tile
          label="Company health"
          value={`${health.score}/100`}
          note={`${critical} urgent issue${critical === 1 ? "" : "s"}`}
          to="/health"
          bad={health.score < 60}
        />
      ) : null}
    </Band>
  );
}

// ---------------------------------------------------------------- roles without finance access

function WorkspaceBand({ role }: { role: Role }) {
  const { data } = useStore();
  const person = ROLE_PERSON[role];
  const plan = usePlanning();
  const mkt = useMarketing(LAST_FULL_MONTH);
  const tiles: ReactNode[] = [];

  if (role === "Warehouse") {
    const sheet = data.stockCounts.find((s) => s.status === "In Progress");
    const prog = sheet ? sheetProgress(sheet) : null;
    const transfers = plan.finishedGoods.filter((p) => p.transfer.status === "Transfer Required");
    const inbound = data.purchaseOrders.filter(
      (p) => p.status === "Open" && p.eta && p.eta <= "2026-11-30",
    );
    tiles.push(
      <Tile
        key="count"
        label="This month's stock count"
        value={prog ? `${prog.counted}/${prog.total}` : "Not started"}
        note={sheet ? `${sheet.location} · ${sheet.month}` : "Start the count sheet"}
        to="/stock-count"
      />,
      <Tile
        key="transfers"
        label="Transfers Georgia → Brentwood"
        value={transfers.length}
        note={transfers.map((t) => t.sku).join(", ") || "None due"}
        to="/projection"
      />,
      <Tile
        key="inbound"
        label="Inbound POs next 5 weeks"
        value={inbound.length}
        note={inbound.map((p) => `${p.po} ${formatDate(p.eta)}`).join(" · ") || "None"}
        to="/projection"
      />,
    );
  }
  if (role === "Salon Sales Rep") {
    const lines = calculateCommission(data.salonOrders, data.commissionPlans).filter(
      (l) => l.order.repId === person,
    );
    const month = lines.filter((l) => l.order.date.startsWith("2026-10"));
    tiles.push(
      <Tile
        key="comm"
        label="My commission · Oct"
        value={money(month.reduce((a, l) => a + l.commission, 0))}
        note={`${month.length} orders`}
        to="/salons"
      />,
      <Tile
        key="pending"
        label="Orders waiting for Finance"
        value={lines.filter((l) => l.order.status === "Pending Review").length}
        note="Pending review"
        to="/salons"
      />,
      <Tile
        key="tag"
        label="Shopify orders to tag"
        value={data.untaggedShopifyOrders.length}
        note="Tag them to your salons"
        to="/salons"
      />,
    );
  }
  if (role === "Consultant") {
    tiles.push(
      <Tile
        key="roas"
        label="Ad return (ROAS) · Sep"
        value={mkt.total.roas.toFixed(2)}
        note={`Spend ${usd(mkt.total.spend)} · TACoS ${pct(mkt.total.tacos)}`}
        to="/marketing"
      />,
      <Tile key="kpi" label="My KPI" value="View" note="ROAS and TACoS vs target" to="/kpis" />,
    );
  }
  if (tiles.length === 0) return null;
  return <Band title={`Your numbers · ${role}`}>{tiles}</Band>;
}

// ---------------------------------------------------------------- needs attention (all areas)

function useAttentionItems(): Item[] {
  const { role, data, asOf } = useStore();
  const plan = usePlanning();
  const { batches, unitCost } = useCosting();
  const payments = usePayments();
  const cash = useCashFlow();
  const arInvoices = useArInvoices();
  const records = useOutflowRecords();
  const health = useHealth();

  return useMemo(() => {
    const can = (m: ModuleId) => access(role, m) !== null;
    const items: Item[] = [];

    // Money
    if (can("cash-flow")) {
      for (const m of cash.months.filter((x) => x.closing < HEALTH_TARGETS.minimumCashBuffer))
        items.push({
          key: `cash-${m.month}`,
          level: m.closing < 0 ? "critical" : "warning",
          area: "Money",
          title: `Cash drops to ${usdK(m.closing)} at end of ${monthLabel(m.month)}`,
          detail: `Below the ${usdK(HEALTH_TARGETS.minimumCashBuffer)} safety buffer — move or delay payments`,
          value: usdK(m.closing),
          to: "/cash-flow",
          action: "See cash flow →",
        });
    }
    if (can("payments")) {
      const soon = addDays(asOf, SOON_DAYS);
      const open = payments.all.filter((p) => p.status !== "Paid" && p.dueDate);
      for (const p of open.filter((x) => x.dueDate! < asOf))
        items.push({
          key: `late-${p.id}`,
          level: "critical",
          area: "Money",
          title: `Overdue payment · ${p.vendor}`,
          detail: `${p.reference} · ${p.description} · was due ${formatDate(p.dueDate)}`,
          value: usd(p.amount),
          to: "/payments",
          action: "Pay or reschedule →",
        });
      const upcoming = open.filter((x) => x.dueDate! >= asOf && x.dueDate! <= soon);
      if (upcoming.length)
        items.push({
          key: "due-soon",
          level: "warning",
          area: "Money",
          title: `${upcoming.length} payments due in the next ${SOON_DAYS} days`,
          detail: upcoming
            .slice(0, 3)
            .map((p) => `${p.vendor} ${formatDate(p.dueDate)}`)
            .join(" · "),
          value: usd(upcoming.reduce((a, p) => a + p.amount, 0)),
          to: "/payments",
          action: "Approve payments →",
        });
    }
    if (can("ar")) {
      const me = ROLE_PERSON[role];
      const scoped =
        role === "Salon Sales Rep" ? arInvoices.filter((i) => i.ownerId === me) : arInvoices;
      const byCustomer = new Map<string, { name: string; amount: number; days: number }>();
      for (const i of scoped) {
        const d = daysOverdue(i, asOf);
        const o = openUsd(i);
        if (d <= 0 || o <= 0) continue;
        const c = byCustomer.get(i.customerId) ?? { name: i.customerName, amount: 0, days: 0 };
        c.amount += o;
        c.days = Math.max(c.days, d);
        byCustomer.set(i.customerId, c);
      }
      for (const [id, c] of byCustomer)
        items.push({
          key: `ar-${id}`,
          level: c.days > 60 ? "critical" : "warning",
          area: "Money",
          title: `${c.name} owes us ${usd(c.amount)} overdue`,
          detail: `Oldest invoice ${c.days} days late`,
          value: usd(c.amount),
          to: "/ar",
          action: "Chase →",
        });
    }

    // Stock
    if (can("projection")) {
      for (const p of plan.finishedGoods) {
        if (p.poStatus === "PO Now" || p.poStatus === "Additional PO Required")
          items.push({
            key: `po-${p.sku}`,
            level: p.poStatus === "PO Now" ? "critical" : "warning",
            area: "Stock",
            title: `Reorder ${p.description}`,
            detail: `${p.sku} · ${p.daysOfStockLeft ?? "—"} days of stock left · selling ${int(p.projectionBurn)}/day`,
            value: `${int(p.recommendedQty)} units`,
            to: "/projection",
            action: "Open PO →",
          });
        if (p.transfer.status === "Transfer Required")
          items.push({
            key: `tr-${p.sku}`,
            level: "info",
            area: "Stock",
            title: `Move ${p.description} from Georgia to Brentwood`,
            detail: `Brentwood has ${p.transfer.brentwoodDaysLeft} days of stock`,
            value: "Transfer",
            to: "/projection",
            action: "View →",
          });
        for (const ps of p.pastDuePlanned)
          items.push({
            key: `ps-${ps.id}`,
            level: "warning",
            area: "Stock",
            title: `Planned sale past due · ${p.description}`,
            detail: `${ps.reference} · expected ${formatDate(ps.expectedDate)} — confirm, delay or mark fulfilled`,
            value: `${int(ps.qty)} units`,
            to: "/projection",
            action: "Review →",
          });
      }
      for (const t of plan.tubes.filter((x) => x.status === "Open Tube PO"))
        items.push({
          key: `tube-${t.tubeSku}`,
          level: "warning",
          area: "Stock",
          title: `Order empty tubes · ${t.description}`,
          detail: `Open by ${formatDate(t.tubeOpenBy)}`,
          value: `${int(t.recommendedQty)} tubes`,
          to: "/projection",
          action: "Open PO →",
        });
    }
    if (can("stock-count")) {
      const masterUnits = (sku: string) => data.skus.find((s) => s.sku === sku)?.unitsPerBox ?? 0;
      for (const sheet of data.stockCounts.filter((s) => s.status === "Sent to Finance")) {
        const review = sheetVariances(sheet, unitCost, masterUnits).filter((l) => l.needsReview);
        if (review.length)
          items.push({
            key: `count-${sheet.id}`,
            level: "warning",
            area: "Stock",
            title: `Stock count differences · ${sheet.location}`,
            detail: `${review.length} SKUs counted differently from ShipStation — check and adjust`,
            value: usd(Math.abs(review.reduce((a, l) => a + (l.valueImpact ?? 0), 0))),
            to: "/stock-count",
            action: "Review count →",
          });
      }
    }
    if (can("outflows")) {
      const s = reconSummary(
        reconcileOutflows(data.stockOutflows, records, data.outflowResolutions, unitCost),
      );
      if (s.openItems)
        items.push({
          key: "outflows",
          level: s.unexplainedValue > 1000 ? "critical" : "warning",
          area: "Stock",
          title: `${s.openItems} stock movements not explained`,
          detail: `${int(s.unexplainedUnits)} units left the warehouse without a matching order`,
          value: usd(s.unexplainedValue),
          to: "/stock-outflows",
          action: "Investigate →",
        });
    }
    if (can("cogs") && role !== "CEO") {
      const pending = batches.filter((b) => b.status === "Tentative");
      if (pending.length)
        items.push({
          key: "cogs",
          level: "info",
          area: "Stock",
          title: `${pending.length} product costs waiting to be finalised`,
          detail: pending.map((b) => b.sku).join(", "),
          value: `${pending.length}`,
          to: "/cogs",
          action: "Finalise →",
        });
    }

    // Sales & marketing
    if (can("marketing")) {
      for (const a of data.campaigns.map((c) => analyzeCampaign(c, unitCost)))
        if (a.verdict === "Lost money")
          items.push({
            key: `camp-${a.campaign.id}`,
            level: "warning",
            area: "Sales & Marketing",
            title: `Campaign lost money · ${a.campaign.name}`,
            detail: `${a.campaign.channel} · cost ${usd(a.totalCost)} · ROAS ${a.roas.toFixed(2)}`,
            value: usd(a.incrementalProfit),
            to: "/marketing",
            action: "See why →",
          });
    }

    // Profit (company health signals not already covered above)
    if (can("health")) {
      for (const s of health.signals)
        if (s.severity === "critical" && s.area !== "Cash" && s.area !== "Collections")
          items.push({
            key: `h-${s.id}`,
            level: "critical",
            area: "Profit",
            title: s.title,
            detail: s.suggestion ?? s.detail,
            value: s.monthlySaving > 0 ? `${usd(s.monthlySaving)}/mo` : s.area,
            to: "/health",
            action: "Details →",
          });
    }

    // Team
    if (access(role, "kpis") === "edit" && ROLE_PERSON[role]) {
      const team = data.employees.filter(
        (e) => e.managerId === ROLE_PERSON[role] && e.kind === "Employee",
      );
      const missing = team.filter(
        (e) =>
          !data.kpiReviews.some(
            (r) => r.employeeId === e.id && r.month === "2026-10" && r.status === "Submitted",
          ),
      );
      if (missing.length)
        items.push({
          key: "kpi-reviews",
          level: "info",
          area: "Team",
          title: `${missing.length} KPI reviews to submit for October`,
          detail: missing.map((e) => e.name).join(", "),
          value: `${team.length - missing.length}/${team.length} done`,
          to: "/kpis",
          action: "Review →",
        });
    }

    // View-only roles get a plain "View" link instead of an action they can't take.
    const canEdit = (to: string) => {
      const m = MODULES.find((x) => x.path === to);
      return m ? access(role, m.id) === "edit" : false;
    };
    return items
      .map((i) => (canEdit(i.to) ? i : { ...i, action: "View →" }))
      .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  }, [
    role,
    data,
    asOf,
    plan,
    batches,
    unitCost,
    payments.all,
    cash.months,
    arInvoices,
    records,
    health,
  ]);
}

const AREAS: Area[] = ["Money", "Stock", "Sales & Marketing", "Profit", "Team"];
const SHOW = 8;

function NeedsAttention() {
  const items = useAttentionItems();
  const [area, setArea] = useState<Area | "All">("All");
  const [all, setAll] = useState(false);
  const areas = AREAS.filter((a) => items.some((i) => i.area === a));
  const filtered = items.filter((i) => area === "All" || i.area === area);
  const shown = all ? filtered : filtered.slice(0, SHOW);
  const urgent = items.filter((i) => i.level === "critical").length;

  return (
    <div className="card priority-card">
      <div className="section-title">
        <div>
          <span className="section-kicker">
            {items.length} ITEMS · {urgent} URGENT
          </span>
          <h3>Needs attention</h3>
        </div>
      </div>
      {areas.length > 1 ? (
        <div className="attention-filters" role="tablist">
          {(["All", ...areas] as const).map((a) => (
            <button
              key={a}
              type="button"
              className={area === a ? "active" : ""}
              onClick={() => {
                setArea(a);
                setAll(false);
              }}
            >
              {a} {a === "All" ? items.length : items.filter((i) => i.area === a).length}
            </button>
          ))}
        </div>
      ) : null}
      <div className="priority-list">
        {shown.length === 0 ? <div className="empty">Nothing needs action today.</div> : null}
        {shown.map((a) => (
          <div key={a.key} className={`priority-item ${LEVEL_CLASS[a.level]}`}>
            <div className="priority-mark">{LEVEL_BADGE[a.level]}</div>
            <div className="priority-copy">
              <div className="priority-title">
                <span className="area-tag">{a.area}</span>
                {a.title}
              </div>
              <div className="priority-sub">{a.detail}</div>
            </div>
            <div className="priority-action">
              <strong>{a.value}</strong>
              <Link className="row-link" to={a.to}>
                {a.action}
              </Link>
            </div>
          </div>
        ))}
      </div>
      {filtered.length > SHOW ? (
        <button
          className="btn"
          type="button"
          style={{ marginTop: 12, width: "100%" }}
          onClick={() => setAll((x) => !x)}
        >
          {all ? "Show fewer" : `Show all ${filtered.length}`}
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- side panel

function SidePanel() {
  const { role, data } = useStore();
  const can = (m: ModuleId) => access(role, m) !== null;
  const payments = usePayments();
  const plan = usePlanning();
  const upcoming = payments.all.filter((p) => p.status !== "Paid" && p.dueDate).slice(0, 6);
  const openPOs = data.purchaseOrders.filter((p) => p.status === "Open");
  const healthy = plan.finishedGoods.filter((p) => p.poStatus === "No PO Required").length;
  const reorder = plan.finishedGoods.filter(
    (p) => p.poStatus === "PO Now" || p.poStatus === "Additional PO Required",
  ).length;

  if (!can("payments") && !can("projection")) return null;
  return (
    <div className="dashboard-side">
      {can("payments") ? (
        <div className="card pulse-card">
          <div className="section-title">
            <div>
              <span className="section-kicker">COMING UP</span>
              <h3>Next payments</h3>
            </div>
            <Link className="text-link" to="/payments">
              All →
            </Link>
          </div>
          {upcoming.map((p) => (
            <div key={p.id} className="pulse-row">
              <span>
                {p.vendor}
                <br />
                <small className="muted">{formatDate(p.dueDate)}</small>
              </span>
              <strong>{usd(p.amount)}</strong>
            </div>
          ))}
        </div>
      ) : null}
      {can("projection") ? (
        <div className="card pulse-card">
          <div className="section-title">
            <div>
              <span className="section-kicker">{sectionOf("projection")?.label.toUpperCase()}</span>
              <h3>Stock at a glance</h3>
            </div>
            <Link className="text-link" to="/projection">
              Open →
            </Link>
          </div>
          <div className="pulse-row">
            <span>Products healthy</span>
            <div>
              <strong>{healthy}</strong>
              <span className="trend good">ok</span>
            </div>
          </div>
          <div className="pulse-row">
            <span>Products to reorder</span>
            <div>
              <strong>{reorder}</strong>
              <span className="trend watch">action</span>
            </div>
          </div>
          <div className="pulse-row">
            <span>Open purchase orders</span>
            <div>
              <strong>{openPOs.length}</strong>
              <span className="trend neutral">POs</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
