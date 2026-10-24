# ROAS Report Summary (CEO view) — Sep 2026, version "Sep 3"

Source file: `ROAS_Report_Summary_Sep_3.xlsx` (2 sheets, no charts, no images, no named ranges).

## Purpose

A one-page **CEO channel scorecard** for 1–30 Sep 2026. It shows sales, new and returning customers, paid-ad-attributed sales, **ROAS** and **MER** for each sales channel (Shopify D2C, Wholesale/Distributor, Amazon, TikTok Shop, Walmart). It also has a Shopify traffic-source breakdown and a subscription versus one-time snapshot.

It is a condensed view of `ROAS_Report_FMO_Sep-26_-_Final.xlsx`. Almost every number here is a **pasted value** taken from that workbook, from the Sellerboard export, or from the ad platforms. The only formulas are the ROAS and MER ratios and the totals.

The banner (A2) defines the two metrics:

- **ROAS** = paid-ad return.
- **MER** = total channel sales ÷ total marketing cost.

## Sheets & columns

### `CEO Summary` (A1:G32)

**Block 1: Channel Performance Summary (rows 4–10)**

Columns: `Channel | Total Sales | New Customers | Returning Customers | Paid Ad-attributed Sales | ROAS | MER`

| Row | Channel | Total Sales | New | Returning | Paid-attr. Sales | ROAS | MER |
|---|---|---|---|---|---|---|---|
| 5 | Shopify | ='MER Inputs'!B2 → 11,959.16 | 28 (input) | 152 (input) | ='MER Inputs'!G2 → 3,517.35 | ='MER Inputs'!I2 → 0.5735 | ='MER Inputs'!F2 → 1.1843 |
| 6 | Wholesale / Distributor | 2,628.52 | 0 | 7 | "N/A" | "N/A" | 28.7789 |
| 7 | Amazon | 51,178.52 | "N/A" | "N/A" | 15,501.69 | 1.6140 | 4.8643 |
| 8 | TikTok | 8,863.13 | 464 | 14 | 5,838.14 | 1.7707 | 1.3429 |
| 9 | Walmart | 1,125.35 | 64 | 2 | 673.47 | 1.8489 | 3.0894 |
| 10 | TOTAL | `SUM(B5:B9)` → 75,754.68 | 556 | 175 | 25,530.65 | `E10 / SUM('MER Inputs'!H2:H6)` → **1.3161** | `B10 / SUM('MER Inputs'!E2:E6)` → **2.7373** |

New and returning customer counts (C5:D9) are typed numbers.

**Block 2: Shopify Source Performance (rows 14–20)**

Columns: `Source | Sales | New Customers | Returning Customers | Ad Spend | ROAS`. All values are typed except ROAS = `IFERROR(Sales/AdSpend, 0)`, with "N/A" typed where spend is 0.

| Source | Sales | New | Returning | Ad Spend | ROAS |
|---|---|---|---|---|---|
| Google | 3,221.21 | 12 | 22 | 3,760.42 | 0.8566 |
| Facebook / Instagram | 296.14 | 3 | 2 | 2,373.01 | 0.1248 |
| Email Marketing | 2,175.68 | 2 | 28 | 582.36 | 3.7360 |
| Direct | 1,120.71 | 2 | 7 | 0 | N/A |
| Others | 5,005.93 | 8 | 93 | 0 | N/A |
| Affiliate | 139.49 | 1 | 0 | 0 | N/A |

These six sources sum to Shopify sales 11,959.16, 28 new and 152 returning customers.

**Block 3: Subscription vs One-Time Snapshot (rows 24–26)**

Columns: `Channel / Group | Subscription Sales | One-Time / Non-Sub Sales | Subscribers / Active Subs | New Subs | Recurring Subs`

| Group | Sub sales | One-time | Subscribers | New | Recurring |
|---|---|---|---|---|---|
| Shopify + Wholesale | 3,975.52 | 10,612.16 | `=E25+F25` → 95 | 8 | 87 |
| Amazon | 6,501.60 | `=B7-B26` → 44,676.92 | 230 | N/A | N/A |

### `MER Inputs` (A1:I11)

One row per channel (rows 2–6). Columns:

| Col | Header | Type |
|---|---|---|
| A | Channel | key |
| B | Total Sales | input |
| C | Marketing / Selling Cost | input (ad spend + other selling/marketing cost) |
| D | Marketing Salary (Input) | input (allocated payroll) |
| E | Total Marketing Cost | `=C+D` |
| F | MER | `=IFERROR(B/E, 0)` |
| G | Paid Ad-attributed Sales | input ("N/A" for Wholesale) |
| H | Paid Ad Spend | input ("N/A" for Wholesale) |
| I | ROAS | `=IFERROR(G/H, 0)` |

