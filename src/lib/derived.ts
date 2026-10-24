// Derived business views shared by several screens (dashboard, CEO pages, finance).

import { useMemo } from "react";

import { addMonths, endOfMonth, monthKeys } from "./engine/dates";
import { distributorPositions } from "./engine/distributors";
import {
  cashFlowOutlook,
  paymentPlanByMonth,
  plannedPayments,
  profitability,
  salesVsCash,
  type CashForecastLine,
} from "./engine/finance";
import { healthScore, healthSignals } from "./engine/health";
import { AD_PLATFORMS, summarize } from "./engine/marketing";
import { detectSubscriptions, monthlyCost } from "./engine/operations";
import { SALES_MONTHS, HEALTH_TARGETS } from "./sample/finance";
import { usePlanning, useStore } from "./store";

export function usePayments() {
  const { data, asOf } = useStore();
  return useMemo(() => {
    const all = plannedPayments(data.purchaseOrders, data.nonPOPayments, data.vendors);
    return { all, ...paymentPlanByMonth(all, asOf, 3) };
  }, [data.purchaseOrders, data.nonPOPayments, data.vendors, asOf]);
}

export function useCashFlow() {
  const { data, asOf } = useStore();
  const payments = usePayments();
  return useMemo(() => {
    const lines: CashForecastLine[] = [];
    // Payment planner (PO installments + Non-PO), unpaid with a date
    for (const p of payments.all) {
      if (p.status === "Paid" || !p.dueDate) continue;
      lines.push({
        id: `pp-${p.id}`,
        date: p.dueDate < asOf ? asOf : p.dueDate,
        direction: "out",
        category: p.source === "PO Installment" ? "PO Payment" : "Non-PO Payment",
        description: `${p.vendor} · ${p.reference}`,
        amount: p.amount,
        source: "Payment Planner",
      });
    }
    // Subscriptions (monthly cost on renewal day)
    const horizonEnd = endOfMonth(addMonths(asOf, 2));
    for (const s of data.subscriptions.filter((x) => x.status === "Active")) {
      if (s.billingCycle === "Annual") {
        if (s.nextRenewal >= asOf && s.nextRenewal <= horizonEnd)
          lines.push({ id: `sub-${s.id}`, date: s.nextRenewal, direction: "out", category: "Subscription", description: s.tool, amount: s.cost, source: "Subscriptions" });
        continue;
      }
      for (let i = 0; i < 3; i++) {
        const d = addMonths(s.nextRenewal, i);
        if (d >= asOf && d <= horizonEnd)
          lines.push({ id: `sub-${s.id}-${i}`, date: d, direction: "out", category: "Subscription", description: s.tool, amount: monthlyCost(s), source: "Subscriptions" });
      }
    }
    // Manual lines: payroll, loans, tax
    data.manualCashLines.forEach((m, i) =>
      lines.push({ id: `m-${i}`, ...m, source: m.category.startsWith("Loan") ? "Loan Schedule" : "Manual" }),
    );
    // Expected receipts by channel
    for (const r of data.expectedReceipts) {
      const per = r.amount / r.days.length;
      r.days.forEach((day, i) => {
        const date = `${r.month}-${String(day).padStart(2, "0")}`;
        if (date < asOf) return;
        lines.push({
          id: `rc-${r.channel}-${r.month}-${i}`,
          date,
          direction: "in",
          category: r.channel === "Salon Direct" || r.channel === "Distributor" ? "Salon / Distributor Receipt" : "Marketplace Payout",
          description: `${r.channel} ${r.channel === "Salon Direct" || r.channel === "Distributor" ? "receipts (QuickBooks AR)" : "payout"}`,
          amount: Math.round(per),
          source: r.channel === "Salon Direct" || r.channel === "Distributor" ? "QuickBooks AR" : "Payout Forecast",
        });
      });
    }
    const months = cashFlowOutlook(data.bankAccounts, lines, asOf, 3);
    return { months, lines, opening: data.bankAccounts.reduce((a, b) => a + b.balance, 0) };
  }, [data, asOf, payments.all]);
}

export function useSalesCash(months: string[] = SALES_MONTHS) {
  const { data } = useStore();
  return useMemo(() => salesVsCash(data.channelSales, data.cashReceipts, months), [data.channelSales, data.cashReceipts, months]);
}

export function useProfitability(months: string[]) {
  const { data } = useStore();
  return useMemo(() => profitability(data.channelSales, data.channelCosts, data.expenses, months), [data.channelSales, data.channelCosts, data.expenses, months]);
}

export function useMarketing(months: string[]) {
  const { data } = useStore();
  return useMemo(() => {
    const rows = data.adMetrics.filter((m) => months.includes(m.month));
    const channelTotal = (ch: string) =>
      data.channelSales.filter((s) => s.channel === ch && months.includes(s.month)).reduce((a, s) => a + s.grossSales, 0);
    const byPlatform = AD_PLATFORMS.map((p) => {
      const r = rows.filter((x) => x.platform === p);
      const channels = [...new Set(r.map((x) => x.channel))];
      return summarize(p, r, channels.reduce((a, c) => a + channelTotal(c), 0));
    });
    const allChannels = [...new Set(rows.map((x) => x.channel))];
    const total = summarize("All platforms", rows, allChannels.reduce((a, c) => a + channelTotal(c), 0));
    const totalSalesAllChannels = data.channelSales.filter((s) => months.includes(s.month)).reduce((a, s) => a + s.grossSales, 0);
    return { rows, byPlatform, total, totalSalesAllChannels };
  }, [data.adMetrics, data.channelSales, months]);
}

export function useDistributors() {
  const { data, asOf } = useStore();
  return useMemo(
    () => distributorPositions(data.distributors, data.distributorInvoices, data.distributorLedger, asOf, `${asOf.slice(0, 4)}-01-01`),
    [data.distributors, data.distributorInvoices, data.distributorLedger, asOf],
  );
}

export function useDetectedSubscriptions() {
  const { data } = useStore();
  return useMemo(() => detectSubscriptions(data.bankTransactions, data.subscriptions), [data.bankTransactions, data.subscriptions]);
}

export const LAST_FULL_MONTH = ["2026-09"];

export function useHealth() {
  const planning = usePlanning();
  const cash = useCashFlow();
  const profit = useProfitability(LAST_FULL_MONTH);
  const marketing = useMarketing(LAST_FULL_MONTH);
  const sc = useSalesCash(["2026-08", "2026-09"]);
  const dist = useDistributors();
  const detected = useDetectedSubscriptions();
  const { data } = useStore();
  return useMemo(() => {
    const signals = healthSignals({
      targets: HEALTH_TARGETS,
      cash: cash.months,
      profit: profit.rows,
      marketing: marketing.byPlatform,
      subscriptions: data.subscriptions,
      detected,
      planning: planning.finishedGoods,
      salesVsCash: sc,
      distributors: dist,
    });
    return { signals, score: healthScore(signals), targets: HEALTH_TARGETS };
  }, [cash.months, profit.rows, marketing.byPlatform, data.subscriptions, detected, planning.finishedGoods, sc, dist]);
}

export { SALES_MONTHS, monthKeys };
