// Sample data: employees & KPI reviews, consultants, salon reps & commission,
// distributors (Maly's figures come from the real "Malys Ledger" workbook),
// stock counts, tools & subscriptions. Names other than Viviene and Maly's are placeholders.

import type { ConsignmentMovement, Distributor, DistributorInvoice, LedgerEntry } from "../engine/distributors.ts";
import type { BankTransaction, CountSheet, CountSheetLine, Subscription } from "../engine/operations.ts";
import type { CommissionPlan, ConsultantTarget, Employee, KpiReview, ReviewTemplate, SalesRep, SalonAccount, SalonOrder } from "../engine/people.ts";

// ---------------------------------------------------------------- employees & KPIs

export const reviewTemplates: ReviewTemplate[] = [
  { id: "T-FIN", name: "Finance team", department: "Finance", criteria: [
    { id: "accuracy", name: "Accuracy of entries & reconciliations", weight: 30 },
    { id: "close", name: "Month-end close on time", weight: 25 },
    { id: "cogs", name: "COGS finalized within 10 days of invoice", weight: 20 },
    { id: "comms", name: "Communication & responsiveness", weight: 15 },
    { id: "initiative", name: "Initiative / process improvement", weight: 10 },
  ] },
  { id: "T-SC", name: "Supply chain", department: "Supply Chain", criteria: [
    { id: "po", name: "POs opened by PO Open By date", weight: 35 },
    { id: "eta", name: "ETA accuracy & vendor follow-up", weight: 25 },
    { id: "data", name: "PO / SKU data kept current", weight: 20 },
    { id: "cost", name: "Cost negotiation", weight: 20 },
  ] },
  { id: "T-WH", name: "Warehouse", department: "Warehouse", criteria: [
    { id: "count", name: "Stock count accuracy", weight: 35 },
    { id: "ship", name: "Orders shipped same day", weight: 35 },
    { id: "safety", name: "Safety & housekeeping", weight: 15 },
    { id: "transfer", name: "Transfers completed when due", weight: 15 },
  ] },
  { id: "T-MKT", name: "Marketing", department: "Marketing", criteria: [
    { id: "roas", name: "Blended ROAS vs target", weight: 30 },
    { id: "content", name: "Content calendar delivered", weight: 25 },
    { id: "launch", name: "Campaign launches on time", weight: 25 },
    { id: "report", name: "Weekly reporting", weight: 20 },
  ] },
  { id: "T-SALES", name: "Salon sales", department: "Sales", criteria: [
    { id: "new", name: "New salon accounts opened", weight: 40 },
    { id: "repeat", name: "Repeat orders from existing salons", weight: 35 },
    { id: "crm", name: "Order entry & CRM hygiene", weight: 25 },
  ] },
];

export const employees: Employee[] = [
  { id: "E-DF", name: "Director Finance", department: "Finance", title: "Director Finance", managerId: null, templateId: null, kind: "Employee" },
  { id: "E-DMF", name: "Deputy Manager Finance", department: "Finance", title: "Deputy Manager Finance", managerId: "E-DF", templateId: "T-FIN", kind: "Employee" },
  { id: "E-SFO", name: "Sr Finance Officer", department: "Finance", title: "Sr Finance Officer", managerId: "E-DF", templateId: "T-FIN", kind: "Employee" },
  { id: "E-VIV", name: "Viviene", department: "Supply Chain", title: "Supply Chain Manager", managerId: "E-DF", templateId: "T-SC", kind: "Employee" },
  { id: "E-WH1", name: "Warehouse Lead (Brentwood)", department: "Warehouse", title: "Warehouse Lead", managerId: "E-VIV", templateId: "T-WH", kind: "Employee" },
  { id: "E-WH2", name: "Warehouse Associate", department: "Warehouse", title: "Warehouse Associate", managerId: "E-WH1", templateId: "T-WH", kind: "Employee" },
  { id: "E-MKT", name: "Marketing Manager", department: "Marketing", title: "Marketing Manager", managerId: null, templateId: "T-MKT", kind: "Employee" },
  { id: "E-SR1", name: "Salon Rep – Northeast", department: "Sales", title: "Salon Sales Rep", managerId: "E-MKT", templateId: "T-SALES", kind: "Employee" },
  { id: "E-SR2", name: "Salon Rep – Southeast", department: "Sales", title: "Salon Sales Rep", managerId: "E-MKT", templateId: "T-SALES", kind: "Employee" },
  { id: "C-AMZ", name: "Amazon PPC Consultant", department: "Marketing", title: "Consultant – Amazon Ads", managerId: "E-MKT", templateId: null, kind: "Consultant" },
  { id: "C-META", name: "Paid Social Consultant", department: "Marketing", title: "Consultant – Meta & TikTok Ads", managerId: "E-MKT", templateId: null, kind: "Consultant" },
];