Values:

| Channel | B Sales | C Mkt/Selling | D Salary | E Total cost | F MER | G Paid sales | H Paid spend | I ROAS |
|---|---|---|---|---|---|---|---|---|
| Shopify | 11,959.16 | 7,080.79 | 3,016.906 | 10,097.696 | 1.18435 | 3,517.35 | 6,133.43 | 0.57347 |
| Wholesale / Distributor | 2,628.52 | 0 | 91.335 | 91.335 | 28.77889 | N/A | N/A | 0 (IFERROR) |
| Amazon | 51,178.52 | 9,632.21 | 889.0818 | 10,521.2918 | 4.86428 | 15,501.69 | 9,604.51 | 1.61400 |
| TikTok | 8,863.13 | 6,516.2611 | 83.6915 | 6,599.9526 | 1.34291 | 5,838.14 | 3,297.06 | 1.77071 |
| Walmart | 1,125.35 | 364.26 | 0 | 364.26 | 3.08941 | 673.47 | 364.26 | 1.84887 |

Rows 9–11 hold the definitions table:

- MER = Total Sales ÷ (Marketing/Selling Cost + Marketing Salary).
- ROAS = Paid Ad-attributed Sales ÷ Paid Ad Spend. N/A where paid-attributed sales are not available.

## Calculations

For each channel *c* in the month:

```
TotalMarketingCost_c = MarketingSellingCost_c + MarketingSalary_c
MER_c   = TotalSales_c / TotalMarketingCost_c            (0 if cost = 0)
ROAS_c  = PaidAdAttributedSales_c / PaidAdSpend_c        (0 / "N/A" if not available)

Blended MER  = Σ TotalSales_c / Σ TotalMarketingCost_c   = 75,754.68 / 27,674.535 = 2.73734
Blended ROAS = Σ PaidAdAttributedSales_c / Σ PaidAdSpend_c (channels with N/A are excluded)
             = 25,530.65 / (6,133.43 + 9,604.51 + 3,297.06 + 364.26 = 19,399.26) = 1.31606
Shopify source ROAS_s = SourceSales_s / SourceAdSpend_s

Amazon one-time sales = Amazon TotalSales − Amazon subscription sales = 51,178.52 − 6,501.60
Shopify+WS subscribers = NewSubs + RecurringSubs = 8 + 87 = 95
```

Note that blended ROAS divides by the **sum of ROAS spend** (`H`). Blended MER divides by the **sum of total marketing cost** (`E`). These are different denominators.

### Where each input comes from (traced to the FMO workbook)

| Input | Origin |
|---|---|
| Shopify Total Sales 11,959.16 | FMO `Marketing ROAS`!I7, the sum of Shopify first-click net sales over D2C plus Affiliate rows |
| Shopify Mkt/Selling cost 7,080.79 | FMO `Marketing ROAS`!I13 = Google 3,760.42 + Meta 2,373.01 + Email 582.36 + Reddit 365 |
| Shopify Paid sales 3,517.35 | Google 3,221.21 + Facebook/Instagram 296.14, first-click sales from paid sources (including returning-customer orders) |
| Shopify Paid spend 6,133.43 | Google 3,760.42 + Meta 2,373.01 (Reddit and email excluded) |
| Salaries (D) | FMO `Others` payroll allocation: Shopify P14, Wholesale R14 ("Retail"), Amazon O14, TikTok Q14 |
| Amazon Sales 51,178.52 and Mkt cost 9,632.21 | Sellerboard export in FMO `Amazon Trend` (B2, −B16) |
| Amazon Paid sales 15,501.69 and Paid spend 9,604.51 | Sellerboard export in **Mehran KPI** `PnL SB` (B4, −B16). This is a different pull; see the oddities below |
| TikTok Sales 8,863.13 | FMO `TikTok Data`!P480, the sum of settlement "Net sales" |
| TikTok Mkt cost 6,516.26 | FMO `Sample CGS`!J29 = sample COGS + sample shipping + "Join brand" + "Direct Marketing" |
| TikTok Paid sales 5,838.14 and spend 3,297.06 | Not in any workbook; presumably TikTok Ads Manager / GMV Max for the full month |
| TikTok new 464 / returning 14 | Screenshot of TikTok Shop "Customer analysis" (in the FMO file) |
| Walmart 1,125.35 / 673.47 / 364.26 / 64 / 2 | Walmart Connect "All Campaigns Performance Summary" screenshot (Ad spend 364.26, attributed sales 673.47, ROAS 1.85) plus typed values |
| Subscription split, Shopify+WS | FMO `Summary`!C21:C22 (SUMIFS on Shopify "Subscription or one-time") |
| Amazon subscription 6,501.60 and "230" | Mehran KPI `PnL SB` B7 (Subscription sales est.) and B13 (Subscription **units**) |

