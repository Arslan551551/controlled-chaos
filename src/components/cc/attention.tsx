// "Needs attention" items from every area, filtered to what the role can open.
// Used by Home; each item links to the tab where it is handled.

import { useMemo, type ReactNode } from "react";

import { access, MODULES, ROLE_PERSON, type ModuleId } from "@/lib/access";
import {
  useArInvoices,
  useCashFlow,
  useHealth,
  useOutflowRecords,
  usePayments,
} from "@/lib/derived";
import { daysOverdue, openUsd } from "@/lib/engine/ar";
import { analyzeCampaign } from "@/lib/engine/campaigns";
import { addDays, formatDate } from "@/lib/engine/dates";
import { sheetVariances } from "@/lib/engine/operations";
import { reconcileOutflows, reconSummary } from "@/lib/engine/outflows";
import { int, monthLabel, usd, usdK } from "@/lib/format";
import { HEALTH_TARGETS } from "@/lib/sample/finance";
import { useCosting, usePlanning, useStore } from "@/lib/store";

export const SOON_DAYS = 14;

export type Area = "Money" | "Stock" | "Sales & Marketing" | "Profit" | "Team";
export type Level = "critical" | "warning" | "info";

export interface Item {
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

export function useAttentionItems(): Item[] {
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
        const lines = sheetVariances(sheet, unitCost, masterUnits);
        const desc = (sku: string) => data.skus.find((x) => x.sku === sku)?.description ?? sku;
        // A units-per-box that doesn't match the SKU master is a keying error: recount, don't value it.
        for (const l of lines.filter((x) => x.anomaly))
          items.push({
            key: `count-${sheet.id}-${l.sku}`,
            level: "warning",
            area: "Stock",
            title: `Recount ${desc(l.sku)} · ${sheet.location}`,
            detail: `Units per box entered as ${int(l.unitsPerBox)}, SKU master says ${int(masterUnits(l.sku))} — likely a typing error`,
            value: "Recount",
            to: "/stock-count",
            action: "Review count →",
          });
        const review = lines.filter((l) => l.needsReview && !l.anomaly);
        if (review.length)
          items.push({
            key: `count-${sheet.id}`,
            level: "warning",
            area: "Stock",
            title: `Stock count differences · ${sheet.location}`,
            detail: `${review.length} SKU${review.length === 1 ? "" : "s"} counted differently from ShipStation — check and adjust`,
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