const s = (o: Record<string, number>) => o;
export const kpiReviews: KpiReview[] = [
  { id: "R-1", employeeId: "E-DMF", month: "2026-09", reviewerId: "E-DF", scores: s({ accuracy: 4, close: 5, cogs: 4, comms: 4, initiative: 3 }), comments: "Close finished a day early.", status: "Submitted" },
  { id: "R-2", employeeId: "E-SFO", month: "2026-09", reviewerId: "E-DF", scores: s({ accuracy: 4, close: 4, cogs: 3, comms: 4, initiative: 4 }), comments: "Two batches finalized late.", status: "Submitted" },
  { id: "R-3", employeeId: "E-VIV", month: "2026-09", reviewerId: "E-DF", scores: s({ po: 3, eta: 4, data: 5, cost: 4 }), comments: "CONTCHAOSCC5OZ PO opened after Open By date.", status: "Submitted" },
  { id: "R-4", employeeId: "E-WH1", month: "2026-09", reviewerId: "E-VIV", scores: s({ count: 5, ship: 4, safety: 4, transfer: 4 }), comments: "", status: "Submitted" },
  { id: "R-5", employeeId: "E-WH2", month: "2026-09", reviewerId: "E-WH1", scores: s({ count: 3, ship: 4, safety: 3, transfer: 4 }), comments: "Count variance on CLNSAHR8OZGFF.", status: "Submitted" },
  { id: "R-6", employeeId: "E-MKT", month: "2026-09", reviewerId: "E-DF", scores: s({ roas: 3, content: 4, launch: 4, report: 5 }), comments: "TikTok ROAS below target.", status: "Submitted" },
  { id: "R-7", employeeId: "E-SR1", month: "2026-09", reviewerId: "E-MKT", scores: s({ new: 5, repeat: 4, crm: 4 }), comments: "3 new salons.", status: "Submitted" },
  { id: "R-8", employeeId: "E-SR2", month: "2026-09", reviewerId: "E-MKT", scores: s({ new: 3, repeat: 4, crm: 3 }), comments: "", status: "Submitted" },
  { id: "R-9", employeeId: "E-DMF", month: "2026-10", reviewerId: "E-DF", scores: s({ accuracy: 4, close: 4 }), comments: "", status: "Draft" },
];

export const consultantTargets: ConsultantTarget[] = [
  { consultantId: "C-AMZ", scope: "Amazon Ads", targetRoas: 4, targetTacos: 0.1, roasWeight: 60, tacosWeight: 40 },
  { consultantId: "C-META", scope: "Meta Ads + TikTok Ads", targetRoas: 3, targetTacos: 0.12, roasWeight: 60, tacosWeight: 40 },
];

// ---------------------------------------------------------------- salons & commission

export const salesReps: SalesRep[] = [
  { id: "E-SR1", name: "Salon Rep – Northeast", email: "rep.northeast@controlledchaoshair.com" },
  { id: "E-SR2", name: "Salon Rep – Southeast", email: "rep.southeast@controlledchaoshair.com" },
];

