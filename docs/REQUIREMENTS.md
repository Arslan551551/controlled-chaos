# Controlled Chaos portal — requirements register

Living list of everything Arslan has asked for, with the source of each requirement.
Detailed workings of each Excel/PDF file are in `docs/excel-analysis/`.
Original v1 business rules are in the authority package (Living Blueprint v1.10 etc.).

Status key: ✅ in prototype · 🟡 partly in prototype · ⬜ not started · ❓ waiting on an answer

## Platform & access
- ✅ Web app in GitHub (TanStack Start + Lovable Cloud). Claude builds; Arslan publishes from Lovable. Domain: finance.controlledchaoshair.com.
- 🟡 Sign-in: **email + password**. Role per user from a roles table; anyone not listed gets no access. (Prototype uses a role switcher.)
- ✅ Module-based permissions (view / edit / none per module) so new user types can be added: CEO, Finance (3 roles), Supply Chain (Viviene), Warehouse, Marketing, Salon Sales Reps, Consultants.
- ⬜ Email via Gmail later. Until then, emails are queued in an outbox.

## Integrations (backend only, read-only scopes)
- ShipStation (Brentwood + Georgia stock, shipments) · Amazon (Seller Central / Sellerboard) · Shopify · TikTok Shop · Walmart · QuickBooks Online (bank, AR, expenses, credit memos) · Amazon Ads · Meta Ads · Google Ads · TikTok Ads.
- ❓ Sellerboard vs QuickBooks disagree on Amazon numbers. One locked month-end figure is needed before pay/ROAS/profit is calculated (see excel-analysis).

## v1 modules (from the authority package)
- ✅ Dashboard · ✅ PO Projection (Finished Goods / Empty Tubes / Internal Transfer, planned & direct sales) · ✅ PO & Vendor Management (Open POs, SKU / MOQ setup) · ✅ COGS (Tube Fill / Direct Purchase, moving-average tubes).
- Change (24 Oct): Finance now also maintains **vendor records** and **Non-PO payments** (previously disabled).

## New modules (24 Oct 2026)
1. **Stock count** ✅. Monthly count sheet like "Physical Stock Counting.xlsx": every SKU sorted by burn, count date/time per line, boxes × units/box + loose, ShipStation qty at that time, variance emailed to Finance, Finance marks "Adjusted in ShipStation". ❓ Is "Avg Burn" per month or per day?
2. **Stock outflow reconciliation** ✅. Shopify/TikTok outflows are visible via ShipStation, but Amazon (FBA inbound), Walmart (WFS) and manual shipments reduce stock without clear records. Use the marketplace APIs (inbound shipments / WFS shipments) to explain every ShipStation stock decrease. Send unexplained outflows to Finance.
3. **Cash flow** ✅. Opening balance from **QuickBooks bank**, − payments out, + sales receipts, + loan receipts, = month-end cash for 3 months. **Weekly schedule** ✅: what to pay each week, what's left in the bank, cash position.
4. **Tools & subscriptions** ✅. Register for every department, plus automatic detection from bank/card charges by merchant (unregistered charges, price increases).
5. **Marketing** ✅. Ad spend, ROAS, ACoS, TACoS, MER per channel (as in the ROAS reports). **Campaign analysis per marketplace** ✅: money paid, discounts given, deal fees, incremental sales and profit, ROI. **Marketing conversion** ✅: traffic → orders, new vs returning customers, by source.
6. **Payment planner (CEO)** ✅. Viviene and Finance enter PO and Non-PO payments; the CEO sees a monthly and **weekly** plan. **Pakistan payroll** ✅: Finance uploads the payroll file (e.g. "Payroll New CDC Oct 26"); it appears in the CEO's planner as one payment batch, with per-employee net pay (PKR and USD at the month's rate) and **bank transfer details shown for the CEO** to pay.
7. **Marketplace profitability** ✅. P&L per channel with **GP, CM, NP**, and splitting any expense across channels by %. **Product × platform profitability** ✅ (e.g. brush and hair pick on all platforms). **Profit drivers** ✅: what is reducing profit and how to improve it (shipping per unit on TikTok, Amazon fees %, refunds, ads, discounts), with trends and suggested actions.
8. **Team KPIs & bonus** ✅. Monthly manager reviews (Excellent/Good/Fair/Poor = 100/75/35/0) × target bonus, plus formula-based pay for marketers and consultants. One configurable component engine covers fixed, % above threshold, % of metric, tier step, marginal slab, per-unit bands, scored review, conditions, caps, floors, FX. See `kpi-framework-summary.md`.
9. **Reports** ✅. Report library plus a **custom report builder** for the CEO's one-off questions (product, platform, period, measure). Examples asked for: profitability of brush and hair pick on all platforms · spend on new products / new SKUs in the last 6 months · each marketplace's profitability at GP/NP/CM · weekly payment & cash schedule · product-wise profitability by platform · marketing conversion.
10. **Company health** ✅. Overall score, rule-based alerts, and an AI-written summary with suggestions on where to cut.
11. **Sales vs cash received** ✅. Sales by channel (marketplaces, salons, distributors) vs cash actually received in the bank (QuickBooks).
12. **Salons** ✅. Accounts, orders entered by reps or tagged from Shopify, commission per dated plan (first-order %, recurring % for N months or forever).
13. **Distributors** ✅. John Beeren (JB, Netherlands) is consignment: invoiced in EUR, for units sold only. Separate section per distributor. Marketing fund = **4% of cash paid** (credit/fund-applied amounts don't create fund), less free goods issued. Product credit ledger from QuickBooks credit memos, applied on later invoices. Invoices and aging. **Consignment** (Netherlands): our stock at their site, sell-through reports, invoice on units sold.

14. **AR position & reminders** ✅. One view of everything customers owe us (distributors, salons, wholesale, consignment; from QuickBooks AR) with aging. Automatic reminders go **to the internal person who manages each account** (rep / account owner / Finance), **never to the customer**. Reminders are sent before due, on due and when overdue.

## Open questions for Arslan
- "Avg Burn" unit in the stock count sheet (per month or per day?).
- Should consignment stock count toward PO projection stock? (Assumed no.)
- "New SKU" for the spend report = first PO in the last 6 months. Should first sale date count too?
- Has JB paid invoice JB-2026-08 (€3,714.30)?
- KPI questions: Mehran zero floor; Sadam/Rafay register vs KPI files; which monthly PKR rate.
- Which Amazon source is the truth for month-end: Sellerboard or QuickBooks?
- KPI/bonus questions listed in `excel-analysis/kpi-framework-summary.md` and the individual notes.
- Campaign tracking: is there an existing sheet?
