// Sample Pakistan payroll batch, modelled on "Payroll New CDC Oct 26.xlsx".
// Amounts, departments, employee codes and FX rate follow the file; names are
// placeholders and account numbers are fake masks — the live upload carries
// the real bank details (shown to CEO + Director Finance only).

import { maskedAccount, type PayrollBatch, type PayrollLine } from "../engine/payroll.ts";

const line = (empCode: string, department: string, grossPkr: number, pfReleasePkr: number, bankName: string): PayrollLine => ({
  empCode,
  name: `Employee ${empCode}`,
  department,
  grossPkr,
  pfReleasePkr,
  deductionsPkr: 0,
  netPkr: Math.round((grossPkr + pfReleasePkr) * 100) / 100,
  bank: { beneficiary: `Employee ${empCode}`, bankName, bankCode: "—", accountMasked: maskedAccount(empCode) },
});

export const payrollBatches: PayrollBatch[] = [
  {
    id: "PR-2026-10",
    month: "2026-10",
    entity: "Urtasker Pakistan (CDC)",
    uploadedBy: "Sr Finance Officer",
    uploadedAt: "2026-10-23",
    fileName: "Payroll New CDC Oct 26.xlsx",
    fxRate: 278.22,
    payDate: "2026-11-01",
    status: "Uploaded",
    lines: [
      line("CDC-011-22", "Finance", 200750, 0, "Allied Bank Limited"),
      line("CDC-013-26", "Digital Marketing", 211889.04, 10323.72, "Allied Bank Limited"),
      line("CDC-014-26", "Digital Marketing", 97440, 0, "Meezan Bank"),
      line("CDC-012-26", "Digital Marketing", 61962, 0, "Habib Bank Limited"),
      line("CDC-003-24", "Digital Marketing", 83883, 1882.55, "Allied Bank Limited"),
      line("CDC-001-24", "Digital Marketing", 252862, 0, "MCB Bank Limited"),
      line("CDC-008-26", "Finance", 65000, 0, "Meezan Bank Limited"),
      line("CDC-010-25", "Finance", 63000, 0, "Mashreq Bank"),
      line("CDC-004-24", "Brands Management Division", 56400, 0, "MCB Bank Limited"),
      line("CDC-007-25", "Digital Marketing", 48633.33, 0, "United Bank Limited"),
      line("CDC-006-25", "Digital Marketing", 53350, 0, "Allied Bank Limited"),
      line("CDC-009-26", "Digital Marketing", 97457.5, 0, "MCB Bank Limited"),
      line("CDC-015-26", "Digital Marketing", 105825, 0, "Bank Al Habib Limited"),
    ],
  },
];