export const salonAccounts: SalonAccount[] = [
  { id: "SAL-01", name: "Crown & Coil Studio", repId: "E-SR1", city: "Brooklyn, NY", shopifyCustomerId: "7740021" },
  { id: "SAL-02", name: "Glow Studios", repId: "E-SR1", city: "Hoboken, NJ", shopifyCustomerId: "7740058" },
  { id: "SAL-03", name: "The Curl Bar", repId: "E-SR1", city: "Stamford, CT", shopifyCustomerId: null },
  { id: "SAL-04", name: "Texture Lab Salon", repId: "E-SR1", city: "Boston, MA", shopifyCustomerId: "7740112" },
  { id: "SAL-05", name: "Peachtree Curl Co", repId: "E-SR2", city: "Atlanta, GA", shopifyCustomerId: "7740140" },
  { id: "SAL-06", name: "Magnolia Hair House", repId: "E-SR2", city: "Charlotte, NC", shopifyCustomerId: null },
  { id: "SAL-07", name: "Coastal Coils", repId: "E-SR2", city: "Savannah, GA", shopifyCustomerId: "7740177" },
];

export const commissionPlans: CommissionPlan[] = [
  { id: "CP-1", name: "Northeast standard 2026", repId: "E-SR1", accountId: null, firstOrderPct: 10, recurringPct: 5, recurringMonths: 6, effectiveFrom: "2026-01-01", effectiveTo: null },
  { id: "CP-2", name: "Southeast standard 2026", repId: "E-SR2", accountId: null, firstOrderPct: 12, recurringPct: 4, recurringMonths: 6, effectiveFrom: "2026-01-01", effectiveTo: "2026-06-30" },
  { id: "CP-3", name: "Southeast H2 – recurring forever", repId: "E-SR2", accountId: null, firstOrderPct: 12, recurringPct: 3, recurringMonths: null, effectiveFrom: "2026-07-01", effectiveTo: null },
  { id: "CP-4", name: "Glow Studios key account", repId: "E-SR1", accountId: "SAL-02", firstOrderPct: 15, recurringPct: 6, recurringMonths: null, effectiveFrom: "2026-01-01", effectiveTo: null },
];

const o = (id: string, accountId: string, repId: string, date: string, netAmount: number, source: SalonOrder["source"] = "Manual", status: SalonOrder["status"] = "Approved", shopifyOrderNumber: string | null = null): SalonOrder =>
  ({ id, accountId, repId, date, netAmount, source, shopifyOrderNumber, status });

export const salonOrders: SalonOrder[] = [
  o("SO-1001", "SAL-01", "E-SR1", "2026-02-12", 2400),
  o("SO-1002", "SAL-01", "E-SR1", "2026-04-03", 1850, "Shopify", "Approved", "#S1042"),
  o("SO-1003", "SAL-01", "E-SR1", "2026-07-20", 2100, "Shopify", "Approved", "#S1188"),
  o("SO-1004", "SAL-01", "E-SR1", "2026-09-28", 2650, "Shopify", "Approved", "#S1301"),
  o("SO-1005", "SAL-02", "E-SR1", "2026-03-15", 4200),
  o("SO-1006", "SAL-02", "E-SR1", "2026-06-11", 3900, "Shopify", "Approved", "#S1120"),
  o("SO-1007", "SAL-02", "E-SR1", "2026-10-09", 4600, "Shopify", "Approved", "#S1340"),
  o("SO-1008", "SAL-03", "E-SR1", "2026-08-22", 1500),
  o("SO-1009", "SAL-03", "E-SR1", "2026-10-15", 1200, "Manual", "Pending Review"),
  o("SO-1010", "SAL-04", "E-SR1", "2026-10-02", 3100, "Shopify", "Approved", "#S1322"),
  o("SO-1011", "SAL-05", "E-SR2", "2026-01-25", 2800),
  o("SO-1012", "SAL-05", "E-SR2", "2026-05-14", 2600, "Shopify", "Approved", "#S1089"),
  o("SO-1013", "SAL-05", "E-SR2", "2026-09-05", 3000, "Shopify", "Approved", "#S1275"),
  o("SO-1014", "SAL-06", "E-SR2", "2026-06-30", 1900),
  o("SO-1015", "SAL-06", "E-SR2", "2026-10-18", 2200, "Shopify", "Pending Review", "#S1366"),
  o("SO-1016", "SAL-07", "E-SR2", "2026-10-20", 1750, "Shopify", "Pending Review", "#S1371"),
];

