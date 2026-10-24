// Dashboard — replica of v16 #screen-dashboard with live numbers, plus a
// role-specific strip for the CEO and the new user types.

import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { access, ROLE_PERSON, type ModuleId } from "@/lib/access";
import { useCashFlow, useDistributors, useHealth, useMarketing, usePayments, useSalesCash, LAST_FULL_MONTH } from "@/lib/derived";
import { formatDate } from "@/lib/engine/dates";
import { sheetProgress } from "@/lib/engine/operations";
import { calculateCommission } from "@/lib/engine/people";
import { remainingQty } from "@/lib/engine/planning";
import { int, money, usd, usdK } from "@/lib/format";
import { useCosting, usePlanning, useStore } from "@/lib/store";

export function DashboardPage() {
  const { role } = useStore();
  const core = access(role, "projection") !== null || access(role, "cogs") !== null;
  return (
    <section className={`screen active${role === "CEO" ? " dashboard-ceo" : ""}`} id="screen-dashboard">
      {role === "CEO" ? <CeoStrip /> : null}
      {core ? <CoreDashboard /> : <WorkspaceDashboard />}
    </section>
  );
}

function KpiCard({ label, value, note, icon, tone, to }: { label: string; value: ReactNode; note: string; icon: string; tone: "red" | "blue" | "indigo" | "green"; to: string }) {
  const navigate = useNavigate();
  return (
    <button className="card kpi kpi-click" type="button" onClick={() => navigate({ to })}>
      <div>
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-note">{note}</div>
      </div>
      <div className={`kpi-icon kpi-${tone}`}>{icon}</div>
    </button>
  );
}

