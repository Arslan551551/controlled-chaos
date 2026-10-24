import { useMemo, useState } from "react";

import { ModuleGate, ModuleHead, Section, Source } from "@/components/cc/ui";
import { ReportBuilder } from "@/components/pages/ReportBuilder";
import { addDays, monthKey } from "@/lib/engine/dates";
import { consignmentPosition } from "@/lib/engine/distributors";
import { monthlyCost } from "@/lib/engine/operations";
import { calculateCommission, reviewScore } from "@/lib/engine/people";
import { SALES_MONTHS, useDistributors, usePayments, useProfitability, useSalesCash } from "@/lib/derived";
import { formatDate, int, monthLabel, pct, usd } from "@/lib/format";
import { useCosting, useStore } from "@/lib/store";

type Fmt = "text" | "usd" | "int" | "pct" | "ratio" | "date" | "month";
type Cell = string | number | null;

interface Column {
  key: string;
  label: string;
  fmt?: Fmt;
}

interface Report {
  id: string;
  group: "Sales" | "Marketing" | "Finance" | "Inventory" | "People";
  title: string;
  description: string;
  columns: Column[];
  rows: Record<string, Cell>[];
  total?: Record<string, Cell>;
  note?: string;
}

const GROUPS: Report["group"][] = ["Sales", "Marketing", "Finance", "Inventory", "People"];
const FULL_MONTHS = SALES_MONTHS.filter((m) => m !== "2026-10");

function fmtCell(v: Cell, fmt: Fmt = "text"): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string") {
    if (fmt === "date") return formatDate(v);
    if (fmt === "month") return monthLabel(v);
    return v;
  }
  switch (fmt) {
    case "usd":
      return usd(v);
    case "int":
      return int(v);
    case "pct":
      return pct(v);
    case "ratio":
      return v.toFixed(2);
    default:
      return String(v);
  }
}

function isNum(fmt: Fmt | undefined) {
  return fmt === "usd" || fmt === "int" || fmt === "pct" || fmt === "ratio";
}

