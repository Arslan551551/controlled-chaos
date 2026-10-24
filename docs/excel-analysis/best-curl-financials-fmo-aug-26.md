# Best Curl Financials — FMO Aug 2026

Source file: `Best_Curl_Financials_FMO_Aug-26.xlsx`. Legal entity: **Best Curls Ever Inc**.

- 17 sheets. Visible: 5. Hidden: 12.
- No charts or images. The 2 VML drawings hold **cell comments**.
- No named ranges.
- "FMO" means "for the month of".

## Purpose

The monthly **management P&L by sales channel**, built on top of QuickBooks Online (accrual basis, exported 4 Sep 2026). It:

1. pastes the QuickBooks P&L for the month (`Profit and Loss working`);
2. maps every QuickBooks revenue and COGS account to **one channel column**, by placement in the row layout;
3. allocates **every indirect-expense transaction** to Amazon / Shopify / TikTok / Retail (wholesale), either with a fixed % per transaction or pro rata to channel revenue (`Profit & Loss Allocation`);
4. rolls this up into a detailed and a summarised channel P&L (Revenue → COGS → **Gross Profit** → Indirect Expense → **Net Income**), comparing **July 2026 with August 2026**;
5. produces the **Amazon indirect-expense figure that is posted into Sellerboard**, so that Sellerboard's Amazon "Net profit" (used for Mehran's profit share) includes overheads.

There is **no product/SKU dimension** anywhere in the workbook, and **no contribution margin (CM) line**. Profitability is channel × month only.

## Sheet map

| # | Sheet | State | Role |
|---|---|---|---|
| 1 | `Profit & Loss Summarize` | visible | **Output**: channel P&L by category, Jul against Aug, % change |
| 2 | `Profit & Loss (Detailed) ` (trailing space) | visible | Account-level channel P&L. Aug columns pull from QuickBooks and the allocation sheet. Jul columns are pasted values |
| 3 | `Profit and Loss working` | visible | QuickBooks P&L export, August 2026 (A = account, B = amount) |
| 4 | `Profit & Loss Allocation` | visible | Transaction-level indirect-expense allocation (QuickBooks transaction detail with % splits) |
| 5 | `Transactions Report` | hidden | QuickBooks "Transaction Detail by Account" for expense accounts, August; reconciles to the allocation total |
| 6 | `Balance Sheet` | visible | QuickBooks balance sheet as of 31 Aug 2026 |
| 7 | `Cash Flow Forecast` | hidden | Monthly cash forecast Aug-2024 → Mar-2026 (stale) |
| 8–11 | `Account Payable`, `AP`, `Account Receivable`, `AR` | hidden | AP/AR listings. `AP` and `AR` are aging summaries as of 31 Mar 2025 (stale) |
| 12 | `Sales & Marketing Ledger` | hidden | QuickBooks transaction report, Feb 2026, Sales & Marketing accounts (stale) |
| 13 | `Michael B2B` | hidden | QuickBooks transactions for distributor consultant Michael Casella (Jan 2026; stale) |
| 14 | `Bank` | hidden | QuickBooks bank register, operating account, Feb 2025 (stale) |
| 15 | `Cash Flow Financial` | hidden | Indirect cash-flow statement "September – Jan 2025" (stale; broken links) |
| 16, 17 | `PayPal Ledger (2)`, `Best Curl Ever Ledger` | hidden | Bank/PayPal registers, Nov 2024 (stale), feeding the Cash Flow Forecast inflows |

---

## 1. Channel model

The channel columns are the same in every P&L sheet:

