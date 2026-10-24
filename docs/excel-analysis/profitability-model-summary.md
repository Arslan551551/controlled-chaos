# Profitability Model — What the Portal Must Produce

This note is a synthesis of:

- `best-curl-financials-fmo-aug-26.md` (the QuickBooks-based channel P&L and expense allocation);
- `mehran-kpi-sep-26.md` (Sellerboard Amazon P&L);
- `roas-report-fmo-sep-26.md` (marketing cost, payroll allocation, TikTok sample COGS and the unit-cost table);
- `roas-report-summary-sep-3.md` (MER/ROAS).

## 1. What exists today

| Aspect | Today (Excel) | Gap |
|---|---|---|
| Dimensions | **channel × month** only: Amazon, Shopify, Learn The Cut, TikTok, Walmart, Wholesale/Distributor | **no SKU/product dimension** anywhere in the financial pack |
| Book of record | QuickBooks Online P&L (accrual), pasted monthly | prior months are pasted values; no rule history |
| Levels | Revenue → COGS → **Gross Profit** → Indirect expenses → **Net Income** | **no Contribution Margin**. The ROAS workbook's CM block is `#REF!` |
| Channel attribution of revenue and COGS | by QuickBooks account name (each account belongs to one channel) | fragile name lookups; duplicate names |
| Overhead allocation | per transaction: fixed % (236 rows) or revenue share (42 rows), across Amazon / Shopify / TikTok / Retail | Walmart and Learn The Cut never get overhead; stale fixed splits; remarks contradict the % used |
| Amazon | QuickBooks for the P&L; Sellerboard for KPIs, with indirect expenses **posted into Sellerboard** from the allocation sheet | two Amazon truths (QuickBooks Aug sales 42,068 against Sellerboard 57,805; ads 10,112 against 12,844) |
| COGS | one "Purchase Cost-<channel>" account per channel (Aug: Amazon 5,149.53; Shopify 2,685.33; TikTok 988.55; Walmart 60.40; Wholesale 1,131.74) | how it is computed is undocumented; SKU unit costs exist only in the ROAS workbook's sample table |

August 2026 headline (QuickBooks basis):

| | Amazon | Shopify | LTC | TikTok | Walmart | Wholesale | Total |
|---|---|---|---|---|---|---|---|
| Net revenue | 40,064.64 | 13,817.49 | −33.86* | 6,725.85 | 365.80 | 4,753.08 | 65,693.00 |
| GP (file definition) | 8,518.89 | 6,730.68 | −158.53 | 954.25 | 176.46 | 2,353.92 | 18,575.68 |
| Indirect | 6,960.28 | 15,143.57 | 0 | 6,125.93 | 0 | 4,342.38 | 32,572.16 |
| Net income | 1,558.62 | −8,412.89 | −158.53 | −5,171.68 | 176.46 | −1,988.46 | **−13,996.48** |

\* The LTC revenue figure is actually an FX loss that was mis-placed in this column.

## 2. Definitions: today against recommended

**Today, in the file:**

- **GP = Net revenue − "COGS"**, where "COGS" lumps together:
  - product cost;
  - marketplace and payment fees;
  - fulfilment, warehouse and shipping;
  - platform subscriptions (Shopify, Teachable, QuickBooks);
  - **Amazon advertising only**.
- **NP = GP − all other expenses** (other ads, samples, salaries, interest, G&A, R&D).
- Consequence: Amazon GP is *after* ads, while Shopify and TikTok GP are *before* ads, so GP is not comparable across channels.
- Sellerboard's "Gross profit" is also after ads, and its "Net profit" is after the posted indirects.

**Recommended layered P&L** (each line is tagged with a `cost_class`, so any layer can be produced):

```
Gross sales
 − discounts / promo rebates − returns & refunds
= NET REVENUE                                   (+ shipping income, + other channel income)
 − Product COGS (units sold × landed unit cost, per SKU)          [cost_class = PRODUCT_COGS]
= GROSS PROFIT (GP)                                                -- product margin
 − Channel variable costs: referral/selling fees, FBA/fulfilment, storage, shipping & delivery,
   packaging, payment/transaction fees, warehouse handling         [cost_class = CHANNEL_VARIABLE]
= CM1  (contribution after fulfilment)
 − Marketing: ads (Amazon PPC, Meta, Google, TikTok/GMV Max, Walmart Connect, Reddit),
   samples & gifts (COGS + shipping), affiliate/creator commissions, wholesale commissions,
   email tools                                                    [cost_class = MARKETING]
= CM2  (contribution margin after marketing)   ← "CM" for channel decisions
 − Channel-direct fixed costs: platform subscriptions (Shopify plan, apps, Teachable, Sellerboard),
   dedicated staff (100%-allocated salaries)                      [cost_class = CHANNEL_FIXED]
= CM3  (channel contribution)
 − Allocated shared overheads: shared salaries, rent/utilities, insurance, professional & legal,
   software, R&D, bank charges                                    [cost_class = SHARED_OPEX]
 − Financing: loan & card interest                                [cost_class = FINANCE] (show separately; allocation optional)
 − Other income/expense: FX gain/loss                             [cost_class = OTHER] (company level only)
= NET PROFIT (NP)
```

The QuickBooks-equivalent figures stay reproducible:

- **file-GP** = Net revenue − (PRODUCT_COGS + CHANNEL_VARIABLE + CHANNEL_FIXED platform subscriptions + Amazon ads);
- **NP** is the same in both views, because only the layer boundaries move.

Keep a "QuickBooks view" report so totals tie to QuickBooks Net Income (−13,996.48 for Aug-26).

## 3. Cost-line sourcing and allocation rules