/** Recent Shopify wholesale orders not yet tagged to a rep (from the Shopify API). */
export const untaggedShopifyOrders = [
  { number: "#S1378", date: "2026-10-21", customer: "Peachtree Curl Co", netAmount: 1980, suggestedAccountId: "SAL-05" },
  { number: "#S1380", date: "2026-10-22", customer: "Bloom Natural Hair Salon", netAmount: 1450, suggestedAccountId: null },
  { number: "#S1383", date: "2026-10-23", customer: "Crown & Coil Studio", netAmount: 2300, suggestedAccountId: "SAL-01" },
];

// ---------------------------------------------------------------- distributors

export const distributors: Distributor[] = [
  { id: "D-MALYS", name: "Maly's", legalName: "Excel Salon Products, Inc d/b/a Malys@ManocoBlue", contact: "Scott Missad", email: "malys@example.com", city: "Grand Rapids, MI", country: "United States", currency: "USD", model: "Wholesale", paymentTermsDays: 30, creditLimit: 40000, marketingFundPct: 4, status: "Active", fxToUsd: 1, priceList: {} },
  { id: "D-BSE", name: "Beauty Supply East", legalName: "Beauty Supply East LLC", contact: "Account Manager", email: "ap@bse.example", city: "Newark, NJ", country: "United States", currency: "USD", model: "Wholesale", paymentTermsDays: 45, creditLimit: 60000, marketingFundPct: 3, status: "Active", fxToUsd: 1, priceList: {} },
  // Netherlands consignment distributor — figures from "JB Report.xlsx" (stock sent, June–Aug sales, EUR price list, 1 EUR = 1.165365 USD)
  { id: "D-NL", name: "John Beeren (JB)", legalName: "John Beeren", contact: "John Beeren", email: "jb@example.nl", city: "Netherlands", country: "Netherlands", currency: "EUR", model: "Consignment", paymentTermsDays: 30, creditLimit: 0, marketingFundPct: 0, status: "Active", fxToUsd: 1.165365,
    priceList: { "32-OZ-HAIRCLEANSER": 35.19, "32-OZ-HAIRMOISTURIZER": 34.16, "32-OZ-CURLCREME": 43.12, MOISTAHR8OZPO: 12.08, CLNSAHR8OZGFF: 12.42, CONTCHAOSCC5OZ: 10.01, CONTCHAOSCC3OZ: 8.63, "CC-LICS-3.4OZ": 6.9, "CC-LICS-8OZ": 11.73 } },
];

const inv = (id: string, distributorId: string, date: string, amount: number, payments: DistributorInvoice["payments"], terms = 30): DistributorInvoice => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + terms);
  return { id, distributorId, date, dueDate: d.toISOString().slice(0, 10), amount, payments, link: null };
};

export const distributorInvoices: DistributorInvoice[] = [
  // Maly's — paid amounts from the Malys Ledger workbook
  inv("30001", "D-MALYS", "2026-01-26", 30202.75, [{ date: "2026-02-24", amount: 30202.75 }]),
  inv("30144", "D-MALYS", "2026-04-27", 3798.74, [{ date: "2026-04-27", amount: 1645.25, method: "Credit / Fund Applied" }, { date: "2026-05-08", amount: 2153.49, method: "Cash" }]),
  inv("30182", "D-MALYS", "2026-05-01", 196, [{ date: "2026-05-08", amount: 196 }]),
  inv("30216", "D-MALYS", "2026-05-12", 968.13, [{ date: "2026-05-18", amount: 968.13 }]),
  inv("30221", "D-MALYS", "2026-05-14", 509, [{ date: "2026-06-08", amount: 509 }]),
  inv("30350", "D-MALYS", "2026-07-02", 2907.03, [{ date: "2026-07-24", amount: 2907.03 }]),
  inv("30531", "D-MALYS", "2026-09-10", 536.76, [{ date: "2026-10-02", amount: 87.78, method: "Credit / Fund Applied" }, { date: "2026-10-02", amount: 448.98, method: "Cash" }]),
  inv("30588", "D-MALYS", "2026-10-06", 6840, []),
  // John Beeren (consignment) — invoiced in EUR for units sold only. Payment status not yet confirmed.
  inv("JB-2026-08", "D-NL", "2026-09-05", 3714.3, []),
  // Beauty Supply East
  inv("30410", "D-BSE", "2026-07-15", 18400, [{ date: "2026-08-28", amount: 18400 }], 45),
  inv("30472", "D-BSE", "2026-08-20", 22150, [{ date: "2026-10-03", amount: 12000 }], 45),
  inv("30515", "D-BSE", "2026-09-18", 15800, [], 45),
  inv("30590", "D-BSE", "2026-10-10", 9600, [], 45),
];

