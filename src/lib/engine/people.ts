// People engines: employee KPI reviews (manager-filled, monthly),
// consultant KPIs (ROAS / TACoS), and Salon Direct sales commission.

import { addMonths } from "./dates.ts";

// ---------------------------------------------------------------- KPI reviews

export interface KpiCriterion {
  id: string;
  name: string;
  weight: number;
}

export interface ReviewTemplate {
  id: string;
  name: string;
  department: string;
  criteria: KpiCriterion[];
}

export interface Employee {
  id: string;
  name: string;
  department: string;
  title: string;
  managerId: string | null;
  templateId: string | null;
  kind: "Employee" | "Consultant";
}

export interface KpiReview {
  id: string;
  employeeId: string;
  month: string;
  reviewerId: string;
  /** criterionId -> score 1..5 */
  scores: Record<string, number>;
  comments: string;
  status: "Draft" | "Submitted";
}

export type Rating = "Exceeds" | "Meets" | "Needs Improvement" | "Below Expectations";

export function rating(scorePct: number): Rating {
  if (scorePct >= 100) return "Exceeds";
  if (scorePct >= 85) return "Meets";
  if (scorePct >= 70) return "Needs Improvement";
  return "Below Expectations";
}

/** Weighted review score. Each criterion scored 1–5; 4/5 = 100% ("meets target"), 5/5 = 125%. */
export function reviewScore(review: KpiReview, template: ReviewTemplate): number {
  const totalWeight = template.criteria.reduce((a, c) => a + c.weight, 0);
  if (totalWeight <= 0) return 0;
  const weighted = template.criteria.reduce(
    (a, c) => a + c.weight * ((review.scores[c.id] ?? 0) / 4),
    0,
  );
  return Math.round((weighted / totalWeight) * 1000) / 10;
}

export interface ConsultantTarget {
  consultantId: string;
  scope: string;
  targetRoas: number;
  targetTacos: number;
  roasWeight: number;
  tacosWeight: number;
}

/** Higher ROAS is better, lower TACoS is better. Each component is capped at 120%. */
export function consultantScore(t: ConsultantTarget, actualRoas: number, actualTacos: number) {
  const cap = (v: number) => Math.max(0, Math.min(1.2, v));
  const roasPct = t.targetRoas > 0 ? cap(actualRoas / t.targetRoas) : 0;
  const tacosPct = actualTacos > 0 ? cap(t.targetTacos / actualTacos) : 1.2;
  const total = t.roasWeight + t.tacosWeight;
  const score = total > 0 ? ((roasPct * t.roasWeight + tacosPct * t.tacosWeight) / total) * 100 : 0;
  return { roasPct: roasPct * 100, tacosPct: tacosPct * 100, score: Math.round(score * 10) / 10 };
}

// ---------------------------------------------------------------- commission

export interface SalesRep {
  id: string;
  name: string;
  email: string;
}

export interface SalonAccount {
  id: string;
  name: string;
  repId: string;
  city: string;
  shopifyCustomerId: string | null;
}

export interface CommissionPlan {
  id: string;
  name: string;
  repId: string;
  /** Account-specific override; null = rep's default plan. */
  accountId: string | null;
  firstOrderPct: number;
  recurringPct: number;
  /** Months after the first order that recurring commission applies. null = forever. */
  recurringMonths: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface SalonOrder {
  id: string;
  accountId: string;
  repId: string;
  date: string;
  netAmount: number;
  source: "Manual" | "Shopify";
  shopifyOrderNumber: string | null;
  status: "Pending Review" | "Approved" | "Rejected";
}

export interface CommissionLine {
  order: SalonOrder;
  plan: CommissionPlan | null;
  basis: "First Order" | "Recurring" | "Outside Recurring Window" | "No Plan";
  ratePct: number;
  commission: number;
}

export function planFor(
  plans: CommissionPlan[],
  repId: string,
  accountId: string,
  date: string,
): CommissionPlan | null {
  const active = plans.filter(
    (p) =>
      p.repId === repId &&
      p.effectiveFrom <= date &&
      (p.effectiveTo === null || p.effectiveTo >= date),
  );
  return (
    active.find((p) => p.accountId === accountId) ??
    active.find((p) => p.accountId === null) ??
    null
  );
}

/** Commission for each order. Rejected orders earn nothing; first order is per salon account. */
export function calculateCommission(
  orders: SalonOrder[],
  plans: CommissionPlan[],
): CommissionLine[] {
  const firstOrder = new Map<string, SalonOrder>();
  for (const o of [...orders]
    .filter((o) => o.status !== "Rejected")
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
    if (!firstOrder.has(o.accountId)) firstOrder.set(o.accountId, o);
  }
  return orders.map((order) => {
    if (order.status === "Rejected")
      return { order, plan: null, basis: "No Plan", ratePct: 0, commission: 0 };
    const plan = planFor(plans, order.repId, order.accountId, order.date);
    if (!plan) return { order, plan: null, basis: "No Plan", ratePct: 0, commission: 0 };
    const first = firstOrder.get(order.accountId);
    if (first?.id === order.id) {
      return {
        order,
        plan,
        basis: "First Order",
        ratePct: plan.firstOrderPct,
        commission: round2((order.netAmount * plan.firstOrderPct) / 100),
      };
    }
    const windowEnd =
      first && plan.recurringMonths !== null ? addMonths(first.date, plan.recurringMonths) : null;
    if (windowEnd === null || order.date < windowEnd) {
      return {
        order,
        plan,
        basis: "Recurring",
        ratePct: plan.recurringPct,
        commission: round2((order.netAmount * plan.recurringPct) / 100),
      };
    }
    return { order, plan, basis: "Outside Recurring Window", ratePct: 0, commission: 0 };
  });
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
