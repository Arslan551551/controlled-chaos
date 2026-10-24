// Shared business types. These mirror the planned database tables
// (see docs/DATA_MODEL.md) so the same engine runs on sample data now
// and on live data later.

export type ProductType = "Finished Goods" | "Accessory" | "Empty Tube";
export type CogsMethod = "Tube Fill" | "Direct Purchase" | "Component / Empty Tube";
export type Location = "Brentwood" | "Georgia";
export type SalesChannel =
  | "Amazon"
  | "Shopify"
  | "TikTok Shop"
  | "Walmart"
  | "Salon Direct"
  | "Distributor";

export interface Sku {
  sku: string;
  description: string;
  type: ProductType;
  cogsMethod: CogsMethod;
  /** Required for Tube Fill products, otherwise null. */
  linkedTubeSku: string | null;
  supplier: string;
  moq: number;
  leadTimeDays: number;
  /** Stocked tube threshold. 0 = tube stock not normally maintained. */
  tubeThresholdQty: number;
  /** Units per carton for physical counts. 0 = counted loose. */
  unitsPerBox: number;
  active: boolean;
  shipStationStatus: "Complete" | "Pending Setup";
}

export interface StockPosition {
  sku: string;
  location: Location | "Tube Store";
  qty: number;
  sourceUpdatedAt: string;
}

/** Actual fulfilled sales (platform or direct). Feeds historical burn. */
export interface ActualSale {
  id: string;
  sku: string;
  channel: SalesChannel | "Direct Sale";
  date: string;
  qty: number;
  reference?: string;
}

export type PlannedSaleStatus = "Confirmed" | "Tentative" | "Delayed" | "Cancelled" | "Fulfilled";

export interface PlannedSale {
  id: string;
  sku: string;
  expectedDate: string;
  qty: number;
  reference: string;
  status: PlannedSaleStatus;
  notes: string;
  /** History of date moves, newest last. */
  delays: { from: string; to: string; note: string }[];
}

export type POType = "Finished Goods" | "Empty Tube" | "Accessory";
export type POStatus = "Open" | "Closed" | "Cancelled";

export interface POInstallment {
  id: string;
  amount: number;
  /** ISO date or null when TBD. */
  dueDate: string | null;
  paid: boolean;
}

export interface PurchaseOrder {
  po: string;
  type: POType;
  sku: string;
  supplier: string;
  openDate: string;
  orderedQty: number;
  receivedQty: number;
  /** Actual received saleable qty (may be below received when damaged). */
  saleableQty: number | null;
  leadTimeDays: number;
  eta: string | null;
  status: POStatus;
  notes: string;
  installments: POInstallment[];
  documents: DocumentRef[];
}

export interface DocumentRef {
  id: string;
  name: string;
  type: "PO Invoice" | "Supplier Quotation" | "Shipping Document" | "Packing List" | "Receipt Evidence" | "COGS Support" | "Vendor Document" | "Stock Count Sheet" | "Other";
  uploadedBy: string;
  uploadedAt: string;
}

/** Empty tube / component inventory transactions for moving-average costing. */
export interface TubeLedgerEvent {
  id: string;
  tubeSku: string;
  date: string;
  type: "Receipt" | "Issue to Fill" | "Adjustment";
  qty: number;
  /** Unit cost for receipts; ignored for issues (they use the moving average). */
  unitCost?: number;
  po?: string;
  batch?: string;
}