const le = (id: string, distributorId: string, ledger: LedgerEntry["ledger"], date: string, type: LedgerEntry["type"], ref: string, description: string, plus: number, minus: number, source: LedgerEntry["source"] = "Manual", support: string | null = null): LedgerEntry =>
  ({ id, distributorId, ledger, date, type, ref, description, plus, minus, source, support });

export const distributorLedger: LedgerEntry[] = [
  // Maly's — from the workbook
  le("L-001", "D-MALYS", "Marketing Fund", "2026-03-13", "Goods Issued", "#30072", "Free Goods Issued", 0, 539.28),
  le("L-002", "D-MALYS", "Product Credit", "2026-03-13", "Credit Memo", "30115", "March/April The Cut Magazine Fee – Full Page Ad", 1000, 0, "QuickBooks credit memo", "Credit memo 30115.pdf"),
  le("L-003", "D-MALYS", "Product Credit", "2026-03-27", "Credit Memo", "30113", "29 units of Curl Creme 32oz @ $22.25 (order SO540371)", 645.25, 0, "QuickBooks credit memo", "Credit memo 30113.pdf"),
  le("L-004", "D-MALYS", "Product Credit", "2026-04-27", "Credit Applied", "30144", "Credit memos 30115, 30113 applied on invoice 30144", 0, 1645.25),
  le("L-005", "D-MALYS", "Product Credit", "2026-06-05", "Credit Memo", "30301", "May/June The Cut Magazine Fee – Full Page Ad", 1000, 0, "QuickBooks credit memo", "Credit memo 30301.pdf"),
  le("L-006", "D-MALYS", "Product Credit", "2026-07-10", "Credit Memo", "30403", "May/June Product Credit reimbursement", 87.78, 0, "QuickBooks credit memo", "Credit memo 30403.pdf"),
  le("L-007", "D-MALYS", "Product Credit", "2026-10-02", "Credit Applied", "30531", "Credit Memo 30403 applied on Invoice 30531", 0, 87.78),
  // Beauty Supply East
  le("L-101", "D-BSE", "Marketing Fund", "2026-09-12", "Goods Issued", "#30498", "Free goods – salon education event", 0, 300),
  le("L-102", "D-BSE", "Product Credit", "2026-09-20", "Credit Memo", "30520", "Damaged cartons – 40 × Hair Cleanser 8oz", 228, 0, "QuickBooks credit memo"),
];

