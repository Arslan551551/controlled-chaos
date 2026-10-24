// Prototype state: holds the sample data in memory so every form and action
// works and every screen recalculates. In production this is replaced by the
// database (same shapes) — the screens and engine stay the same.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { ROLES, type Role } from "./access";
import { buildCogsBatches, runTubeLedger } from "./engine/cogs";
import { runPlanning } from "./engine/planning";
import type { StockPosition } from "./engine/types";
import * as core from "./sample/core";
import * as fin from "./sample/finance";
import * as ppl from "./sample/people";
import * as kpiPlans from "./sample/kpiPlans";
import * as ar from "./sample/ar";
import * as outflows from "./sample/outflows";
import * as productpnl from "./sample/productpnl";
import * as campaignData from "./sample/campaigns";
import * as payroll from "./sample/payroll";

function initialData() {
  return {
    skus: core.skus,
    finishedGoodsStock: core.finishedGoodsStock,
    actualSales: core.actualSales,
    plannedSales: core.plannedSales,
    purchaseOrders: core.purchaseOrders,
    tubeLedger: core.tubeLedger,
    cogsBatches: core.cogsBatches,
    vendors: fin.vendors,
    nonPOPayments: fin.nonPOPayments,
    bankAccounts: fin.bankAccounts,
    manualCashLines: fin.manualCashLines,
    expectedReceipts: fin.expectedReceipts,
    channelSales: fin.channelSales,
    cashReceipts: fin.cashReceipts,
    adMetrics: fin.adMetrics,
    channelCosts: fin.channelCosts,
    expenses: fin.expenses,
    employees: ppl.employees,
    reviewTemplates: ppl.reviewTemplates,
    kpiReviews: ppl.kpiReviews,
    consultantTargets: ppl.consultantTargets,
    salesReps: ppl.salesReps,
    salonAccounts: ppl.salonAccounts,
    commissionPlans: ppl.commissionPlans,
    salonOrders: ppl.salonOrders,
    untaggedShopifyOrders: ppl.untaggedShopifyOrders,
    distributors: ppl.distributors,
    distributorInvoices: ppl.distributorInvoices,
    distributorLedger: ppl.distributorLedger,
    consignmentMovements: ppl.consignmentMovements,
    stockCounts: ppl.stockCounts,
    subscriptions: ppl.subscriptions,
    bankTransactions: ppl.bankTransactions,
    payrollBatches: payroll.payrollBatches,
    campaigns: campaignData.campaigns,
    trafficSources: campaignData.trafficSources,
    merInputs: campaignData.merInputs,
    skuChannelMonth: productpnl.skuChannelMonth,
    arInvoices: ar.arInvoices,
    arRules: ar.arRules,
    arReminderLog: ar.arReminderLog,
    stockOutflows: outflows.stockOutflows,
    channelRecords: outflows.channelRecords,
    outflowResolutions: outflows.outflowResolutions,
    payPlans: kpiPlans.payPlans,
    metricSnapshots: kpiPlans.metricSnapshots,
    reviewRatings: kpiPlans.reviewRatings,
    planPeople: kpiPlans.planPeople,
    payAdjustments: kpiPlans.payAdjustments,
    payRuns: kpiPlans.payRuns,
    outbox: [] as OutboxEmail[],
  };
}

export type AppData = ReturnType<typeof initialData>;

export interface OutboxEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  queuedAt: string;
  status: "Queued (Gmail not connected yet)";
}

interface Ctx {
  role: Role;
  setRole: (r: Role) => void;
  data: AppData;
  update: <K extends keyof AppData>(key: K, fn: (prev: AppData[K]) => AppData[K]) => void;
  notice: string | null;
  flash: (msg: string) => void;
  asOf: string;
}

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("Director Finance");
  const [data, setData] = useState<AppData>(initialData);
  const [notice, setNotice] = useState<string | null>(null);

  const update = useCallback(
    <K extends keyof AppData>(key: K, fn: (prev: AppData[K]) => AppData[K]) => {
      setData((d) => ({ ...d, [key]: fn(d[key]) }));
    },
    [],
  );

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice((m) => (m === msg ? null : m)), 2200);
  }, []);

  const value = useMemo(
    () => ({ role, setRole, data, update, notice, flash, asOf: core.AS_OF }),
    [role, data, update, notice, flash],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Ctx {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export { ROLES };

/** Tube ledger, current tube stock and COGS batches. */
export function useCosting() {
  const { data } = useStore();
  return useMemo(() => {
    const ledger = runTubeLedger(data.tubeLedger);
    const batches = buildCogsBatches(data.cogsBatches, data.purchaseOrders, ledger.rows);
    const tubeStock: StockPosition[] = [...ledger.positions.values()].map((p) => ({
      sku: p.tubeSku,
      location: "Tube Store",
      qty: p.onHand,
      sourceUpdatedAt: core.AS_OF,
    }));
    /** Latest full COGS per SKU (final if finalized, else tentative). */
    const unitCost = (sku: string) => {
      const b = [...batches].reverse().find((x) => x.sku === sku);
      if (b) return b.currentFullUnit;
      const tube = ledger.positions.get(sku);
      return tube ? tube.weightedUnitCost : (core.standardCost[sku] ?? 0);
    };
    return { ledger, batches, tubeStock, unitCost };
  }, [data.tubeLedger, data.cogsBatches, data.purchaseOrders]);
}

export function usePlanning() {
  const { data, asOf } = useStore();
  const { tubeStock } = useCosting();
  return useMemo(
    () =>
      runPlanning({
        asOf,
        skus: data.skus,
        stock: [...data.finishedGoodsStock, ...tubeStock],
        sales: data.actualSales,
        plannedSales: data.plannedSales,
        purchaseOrders: data.purchaseOrders,
      }),
    [
      asOf,
      data.skus,
      data.finishedGoodsStock,
      tubeStock,
      data.actualSales,
      data.plannedSales,
      data.purchaseOrders,
    ],
  );
}

let idCounter = 0;
export function newId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36).slice(-4)}${idCounter}`;
}