function CoreDashboard() {
  const { role, data } = useStore();
  const plan = usePlanning();
  const { batches } = useCosting();
  const payments = usePayments();
  const isCEO = role === "CEO";

  const poNow = plan.finishedGoods.filter((p) => p.poStatus === "PO Now");
  const additional = plan.finishedGoods.filter((p) => p.poStatus === "Additional PO Required");
  const transfers = plan.finishedGoods.filter((p) => p.transfer.status === "Transfer Required");
  const tubePOs = plan.tubes.filter((t) => t.status === "Open Tube PO");
  const openPOs = data.purchaseOrders.filter((p) => p.status === "Open");
  const pendingCogs = batches.filter((b) => b.status === "Tentative");
  const latestFull = [...batches].filter((b) => b.status === "Finalized").at(-1) ?? batches.at(-1);
  const avgTentative = pendingCogs.length ? pendingCogs.reduce((a, b) => a + b.tentativeFullUnit, 0) / pendingCogs.length : 0;
  const healthy = plan.finishedGoods.filter((p) => p.poStatus === "No PO Required").length;
  const accelerating = plan.finishedGoods.filter((p) => p.salesTrend === "Accelerating").length;
  const openFgQty = openPOs.filter((p) => p.type !== "Empty Tube").reduce((a, p) => a + remainingQty(p), 0);
  const pastDue = plan.finishedGoods.flatMap((p) => p.pastDuePlanned);

  type Alert = { key: string; cls: string; title: string; sub: ReactNode; badge: ReactNode; qty: string; link: string; to: string };
  const alerts: Alert[] = [
    ...poNow.map((p) => ({ key: `po-${p.sku}`, cls: "critical", title: `${p.sku} · ${p.description}`, sub: <><strong>{p.daysOfStockLeft ?? "—"} days of stock left</strong> · burn {int(p.projectionBurn)}/day · {p.reason.split(" · ").slice(1).join(" · ")}</>, badge: <span className="badge b-red">Open PO Now</span>, qty: `${int(p.recommendedQty)} units`, link: "View SKU →", to: "/projection" })),
    ...additional.map((p) => ({ key: `add-${p.sku}`, cls: "warning", title: `${p.sku} · ${p.description}`, sub: <><strong>{p.daysOfStockLeft ?? "—"} days of stock left</strong> · existing inbound PO ({int(p.openPOQty)}) does not restore required cover</>, badge: <span className="badge b-amber">Additional PO</span>, qty: `${int(p.recommendedQty)} units`, link: "View SKU →", to: "/projection" })),
    ...transfers.map((p) => ({ key: `tr-${p.sku}`, cls: "info", title: `${p.sku} · ${p.description}`, sub: <>Brentwood at <strong>{p.transfer.brentwoodDaysLeft} days cover</strong> · stock is available at Georgia</>, badge: <span className="badge b-blue">Transfer Due</span>, qty: "Warehouse decides qty", link: "View Stock →", to: "/projection" })),
    ...tubePOs.map((t) => ({ key: `tube-${t.tubeSku}`, cls: "tube", title: `${t.tubeSku} · ${t.description}`, sub: <>Finished Goods fill needs {int(t.fgRequirement)} tubes · threshold {int(t.thresholdQty)} · open by {formatDate(t.tubeOpenBy)}</>, badge: <span className="badge b-purple">Tube PO</span>, qty: `${int(t.recommendedQty)} tubes`, link: "View Tubes →", to: "/projection" })),
    ...pastDue.map((p) => ({ key: `ps-${p.id}`, cls: "warning", title: `${p.sku} · planned sale past due`, sub: <>{p.reference} · expected {formatDate(p.expectedDate)} · {int(p.qty)} units — confirm, delay or mark fulfilled</>, badge: <span className="badge b-amber">Review</span>, qty: `${int(p.qty)} units`, link: "Review →", to: "/projection" })),
  ];

  const upcoming = payments.all.filter((p) => p.status !== "Paid").slice(0, 5);

  return (
    <>
      <div className="dashboard-intro">
        <div>
          <div className="eyebrow">CONTROLLED CHAOS · OPERATIONS CONTROL</div>
          <h1>Inventory &amp; PO Control</h1>
          <p>One clear view of purchasing pressure, warehouse movement, open commitments and COGS finalization.</p>
        </div>
        <div className="asof-card">
          <span className="asof-label">Projection horizon</span>
          <strong>Next 12 Months</strong>
          <span className="asof-note">14-day confirmed burn · daily threshold checks</span>
        </div>
      </div>

      <div className="grid kpis premium-kpis">
        <KpiCard label="SKUs requiring PO" value={poNow.length + additional.length} note={`${poNow.length} immediate · ${additional.length} additional`} icon="!" tone="red" to="/projection" />
        <KpiCard label="Warehouse transfers due" value={transfers.length} note="Brentwood at / below 60-day cover" icon="⇄" tone="blue" to="/projection" />
        <KpiCard label="Open POs" value={openPOs.length} note="Finished Goods + Empty Tubes" icon="PO" tone="indigo" to="/vendor" />
        {!isCEO ? <KpiCard label="COGS pending finalization" value={pendingCogs.length} note="Finance action required" icon="$" tone="green" to="/cogs" /> : null}
      </div>

      <div className="dashboard-focus">
        <div className="card priority-card">
          <div className="section-title">
            <div>
              <span className="section-kicker">TODAY'S ACTIONS</span>
              <h3>Priority Alerts</h3>
            </div>
            <Link className="text-link" to="/projection">Open Projection →</Link>
          </div>
          <div className="priority-list">
            {alerts.length === 0 ? <div className="empty">Nothing needs action today.</div> : null}
            {alerts.map((a, i) => (
              <div key={a.key} className={`priority-item ${a.cls}`}>
                <div className="priority-mark">{String(i + 1).padStart(2, "0")}</div>
                <div className="priority-copy">
                  <div className="priority-title">{a.title}</div>
                  <div className="priority-sub">{a.sub}</div>
                </div>
                <div className="priority-action">
                  {a.badge}
                  <strong>{a.qty}</strong>
                  <Link className="row-link" to={a.to}>{a.link}</Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-side">
          <div className="card pulse-card">
            <div className="section-title">
              <div>
                <span className="section-kicker">SUMMARY · NOT CLICKABLE</span>
                <h3>Stock Position</h3>
              </div>
            </div>
            <div className="pulse-row"><span>Healthy SKUs</span><div><strong>{healthy}</strong><span className="trend good">healthy</span></div></div>
            <div className="pulse-row"><span>Demand accelerating</span><div><strong>{accelerating}</strong><span className="trend watch">watch</span></div></div>
            <div className="pulse-row"><span>Open FG quantity</span><div><strong>{int(openFgQty)}</strong><span className="trend neutral">units</span></div></div>
            <div className="pulse-row"><span>Tube POs projected</span><div><strong>{tubePOs.length}</strong><span className="trend watch">action</span></div></div>
          </div>

          {!isCEO ? (
            <div className="card cogs-mini-card">
              <div className="section-title">
                <div>
                  <span className="section-kicker">COGS SUMMARY</span>
                  <h3>Current Cost View</h3>
                </div>
                <Link className="text-link" to="/cogs">Open →</Link>
              </div>
              <div className="cost-hero">
                <span>Latest full COGS · {latestFull?.sku ?? "—"}</span>
                <strong>{money(latestFull?.currentFullUnit ?? 0)}</strong>
                <small>Fill + tube cost</small>
              </div>
              <div className="cost-grid">
                <div><span>Avg tentative</span><strong>{money(avgTentative)}</strong></div>
                <div><span>Awaiting finalization</span><strong>{pendingCogs.length}</strong></div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="card payment-card">
        <div className="section-title">
          <div>
            <span className="section-kicker">CASH COMMITMENTS</span>
            <h3>Upcoming Payments</h3>
          </div>
          <Link className="text-link" to="/payments">Open Payment Planner →</Link>
        </div>
        <div className="payment-head"><span>Reference / Vendor</span><span>Installment</span><span>Due</span><span>Amount</span></div>
        {upcoming.map((p) => (
          <div key={p.id} className="payment-row modern">
            <strong>{p.vendor} · {p.description}</strong>
            <span>{p.reference}</span>
            {p.dueDate ? <span>{formatDate(p.dueDate)}</span> : <span className="muted">Date TBD</span>}
            <span className="right">{usd(p.amount)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function CeoStrip() {
  const health = useHealth();
  const cash = useCashFlow();
  const sc = useSalesCash();
  const mkt = useMarketing(LAST_FULL_MONTH);
  const dist = useDistributors();
  const lowest = [...cash.months].sort((a, b) => a.closing - b.closing)[0];
  const outstanding = sc.reduce((a, r) => a + r.outstanding, 0);
  const ar = dist.reduce((a, d) => a + d.openAR, 0);
  return (
    <div className="grid kpis premium-kpis" style={{ marginBottom: 16 }}>
      <KpiCard label="Company health" value={`${health.score}/100`} note={`${health.signals.filter((s) => s.severity === "critical").length} critical · ${health.signals.filter((s) => s.severity === "warning").length} warnings`} icon="♥" tone={health.score >= 80 ? "green" : health.score >= 60 ? "indigo" : "red"} to="/health" />
      <KpiCard label="Cash in bank (QuickBooks)" value={usdK(cash.opening)} note={lowest ? `Lowest month-end ${usdK(lowest.closing)} (${lowest.month})` : ""} icon="≋" tone="blue" to="/cash-flow" />
      <KpiCard label="Sales not yet received" value={usdK(outstanding)} note="Expected payouts still to land, Jul–Oct" icon="⇆" tone="indigo" to="/sales-cash" />
      <KpiCard label="Blended ROAS (Sep)" value={mkt.total.roas.toFixed(2)} note={`Ad spend ${usdK(mkt.total.spend)} · distributor AR ${usdK(ar)}`} icon="◎" tone={mkt.total.roas >= 3 ? "green" : "red"} to="/marketing" />
    </div>
  );
}

function WorkspaceDashboard() {
  const { role, data } = useStore();
  const person = ROLE_PERSON[role];
  const plan = usePlanning();
  const mkt = useMarketing(LAST_FULL_MONTH);

  const tiles: { id: ModuleId; title: string; value: ReactNode; note: ReactNode; to: string }[] = [];
  if (role === "Warehouse") {
    const sheet = data.stockCounts.find((s) => s.status === "In Progress");
    const prog = sheet ? sheetProgress(sheet) : null;
    tiles.push({ id: "stock-count", title: "This month's stock count", value: prog ? `${prog.counted}/${prog.total}` : "Not started", note: sheet ? `${sheet.location} · ${sheet.month}` : "Start the count sheet", to: "/stock-count" });
    const transfers = plan.finishedGoods.filter((p) => p.transfer.status === "Transfer Required");
    tiles.push({ id: "projection", title: "Transfers Georgia → Brentwood", value: transfers.length, note: transfers.map((t) => t.sku).join(", ") || "None due", to: "/projection" });
    const inbound = data.purchaseOrders.filter((p) => p.status === "Open" && p.eta && p.eta <= "2026-11-30");
    tiles.push({ id: "projection", title: "Inbound POs next 5 weeks", value: inbound.length, note: inbound.map((p) => `${p.po} ${formatDate(p.eta)}`).join(" · ") || "None", to: "/projection" });
  }
  if (role === "Marketing Manager" || role === "Consultant") {
    tiles.push({ id: "marketing", title: "Blended ROAS (Sep)", value: mkt.total.roas.toFixed(2), note: `Spend ${usd(mkt.total.spend)} · TACoS ${(mkt.total.tacos * 100).toFixed(1)}%`, to: "/marketing" });
    const worst = [...mkt.byPlatform].filter((p) => p.spend > 0).sort((a, b) => a.roas - b.roas)[0];
    if (worst) tiles.push({ id: "marketing", title: "Weakest platform", value: worst.key, note: `ROAS ${worst.roas.toFixed(2)}`, to: "/marketing" });
    if (role === "Marketing Manager") {
      const team = data.employees.filter((e) => e.managerId === person && e.kind === "Employee");
      const done = team.filter((e) => data.kpiReviews.some((r) => r.employeeId === e.id && r.month === "2026-10" && r.status === "Submitted")).length;
      tiles.push({ id: "kpis", title: "Team KPI reviews · Oct", value: `${done}/${team.length}`, note: "Submitted by you this month", to: "/kpis" });
    } else {
      tiles.push({ id: "kpis", title: "My KPI", value: "View", note: "ROAS and TACoS vs target", to: "/kpis" });
    }
  }
  if (role === "Salon Sales Rep") {
    const lines = calculateCommission(data.salonOrders, data.commissionPlans).filter((l) => l.order.repId === person);
    const month = lines.filter((l) => l.order.date.startsWith("2026-10"));
    tiles.push({ id: "salons", title: "My commission · Oct", value: money(month.reduce((a, l) => a + l.commission, 0)), note: `${month.length} orders`, to: "/salons" });
    tiles.push({ id: "salons", title: "Pending review", value: lines.filter((l) => l.order.status === "Pending Review").length, note: "Orders waiting for Finance", to: "/salons" });
    tiles.push({ id: "salons", title: "Shopify orders to tag", value: data.untaggedShopifyOrders.length, note: "Tag to your salons", to: "/salons" });
  }

  return (
    <>
      <div className="dashboard-intro">
        <div>
          <div className="eyebrow">CONTROLLED CHAOS</div>
          <h1>Your workspace</h1>
          <p>What needs your attention today as {role}.</p>
        </div>
      </div>
      <div className="grid kpis premium-kpis">
        {tiles.map((t, i) => (
          <Link key={`${t.id}-${i}`} to={t.to} className="card kpi kpi-click" style={{ textAlign: "left" }}>
            <div>
              <div className="kpi-label">{t.title}</div>
              <div className="kpi-value" style={{ fontSize: typeof t.value === "string" && t.value.length > 8 ? 22 : undefined }}>{t.value}</div>
              <div className="kpi-note">{t.note}</div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