export const consignmentMovements: ConsignmentMovement[] = [
  { id: "CM-S1", distributorId: "D-NL", date: "2026-05-28", sku: "32-OZ-HAIRCLEANSER", type: "Shipment to Distributor", qty: 42, reference: "Stock sent to John Beeren" },
  { id: "CM-S2", distributorId: "D-NL", date: "2026-05-28", sku: "32-OZ-HAIRMOISTURIZER", type: "Shipment to Distributor", qty: 78, reference: "Stock sent to John Beeren" },
  { id: "CM-S3", distributorId: "D-NL", date: "2026-05-28", sku: "32-OZ-CURLCREME", type: "Shipment to Distributor", qty: 120, reference: "Stock sent to John Beeren" },
  { id: "CM-S4", distributorId: "D-NL", date: "2026-05-28", sku: "MOISTAHR8OZPO", type: "Shipment to Distributor", qty: 696, reference: "Stock sent to John Beeren" },
  { id: "CM-S5", distributorId: "D-NL", date: "2026-05-28", sku: "CLNSAHR8OZGFF", type: "Shipment to Distributor", qty: 480, reference: "Stock sent to John Beeren" },
  { id: "CM-S6", distributorId: "D-NL", date: "2026-05-28", sku: "CONTCHAOSCC5OZ", type: "Shipment to Distributor", qty: 696, reference: "Stock sent to John Beeren" },
  { id: "CM-S7", distributorId: "D-NL", date: "2026-05-28", sku: "CONTCHAOSCC3OZ", type: "Shipment to Distributor", qty: 192, reference: "Stock sent to John Beeren" },
  { id: "CM-S8", distributorId: "D-NL", date: "2026-05-28", sku: "CC-LICS-3.4OZ", type: "Shipment to Distributor", qty: 144, reference: "Stock sent to John Beeren" },
  { id: "CM-S9", distributorId: "D-NL", date: "2026-05-28", sku: "CC-LICS-8OZ", type: "Shipment to Distributor", qty: 240, reference: "Stock sent to John Beeren" },
  { id: "CM-R1", distributorId: "D-NL", date: "2026-08-31", sku: "MOISTAHR8OZPO", type: "Reported Sale", qty: 77, amount: 919.28, invoiceId: "JB-2026-08", reference: "JB sales report June–Aug ($1071.3 ÷ 1.165365)" },
  { id: "CM-R2", distributorId: "D-NL", date: "2026-08-31", sku: "CONTCHAOSCC5OZ", type: "Reported Sale", qty: 77, amount: 773.42, invoiceId: "JB-2026-08", reference: "JB sales report June–Aug ($901.32 ÷ 1.165365)" },
  { id: "CM-R3", distributorId: "D-NL", date: "2026-08-31", sku: "32-OZ-CURLCREME", type: "Reported Sale", qty: 23, amount: 987.65, invoiceId: "JB-2026-08", reference: "JB sales report June–Aug ($1150.97 ÷ 1.165365)" },
  { id: "CM-R4", distributorId: "D-NL", date: "2026-08-31", sku: "32-OZ-HAIRMOISTURIZER", type: "Reported Sale", qty: 26, amount: 884.91, invoiceId: "JB-2026-08", reference: "JB sales report June–Aug ($1031.24 ÷ 1.165365)" },
  { id: "CM-R5", distributorId: "D-NL", date: "2026-08-31", sku: "CLNSAHR8OZGFF", type: "Reported Sale", qty: 12, amount: 149.04, invoiceId: "JB-2026-08", reference: "JB sales report June–Aug ($173.69 ÷ 1.165365)" },
];

// ---------------------------------------------------------------- stock counts
// Monthly count sheets, as in "Physical Stock Counting.xlsx". Lines are listed
// fastest-burning SKU first; each SKU can be counted on a different day.

const line = (
  sku: string,
  unitsPerBox: number,
  countedAt: string | null = null,
  boxes: number | null = null,
  looseUnits: number | null = null,
  systemQty: number | null = null,
  counter: string | null = null,
): CountSheetLine => ({ sku, countedAt, boxes, unitsPerBox, looseUnits, systemQty, counter });

const WL = "Warehouse Lead (Brentwood)";
const WA = "Warehouse Associate";
const GA = "Georgia Prep (3PL)";