| Detailed col (Jul / Aug) | Channel | Notes |
|---|---|---|
| D / K | **Amazon** | |
| E / L | **Shopify** (D2C website) | includes Amazon Pay, Stripe and PayPal checkout revenue |
| F / M | **Learn The Cut** | education product (Teachable). Hidden in the Summarize view |
| G / N | **TikTok** (TikTok Shop) | |
| H / O | **Walmart** | |
| I / P | **WholeSale / Distributor** ("Retail" in the allocation sheet) | wholesale (WSAIO app) plus distributors (Maly's) |
| J / Q | Grand Total | `=SUM(channel columns)` |

A **channel is decided by the QuickBooks account**, not by a QuickBooks class. Each account sits in exactly one channel's column, either because its name is channel-specific ("Purchase Cost-Amazon", "Shiping Fee Tiktok") or because of its parent group:

- Amazon Warehouse → Amazon;
- CGS-Warehouse GLF → Shopify;
- Wholesale CGS → Wholesale;
- Walmart CGS → Walmart.

## 2. `Profit and Loss working` (QuickBooks input)

- Row 3 is "August 2026". Footer: "Friday, Sep 04, 2026 10:06:49 AM GMT-7 – Accrual Basis".
- Column A is the account name, indented in QuickBooks style. Column B is the amount: leaf values are typed as `=<number>`, and totals are QuickBooks' nested sums.

Key August totals:

| Line | Amount |
|---|---|
| Total Amazon | 40,064.64 |
| Total Shopify | 13,817.49 |
| Total Wholesale | 4,753.08 |
| "Total Revenue" (QuickBooks group: Amazon + Shopify + Wholesale) | 58,635.21 |
| Total Tiktok | 6,725.85 |
| Total Walmart | 365.80 |
| **Total Income** | **65,726.86** |
| **Total COGS** | **47,117.32** |
| **Gross Profit (QuickBooks)** | **18,609.54** |
| **Total Expenses** | **32,572.16** |
| Net Operating Income | −13,962.62 |
| Other Expenses: Exchange Gain or Loss | 33.86, so Net Other Income −33.86 |
| **Net Income** | **−13,996.48** |

## 3. `Profit & Loss (Detailed) ` (A1:AQ241)

Hidden helper columns:

- **A** = Summarize category key: `Sales`, `Sale Return`, `Discount Allowed`, `Cost of Goods Sold`, `Cost of Goods Sold (Direct Marketing)`, `Advertising & Marketing Exp`, `Financial Charges`, `Other General & Admin Exp`, `Tools & Software`, `Website Development Exp`, `Insurance on Stock Exp`, `Research and Development`, `Salaries & Wages`.
- **B** = the allocation lookup key (the expense head name used in the allocation sheet column B).

Cell comments (author: Muhammad Hassan):

| Cell | Comment |
|---|---|
| C73 | "amazon cgs" |
| C80 | "shopify cgs" |
| C90 | "tiktok cgs" |
| C102 | "total exp qb * as per revenue %" |

Formula patterns:

| Pattern | Where | Plain maths |
|---|---|---|
| `XLOOKUP($C, PLW!A:A, PLW!B:B, "0")` | Aug revenue and COGS cells, in the owning channel's column only | amount of the QuickBooks account whose name equals the label in C (first match from the top) |
| `XLOOKUP(..., "0", 0, -1)` | P108 Wholesale "Purchase Cost" | **search from the bottom**, because "Purchase Cost" also exists under Walmart CGS. This is a fragile duplicate-name workaround |
| `SUMIF(Alloc!B:B, DET!B<row>, Alloc!F/G/H/I)` | Aug expense cells K/L/N/P | Σ of allocated amounts for that expense head and channel (F = Amazon, G = Shopify, H = TikTok, I = Retail → Wholesale column P) |
| `XLOOKUP(QuickBooks)*W11 … *AA11` | row 102 (Merchant Fee: QuickBooks) | QuickBooks subscription split by revenue share (**misaligned**, see Q2) |
| `SUM(D:I)`, `SUM(K:P)` | J, Q | grand totals. Expense rows 128–137 use `ROUND(…,1)` |
| Jul columns D–I | | **typed values** pasted from last month's file |

Revenue-share helper (W8:AA15, from August totals):

```
Amazon  W9 = Q15 = 40,064.64     Shopify X9 = Q44 = 13,817.49
TikTok  Y9 = Q49 =  6,725.85     Retail  Z9 = Q24 + Q17 = 4,753.08 (+ Maly's 0)
AA9 = Σ = 65,361.06   (Walmart and Learn The Cut are EXCLUDED)
Share W15/X15/Y15/Z15 = 0.612975 / 0.211403 / 0.102903 / 0.072720   (W11:Z11 identical)
Amazon-vs-Shopify only (W24:Y25): 40,064.64 / 13,817.49 → 0.743562 / 0.256438
```

P&L lines (August values, by channel):

| Section / line | QuickBooks accounts (C) | Amazon | Shopify | LTC | TikTok | Walmart | Wholesale | Total |
|---|---|---|---|---|---|---|---|---|
| **Revenue: Amazon** | Fee Adjustment 0, Inventory Adjustment 180.48, Seller Promo Rebate −1,379.76, Seller Sale 42,068.33, Seller Sale Return −804.41 | 40,064.64 | | | | | | 40,064.64 |
| **Revenue: Distributor** | Maly's Sale | | | | | | 0 | 0 |
| **Revenue: Wholesale** | Discount on Wholesale −3,832.61, Returns 0, Sale 8,402.69, Shipping Income 183 | | | | | | 4,753.08 | 4,753.08 |
| **Revenue: Shopify** | Amazon Pay Sale 296.27, Shopify Payment Discount −2,625.56, Shopify Payment Sale 15,559.09, Sale Return −54.63, Shipping Income 326.28, Stripe Payment Sale 316.04 (Afterpay/PayPal/Stripe discount/returns 0) | | 13,817.49 | | | | | 13,817.49 |
| **Revenue: TikTok** | Discount −1,298.48, Revenue 8,521.10, Sale Return −496.77 | | | | 6,725.85 | | | 6,725.85 |
| **Revenue: Walmart** | Walmart Sales | | | | | 365.80 | | 365.80 |
| Total Revenue (row 53) | | 40,064.64 | 13,817.49 | 0 | 6,725.85 | 365.80 | 4,753.08 | 65,726.86 |
| Net Other Income (row 55) | **FX loss −33.86, put in the Learn The Cut column** | | | −33.86 | | | | −33.86 |
| **Total Income (row 56)** | | 40,064.64 | 13,817.49 | −33.86 | 6,725.85 | 365.80 | 4,753.08 | **65,693.00** |
| COGS: Amazon Warehouse | Cost of Advertising 10,111.77 (category "COGS (Direct Marketing)"), FBA Fee 3,608.07, Storage fees 2,070.49, Seller Subscription 22.68, Selling Fee (referral) 10,489.88, **Purchase Cost-Amazon 5,149.53** | 31,452.42 | | | | | | 31,452.42 |
| COGS: CGS-Warehouse GLF (Shopify) | Amazon Pay txn fee 7.10, GLF Warehouse Fee 714.07, **Purchase Cost Shopify-Warehouse 2,685.33**, Shipping & Delivery 1,868.02, Shopify Monthly Subscription 1,085.82, Shopify Transaction Fee 455.16, Stripe fee 8.67, Tools for Shopify 230.45 | | 7,054.62 | | | | | 7,054.62 |
| COGS: TikTok CGS | **Purchase Cost Tiktok 988.55**, Packaging 0, Shipping Fee 2,418.15, Seller Fee 7.24, Transaction Fee 1,999.01, Warehouse Charges 347.58 | | | | 5,760.53 | | | 5,760.53 |
| COGS: Walmart CGS | **Purchase Cost 60.40**, Shipping Cost 128.94 | | | | | 189.34 | | 189.34 |
| COGS: Merchant Fee | QuickBooks subscription 152.25 × revenue share | 93.33 | 32.19 | 15.67 | 11.07 | 0 | 0 | 152.25 |
| COGS: Wholesale CGS | **Purchase Cost 1,131.74**, Shipping Charges 247.51, Storage Processing 675, Transaction Fee 99.28, Warehouse & Handling 245.63 (Complementary/Lost Goods 0) | | | | | | 2,399.16 | 2,399.16 |
| COGS: Distributor (Maly's) | Purchase / Warehouse / Shipping | | | | | | 0 | 0 |
| COGS: Learn the Cut | Teachable Account Fee 109 (Training Course, Stripe fee 0) | | | 109 | | | | 109 |
| **Total COGS (row 125)** | | 31,545.75 | 7,086.81 | 124.67 | 5,771.60 | 189.34 | 2,399.16 | **47,117.32** |
| **Gross Profit (row 126)** = Total Income − Total COGS | | **8,518.89** | **6,730.68** | **−158.53** | **954.25** | **176.46** | **2,353.92** | **18,575.68** |
| Expenses (rows 128–209) | allocation `SUMIF` per head, see §4 | 6,960.28 | 15,143.57 | 0 | 6,125.93 | 0 | 4,342.38 | **32,572.16** |
| **Net Income (rows 211–212)** = GP − Expenses | | **1,558.62** | **−8,412.89** | **−158.53** | **−5,171.68** | **176.46** | **−1,988.46** | **−13,996.48** |

Check: `AB212 = Q212 − XLOOKUP("Net Income", PLW)` → 0 ✓. The GP in this sheet (18,575.68) differs from QuickBooks GP (18,609.54) by exactly the FX loss, which is moved above GP into "income".

Expense block (rows 127–210), with August totals by line:

| Line | Amount |
|---|---|
| Bank Charges | 93.70 |
| Distributor/Wholesale: Other Business Expense | 137 |
| General & Admin (row 163) | 2,564.23 |
| Insurance on Stock | 335.43 |
| Business loan interest | 5,084.15 |
| Credit card interest | 717.18 |
| Professional Fee | 1,087.44 |
| New product development (R&D) | 2,778.82 |
| Salaries & Wages | 7,232.63 |
| Sales & Marketing (row 192) | 11,860.32 |
| Sales Tax Paid | 95 |
| Tax return charges | 223.38 |
| Travelling (row 203) | 119.33 |
| Utilities (row 208) | 243.55 |

General & Admin (row 163) is made up of Wholesale Commission 25.49, Packaging 503.32, Affiliate Commission 54.30, Director Expense 159, Corporation Filing Fees 234.61, Dues & Subscription 526.05, Google Email 712.80, Office Supplies & Software 305.45 and Website 43.21.

Sales & Marketing (row 192) is made up of Advertising & Marketing 49.21, Facebook Marketing 3,699.81, Gifts & samples 3,322.85, TikTok Marketing 2,287.52, Google Adspend 1,918.57 and Marketing SEO Tools (Mailchimp) 582.36.

**Total Expenses** = `J/Q210` = the sum of the section totals listed in the formula.

Scratch areas (not used by the outputs):

- **AC158:AF161** is an old warehouse-rent split (415.71 × 45.83 / 31.43 / 0.41 / 22.34 %).
- **AC178:AD180** is an old digital-marketing split (1,063.22 × 27.09 / 72.91 %).
- **AF174:AI177** holds names (viviene / micheal / zoha / muhammad shahrukh) with 917 and 458.56.
- **AP165** = K165 + K168 = 1,964.91. This is the Amazon interest posted to Sellerboard.
- **AQ149** = K149 + K150.
- Rows 214–231 hold stale reconciliations: `#REF!`, "Profit as Per Old Profit & Loss" 1,948.87, and a "Should be Zero" cell that shows 16,043.29.

## 4. `Profit & Loss Allocation` (B1:X314): how indirect expenses are split

There is one row per QuickBooks expense transaction (or per expense head with a placeholder row), 298 rows in total. Columns:

| Col | Field |
|---|---|
| B | Expense head, which equals Detailed column B |
| C | Date |
| D | Description (bank or card memo) |
| E | QuickBooks head (sometimes) |
| **F / G / H / I** | Allocated **Amazon / Shopify / TikTok / Retail** |
| J | `= F + G + H + I` |
| K | Remarks |
| **P / Q / R / S** | **New Allocation %** for Amazon / Shopify / TikTok / Retail, or the text "As per Amazon, Tik Tok, Shopify and Retail revenue" |
| T | `= P + Q + R + S` (should be 100) |
| **U** | Amount from QuickBooks (input) |
| V | `= (U = J)`, a check |
| W | `= J − U` |
| X | Notes |

Three allocation methods are used:

```
(1) Fixed %      F = U × P%,  G = U × Q%,  H = U × R%,  I = U × S%          (236 rows)
(2) Revenue %    F = U × W15, G = U × X15, H = U × Y15, I = U × Z15          (42 rows: Amazon/Shopify/TikTok/Retail revenue shares)
(3) Amazon+Shopify revenue %   F = U × W25, G = U × X25 (H, I = 0)          (tax return charges, rows 177–179)
(+ two rows hard-coded F = U × 50%: ULINE ship supplies, Dollar Tree)
```

Walmart and Learn The Cut **never receive any indirect expense**. Their Net Income therefore equals their GP.

August allocation by head (only heads with amounts; F / G / H / I = Amazon / Shopify / TikTok / Retail):

| Head | Method / split | Amazon | Shopify | TikTok | Retail | Total |
|---|---|---|---|---|---|---|
| Salaries & Wages | **fixed % per employee** (below) | 1,908.43 | 3,918.01 | 85.49 | 1,320.70 | 7,232.63 |
| Business loan interest (7 lines) | fixed 33.87 / 32 / 0.26 / 33.87 | 1,722.00 | 1,626.93 | 13.22 | 1,722.00 | 5,084.15 |
| Credit card interest | fixed 33.87 / 32 / 0.26 / 33.87 | 242.91 | 229.50 | 1.86 | 242.91 | 717.18 |
| New product development (6 lines) | revenue % | 1,703.34 | 587.45 | 285.95 | 202.08 | 2,778.82 |
| Facebook Marketing (6 lines) | 100% Shopify | | 3,699.81 | | | 3,699.81 |
| Google Adspend | 100% Shopify | | 1,918.57 | | | 1,918.57 |
| Marketing SEO Tools (Mailchimp) | 100% Shopify | | 582.36 | | | 582.36 |
| Gifts & samples (Sample Allocation 1,347.03 + Samples Shipping 1,975.82) | 100% TikTok | | | 3,322.85 | | 3,322.85 |
| Tiktok Marketing (content tool 581.40 + TikTok Ads 1,706.12) | 100% TikTok | | | 2,287.52 | | 2,287.52 |
| Advertising & Marketing (Amazon card charges, JoinBrands −124.97 credit) | 100% Amazon | 49.21 | | | | 49.21 |
| Professional Fee | Anam 800 100% Shopify; Fiverr 218 and VAT returns 69.44 by revenue % | 176.19 | 860.77 | 29.58 | 20.90 | 1,087.44 |
| Google Email (Workspace) | fixed 10 / 60 / 0 / 30 | 71.28 | 427.68 | | 213.84 | 712.80 |
| Dues & Subscription | Sellerboard 159 100% Amazon; ChatGPT, Claude, Envato, Stamps.com 100% Shopify; one 55 tool by revenue % | 192.71 | 323.68 | 5.66 | 4.00 | 526.05 |
| Packaging Cost (ULINE) | revenue % | 308.52 | 106.40 | 51.79 | 36.60 | 503.32 |
| Office Supplies & Software | mixed: Veed 100% Retail; CapCut and Staples 1/3 each A/S/R; Zoom, Apple, Dropbox, Heyzine, HotspotShield 100% Shopify | 26.30 | 233.86 | | 45.30 | 305.45 |
| Insurance on Stock | fixed 1/3 Amazon, Shopify, Retail | 111.81 | 111.81 | | 111.81 | 335.43 |
| Corporation Filing Fee (monthly allocation) | revenue % | 143.81 | 49.60 | 24.14 | 17.06 | 234.61 |
| Tax return charges (TaxCloud 2,904/13 per month) | Amazon+Shopify revenue % | 166.10 | 57.28 | | | 223.38 |
| Disposal & waste fees | revenue % | 106.42 | 36.70 | 17.87 | 12.63 | 173.62 |
| Director Expense | 50 Shopify / 50 Retail | | 79.50 | | 79.50 | 159 |
| Other Business Expense (reimbursement, Direct Non-Sale) | 100% Retail | | | | 137 | 137 |
| Sales Tax Paid (NY state / county / transit) | 100% Shopify | | 95.00 | | | 95.00 |
| Bank Charges (service charge, late fee) | 1/3 Amazon, Shopify, Retail | 31.23 | 31.23 | | 31.23 | 93.70 |
| Telephone (RingCentral) | 100% Shopify | | 69.93 | | | 69.93 |
| Affiliate Commission | 100% Shopify | | 54.30 | | | 54.30 |
| Website Development (hosting) | 100% Shopify | | 43.21 | | | 43.21 |
| Wholesale Commission | 100% Retail | | | | 25.49 | 25.49 |
| Travel (accommodation, parking, transport, meals) | 100% Retail | | | | 119.33 | 119.33 |
| **Grand total (row 300)** | | **6,960.28** | **15,143.57** | **6,125.93** | **4,342.38** | **32,572.16** |

Reconciliations:

- `U300` = 32,572.16, which equals the `Transactions Report` TOTAL (`I217` check TRUE) and QuickBooks Total Expenses.
- `X300` note: "NOT MORE THEN 0.00".

Salary allocation (fixed % per employee; USD amounts as booked in QuickBooks for August):

| Employee | Booked | Amazon / Shopify / TikTok / Retail |
|---|---|---|
| Vivienne Marzan | 2 × 967 | 33.3 / 33.3 / – / 33.3. The K remark says "half month salary fixed to Amazon, remaining to Shopify", which contradicts this; X says "33.33 other than tiktok" |
| Hafiz Ahmed | 93.61 | Shopify 100 |
| Muhammad Rafay | 375.04 | Shopify 100 |
| Muhammad Shah Rukh | 920.70 | Shopify 100. X note says "50/50 shopify & retail" |
| Nazma Sharif | 180.83 | Shopify 100 |
| Shumaila Mazhar | 142.48 | Shopify 40 / TikTok 60 |
| Zubiya Shahid | 183.80 | Shopify 100 |
| Arslan Nasir | 726.11 | 25 / 25 / – / 50 |
| Asim Javed Butt | 689.31 | 60 / 40 |
| Sadam Hussain | 578.07 | Shopify 100 |
| Ayaz Yasin | 224.89 | Shopify 100 |
| Soman Yasir | 304.45 | 40 / 30 / – / 30 |
| Hamza Naveed | 235.91 | 25 / 25 / – / 50 |
| Mehran Nisar | 436.05 | Amazon 100 |
| Hamza Bilal | 207.38 | 25 / 25 / – / 50 |

**Sellerboard posting block (rows 302–312).**

```
F302 GLF & QB Charges (Direct Expense-Amazon) = DET!K59 + K64 + K102 + K63
     = Case Processed-GLF 0 + Labeling 0 + QuickBooks share 93.33 + Amazon storage fees 2,070.49 = 2,163.82
F304 Total to be Posted on Sellerboard (Amazon) = F300 + F302 = 6,960.28 + 2,163.82 = 9,124.09
F306 6,729.63 (typed; probably the amount already posted) ; F312 = F304 − F306 = 2,394.46
```

Cross-check against Sellerboard (Mehran KPI file, `PnL SB`, August column, "Indirect expenses" −9,614.47):

| Sellerboard indirect line | Aug | Source in this workbook |
|---|---|---|
| Freight cost | 2,070.49 | Amazon inventory **storage fees** (K63). The label is wrong, and it is also a COGS line here |
| Salaries | 1,908.43 | K175 ✓ |
| Interest expense | 1,964.91 | K165 + K168 (AP165) ✓ |
| Advertising and Marketing | 1,752.55 | K178 49.21 + **R&D K174 1,703.34** ✓ |
| Office Expenses | 594.04 | bank 31.23 + dues 192.71 + Google email 71.28 + office 26.30 + tax-return 166.10 + disposal 106.42 ✓ |
| Legal fee | 810.38 | professional fee 176.19 + corporation filing 143.81 = 320.00. **490.38 unexplained** |
| Shipping cost | 308.52 | packaging K143 ✓ |
| Stock Insurance | 111.81 | K164 ✓ |
| Accounting and Bookkeeping | 93.33 | QuickBooks share K102 ✓ |
| **Total** | **9,614.47** | against F304 9,124.09 (difference 490.38, all in Legal fee) |

So the Amazon storage fee is **double-counted in Sellerboard's view**. Sellerboard already deducts storage inside "Amazon fees", and it is then posted again as "Freight cost". The QuickBooks QB-fee share is likewise a COGS line in this workbook but an indirect expense in Sellerboard.

## 5. `Profit & Loss Summarize` (C1:U103): the output

Rows 6–23 per channel, for Jul (D–J) and Aug (K–Q), with R = % change `(Q − J) / J`. Row 23 uses `−(Q − J)/J` for the sign.

- Rows 6–8 and 10–11 (Sales, Sale Return, Discount Allowed, COGS, COGS (Direct Marketing)) and rows 14–21 (expense categories): `SUMIF('Detailed'!A:A, <category label>, 'Detailed'!<channel column>)`.
- Row 9 `Total Revenue = Sales + Sale Return + Discount Allowed`.
- Row 12 `Gross Profit = Total Revenue − COGS − COGS (Direct Marketing)`.
- Row 22 `Total Indirect Expense = SUM(14:21)`.
- Row 23 `Net Income = GP − Total Indirect`.
- Checks: row 24 `= Net Income − Detailed!212`; rows 25–30 compare with Detailed and with QuickBooks (`#REF!`).
- Columns F and M (Learn The Cut) are hidden; rows 25–36 are hidden.
- **Category totals (Aug).** In each figure below, components are listed by channel in the order Amazon / Shopify / TikTok / Walmart / Wholesale; zero entries are left out.

| Line | Amazon | Shopify | LTC | TikTok | Walmart | Wholesale | Total |
|---|---|---|---|---|---|---|---|
| Sales | 40,869.05 | 16,497.68 | −33.86 | 8,521.10 | 365.80 | 8,585.69 | 74,805.46 |
| Sale Return | −804.41 | −54.63 | 0 | −496.77 | 0 | 0 | −1,355.81 |
| Discount Allowed | 0 | −2,625.56 | 0 | −1,298.48 | 0 | −3,832.61 | −7,756.65 |
| **Total Revenue** | 40,064.64 | 13,817.49 | −33.86 | 6,725.85 | 365.80 | 4,753.08 | **65,693.00** |
| COGS | 21,433.98 | 7,086.81 | 124.67 | 5,771.60 | 189.34 | 2,399.16 | 37,005.55 |
| COGS (Direct Marketing) = Amazon ads | 10,111.77 | | | | | | 10,111.77 |
| **Gross Profit** | **8,518.89** | **6,730.68** | **−158.53** | **954.25** | **176.46** | **2,353.92** | **18,575.68** |
| Advertising & Marketing | 49.21 | 6,200.74 | | 5,610.37 | | 0 | 11,860.32 |
| Financial Charges (bank, loan and card interest, professional fee) | 2,172.34 | 2,748.42 | | 44.66 | | 2,017.05 | 6,982.47 |
| Other General & Admin | 724.85 | 548.72 | | 93.80 | | 427.61 | 1,794.98 |
| Tools & Software | 290.29 | 985.21 | | 5.66 | | 263.14 | 1,544.30 |
| Website Development | | 43.21 | | | | | 43.21 |
| Insurance on Stock | 111.81 | 111.81 | | | | 111.81 | 335.43 |
| Research & Development | 1,703.34 | 587.45 | | 285.95 | | 202.08 | 2,778.82 |
| Salaries & Wages | 1,908.43 | 3,918.01 | | 85.49 | | 1,320.70 | 7,232.63 |
| **Total Indirect** | 6,960.28 | 15,143.57 | 0 | 6,125.93 | 0 | 4,342.38 | **32,572.16** |
| **Net Income** | **1,558.62** | **−8,412.89** | **−158.53** | **−5,171.68** | **176.46** | **−1,988.46** | **−13,996.48** |

The "Sales" figures include adjustments that sit in the "Sales" category:

- Amazon: Inventory Adjustment and Promo Rebate (−1,379.76).
- Shopify: shipping income and Amazon Pay / Stripe sales.
- Wholesale: shipping income.

## Key numbers (test fixtures)

**July 2026** (D–J, pasted values):

| | Amazon | Shopify | LTC | TikTok | Walmart | Wholesale | Total |
|---|---|---|---|---|---|---|---|
| Total Revenue | 56,637.83 | 13,413.64 | −20.48 | 6,303.45 | 199.90 | 4,617.09 | 81,151.43 |
| COGS (excl. ads) | 28,289.70 | 6,384.71 | 119.98 | 6,378.15 | 81.95 | 2,298.44 | 43,552.93 |
| Amazon ads (COGS DM) | 15,118.88 | | | | | | 15,118.88 |
| Gross Profit | 13,229.25 | 7,028.93 | −140.46 | −74.70 | 117.95 | 2,318.65 | 22,479.62 |
| Total Indirect | 7,588.39 | 16,004.96 | 0 | 4,858.10 | 0 | 9,601.26 | 38,052.71 |
| Net Income | 5,640.86 | −8,976.03 | −140.46 | −4,932.80 | 117.95 | −7,282.61 | −15,573.09 (Detailed −15,573.10; rounding) |

**August 2026**: see the tables in §3–§5. Headline figures: revenue 65,693.00, GP 18,575.68 (28.3%), indirect 32,572.16, **Net Income −13,996.48**. Changes against July: revenue −19.05%, GP −17.37%, net loss 10.1% smaller.

**Balance sheet, 31 Aug 2026** (QuickBooks; account identifiers omitted):

| Item | Amount |
|---|---|
| Bank balances | 5,475.58 (2 operating accounts 3,709.84 + 1,765.74; PayPal 0) |
| AR | 5,717.43 (USD 4,858.81 + EUR AR 858.62) |
| Supplier advances | Alibaba 12,646.13, FairyGene 4,934.14, Stephen Gould 13,228.40 |
| Amazon reserve | 560 |
| **Inventory** | **336,696.61**: empty tubes at Jet 138,160.26; finished goods at Jet 70,993.23; Amazon FBA 25,554.64; GLF 59,317.76; NY office 42,670.72 |
| Prepaids | GoDaddy 2,073.98, insurance 335.44, Sasserath 938.45, ShipStation 842.27, TaxCloud 446.82 |
| Preliminary expense | 20,000 |
| Receivable from Michael | 4,500 |
| Total current assets | 411,088.85 |
| Acquisition cost of Best Curl (fixed asset) | 146,423.59 |
| Security deposit | 3,000 |
| **Total assets** | **560,512.44** |
| AP | 35,027.04 |
| Credit cards | 40,020.46 (3 cards) |
| Loans: PayPal | 34,729.39 |
| Loans: QuickBooks | 62,168.12 |
| Loans: Shopify | 39,435.33 |
| Loans: short-term business | 90,660.95 |
| Loans: Dasktech | 4,031.41 |
| Sales tax collected | Shopify 1,067.07, Amazon −197.77, Walmart 86.90, Distributor 22.08 |
| Total current liabilities | 307,163.39 |
| Long-term loans | 230,013.92 (Ahmed Cheema 55,000; Fuad Khan 70,407.60; UCB 98,500; Urtasker 6,106.32) |
| Total liabilities | 537,177.31 |
| Equity | 23,335.13 (investments 200,000 + 100,000; retained earnings −172,349.97; YTD net income −104,288.90) |

## Data sources needed

| Data | System | Granularity |
|---|---|---|
| P&L by account, monthly | **QuickBooks Online** Reports API (ProfitAndLoss), accrual | month × account |
| Expense transactions (for allocation) | QuickBooks TransactionList / Transaction Detail by Account (expense accounts) | transaction |
| Balance sheet, AR/AP aging | QuickBooks BalanceSheet, AgedReceivables, AgedPayables | month-end |
| Bank / card / PayPal registers | QuickBooks banking, or bank feeds | transaction |
| Channel revenue detail (to validate QuickBooks) | Amazon (Sellerboard or SP-API settlements), Shopify Payments payouts, TikTok settlements, Walmart settlements, WSAIO wholesale invoices | settlement / order |
| Amazon P&L incl. indirect expenses | **Sellerboard** (receives the posted indirect amount) | month |
| Allocation rules | portal master: per expense head / vendor / employee → % split, or "revenue share" basis with the included channels | rule |
| Payroll per employee | payroll / HR, in USD as booked | month × employee |
| COGS ("Purchase Cost-<channel>") | journal booked by the bookkeeper. Likely units sold × landed unit cost from the inventory / costing sheet (the unit-cost table appears in the ROAS workbook's `Sample CGS`) | month × channel (SKU detail **not** in this file) |

## Questions / oddities

1. **There is no SKU or product profitability.** COGS is one "Purchase Cost" number per channel. How is it computed: Sellerboard COGS for Amazon, and units × unit cost for the others? Which unit-cost master and which costing method (latest PO landed cost or weighted average)? The portal needs SKU-level COGS to give channel × SKU profit.
2. **The QuickBooks merchant-fee split is misaligned (row 102).**
   - Learn The Cut gets TikTok's share (Y11).
   - TikTok gets Retail's share (Z11).
   - Wholesale multiplies by AA11, which is blank, so it gets 0.

   The total is still correct, but TikTok and Wholesale are wrong. Correct values: TikTok 15.67, Wholesale 11.07, LTC 0.
3. **Ads sit at different levels.** Amazon advertising sits in COGS ("COGS (Direct Marketing)", above GP), while Meta, Google, TikTok and samples sit in indirect expenses, below GP. Channel GP is therefore not comparable: Amazon GP is after ads, Shopify GP is before ads. Define GP, CM and NP consistently (see `profitability-model-summary.md`).
4. **Walmart and Learn The Cut receive no indirect expenses**, because the revenue share excludes them. Is that intentional (immaterial), or should they share overheads?
5. **The fixed loan-interest split 33.87 / 32 / 0.26 / 33.87 is stale.** The K remark says "Revenue Based (67.77% Amazon, 31.99% Shopify, 0.24% TikTok)", which looks like Amazon's 67.77% was halved between Amazon and Retail. August revenue shares are 61.3 / 21.1 / 10.3 / 7.3. Which basis should interest use?
6. **Remarks contradict the % used** for several employees. Vivienne: the remark says half Amazon, the rest Shopify; 1/3 each is applied. Shahrukh: the note says 50/50 Shopify/Retail; 100% Shopify is applied. The allocation master must be authoritative and dated.
7. **Payroll allocation disagrees with the ROAS workbook.** There, Mehran is 197.66 (100% Amazon) and Sadam (CDC-014-26) is 450.07; here they are 436.05 and 578.07. Different months, or different pay components (salary only against salary plus bonus)?
8. **Sellerboard indirect-expense posting.**
   - Storage fees are posted as "Freight cost", which double-counts them, since Sellerboard already has storage inside Amazon fees.
   - R&D is posted as "Advertising and Marketing".
   - Sellerboard's Legal fee is 490.38 higher than this workbook can explain.
   - F306 6,729.63 is typed with no label.

   Because Mehran's profit share is based on Sellerboard net profit, these postings change pay.
9. **The FX loss (33.86) is booked as negative revenue for Learn The Cut**, so LTC "Sales" is −33.86. It should be a company-level other expense.
10. **Duplicate account names** ("Purchase Cost" under Walmart and Wholesale; "Gifts & samples" twice, B184 with leading spaces) force position-dependent lookups (`XLOOKUP … -1`). The portal should map by QuickBooks **account ID**, not by name.
11. "Warehouse & Labor" (row 153) is labelled category "Cost of Goods Sold" but sits in the expense block. It is 0 this month, but would be summed into COGS by the Summarize view while also counted in expenses.
12. **The July columns are pasted values.** Prior months cannot be recomputed if a rule changes. The portal should store monthly snapshots with the rule version.
13. **Broken or stale checks**: `Q28`, `Q214`, `J307` are `#REF!`; `J30` is FALSE (a 0.01 rounding difference from `ROUND(…,1)` on rows 128–137); `Q231` "Should be Zero" shows 16,043.29; AB125 compares against the wrong QuickBooks row.
14. **Hidden sheets are stale** (Cash Flow Forecast to Mar-2026 with a `#REF!` opening; AP/AR aging Mar-2025; bank/PayPal registers Nov-2024 / Feb-2025; the cash-flow statement's broken links). Are cash-flow forecasting and AR/AP aging in scope for the portal? If so, they should come live from QuickBooks.
15. Header dates are typed as e.g. 2026-07-25 / 2026-08-26 and only *formatted* as "Jul-26 / Aug-26". Use real month keys.
16. **Amazon in QuickBooks does not match Sellerboard for the same month.**

    | August | QuickBooks | Sellerboard (Mehran file) |
    |---|---|---|
    | Seller Sale | 42,068.33 | 57,804.79 (Sales) |
    | Advertising | 10,111.77 | 12,844.03 |

    Fees are separate COGS lines in QuickBooks, so the gap is not a net-against-gross difference. It is most likely timing: QuickBooks books from settlements, which are bi-weekly and lag, while Sellerboard is order-date based. Agree which basis drives the channel P&L, and which drives KPIs such as Mehran's.