function csvEscape(v: Cell): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(r: Report) {
  if (typeof window === "undefined") return;
  const lines = [r.columns.map((c) => csvEscape(c.label)).join(",")];
  for (const row of r.rows) lines.push(r.columns.map((c) => csvEscape(row[c.key] ?? null)).join(","));
  if (r.total) lines.push(r.columns.map((c) => csvEscape(r.total?.[c.key] ?? null)).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${r.id}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sumKey(rows: Record<string, Cell>[], key: string): number {
  return rows.reduce((a, r) => a + (typeof r[key] === "number" ? (r[key] as number) : 0), 0);
}

export function ReportsPage() {
  return (
    <ModuleGate id="reports">
      <ReportsContent />
    </ModuleGate>
  );
}

function ReportsContent() {
  const { data, asOf } = useStore();
  const salesCash = useSalesCash(SALES_MONTHS);
  const profit = useProfitability(FULL_MONTHS);
  const payments = usePayments();
  const distributors = useDistributors();
  const costing = useCosting();

  const reports = useMemo<Report[]>(() => {
    const list: Report[] = [];

    // ---- Sales by channel by month
    {
      const channels = [...new Set(data.channelSales.map((s) => s.channel))];
      const rows = channels.map((ch) => {
        const row: Record<string, Cell> = { channel: ch };
        let total = 0;
        for (const m of SALES_MONTHS) {
          const v = data.channelSales.filter((s) => s.channel === ch && s.month === m).reduce((a, s) => a + s.grossSales, 0);
          row[m] = v;
          total += v;
        }
        row["total"] = total;
        return row;
      });
      const total: Record<string, Cell> = { channel: "Total" };
      for (const m of [...SALES_MONTHS, "total"]) total[m] = sumKey(rows, m);
      list.push({
        id: "sales-by-channel",
        group: "Sales",
        title: "Sales by channel by month",
        description: "Gross sales per marketplace, salons and distributors",
        columns: [{ key: "channel", label: "Channel" }, ...SALES_MONTHS.map((m) => ({ key: m, label: monthLabel(m), fmt: "usd" as const })), { key: "total", label: "Total", fmt: "usd" }],
        rows,
        total,
        note: "October is month-to-date.",
      });
    }

    // ---- Sales vs cash received
    {
      const rows = salesCash.map((r) => ({ channel: r.channel, gross: r.grossSales, expected: r.expectedNet, received: r.received, outstanding: r.outstanding, collected: r.collectedPct }));
      const exp = sumKey(rows, "expected");
      const rec = sumKey(rows, "received");
      list.push({
        id: "sales-vs-cash",
        group: "Sales",
        title: "Sales vs cash received",
        description: "What each channel sold vs what landed in the bank",
        columns: [
          { key: "channel", label: "Channel" },
          { key: "gross", label: "Gross sales", fmt: "usd" },
          { key: "expected", label: "Expected net payout", fmt: "usd" },
          { key: "received", label: "Cash received", fmt: "usd" },
          { key: "outstanding", label: "Not yet received", fmt: "usd" },
          { key: "collected", label: "Collected", fmt: "pct" },
        ],
        rows,
        total: { channel: "Total", gross: sumKey(rows, "gross"), expected: exp, received: rec, outstanding: sumKey(rows, "outstanding"), collected: exp > 0 ? rec / exp : 0 },
        note: `${monthLabel(SALES_MONTHS[0] ?? "")} – ${monthLabel(SALES_MONTHS[SALES_MONTHS.length - 1] ?? "")}. Cash from QuickBooks bank deposits matched to settlement month.`,
      });
    }

    // ---- Salon commission by rep by month
    {
      const lines = calculateCommission(data.salonOrders, data.commissionPlans);
      const keys = new Map<string, Record<string, Cell>>();
      for (const l of lines) {
        if (l.order.status === "Rejected") continue;
        const m = monthKey(l.order.date);
        const k = `${l.order.repId}|${m}`;
        const rep = data.salesReps.find((r) => r.id === l.order.repId)?.name ?? l.order.repId;
        const row = keys.get(k) ?? { rep, month: m, orders: 0, sales: 0, commission: 0, pending: 0 };
        row["orders"] = (row["orders"] as number) + 1;
        row["sales"] = (row["sales"] as number) + l.order.netAmount;
        row["commission"] = (row["commission"] as number) + l.commission;
        if (l.order.status === "Pending Review") row["pending"] = (row["pending"] as number) + 1;
        keys.set(k, row);
      }
      const rows = [...keys.values()].sort((a, b) => String(a["rep"]).localeCompare(String(b["rep"])) || String(a["month"]).localeCompare(String(b["month"])));
      list.push({
        id: "salon-commission",
        group: "Sales",
        title: "Salon commission by rep",
        description: "Salon Direct orders and commission per rep per month",
        columns: [
          { key: "rep", label: "Rep" },
          { key: "month", label: "Month", fmt: "month" },
          { key: "orders", label: "Orders", fmt: "int" },
          { key: "sales", label: "Net sales", fmt: "usd" },
          { key: "commission", label: "Commission", fmt: "usd" },
          { key: "pending", label: "Pending review", fmt: "int" },
        ],
        rows,
        total: { rep: "Total", month: "", orders: sumKey(rows, "orders"), sales: sumKey(rows, "sales"), commission: sumKey(rows, "commission"), pending: sumKey(rows, "pending") },
        note: "Pending-review orders are included at their expected commission until approved.",
      });
    }

    // ---- Marketing performance by platform by month
    {
      const rows = [...data.adMetrics]
        .sort((a, b) => a.platform.localeCompare(b.platform) || a.month.localeCompare(b.month))
        .map((m) => ({
          platform: m.platform,
          month: m.month,
          spend: m.spend,
          adSales: m.adSales,
          roas: m.spend > 0 ? m.adSales / m.spend : 0,
          clicks: m.clicks,
          orders: m.orders,
          cpc: m.clicks > 0 ? m.spend / m.clicks : 0,
        }));
      const spend = sumKey(rows, "spend");
      const adSales = sumKey(rows, "adSales");
      const clicks = sumKey(rows, "clicks");
      list.push({
        id: "marketing-performance",
        group: "Marketing",
        title: "Marketing performance by platform",
        description: "Spend, ad sales and ROAS per platform per month",
        columns: [
          { key: "platform", label: "Platform" },
          { key: "month", label: "Month", fmt: "month" },
          { key: "spend", label: "Spend", fmt: "usd" },
          { key: "adSales", label: "Ad sales", fmt: "usd" },
          { key: "roas", label: "ROAS", fmt: "ratio" },
          { key: "clicks", label: "Clicks", fmt: "int" },
          { key: "orders", label: "Orders", fmt: "int" },
          { key: "cpc", label: "CPC", fmt: "ratio" },
        ],
        rows,
        total: { platform: "Total", month: "", spend, adSales, roas: spend > 0 ? adSales / spend : 0, clicks, orders: sumKey(rows, "orders"), cpc: clicks > 0 ? spend / clicks : 0 },
      });
    }

    // ---- Channel P&L
    {
      const rows = profit.rows.map((r) => ({
        channel: r.channel,
        revenue: r.revenue,
        refunds: r.refunds,
        fees: r.platformFees,
        cogs: r.cogs,
        gross: r.grossProfit,
        fulfillment: r.fulfillment,
        ads: r.adSpend,
        overhead: r.allocatedExpenses,
        net: r.netProfit,
        margin: r.netMarginPct,
      }));
      const netRev = profit.rows.reduce((a, r) => a + r.netRevenue, 0);
      const net = sumKey(rows, "net");
      list.push({
        id: "channel-pnl",
        group: "Finance",
        title: "Channel P&L",
        description: "Profit by marketplace after fees, COGS, ads and allocated expenses",
        columns: [
          { key: "channel", label: "Channel" },
          { key: "revenue", label: "Revenue", fmt: "usd" },
          { key: "refunds", label: "Refunds", fmt: "usd" },
          { key: "fees", label: "Platform fees", fmt: "usd" },
          { key: "cogs", label: "COGS", fmt: "usd" },
          { key: "gross", label: "Gross profit", fmt: "usd" },
          { key: "fulfillment", label: "Fulfillment", fmt: "usd" },
          { key: "ads", label: "Ad spend", fmt: "usd" },
          { key: "overhead", label: "Allocated expenses", fmt: "usd" },
          { key: "net", label: "Net profit", fmt: "usd" },
          { key: "margin", label: "Net margin", fmt: "pct" },
        ],
        rows,
        total: {
          channel: "Total",
          revenue: sumKey(rows, "revenue"),
          refunds: sumKey(rows, "refunds"),
          fees: sumKey(rows, "fees"),
          cogs: sumKey(rows, "cogs"),
          gross: sumKey(rows, "gross"),
          fulfillment: sumKey(rows, "fulfillment"),
          ads: sumKey(rows, "ads"),
          overhead: sumKey(rows, "overhead"),
          net,
          margin: netRev > 0 ? net / netRev : 0,
        },
        note: `${monthLabel(FULL_MONTHS[0] ?? "")} – ${monthLabel(FULL_MONTHS[FULL_MONTHS.length - 1] ?? "")}. ${profit.unallocated.length} expense${profit.unallocated.length === 1 ? "" : "s"} not yet split by channel are excluded.`,
      });
    }

    // ---- Open POs & upcoming payments
    {
      const rows = payments.all
        .filter((p) => p.status !== "Paid")
        .map((p) => ({ due: p.dueDate, vendor: p.vendor, reference: p.reference, type: p.source, category: p.category, status: p.status, amount: p.amount }));
      list.push({
        id: "upcoming-payments",
        group: "Finance",
        title: "Open POs & upcoming payments",
        description: "Every unpaid PO installment and Non-PO payment",
        columns: [
          { key: "due", label: "Due", fmt: "date" },
          { key: "vendor", label: "Vendor" },
          { key: "reference", label: "Reference" },
          { key: "type", label: "Type" },
          { key: "category", label: "Category" },
          { key: "status", label: "Status" },
          { key: "amount", label: "Amount", fmt: "usd" },
        ],
        rows,
        total: { due: "Total", vendor: "", reference: "", type: "", category: "", status: "", amount: sumKey(rows, "amount") },
        note: "Payments with no date yet (TBD) show a dash in the Due column.",
      });
    }

    // ---- Distributor balances
    {
      const rows = distributors.map((d) => ({
        distributor: d.distributor.name,
        model: d.distributor.model,
        invoiced: d.invoicedYtd,
        paid: d.paidYtd,
        openAR: d.openAR,
        overdue: d.overdue,
        fund: d.marketingFundBalance,
        credit: d.productCreditBalance,
        net: d.netPosition,
      }));
      list.push({
        id: "distributor-balances",
        group: "Finance",
        title: "Distributor balances",
        description: "Open AR, marketing fund and product credit per distributor",
        columns: [
          { key: "distributor", label: "Distributor" },
          { key: "model", label: "Model" },
          { key: "invoiced", label: "Invoiced YTD", fmt: "usd" },
          { key: "paid", label: "Settled YTD", fmt: "usd" },
          { key: "openAR", label: "Open AR", fmt: "usd" },
          { key: "overdue", label: "Overdue", fmt: "usd" },
          { key: "fund", label: "Marketing fund owed", fmt: "usd" },
          { key: "credit", label: "Product credit owed", fmt: "usd" },
          { key: "net", label: "Net position", fmt: "usd" },
        ],
        rows,
        total: {
          distributor: "Total",
          model: "",
          invoiced: sumKey(rows, "invoiced"),
          paid: sumKey(rows, "paid"),
          openAR: sumKey(rows, "openAR"),
          overdue: sumKey(rows, "overdue"),
          fund: sumKey(rows, "fund"),
          credit: sumKey(rows, "credit"),
          net: sumKey(rows, "net"),
        },
        note: "Net position = open AR minus marketing fund and product credit owed to the distributor.",
      });
    }

    // ---- Subscription spend by department
    {
      const active = data.subscriptions.filter((s) => s.status !== "Cancelled");
      const depts = [...new Set(active.map((s) => s.department))].sort();
      const rows = depts.map((d) => {
        const subs = active.filter((s) => s.department === d);
        const monthly = subs.reduce((a, s) => a + monthlyCost(s), 0);
        return { department: d, tools: subs.length, list: subs.map((s) => s.tool).join(", "), monthly, annual: monthly * 12 };
      });
      list.push({
        id: "subscription-spend",
        group: "Finance",
        title: "Subscription spend by department",
        description: "Tools and subscriptions each department pays for",
        columns: [
          { key: "department", label: "Department" },
          { key: "tools", label: "Tools", fmt: "int" },
          { key: "list", label: "Tool list" },
          { key: "monthly", label: "Monthly", fmt: "usd" },
          { key: "annual", label: "Annual", fmt: "usd" },
        ],
        rows,
        total: { department: "Total", tools: sumKey(rows, "tools"), list: "", monthly: sumKey(rows, "monthly"), annual: sumKey(rows, "annual") },
        note: "Annual plans shown as monthly equivalent. Includes cancel-requested tools until they end.",
      });
    }

    // ---- Top SKUs by units, last 30 days
    {
      const from = addDays(asOf, -30);
      const recent = data.actualSales.filter((s) => s.date > from && s.date <= asOf);
      const skus = [...new Set(recent.map((s) => s.sku))];
      const rows = skus
        .map((sku) => {
          const mine = recent.filter((s) => s.sku === sku);
          const units = mine.reduce((a, s) => a + s.qty, 0);
          const byChannel = new Map<string, number>();
          for (const s of mine) byChannel.set(s.channel, (byChannel.get(s.channel) ?? 0) + s.qty);
          const top = [...byChannel.entries()].sort((a, b) => b[1] - a[1])[0];
          return {
            sku,
            product: data.skus.find((x) => x.sku === sku)?.description ?? sku,
            units,
            perDay: Math.round((units / 30) * 10) / 10,
            topChannel: top ? `${top[0]} (${pct(units > 0 ? top[1] / units : 0, 0)})` : "—",
          };
        })
        .sort((a, b) => b.units - a.units);
      list.push({
        id: "top-skus",
        group: "Inventory",
        title: "Top SKUs by units (last 30 days)",
        description: "Fulfilled units across all channels",
        columns: [
          { key: "sku", label: "SKU" },
          { key: "product", label: "Product" },
          { key: "units", label: "Units", fmt: "int" },
          { key: "perDay", label: "Per day", fmt: "int" },
          { key: "topChannel", label: "Top channel" },
        ],
        rows,
        total: { sku: "Total", product: "", units: sumKey(rows, "units"), perDay: sumKey(rows, "perDay"), topChannel: "" },
      });
    }

    // ---- Inventory valuation
    {
      const rows: Record<string, Cell>[] = [];
      const fgSkus = data.skus.filter((s) => s.type !== "Empty Tube");
      for (const s of fgSkus) {
        const qty = data.finishedGoodsStock.filter((p) => p.sku === s.sku).reduce((a, p) => a + p.qty, 0);
        if (qty === 0) continue;
        const cost = costing.unitCost(s.sku);
        rows.push({ category: "Finished goods (Brentwood + Georgia)", sku: s.sku, product: s.description, qty, unitCost: cost, value: Math.round(qty * cost * 100) / 100 });
      }
      for (const p of costing.ledger.positions.values()) {
        if (p.onHand <= 0) continue;
        const desc = data.skus.find((x) => x.sku === p.tubeSku)?.description ?? p.tubeSku;
        rows.push({ category: "Empty tubes", sku: p.tubeSku, product: desc, qty: p.onHand, unitCost: p.weightedUnitCost, value: Math.round(p.inventoryValue * 100) / 100 });
      }
      for (const d of data.distributors.filter((x) => x.model === "Consignment")) {
        for (const c of consignmentPosition(data.consignmentMovements, d.id, costing.unitCost)) {
          if (c.onHandAtDistributor <= 0) continue;
          const desc = data.skus.find((x) => x.sku === c.sku)?.description ?? c.sku;
          rows.push({ category: `Consignment at ${d.name}`, sku: c.sku, product: desc, qty: c.onHandAtDistributor, unitCost: costing.unitCost(c.sku), value: c.stockValueAtCost });
        }
      }
      list.push({
        id: "inventory-valuation",
        group: "Inventory",
        title: "Inventory valuation",
        description: "Stock on hand at current full COGS, including tubes and consignment",
        columns: [
          { key: "category", label: "Where" },
          { key: "sku", label: "SKU" },
          { key: "product", label: "Product" },
          { key: "qty", label: "Qty", fmt: "int" },
          { key: "unitCost", label: "Unit cost", fmt: "ratio" },
          { key: "value", label: "Value", fmt: "usd" },
        ],
        rows,
        total: { category: "Total", sku: "", product: "", qty: sumKey(rows, "qty"), unitCost: null, value: sumKey(rows, "value") },
        note: "Finished goods valued at the latest batch COGS (final if finalized, else tentative). Tubes at moving weighted average.",
      });
    }

    // ---- KPI scores by department
    {
      const submitted = data.kpiReviews.filter((r) => r.status === "Submitted");
      const latest = submitted.map((r) => r.month).sort().at(-1) ?? "";
      const scored = submitted
        .filter((r) => r.month === latest)
        .map((r) => {
          const emp = data.employees.find((e) => e.id === r.employeeId);
          const tpl = data.reviewTemplates.find((t) => t.id === emp?.templateId);
          return { dept: emp?.department ?? "—", name: emp?.name ?? r.employeeId, score: tpl ? reviewScore(r, tpl) : 0 };
        });
      const depts = [...new Set(scored.map((s) => s.dept))].sort();
      const rows = depts.map((d) => {
        const mine = scored.filter((s) => s.dept === d);
        const avg = mine.reduce((a, s) => a + s.score, 0) / Math.max(1, mine.length);
        const low = [...mine].sort((a, b) => a.score - b.score)[0];
        return { department: d, month: latest, reviewed: mine.length, average: Math.round(avg * 10) / 10, lowest: low ? `${low.name} (${low.score})` : "—" };
      });
      list.push({
        id: "kpi-by-department",
        group: "People",
        title: "KPI scores by department",
        description: "Average monthly manager-review score per department",
        columns: [
          { key: "department", label: "Department" },
          { key: "month", label: "Month", fmt: "month" },
          { key: "reviewed", label: "Reviewed", fmt: "int" },
          { key: "average", label: "Average score %", fmt: "int" },
          { key: "lowest", label: "Lowest" },
        ],
        rows,
        note: "100 = meets target (4 out of 5 on every criterion). Draft reviews are excluded.",
      });
    }

    return list;
  }, [data, asOf, salesCash, profit, payments.all, distributors, costing]);

  const [activeId, setActiveId] = useState<string>("sales-vs-cash");
  const active = reports.find((r) => r.id === activeId) ?? reports[0];

  return (
    <section className="screen active" id="screen-reports">
      <ModuleHead title="Reports" subtitle="Report library for the CEO · click a report to open it">
        <Source>Built from the same live data as every screen</Source>
      </ModuleHead>

      <ReportBuilder />

      <div className="section-kicker" style={{ margin: "18px 0 10px" }}>REPORT LIBRARY</div>

      {GROUPS.map((g) => {
        const items = reports.filter((r) => r.group === g);
        if (items.length === 0) return null;
        return (
          <div key={g} style={{ marginBottom: 14 }}>
            <div className="section-kicker" style={{ marginBottom: 8 }}>{g.toUpperCase()}</div>
            <div className="grid-3">
              {items.map((r) => (
                <button key={r.id} type="button" className={`report-card${active?.id === r.id ? " active" : ""}`} onClick={() => setActiveId(r.id)}>
                  <strong>{r.title}</strong>
                  <span>{r.description}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div className="notice">Need another report? Build it above and save it, or tell Claude what the CEO asked and it gets added here as a one-click report.</div>

      {active ? (
        <Section
          title={active.title}
          kicker={active.group.toUpperCase()}
          hint={`${active.rows.length} row${active.rows.length === 1 ? "" : "s"}`}
          actions={
            <button className="btn" type="button" onClick={() => downloadCsv(active)}>
              ⇩ Export CSV
            </button>
          }
        >
          {active.note ? <div className="small" style={{ marginBottom: 10 }}>{active.note}</div> : null}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {active.columns.map((c) => (
                    <th key={c.key} className={isNum(c.fmt) ? "num" : undefined}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {active.rows.length === 0 ? (
                  <tr>
                    <td colSpan={active.columns.length}>
                      <div className="empty">No data for this report yet.</div>
                    </td>
                  </tr>
                ) : (
                  active.rows.map((row, i) => (
                    <tr key={i}>
                      {active.columns.map((c, ci) => (
                        <td key={c.key} className={isNum(c.fmt) ? "num" : undefined}>
                          {ci === 0 ? <strong>{fmtCell(row[c.key] ?? null, c.fmt)}</strong> : fmtCell(row[c.key] ?? null, c.fmt)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
                {active.total ? (
                  <tr className="total-row">
                    {active.columns.map((c) => (
                      <td key={c.key} className={isNum(c.fmt) ? "num" : undefined}>
                        {active.total?.[c.key] === "" ? "" : fmtCell(active.total?.[c.key] ?? null, c.fmt)}
                      </td>
                    ))}
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}
    </section>
  );
}
