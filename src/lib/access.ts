// Module-based permissions. Each role gets "edit", "view" or no access per module.
// In production this comes from the roles table (CC_RolesAccess) and is enforced
// by database row-level security; the prototype uses the role switcher.

export type Role =
  | "CEO"
  | "Director Finance"
  | "Deputy Manager Finance"
  | "Sr Finance Officer"
  | "Supply Chain / Viviene"
  | "Warehouse"
  | "Marketing Manager"
  | "Salon Sales Rep"
  | "Consultant";

export const ROLES: Role[] = [
  "CEO",
  "Director Finance",
  "Deputy Manager Finance",
  "Sr Finance Officer",
  "Supply Chain / Viviene",
  "Warehouse",
  "Marketing Manager",
  "Salon Sales Rep",
  "Consultant",
];

export type ModuleId =
  | "dashboard"
  | "projection"
  | "vendor"
  | "cogs"
  | "stock-count"
  | "payments"
  | "cash-flow"
  | "sales-cash"
  | "profitability"
  | "salons"
  | "distributors"
  | "marketing"
  | "kpis"
  | "tools"
  | "reports"
  | "health";

export type Access = "edit" | "view" | null;

export interface ModuleDef {
  id: ModuleId;
  path: string;
  label: string;
  icon: string;
  group: string;
  subtitle: string;
}

export const MODULES: ModuleDef[] = [
  { id: "dashboard", path: "/", label: "Dashboard", icon: "⌂", group: "", subtitle: "Overview" },
  { id: "health", path: "/health", label: "Company Health", icon: "♥", group: "CEO", subtitle: "Overall health and where to cut" },
  { id: "reports", path: "/reports", label: "Reports", icon: "☰", group: "CEO", subtitle: "Report library" },
  { id: "projection", path: "/projection", label: "PO Projection", icon: "▥", group: "Inventory & Purchasing", subtitle: "Finished Goods and Empty Tube planning" },
  { id: "vendor", path: "/vendor", label: "PO & Vendor Management", icon: "▤", group: "Inventory & Purchasing", subtitle: "Operational workspace maintained by Supply Chain" },
  { id: "stock-count", path: "/stock-count", label: "Stock Count", icon: "✓", group: "Inventory & Purchasing", subtitle: "Physical count vs ShipStation" },
  { id: "cogs", path: "/cogs", label: "COGS", icon: "◉", group: "Inventory & Purchasing", subtitle: "Tentative and final packaged SKU cost" },
  { id: "payments", path: "/payments", label: "Payment Planner", icon: "▦", group: "Finance", subtitle: "PO and Non-PO payments by month" },
  { id: "cash-flow", path: "/cash-flow", label: "Cash Flow", icon: "≋", group: "Finance", subtitle: "3-month outlook from QuickBooks bank" },
  { id: "sales-cash", path: "/sales-cash", label: "Sales vs Cash", icon: "⇆", group: "Finance", subtitle: "Sales by channel vs cash received in bank" },
  { id: "profitability", path: "/profitability", label: "Profitability", icon: "◔", group: "Finance", subtitle: "Profit by marketplace with expense splits" },
  { id: "salons", path: "/salons", label: "Salons", icon: "✂", group: "Sales Channels", subtitle: "Salon accounts, orders and commission" },
  { id: "distributors", path: "/distributors", label: "Distributors", icon: "⛟", group: "Sales Channels", subtitle: "Ledgers, invoices and consignment stock" },
  { id: "marketing", path: "/marketing", label: "Marketing", icon: "◎", group: "Marketing & People", subtitle: "Ad spend, ROAS, TACoS by platform" },
  { id: "kpis", path: "/kpis", label: "Team KPIs", icon: "★", group: "Marketing & People", subtitle: "Monthly manager reviews and consultant KPIs" },
  { id: "tools", path: "/tools", label: "Tools & Subscriptions", icon: "⚙", group: "Marketing & People", subtitle: "Every department's tools, detected from bank charges" },
];

const FINANCE: Role[] = ["Director Finance", "Deputy Manager Finance", "Sr Finance Officer"];

const MATRIX: Record<ModuleId, Partial<Record<Role, Access>>> = {
  dashboard: Object.fromEntries(ROLES.map((r) => [r, "view"])),
  health: { CEO: "view", "Director Finance": "view" },
  reports: { CEO: "view", "Director Finance": "view", "Deputy Manager Finance": "view" },
  projection: { CEO: "view", ...fin("edit"), "Supply Chain / Viviene": "view", Warehouse: "view" },
  // Finance can edit vendor records; POs and SKUs stay Supply Chain only (checked inside the page).
  vendor: { CEO: "view", ...fin("edit"), "Supply Chain / Viviene": "edit" },
  "stock-count": { CEO: "view", ...fin("edit"), "Supply Chain / Viviene": "view", Warehouse: "edit" },
  cogs: { CEO: "view", ...fin("edit"), "Supply Chain / Viviene": "view" },
  payments: { CEO: "view", ...fin("edit"), "Supply Chain / Viviene": "edit" },
  "cash-flow": { CEO: "view", "Director Finance": "edit" },
  "sales-cash": { CEO: "view", "Director Finance": "view", "Deputy Manager Finance": "view" },
  profitability: { CEO: "view", ...fin("edit") },
  salons: { CEO: "view", ...fin("edit"), "Marketing Manager": "view", "Salon Sales Rep": "edit" },
  distributors: { CEO: "view", ...fin("edit") },
  marketing: { CEO: "view", "Director Finance": "view", "Marketing Manager": "edit", Consultant: "view" },
  kpis: { CEO: "view", "Director Finance": "edit", "Supply Chain / Viviene": "edit", Warehouse: "view", "Marketing Manager": "edit", "Salon Sales Rep": "view", Consultant: "view", "Deputy Manager Finance": "view", "Sr Finance Officer": "view" },
  tools: { CEO: "view", ...fin("edit"), "Supply Chain / Viviene": "view", "Marketing Manager": "view" },
};

function fin(a: Access): Partial<Record<Role, Access>> {
  return Object.fromEntries(FINANCE.map((r) => [r, a]));
}

export function access(role: Role, module: ModuleId): Access {
  return MATRIX[module][role] ?? null;
}

export function isFinance(role: Role): boolean {
  return FINANCE.includes(role);
}

/** Who the prototype pretends to be for role-scoped pages (own KPIs, own salon orders). */
export const ROLE_PERSON: Partial<Record<Role, string>> = {
  "Director Finance": "E-DF",
  "Deputy Manager Finance": "E-DMF",
  "Sr Finance Officer": "E-SFO",
  "Supply Chain / Viviene": "E-VIV",
  Warehouse: "E-WH1",
  "Marketing Manager": "E-MKT",
  "Salon Sales Rep": "E-SR1",
  Consultant: "C-AMZ",
};

export const VIEW_ONLY_NOTE: Partial<Record<ModuleId, string>> = {
  projection: "View only for this role. Finance operates PO Projection.",
  vendor: "View only for this role. Viviene / Supply Chain owns edits here.",
  cogs: "View only for this role. Finance owns COGS finalization.",
};
