// Pakistan payroll batches. Finance uploads the monthly payroll file
// (e.g. "Payroll New CDC Oct 26.xlsx"); it appears in the CEO's Payment
// Planner as ONE payment batch with per-employee net pay and the bank
// transfer details the CEO needs to pay.

import type { PlannedPayment } from "./finance.ts";

export interface PayrollBankDetails {
  beneficiary: string;
  bankName: string;
  bankCode: string;
  /** Masked in the prototype; the live file supplies the real account / IBAN (shown to CEO + Director Finance only). */
  accountMasked: string;
}

export interface PayrollLine {
  empCode: string;
  name: string;
  department: string;
  /** "Payroll Amount" in the file — gross before PF release. */
  grossPkr: number;
  pfReleasePkr: number;
  deductionsPkr: number;
  /** "Salary Payable PKR" = gross + PF release − deductions. */
  netPkr: number;
  bank: PayrollBankDetails;
}

export type PayrollStatus = "Uploaded" | "Approved by CEO" | "Paid";

export interface PayrollBatch {
  id: string;
  month: string; // "2026-10"
  entity: string;
  uploadedBy: string;
  uploadedAt: string;
  fileName: string;
  /** PKR per 1 USD for the month, from the file. */
  fxRate: number;
  payDate: string;
  status: PayrollStatus;
  lines: PayrollLine[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function lineNetUsd(line: PayrollLine, fxRate: number): number {
  return fxRate > 0 ? round2(line.netPkr / fxRate) : 0;
}

export function batchTotals(batch: PayrollBatch) {
  const grossPkr = round2(batch.lines.reduce((a, l) => a + l.grossPkr, 0));
  const pfReleasePkr = round2(batch.lines.reduce((a, l) => a + l.pfReleasePkr, 0));
  const deductionsPkr = round2(batch.lines.reduce((a, l) => a + l.deductionsPkr, 0));
  const netPkr = round2(batch.lines.reduce((a, l) => a + l.netPkr, 0));
  const netUsd = batch.fxRate > 0 ? round2(netPkr / batch.fxRate) : 0;
  return { employees: batch.lines.length, grossPkr, pfReleasePkr, deductionsPkr, netPkr, netUsd };
}

/** Department totals of payable salary (gross + PF release), as in the "Payroll Summary" sheet. */
export function departmentTotals(
  batch: PayrollBatch,
): { department: string; employees: number; netPkr: number; netUsd: number }[] {
  const map = new Map<string, { employees: number; netPkr: number }>();
  for (const l of batch.lines) {
    const d = map.get(l.department) ?? { employees: 0, netPkr: 0 };
    d.employees += 1;
    d.netPkr += l.netPkr;
    map.set(l.department, d);
  }
  return [...map.entries()]
    .map(([department, d]) => ({
      department,
      employees: d.employees,
      netPkr: round2(d.netPkr),
      netUsd: batch.fxRate > 0 ? round2(d.netPkr / batch.fxRate) : 0,
    }))
    .sort((a, b) => b.netPkr - a.netPkr);
}

/** One planner row for the whole batch (USD at the batch FX rate). Paid batches drop out as "Paid". */
export function toPlannedPayment(batch: PayrollBatch): PlannedPayment {
  const t = batchTotals(batch);
  return {
    id: `PAYROLL-${batch.id}`,
    source: "Payroll",
    reference: `Payroll ${batch.month} · ${t.employees} employees`,
    vendor: batch.entity,
    description: `Pakistan payroll ${batch.month} · PKR ${t.netPkr.toLocaleString("en-US")} @ ${batch.fxRate}`,
    category: "Payroll",
    amount: t.netUsd,
    dueDate: batch.payDate,
    status:
      batch.status === "Paid"
        ? "Paid"
        : batch.status === "Approved by CEO"
          ? "Approved"
          : "Planned",
  };
}

/** Deterministic fake account mask for sample data, e.g. "PK•• •••• •••• 4821". */
export function maskedAccount(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 10000;
  return `PK•• •••• •••• ${String(h).padStart(4, "0")}`;
}