## Key numbers (test fixtures, Sep 2026)

- Total sales 75,754.68 · New customers 556 · Returning customers 175 · Paid-attributed sales 25,530.65.
- Total marketing cost 27,674.535 · Total paid ad spend 19,399.26.
- **Blended MER 2.7373 · Blended ROAS 1.3161**.
- MER by channel: Shopify 1.1843, Wholesale 28.7789, Amazon 4.8643, TikTok 1.3429, Walmart 3.0894.
- ROAS by channel: Shopify 0.5735, Amazon 1.6140, TikTok 1.7707, Walmart 1.8489.
- Shopify source ROAS: Google 0.8566, Facebook/Instagram 0.1248, Email 3.7360.
- Subscriptions: Shopify+WS 3,975.52 subscription against 10,612.16 one-time; 95 subscribers (8 new, 87 recurring). Amazon 6,501.60 subscription against 44,676.92 one-time.

## Data sources / integrations needed

- **Shopify** Analytics "Sales by first-click attribution" (order-level, with referring channel, UTM, subscription flag and customer type). Also **Smartrr** for subscription orders and the **Wholesale All-in-one** app for wholesale orders.
- **Google Ads**, **Meta Ads**, **Reddit Ads** spend; **Mailchimp/Klaviyo** cost (email).
- **Amazon**: Sellerboard, or SP-API plus the Amazon Ads API: sales, PPC same-day sales, ad cost, Subscribe & Save.
- **TikTok Shop** settlement statements, TikTok Shop Customer Analysis (new/repeat buyers), TikTok Ads / GMV Max (paid sales and spend), and the creator/affiliate ("Join brand") cost.
- **Walmart Marketplace** orders and **Walmart Connect** ad report.
- **Payroll allocation** table: employee × channel %.
- Granularity: monthly × channel (plus Shopify source). No daily or ASIN detail in this file.

## Questions / oddities

1. **Amazon mixes two Sellerboard pulls.** Sales (51,178.52) and Marketing cost (9,632.21) come from the FMO `Amazon Trend` export, but paid-ad sales (15,501.69) and ROAS spend (9,604.51) come from the Mehran `PnL SB` export. The same month therefore has two ad-cost figures. The portal should use a single locked month-end snapshot.
2. **The Amazon "Subscribers / Active Subs" value of 230 is subscription units**, not active subscriptions. Sellerboard's "Active subscriptions (SnS)" is 673. Amazon one-time sales (44,676.92) also mixes the two sources (51,178.52 − 6,501.60 from the other pull, which would give 44,570.20 against Amazon Trend's own Direct sales).
3. **Shopify paid-attributed sales use first-click attribution** and include returning-customer orders whose first click was Google or Meta. Confirm that this is the ROAS the business wants, rather than platform-reported conversion value.
4. **Shopify ROAS spend excludes Reddit (365) and email (582.36)**, but MER cost includes them. Keep this distinction explicit in the portal.
5. TikTok paid sales and spend (5,838.14 / 3,297.06) do not appear in any supporting sheet. What is their source (GMV Max full month)? The FMO GMV Max table only covers 1–20 Sep (spend 1,664.65).
6. **TikTok returning customers = 14, but returning revenue = 0.** All TikTok revenue is treated as "new". Also, TikTok Total Sales is settlement-date based (it includes orders created from 13 Aug), not order-date based.
7. Walmart sales 1,125.35 do not reconcile to the Walmart order export in the FMO file: 116 September order lines, item price sum 2,138.89, 112 unique customers, against 66 customers here. Which definition is correct (net of refunds, delivered only, or something else)?
8. Wholesale ROAS shows 0 in `MER Inputs` (IFERROR on "N/A") but "N/A" in the CEO view. The portal should return null, not 0.
9. Wholesale MER (28.8) only counts allocated payroll as cost. Are distributor margins, commissions or trade discounts meant to be included?
10. New and returning customer counts are typed numbers. In the portal they must be computed: see the FMO note for the exact counting rules, which count unique orders for new customers and unique billing names for returning customers.