export const stockCounts: CountSheet[] = [
  {
    id: "CS-2026-10-BW",
    month: "2026-10",
    location: "Brentwood",
    status: "In Progress",
    notes: "",
    sentAt: null,
    adjustedBy: null,
    adjustedAt: null,
    lines: [
      line("MOISTAHR8OZPO", 24, "2026-10-20T09:30", 257, 12, 6190, WL),
      line("CONTCHAOSCC5OZ", 12, "2026-10-21T14:10", 581, 0, 7010, WL),
      line("CONTCHAOSCC3OZ", 48),
      line("CLNSAHR8OZGFF", 24, "2026-10-22T10:45", 174, 0, 4250, WA),
      line("CCHAIRCOMBPW", 150),
      line("CCHAIRBRUSH1", 0, "2026-10-23T16:20", null, 2788, 2800, WA),
    ],
  },
  {
    id: "CS-2026-09-BW",
    month: "2026-09",
    location: "Brentwood",
    status: "Adjusted in ShipStation",
    notes: "Hair Cleanser 8oz: 2 cases found crushed on rack B4.",
    sentAt: "2026-09-26T17:05",
    adjustedBy: "Sr Finance Officer",
    adjustedAt: "2026-09-29T11:20",
    lines: [
      line("MOISTAHR8OZPO", 24, "2026-09-22T09:00", 312, 0, 7488, WL),
      line("CONTCHAOSCC5OZ", 12, "2026-09-22T11:30", 623, 0, 7476, WL),
      line("CONTCHAOSCC3OZ", 48, "2026-09-23T10:15", 107, 0, 5100, WA),
      line("CLNSAHR8OZGFF", 24, "2026-09-24T09:40", 390, 0, 9408, WL),
      line("CCHAIRCOMBPW", 150, "2026-09-25T15:00", 30, 0, 4512, WA),
      line("CCHAIRBRUSH1", 0, "2026-09-25T16:10", null, 3190, 3190, WA),
    ],
  },
  {
    id: "CS-2026-09-GA",
    month: "2026-09",
    location: "Georgia",
    status: "Sent to Finance",
    notes: "Curl Creme 3oz units/box keyed as 4,800 by 3PL — recount requested.",
    sentAt: "2026-09-30T12:00",
    adjustedBy: null,
    adjustedAt: null,
    lines: [
      line("MOISTAHR8OZPO", 24, "2026-09-23T10:00", 130, 0, 3120, GA),
      line("CONTCHAOSCC5OZ", 12, "2026-09-23T10:40", 466, 8, 5600, GA),
      line("CONTCHAOSCC3OZ", 4800, "2026-09-24T09:15", 256, 0, 12300, GA),
      line("CLNSAHR8OZGFF", 24, "2026-09-24T11:00", 367, 0, 8808, GA),
      line("CCHAIRCOMBPW", 150, "2026-09-25T13:30", 40, 0, 6000, GA),
      line("CCHAIRBRUSH1", 0, "2026-09-25T14:00", null, 3600, 3600, GA),
    ],
  },
];

export const FINANCE_EMAIL = "finance@controlledchaoshair.com";

// ---------------------------------------------------------------- tools & subscriptions

