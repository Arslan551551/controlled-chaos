# ROAS Report FMO — Sep 2026 (Final)

Source file: `ROAS_Report_FMO_Sep-26_-_Final.xlsx`.

- 11 sheets, all visible.
- 2 embedded screenshots, no charts.
- Defined name `carrierMethods`, which is unused (left over from the Walmart template).
- "FMO" appears to be the month-end ("for the month of") pack.

## Purpose

The detailed **monthly marketing-efficiency workbook**. Raw exports from each channel go in, and the workbook produces:

- revenue split into new and returning customers, per channel and (for Shopify) per first-click traffic source;
- new and returning customer counts and average revenue per customer;
- marketing/selling cost = ad spend + other channel marketing costs + **allocated marketing payroll**;
- **MER** (marketing efficiency ratio) per channel and source;
- a subscription versus one-time split for Shopify/Wholesale.

The numbers feed the CEO one-pager (`ROAS_Report_Summary_Sep_3.xlsx`, see `roas-report-summary-sep-3.md`).

Despite its name, this workbook does **not** compute platform ROAS. It computes MER. Paid ROAS is computed only in the summary file.

## Sheet map

| # | Sheet | Role | Granularity |
|---|---|---|---|
| 1 | `Summary` | Output: channel MER table, subscription split, broken contribution-margin (CM) block | month × channel |
| 2 | `Marketing ROAS` | Main calc engine | month × channel × Shopify source / wholesale customer |
| 3 | `Raw Data (1st Click)` | Shopify first-click sales export plus 3 helper columns | order (198 rows) |
| 4 | `Sheet2` | Scratch: copy of order name / tags / D2C-WS flag / billing name, and a note on a returned order | order |
| 5 | `Amazon Trend` | Sellerboard Amazon P&L export (Sep and Aug columns) | month |
| 6 | `Michael Sales` | QuickBooks-style customer transaction lists for 3 distributors (Maly's, Netherlands/John Bereens, Scott Missad) | invoice |
| 7 | `Sheet1` | Helper: unique returning-customer billing names mapped to a source; subscription tags; previous-month order lookups; zero-net orders | customer / order |
| 8 | `Others` | Lookups: referring-channel → source mapping; tool subscriptions; **payroll allocation by channel**; Walmart Connect screenshot | reference |
| 9 | `TikTok Data` | TikTok Shop settlement statement lines | order-SKU line (477 rows) |
| 10 | `Walmart Details` | Walmart Seller Center order export (Mar–Sep 2026) | order line (152 rows) |
| 11 | `Sample CGS` | TikTok free-sample (creator) orders → COGS + shipping; TikTok marketing cost; GMV Max daily table; TikTok customer-analysis screenshot | SKU / day |

---

## 1. `Raw Data (1st Click)` (Shopify)

Columns A–P are a Shopify Analytics report export:

`Day | Order name | Sales channel | Marketing channel handle | Marketing delivery channel | Order UTM source | Order UTM medium | Page path | Page host | Referring platform | Referring channel | UTM campaign source | UTM campaign name | Subscription or one-time | Net sales (first click) | Gross sales (first click)`

Columns Q–U are added by the analyst:

| Col | Header | Rule |
|---|---|---|
| Q | Refering Channel (= "source") | `IF(K="", "Others", XLOOKUP(K, Others!A2:A31, Others!B2:B31, "NA"))`. Q13 (safebrowse) and Q22 (chatgpt.com) are **hard-typed "Others"** because those referrers are missing from the map. |
| R | D2C/WS/Affiliate | manual tag: "D2C", "WS" (wholesale) or "Affiliate" |
| S | New/Returning | manual tag: "First order" / "D2C Returning" / blank (wholesale) |
| T | Tags | Shopify order tags (e.g. "Subscription, Subscription Recurring Order", "wsaio-app") |
| U | Billing Name | customer name |

Totals (row 201):

- `O201 = SUBTOTAL(9, O2:O199)` and `P201 = SUBTOTAL(9, P2:P199)` are **filter-dependent**. An autofilter on column K = facebook/instagram is saved in the file, so the cached totals are 296.14 / 348.09.
- Unfiltered totals: Net 14,587.68, Gross 19,670.26.
- 198 orders dated 2026-09-01 to 2026-09-30.
- Sales channels seen: Online Store 92, Smartrr 87, Alloy 7, Wholesale-All-in-one 5, Shop 3, Facebook & Instagram 2, Draft Orders 2.

Source mapping (`Others`!A:B; matching is case-insensitive in Excel):

| Source | Referring channels mapped to it |
|---|---|
| google | google |
| direct | direct |
| facebook/instagram | facebook, instagram |
| Email Marketing | mailchimp |
| Others | klaviyo, amzn_us_shopdirect, duckduckgo, yahoo!, smile_rewards, gmail, capitaloneshopping, Bing, unattributed, shopify, simplycodes, hflip, ecosia, tenereteam, amazon, mywishlist, shop_app, nortonsafesearch, jerseycurlsalon, spectrum |
| Others | blank referring channel (rule in the formula) |

An unmapped referrer returns "NA" and silently drops out of every bucket. The portal should fall back to "Others" and flag the referrer.

Breakdown by R × Q × S (net sales, first click):

| Segment | Source | New/Returning | Orders | Net sales |
|---|---|---|---|---|
| D2C | google | First order | 12 | 1,082.51 |
| D2C | google | Returning | 23 | 2,138.70 |
| D2C | facebook/instagram | First | 3 | 229.14 |
| D2C | facebook/instagram | Returning | 2 | 67.00 |
| D2C | Email Marketing | First | 2 | 99.36 |
| D2C | Email Marketing | Returning | 29 | 2,076.32 |
| D2C | direct | First | 2 | 218.45 |
| D2C | direct | Returning | 9 | 902.26 |
| D2C | Others | First | 8 | 537.76 |
| D2C | Others | Returning | 100 | 4,468.17 |
| Affiliate | (direct) | First | 1 | 139.49 |
| WS | direct | – | 2 | 1,185.84 |
| WS | google | – | 3 | 1,211.80 |
| WS | Others | – | 2 | 230.88 |

## 2. `Marketing ROAS` (calc engine, B2:X32)

Layout: metrics run down rows 5–23, and channel columns run across.

- **Shopify** (C–I): google, facebook/instagram, Email Marketing, direct, Others, Affiliate, Total.
- **Wholesale/Distributor** (K–O): WS Jess, WS Direct Cust., Maly's, Netherlands, Total.
- **Amazon** (Q), **TikTok** (S), **Walmart** (U).

Rows 14 (Guest Posting), 15 (Marketing Tools) and 17 (Affiliate Commission) are hidden and empty.

### Shopify source columns (C–G; H = Affiliate)

For source *s* (header in row 4), with Raw = `Raw Data (1st Click)`:

```
NewRev_s       = Σ Raw.NetSales where R="D2C" and Q=s and S="First Order"        (row 5)
RetRev_s       = Σ Raw.NetSales where R="D2C" and Q=s and S="D2C Returning"      (row 6)
   Affiliate (H): same, but with condition R="Affiliate" only (no source filter)
TotalRev_s     = NewRev_s + RetRev_s                                             (row 7)
NewCust_s      = COUNT(DISTINCT Raw.OrderName where Q=s, R="D2C", S="First Order")   (row 8; dynamic-array ROWS(UNIQUE(FILTER(..))), range rows 2–202)
                 Affiliate H8: distinct order names where R="Affiliate", S="First Order"
RetCust_s      = COUNT of rows in Sheet1 column B equal to s                     (row 9)
                 i.e. number of distinct returning billing names whose (first-found) source is s
                 Affiliate H9: ROWS(UNIQUE(FILTER(Raw.SalesChannel(col C!), R="Affiliate", S="D2C Returning"))) → error → "0"
TotalCust_s    = NewCust_s + RetCust_s                                           (row 10)
AvgRevNew_s    = NewRev_s / NewCust_s     (IFERROR → "0")                        (row 11)
AvgRevRet_s    = RetRev_s / RetCust_s     (IFERROR → "0")                        (row 12)
```

Costs (rows 13–18):

```
Reddit_s (row 22) = RedditSpend × TotalRev_s / (ShopifyTotalRev − AffiliateRev − EmailRev)
                    for s ∈ {google, facebook/instagram, direct, Others}; RedditSpend = I22 = 365 (input);
                    E (Email) and H (Affiliate) receive no Reddit cost.
DirectAds_s (row 23) = input: google 3,760.42 · facebook/instagram 2,373.01 · Email 582.36
AdsCost_s (row 13) = Reddit_s + DirectAds_s
Payroll_s (row 16) = (TotalRev_s / ShopifyTotalRev) × SharedShopifyPayroll + DedicatedPayroll_s
     SharedShopifyPayroll = Others!P15 = ShopifyPayroll(P14) − P5 − P6 − P13 = 1,947.926
     DedicatedPayroll: google += Others!P5 (450.07), facebook/instagram += Others!P13 (393.70),
                       Email += Others!P6 (225.21); direct/Others/Affiliate get no dedicated payroll
TotalCost_s (row 18) = AdsCost_s + Payroll_s     (rows 14,15,17 are empty)
MER_s (row 20)       = TotalRev_s / TotalCost_s  (IFERROR → "0.00")
Shopify Total (col I) = sums across C:H; MER_I = I7 / I18
```

### Wholesale/Distributor (K–O)

- Revenue (K5:N6), customer counts (K8:N9) and costs are **typed inputs**:
  - WS Jess: returning revenue 1,185.84, 2 customers.
  - WS Direct Cust.: returning revenue 1,442.68, 5 customers.
- `M6 = 'Michael Sales'!F28` (Maly's) and `N6 = 'Michael Sales'!D23` (Netherlands). Both are currently 0.
- `Payroll_k (row 16) = TotalRev_k / WholesaleTotalRev × Others!R14` (R14 = 91.335, the "Retail" payroll pool).
- There are no ad costs (row 13 is blank except `M13 = M22`, which is 0).
- `MER_k = TotalRev_k / TotalCost_k`.

### Amazon (Q)

```
Q5 = Q6 = 0, Q8 = Q9 = 0 (no new/returning split)
Q7  TotalRev   = 'Amazon Trend'!B2               (Sellerboard Sales, 51,178.52)
Q13 AdsCost    = −'Amazon Trend'!B16             (Sellerboard Advertising cost, 9,632.21)
Q16 Payroll    = Others!O14 / 30 × 30            (= O14, 889.0818; the /30×30 is a no-op pro-rating stub)
Q18 TotalCost  = Q13 + Q16;  Q20 MER = Q7 / Q18
```

### TikTok (S)

```
S5  NewRev    = 'TikTok Data'!P480 (Σ settlement Net sales = 8,863.13); S6 RetRev = 0
S8  NewCust   = 464 (input, from TikTok Shop Customer Analysis screenshot); S9 RetCust = 14 (input)
S13 MktCost   = 'Sample CGS'!J29 (6,516.26, see §6)
S16 Payroll   = Others!Q14 / 30 × 30 (83.6915)
S20 MER       = S7 / S18
```

### Walmart (U)

All values are typed inputs: new revenue 1,063.36, returning revenue 61.99, new customers 64, returning customers 2, ad spend 364.26 (which matches the Walmart Connect screenshot). There is no payroll. `MER = U7 / U18`.

Stray scratch cells: `S30 = 1150`, `S31 = S30/4`, `S32 = S31 − 150`. These are unrelated to the report.

## 3. `Summary` (output, B2:H41)

Columns: `Metric | Shopify (D2C) | Wholesale/Distributor | Amazon | TikTok | Walmart | Total`.

Rows 4–17 pull from `Marketing ROAS`:

| Row | Metric | Source |
|---|---|---|
| 4–6 | Revenue new / returning / total | rows 5, 6, 7 (Amazon and TikTok totals linked directly) |
| 7–9 | New / returning / total customers | rows 8, 9, sum |
| 10–11 | Avg revenue per new / returning customer | revenue / customers |
| 12 | Ads Spending/Selling Cost | row 13 |
| 13 | Payroll | row 16 |
| 14 | Affiliate Commission (hidden) | row 17 (empty) |
| 15 | Total Marketing Cost | SUM(12:14) |
| 17 | **MER** | Total Revenue / Total Marketing Cost |

- The Total column uses SUM for amounts. For ratios it uses `H4/H7`, `H5/H8` and `H6/H15`.
- Rows 19–24, the subscription split, are calculated on Shopify + Wholesale only:
  - `Subscription = Σ Raw.O where N="subscription"` (3,975.52)
  - `One-time = Σ Raw.O where N="one_time"` (10,612.16)
  - `Others = Σ Raw.O where N=""` (0)
  - Total 14,587.68
- Rows 26–35, the "CM Summary" (contribution margin: Revenue, Variable costs, Variable marketing, Variable opex, CM, CM ratio), are **all `#REF!`** and hidden. The referenced sheet was deleted. The intended maths is `CM = Revenue − (Variable costs + Variable marketing [Shopify] / Variable operating expenses [overall])` and `CM% = CM / Revenue`.
- Rows 37–41, the number of subscribers, are typed values: first order 8, recurring 87, total 95. These correspond to tag counts in `Sheet1`!I: 87 "Subscription Recurring Order", and 7 + 1 "Subscription First Order".

## 4. `Others` (reference and payroll allocation)

- **A:B** – referring-channel → source map (see §1).
- **E:G** – marketing tools (monthly cost; Freepik is pro-rated as annual × 30/365): Freepik 144 → 11.84, Heyzine 29, Veed.io 19, ChatGPT 22.23, semrush 130.45, Envato (blank). Total F9 = 344.68 and G9 = **212.52**. This total is **not used anywhere**; the "Marketing Tools" row in `Marketing ROAS` is empty and hidden.
- **L:W** – payroll allocation. Each employee has a monthly amount N, and percentage splits S:V across Amazon / Shopify / TikTok / Retail(=Wholesale). `O:R = N × %`.
  - Check columns: `I = (J = M)` checks the name match; `K = (N = SUM(O:R))` checks that the split adds to 100%.

| Emp code | Amount | Amazon | Shopify | TikTok | Retail |
|---|---|---|---|---|---|
| CDC-013-26 | 744.02 | 60% | 40% | | |
| CDC-014-26 | 450.07 | | 100% (dedicated to google) | | |
| CDC-012-26 | 225.21 | | 100% (dedicated to Email) | | |
| CDC-003-24 | 304.88 | 40% | 30% | | 30% |
| CDC-001-24 | 905.46 | | 100% | | |
| CDC-007-25 | 179.39 | | 100% | | |
| CDC-006-25 | 185.01 | | 40% | 60% | |
| CDC-009-26 (Mehran) | 197.66 | 100% | | | |
| (no code) | 400.00 | | 100% | | |
| CDC-015-26 | 393.70 | | 100% (dedicated to facebook/instagram) | | |

The employee names are in the file; keep them in the HR table.

Pool totals (row 14):

- Shopify `P14 = SUM(P4:P13)` = **3,016.906**.
- Amazon `O14` = **889.0818 (typed)**.
- TikTok `Q14` = **83.6915 (typed)**.
- Retail `R14` = **91.335 (typed)**.
- `P15 = P14 − P5 − P6 − P13` = 1,947.926, the shared Shopify pool.
- Row 16 = row 14 /30×30 (no-op).
- T15 = 100 (stray).

**The typed pool totals do not equal their column sums.** Amazon Σ O4:O13 = 766.02 (typed 889.08), TikTok Σ = 111.01 (typed 83.69), Retail Σ = 91.46 (typed 91.335). See Questions.

Image: a Walmart Connect "All Campaigns Performance Summary" screenshot showing Add-to-cart 91, Ad Spend $364.26, Total Attr. Sales Revenue $673.47, ROAS $1.85, In-store $0.00.

## 5. `TikTok Data` (TikTok Shop settlement)

- Columns: `Statement date | Statement ID | Payment ID | Status (Paid/Pending) | Currency | Type (Order) | Order/adjustment ID | SKU ID | Quantity | Product name | SKU name | Order created/shipment/delivery date | Total settlement amount | Net sales | Gross sales | Gross sales refund | Seller discount | Seller discount refund | Shipping`.
- 477 lines, 475 distinct orders, 489 units.
- Statement dates 2026-09-01 to 09-30. Order created dates run from 2026-08-13 to 09-27.
- Verified on every row: `Net sales = Gross sales + Gross sales refund + Seller discount + Seller discount refund`.
- Row 480 totals:
  - Settlement 4,675.65
  - **Net sales 8,863.13**
  - Gross 11,113.27
  - Refund −602.77
  - Discount −1,730.30
  - Discount refund 82.93
  - Shipping −2,023.42

## 6. `Sample CGS` (TikTok sample orders and TikTok marketing cost)

- Columns N:X hold a separate TikTok settlement extract of **free sample orders** (217 rows; quantity 200; net sales 0). Each row is charged shipping in X.
- E:L hold the product cost table:

| Col | Field | Rule |
|---|---|---|
| E | TikTok SKU ID | key |
| F/G | Description / internal SKU | |
| H | Unit Cost | **input** (COGS master) |
| I | Qty | `Σ Q where O = E` |
| J | CGS | `H × I` |
| K | Avg shipping per unit | `AVERAGEIF(O = E, X)` (negative) |
| L | Total shipping | `K × I` |

Unit costs in the table (TikTok SKU → internal SKU → unit cost):

| Internal SKU | Unit cost |
|---|---|
| CCHAIRBRUSH1 | 2.50 |
| CONTCHAOSCC3OZ | 2.414 |
| CC-LICS-8OZ | 3.814 |
| CURLCREAM-MEN_3.4OZ | 2.41137 |
| CC-LICS-3.4OZ | 3.072 |
| IE-O3AV-F28K (comb) | 2.26 |
| 6ZCRLGLMN | 8.22 |
| CC-HYDRATING-GEL-8OZ | 6.44 |
| HCLAYMEN3OZ | 5.0674 |
| CC-PRIMERSPRAY-5OZ | 9.615 |
| CLNSAHR8OZGFF | 4.624 |
| CC-SHB-MEN-FF | 4.356 |
| CONTCHAOSBNDL | 14.47 |
| MOISTAHR8OZPO | 3.534 |
| MENBEARDKIT | 3.78 |
| CCHAIRCOMBPW | 1.74 |
| CC-SILKSCRUNCHIES-5PCK | 3.66 |
| CURLCREAM-MEN_5OZ | 3.8832 |
| Flexi-Form brush (no SKU) | 2.37 |

TikTok marketing cost build-up:

```
I25 Qty = 200;  J25 CGS = Σ J = 793.111;  L25 Shipping = Σ L = −871.47
J26 CGS + Shipping   = J25 − L25 = 793.111 + 871.47 = 1,664.581
J27 Join brand       = 1,837.66   (input; creator/affiliate commission?)
J28 Direct Marketing = 3,014.02   (input; TikTok ads?)
J29 Total TikTok marketing cost = J26 + J27 + J28 = 6,516.261  → Marketing ROAS!S13
```

Other parts of the sheet:

- **A:C** – reconciliation check. B = `SUMIF` quantity by SKU and C = `XLOOKUP` of I; they should match.
- **R220/X220/R221** – settlement total −1,365.83, shipping −871.47, and non-shipping −494.36. These are unused.
- **B52:G76** – "Daily GMV Max Ad Performance (2026-09-01 to 2026-09-20)": Date, Spend, SKU Orders, Cost per Order, Revenue, ROI (= revenue / spend). Spend total `C75 = SUM(C55:C74)` = 1,664.65, and revenue `F76 = SUM(F56:F75)` = 2,374.70. The table is informational and not linked.
- **XFD142** – `=SUM(XFD27:XFD141)`, a stray formula in the last column of the sheet.

Image: TikTok Shop "Customer analysis" screenshot (updated 2 Oct 2026) showing Aware 45,676, High-intent 2,791, **New customers 464** (96.18% of GMV) and **Repeat customers 14** (3.82% of GMV), with an aware-customer trend for Sep against Aug. These are the source of the TikTok customer counts.

## 7. `Amazon Trend`

This is the Sellerboard P&L export with columns Sep 2026 / Aug 2026 / Total. Its structure is identical to `PnL SB` in the Mehran KPI file (see `mehran-kpi-sep-26.md` for the row map and the P&L identities).

September: Sales 51,178.52; Advertising cost −9,632.21; Net profit 6,654.05; TACOS 0.1882.

Only B2 and B16 are used.

## 8. `Michael Sales`, `Sheet1`, `Sheet2`

- **Michael Sales** – three QuickBooks-style customer reports:
  - Maly's: one order on 11 Sep, #63617, 447.46, with `E16 = SUM(E2:E15)`.
  - Netherlands (John Bereens, in EUR): blank amount; G22 1.159783 is a FX rate, unused; `D23 = SUM(D20:D22)` = 0.
  - Scott Missad: an open invoice dated 06/26.
- **Sheet1**:
  - A:B – 152 distinct returning billing names. `B = XLOOKUP(name, Raw.U, Raw.Q)` gives the source of the **first matching order**. This list feeds the returning-customer counts.
  - H:I – 95 subscription orders and their tags.
  - L:M – 91 August order numbers looked up in Raw (all "NA").
  - Q:T – 11 zero-net orders (gross 887.05); these look like replacements or gifted orders.
- **Sheet2** – scratch copy of Raw B/T/R/U. It notes "1 Sep order returned #63529" and shows a September Draft Order #63676 (gross 809.85, net 0) labelled "Sample".

---

## Key numbers (test fixtures, Sep 2026)

| Metric | Shopify | Wholesale | Amazon | TikTok | Walmart | Total |
|---|---|---|---|---|---|---|
| Revenue new | 2,306.71 | 0 | 0 | 8,863.13 | 1,063.36 | 12,233.20 |
| Revenue returning | 9,652.45 | 2,628.52 | 0 | 0 | 61.99 | 12,342.96 |
| Total revenue | 11,959.16 | 2,628.52 | 51,178.52 | 8,863.13 | 1,125.35 | **75,754.68** |
| New customers | 28 | 0 | 0 | 464 | 64 | 556 |
| Returning customers | 152 | 7 | 0 | 14 | 2 | 175 |
| Avg rev / new | 82.38 | 0 | 0 | 19.10 | 16.62 | 22.00 |
| Avg rev / returning | 63.50 | 375.50 | 0 | 0 | 31.00 | 70.53 |
| Ads / selling cost | 7,080.79 | 0 | 9,632.21 | 6,516.26 | 364.26 | 23,593.52 |
| Payroll | 3,016.906 | 91.335 | 889.082 | 83.691 | 0 | 4,081.014 |
| Total marketing cost | 10,097.696 | 91.335 | 10,521.292 | 6,599.953 | 364.26 | 27,674.535 |
| **MER** | **1.1843** | **28.7789** | **4.8643** | **1.3429** | **3.0894** | **2.7373** |

Shopify by source (Marketing ROAS C:H):

| Source | Total rev | New cust | Ret cust | Ads (Reddit + direct) | Payroll | Total cost | MER |
|---|---|---|---|---|---|---|---|
| google | 3,221.21 | 12 | 22 | 121.914 + 3,760.42 = 3,882.334 | 974.746 | 4,857.080 | 0.6632 |
| facebook/instagram | 296.14 | 3 | 2 | 11.208 + 2,373.01 = 2,384.218 | 441.936 | 2,826.154 | 0.1048 |
| Email Marketing | 2,175.68 | 2 | 28 | 582.36 | 579.588 | 1,161.948 | 1.8724 |
| direct | 1,120.71 | 2 | 7 | 42.416 | 182.543 | 224.959 | 4.9818 |
| Others | 5,005.93 | 8 | 93 | 189.461 | 815.373 | 1,004.835 | 4.9818 |
| Affiliate | 139.49 | 1 | 0 | 0 | 22.720 | 22.720 | 6.1394 |

Reddit allocation denominator: 11,959.16 − 139.49 − 2,175.68 = 9,643.99.

Other check figures:

- Raw unfiltered net 14,587.68 (= subscription 3,975.52 + one-time 10,612.16).
- TikTok net 8,863.13.
- TikTok marketing cost 6,516.261.
- Others payroll Shopify pool 3,016.906, shared pool 1,947.926.

## Data sources / integrations needed

| Data | System | Granularity |
|---|---|---|
| Orders with first-click referring channel, UTM, subscription flag, net/gross sales, billing name, tags | **Shopify** Analytics (ShopifyQL "sales by first click"), Smartrr (subscriptions), Wholesale All-in-one app, Alloy | order |
| New vs returning flag | Shopify customer order count (`customer.orders_count == 1` → new) or the "First order" tag | order |
| D2C / WS / Affiliate classification | Shopify sales channel / tags (`wsaio-app` → WS), affiliate tag or app | order |
| Ad spend by source | **Google Ads**, **Meta Ads**, **Reddit Ads**, email platform (Mailchimp/Klaviyo) | month (daily available) |
| Amazon sales and ad cost | **Sellerboard** export, or Amazon SP-API plus the Amazon Ads API | month |
| TikTok net sales | **TikTok Shop** Finance → settlement statements | order-SKU line |
| TikTok new/repeat customers | TikTok Shop Analytics → Customer analysis (not in the open API; may need manual entry) | month |
| TikTok sample orders, creator ("Join brand") cost, GMV Max/ads spend | TikTok Shop affiliate/creator centre, TikTok Ads/GMV Max | order / day |
| Walmart orders | **Walmart Marketplace** orders API | order line |
| Walmart ad spend and attributed sales | **Walmart Connect** | month |
| Distributor sales (Maly's, Netherlands, Scott Missad, "Jess") | **QuickBooks** invoices | invoice |
| Payroll per employee and channel split | HR/payroll (manual table) | month × employee |
| Unit cost per SKU | COGS master (shared with inventory) | SKU |
| Marketing tool subscriptions | AP/accounting | month |

## Questions / oddities

1. **Payroll pool totals are typed and do not match their splits.** Amazon O14 = 889.08 against Σ 766.02; TikTok Q14 = 83.69 against Σ 111.01; Retail R14 = 91.335 against Σ 91.46. Which is right? The non-round values (889.0818…, 83.6915…) suggest they were copied from another calculation, perhaps a different month or an FX conversion.
2. **Returning-customer counting differs from new-customer counting.** New customers = distinct *order names*. Returning customers = distinct *billing names* in a hand-built `Sheet1` list (152), with each name's source taken from its first matching order; 153 distinct returning names exist, and "PAULA BIERNAT" is missing. Define one rule, for example distinct Shopify customer ID per source by first-click of that order.
3. **H9 (affiliate returning) filters the wrong column** (Sales channel, column C, instead of order name, column B). It returns "0" only because there are none.
4. **Unmapped referrers drop out**: XLOOKUP returns "NA". Two rows were patched by hand (safebrowse, chatgpt.com). **klaviyo is mapped to "Others", not "Email Marketing"**, while mailchimp is. Is that intended?
5. **Raw-data totals use SUBTOTAL, and a facebook/instagram filter is saved**, so the visible total (296.14) is not the month total (14,587.68).
6. **MER per Shopify source is mostly an allocation artefact.** "direct" and "Others" both show exactly 4.9818 because their only costs (Reddit plus the shared payroll) are allocated pro-rata to revenue. Email and Affiliate are excluded from Reddit allocation but included in the payroll allocation.
7. **The Amazon figures differ from the Mehran KPI file**, which is the same Sellerboard report pulled at a different time: Sales 51,178.52 against 50,983.59, Ads 9,632.21 against 9,604.51. Also, `Amazon Trend`'s September indirect-expense rows equal the August values, and several rows (63–67) are relabelled. The CEO summary mixes both pulls.
8. **TikTok**: all revenue is booked as "new" (returning = 0, despite 14 repeat customers). Revenue is by settlement date, not order date. Marketing cost includes "Join brand" 1,837.66 and "Direct Marketing" 3,014.02 as typed values. What are they exactly (creator commission, ads, samples)? Where do they come from?
9. **The GMV Max table is mis-aligned.** The Cost-per-order / Revenue / ROI columns are shifted one row down relative to Date / Spend / Orders: for example, 4.28 = 47.11 / 11 sits on the 3 Sep row. It also only covers 1–20 Sep.
10. **Walmart values are typed** and do not reconcile with `Walmart Details`. That export has 152 lines from March to September, with September as Excel serial dates rather than real dates; there are 116 September lines, item price sum 2,138.89 and 112 customers, against revenue 1,125.35 and 66 customers in the report.
11. **Wholesale is typed.** "WS Jess" 1,185.84 and "WS Direct Cust." 1,442.68 match the Raw WS rows split direct / (google + Others). Maly's (`Michael Sales`!F28) and Netherlands (D23) link to blank cells, so the Maly's 447.46 order on 11 Sep is **not** counted, and the EUR rate (1.159783) is unused. Should distributor invoices from QuickBooks be included?
12. **The marketing tools cost (212.52/month) is computed but never added** to marketing cost; the row is hidden and empty. Guest posting and affiliate commission rows are also empty. Should they be costs?
13. **The CM (contribution margin) section is broken (`#REF!`)** and hidden. Does the owner want CM per channel in the portal? If so, what are the variable cost definitions?
14. `/30*30` pro-rating stubs (no-ops) suggest the month length was once a variable. Confirm whether partial-month reports are needed.
15. Subscriber counts (8 first / 87 recurring) are typed in the `Summary` sheet. They match the `Sheet1` tag counts, but one order is tagged "First order, Subscription, Subscription First Order".
16. Zero-net orders (11 in `Sheet1`!Q:T, gross 887.05; draft order #63676 "Sample" 809.85) are excluded from revenue, but their product cost is not charged to marketing, unlike TikTok samples. Should Shopify samples and gifted orders be costed the same way?