| Cost line | Source | Channel attribution | SKU attribution |
|---|---|---|---|
| Gross sales, discounts, returns | Amazon (SP-API settlements or Sellerboard), Shopify orders/payouts, TikTok settlements, Walmart orders/settlements, wholesale invoices (WSAIO / QuickBooks) | native | native (order line) |
| Product COGS | **SKU cost master** (landed cost per unit: PO cost + freight + duty; versioned by date) × units sold, net of returns restocked | native | native |
| Amazon referral, FBA, storage, inbound, subscription | Sellerboard / SP-API finance events | Amazon | referral and FBA per order line; storage by SKU from the storage-fee report |
| Shopify / Stripe / PayPal / Amazon Pay fees | payouts | Shopify | pro rata to order revenue |
| TikTok transaction / seller fees, shipping | TikTok settlement lines | TikTok | per SKU line |
| GLF / Jet warehouse, shipping & delivery, handling | 3PL invoices (QuickBooks bills) | by 3PL account (GLF → Shopify today; Jet?) | pro rata to units shipped |
| Packaging (ULINE) | QuickBooks | **revenue share** today (A/S/T/R) | pro rata to units |
| Amazon ads | Amazon Ads API | Amazon | campaign → ASIN/SKU |
| Meta / Google / Reddit / email | ad APIs or QuickBooks | Shopify (100% today) | first-click attributed SKU sales, or revenue share |
| TikTok ads / GMV Max, creator tools | TikTok Ads / QuickBooks | TikTok | GMV Max per product |
| Samples (TikTok creator samples) | sample orders × unit cost + sample shipping | TikTok | per SKU (`Sample CGS` method) |
| Shopify samples / zero-net / gifted orders | Shopify zero-net orders × unit cost | Shopify (currently **not** costed) | per SKU |
| Walmart Connect | Walmart Connect | Walmart | per item |
| Salaries | payroll × **employee allocation %** (dated master) | fixed % per employee | revenue share within channel |
| Shared overheads (insurance, filing fees, software, R&D, disposal, bank charges) | QuickBooks transactions | rule per vendor/head: fixed % **or** revenue share (with an explicit list of included channels) | revenue share |
| Loan and card interest | QuickBooks | company level, or a configurable split (today a stale fixed 33.87 / 32 / 0.26 / 33.87) | not allocated |
| FX gain/loss | QuickBooks | company level | – |

**Allocation engine requirements:**

- **Rule resolution order**: transaction override → vendor/memo rule → expense-head default.
- Each rule is `{basis: FIXED | REVENUE_SHARE | UNITS_SHARE | ORDERS_SHARE, splits{channel: %}, included_channels[], valid_from}`.
- The revenue-share basis is the month's **net revenue by channel**. Today it is computed from Amazon, Shopify, TikTok and Retail only: Aug = 61.30 / 21.14 / 10.29 / 7.27 %.
- **Check rules**: the splits of each transaction sum to 100%; Σ allocated = QuickBooks total expenses (32,572.16 for Aug); allocated + unallocated = 0.
- **Amazon→Sellerboard export.** Produce the Amazon indirect total and its category breakdown for posting to Sellerboard (Aug: 9,124.09 per the workbook, 9,614.47 as posted). Exclude items Sellerboard already holds, such as storage fees. Today they are double-posted as "Freight cost".

## 4. Output cube

Grain: **period (month) × channel × SKU (product, with parent product family) × cost_class × account**.

Derived measures per slice:

- net revenue, units, GP, CM1, CM2, CM3, NP;
- each as % of net revenue;
- TACoS (ads / revenue); MER (revenue / marketing incl. payroll; see the ROAS notes); ROAS (attributed / ad spend);
- MoM and YoY change (the Summarize view's "% Change" = (current − prior) / prior).

Reports to reproduce:

1. **Channel P&L Summary** (the `Profit & Loss Summarize` layout): categories Sales / Sale Return / Discount Allowed / Total Revenue / COGS / COGS (Direct Marketing) / GP / 8 indirect categories / Net Income, with columns per channel for the current and prior month and % change.
2. **Detailed channel P&L**: per QuickBooks account.
3. **Allocation register**: every expense transaction with its rule and channel split, and a reconciliation to QuickBooks.
4. **SKU profitability by channel** (new): net revenue, units, COGS, fees, ads, CM per SKU.
5. **Balance-sheet snapshot** and (optional) AR/AP aging and cash forecast. These exist only as stale hidden sheets today.

## 5. Owner questions (profitability side)

1. Agree the **GP / CM / NP definitions**. In particular, should Amazon ads move below GP, as for the other channels?
2. **COGS method.** Which unit-cost master? Landed cost including freight and duty? FIFO, weighted average or standard cost? How is "Purchase Cost-<channel>" booked today?
3. **Amazon basis.** QuickBooks settlements or Sellerboard (order date)? These differ by about $15.7k of sales in August. Which drives the P&L, and which drives Mehran's KPI?
4. Should **Walmart and Learn The Cut** share overheads? Should interest be allocated to channels at all?
5. Should the **salary allocation %** live in one dated master? Several remarks contradict the % applied (Vivienne, Shahrukh), and the ROAS workbook uses different payroll figures.
6. Is the **Sellerboard indirect posting** to be generated by the portal? If so, remove the storage double count, fix the R&D-as-marketing label, and explain the 490.38 Legal difference.
7. Which channel do **Wholesale vs Distributor (Maly's) vs Retail** belong to? Should they be one channel or two? And where does **Learn The Cut** (education) sit: a channel or a separate business line?
8. Should **samples and gifted orders** be costed consistently across Shopify and TikTok (product cost + shipping → marketing)?
9. Should QuickBooks **Classes or Locations** be introduced for channel tagging at entry time, replacing name-based mapping?