export const subscriptions: Subscription[] = [
  { id: "S-01", tool: "QuickBooks Online Advanced", merchantMatch: "INTUIT QBOOKS", department: "Finance", owner: "Director Finance", category: "Accounting", billingCycle: "Monthly", cost: 235, nextRenewal: "2026-11-03", seats: 6, seatsUsed: 4, status: "Active" },
  { id: "S-02", tool: "ShipStation", merchantMatch: "SHIPSTATION", department: "Warehouse", owner: "Warehouse Lead (Brentwood)", category: "Shipping", billingCycle: "Monthly", cost: 229, nextRenewal: "2026-11-08", seats: 5, seatsUsed: 5, status: "Active" },
  { id: "S-03", tool: "Shopify Plus", merchantMatch: "SHOPIFY", department: "Marketing", owner: "Marketing Manager", category: "E-commerce platform", billingCycle: "Monthly", cost: 2300, nextRenewal: "2026-11-01", seats: 10, seatsUsed: 7, status: "Active" },
  { id: "S-04", tool: "Klaviyo", merchantMatch: "KLAVIYO", department: "Marketing", owner: "Marketing Manager", category: "Email marketing", billingCycle: "Monthly", cost: 720, nextRenewal: "2026-11-12", seats: 4, seatsUsed: 3, status: "Active" },
  { id: "S-05", tool: "Mailchimp", merchantMatch: "MAILCHIMP", department: "Sales", owner: "Salon Rep – Northeast", category: "Email marketing", billingCycle: "Monthly", cost: 150, nextRenewal: "2026-11-20", seats: 2, seatsUsed: 1, status: "Active" },
  { id: "S-06", tool: "Canva Teams", merchantMatch: "CANVA", department: "Marketing", owner: "Marketing Manager", category: "Design", billingCycle: "Annual", cost: 1200, nextRenewal: "2027-03-14", seats: 10, seatsUsed: 4, status: "Active" },
  { id: "S-07", tool: "Helium 10", merchantMatch: "HELIUM 10", department: "Marketing", owner: "Amazon PPC Consultant", category: "Amazon analytics", billingCycle: "Monthly", cost: 279, nextRenewal: "2026-11-05", seats: 1, seatsUsed: 1, status: "Active" },
  { id: "S-08", tool: "Google Workspace", merchantMatch: "GOOGLE WORKSPACE", department: "Company-wide", owner: "Director Finance", category: "Email & docs", billingCycle: "Monthly", cost: 432, nextRenewal: "2026-11-01", seats: 18, seatsUsed: 15, status: "Active" },
  { id: "S-09", tool: "Slack Pro", merchantMatch: "SLACK", department: "Company-wide", owner: "Director Finance", category: "Chat", billingCycle: "Monthly", cost: 156, nextRenewal: "2026-11-09", seats: 18, seatsUsed: 11, status: "Active" },
  { id: "S-10", tool: "Gorgias", merchantMatch: "GORGIAS", department: "Customer Service", owner: "Marketing Manager", category: "Customer support", billingCycle: "Monthly", cost: 360, nextRenewal: "2026-11-15", seats: 3, seatsUsed: 3, status: "Active" },
  { id: "S-11", tool: "Lovable", merchantMatch: "LOVABLE", department: "Finance", owner: "Director Finance", category: "App builder", billingCycle: "Monthly", cost: 50, nextRenewal: "2026-11-02", seats: 1, seatsUsed: 1, status: "Active" },
  { id: "S-12", tool: "Asana", merchantMatch: "ASANA", department: "Supply Chain", owner: "Viviene", category: "Project management", billingCycle: "Monthly", cost: 110, nextRenewal: "2026-11-18", seats: 5, seatsUsed: 2, status: "Cancel Requested" },
];

/** Card / bank charges from the QuickBooks feed (last 3 months) used for subscription detection. */
export const bankTransactions: BankTransaction[] = (() => {
  const rows: [string, number, string][] = [
    ["INTUIT *QBOOKS ONLINE", 235, "Amex ••1009"],
    ["SHIPSTATION.COM", 229, "Amex ••1009"],
    ["SHOPIFY* 21983341", 2300, "Chase ••4821"],
    ["KLAVIYO INC.", 720, "Amex ••1009"],
    ["MAILCHIMP *MONTHLY", 150, "Amex ••1009"],
    ["HELIUM 10", 279, "Amex ••1009"],
    ["GOOGLE WORKSPACE", 432, "Chase ••4821"],
    ["SLACK T0123", 156, "Amex ••1009"],
    ["GORGIAS", 360, "Amex ••1009"],
    ["LOVABLE", 50, "Amex ••1009"],
    ["ASANA.COM", 110, "Amex ••1009"],
    ["LOOM.COM", 75, "Amex ••1009"],
    ["CALENDLY", 48, "Amex ••1009"],
    ["ZOOM.US 888-799", 199, "Amex ••1009"],
  ];
  const out: BankTransaction[] = [];
  ["2026-08", "2026-09", "2026-10"].forEach((m, mi) => {
    rows.forEach(([merchant, amount, account], i) => {
      // Klaviyo went up in October
      const amt = merchant.startsWith("KLAVIYO") && mi === 2 ? 840 : amount;
      out.push({ id: `BT-${m}-${i}`, date: `${m}-${String(3 + i).padStart(2, "0")}`, merchant, amount: amt, account });
    });
  });
  out.push({ id: "BT-x1", date: "2026-09-14", merchant: "UBER EATS", amount: 64, account: "Amex ••1009" });
  out.push({ id: "BT-x2", date: "2026-10-02", merchant: "DELTA AIR", amount: 412, account: "Amex ••1009" });
  return out;
})();
