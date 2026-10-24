# Sadam KPI / Incentive Calculation — Aug 2026

Source file: `Sadam_KPI_Calculation_Aug-2026.xlsx`.

- 2 sheets.
- No charts, images, comments or named ranges.
- Row 14 of `KPI Net Basis` (the Meta row) is **hidden**.

## Purpose

Monthly incentive statement for **Sadam Hussain**, Senior Digital Marketing Manager, employee `CDC-014-26` (old code `DT00-54-20-ISB`). He owns **Google Ads** for Shopify. The incentive has two parts:

1. **Customer Acquisition Incentive.** A per-new-customer amount, banded by count. The count is Shopify new customers whose first click was Google.
2. **ROAS-based incentive.** 5% of Google-sourced Shopify revenue, payable only if **both** Google ROAS > 2.5 **and** Meta ROAS > 1.5.

The incentive is computed in USD and converted to PKR at a typed rate. The PKR figure is what flows into the bonus sheet (`Controlled_Choas_Bonus_Calculations_4.xlsx`, `Main !`!AN6). See the oddities: that sheet currently holds a different number.

The file `Rafay_KPI_Calculation_Aug-2026.xlsx` is a structural twin of this one, for the Meta Ads manager. See `rafay-kpi-aug-2026.md`.

## Structure

### `Net Basis Working` (B2:I15): input block

This is a copy of the Shopify first-click source table: the same layout as `Marketing ROAS` C:I in the ROAS/FMO workbook, but for **August 2026** and **without payroll or Reddit costs**.

- Columns: `Metric | google | facebook/instagram | Email Marketing | direct | Others | Affiliate | Total`.
- All source columns (C:H) are **typed values**, pasted from the FMO ROAS workbook for August.
- Only column I (totals), row 13 and row 15 are formulas.

| Row | Metric | Rule | google | fb/ig | Email | direct | Others | Affiliate | Total |
|---|---|---|---|---|---|---|---|---|---|
| 4 | Revenue (New Customers) | input | 2,676.78 | 482.09 | 346.51 | 144.02 | 434.47 | 78.61 | `SUM` 4,162.48 |
| 5 | Revenue (Returning Customers) | input | 1,790.06 | 795.37 | 934.34 | 1,165.99 | 3,989.48 | 0 | 8,675.24 |
| 6 | Total Revenue | input (= r4 + r5) | 4,466.84 | 1,277.46 | 1,280.85 | 1,310.01 | 4,423.95 | 78.61 | `I4+I5` 12,837.72 |
| 7 | New Customers | input | **29** | 10 | 3 | 1 | 5 | 1 | 49 |
| 8 | Returning Customers | input | 51 | 19 | 14 | 13 | 97 | "0" (text) | 194 |
| 9 | Total Customers | input | 80 | 29 | 17 | 14 | 102 | 1 | 243 |
| 10 | Avg Revenue / New Customer | input (= r4 / r7) | 92.30 | 48.21 | 115.50 | 144.02 | 86.89 | 78.61 | `IFERROR(I4/I7,"0")` 84.95 |
| 11 | Avg Revenue / Returning Customer | input (= r5 / r8) | 35.10 | 41.86 | 66.74 | 89.69 | 41.13 | "0" | 44.72 |
| 12 | Ads Spending/Cost | input | 1,918.57 | 3,600.53 | 582.36 | – | – | – | 6,101.46 |
| 13 | Total Marketing/Selling Cost | `= row 12` | 1,918.57 | 3,600.53 | 582.36 | 0 | 0 | 0 | 6,101.46 |
| 15 | **ROAS** | `IFERROR(TotalRevenue / Cost, "0.00")` | **2.3282** | **0.3548** | 2.1994 | "0.00" | "0.00" | "0.00" | 2.1040 |

Cross-checks against the FMO financials, `Best_Curl_Financials_FMO_Aug-26.xlsx`:

- Google spend 1,918.57 equals QuickBooks "Google Adspend" for August.
- Email 582.36 equals "Marketing SEO Tools" (Mailchimp).
- Meta 3,600.53 equals QuickBooks "Facebook Marketing" 3,699.81 **minus** the 99.28 line "FACEBOOKAD* KAVJ45NAT4". Confirm whether that charge was meant to be excluded.

### `KPI Net Basis` (C1:H23): the incentive statement

**Block 1: Customer Acquisition Incentive (rows 4–8)**

| Row | Range (C) | Total (D) | Rate $ (E) | Incentive $ (F) | Incentive PKR (G) |
|---|---|---|---|---|---|
| 5 | 1 to 40 | 29 (typed) | 5 | `=D5*E5` → 145 | `=F5*277.8` → 40,281 |
| 6 | 41 to 80 | 0 (typed) | 7 | `=D6*E6` → 0 | `=F6*278.5` → 0 |
| 7 | 81 and Above | 0 (typed) | 9 | `=D7*E7` → 0 | `=F7*278.5` → 0 |
| 8 | Total | `SUM` 29 | | `SUM` 145 | `SUM` 40,281 |

The header says "Incentive Rs @ 277.8", but rows 6–7 use 278.5.

**Block 2: ROAS Based (rows 12–15)**

| Row | Range (C) | Actual ROAS (D) | Revenue (E) | % (F) | Incentive $ (G) | Incentive PKR (H) |
|---|---|---|---|---|---|---|
| 13 | Google Ads > 2.5 | 2.328213 (typed) | 4,466.84 (typed) | `=5%*0` → 0 | `=E13*F13` → 0 | `=G13*277.8` → 0 |
| 14 (hidden) | Meta Ads > 1.5 | 0.169612 (typed, **stale**) | 612.08 (typed, **stale**) | 0 | `=E14*F14` → 0 | `=G14*278.5` → 0 |
| 15 | Total | | | | `SUM` 0 | `SUM` 0 |

- Note in C17: "Both Google Ads & Meta Ads target needs to meet to qualify for 5% revenue generated".
- Row 19, Total Incentive Payable: `G19 = F8 + G15` → **$145**; `H19 = H15 + G8` → **PKR 40,281**.
- Check cells (rows 21–23), all TRUE:
  - `E21 = (E13 = Working!C6)` checks Google revenue.
  - `E22 = (D5 = Working!C7)` checks the new-customer count.
  - `E23 = (D13 = Working!C15)` checks Google ROAS.

## Calculations (exact, as the portal should implement)

Inputs for month *m*, Shopify D2C only, first-click attribution. Source and customer classification rules are as in `roas-report-fmo-sep-26.md`.

```
NewCust_google   = distinct orders where source = google, segment = D2C, new/returning = "First order"
Rev_google       = Σ first-click net sales, segment D2C, source google (new + returning)
Spend_google     = Google Ads spend for the month
ROAS_google      = Rev_google / Spend_google           = 4,466.84 / 1,918.57 = 2.3282
ROAS_meta        = Rev_fbig / Spend_meta               = 1,277.46 / 3,600.53 = 0.3548

-- Customer acquisition (bands, USD per new customer)
band 1: 1–40  → $5      band 2: 41–80 → $7      band 3: 81+ → $9
AcqIncentive_USD = Σ_band count_in_band × rate_band
     As built, the sheet types the count into the band row. With 29 customers only band 1 is used: 29 × 5 = 145.
     Marginal versus whole-count is NOT determined by the sheet (see Questions).

-- ROAS incentive
Qualifies = (ROAS_google > 2.5) AND (ROAS_meta > 1.5)          (strictly greater)
RoasIncentive_USD = Qualifies ? 5% × Rev_google : 0             = 0 for Aug-26

Total_USD = AcqIncentive_USD + RoasIncentive_USD               = 145
Total_PKR = Total_USD × FX                                      = 145 × 277.8 = 40,281
```

## Key numbers (test fixtures, Aug 2026)

| Item | Value |
|---|---|
| Google new customers | 29 |
| Google revenue (first click, new + returning) | 4,466.84 |
| Google spend | 1,918.57 |
| Google ROAS | 2.328213 (target > 2.5: not met) |
| Meta revenue / spend / ROAS | 1,277.46 / 3,600.53 / 0.354798 (target > 1.5: not met) |
| Shopify first-click total revenue | 12,837.72 (blended ROAS 2.1040 on 6,101.46 spend) |
| Acquisition incentive | **$145 = PKR 40,281** (@ 277.8) |
| ROAS incentive | $0 |
| **Total payable** | **$145 / PKR 40,281** |

Hypothetical test: if Google ROAS were 2.6 and Meta ROAS were 1.6, the ROAS incentive would be 5% × 4,466.84 = $223.34.

## Data sources needed

- **Shopify** first-click sales report (order level), plus the source mapping and new/returning tagging, the same pipeline as the ROAS/FMO report.
- **Google Ads** and **Meta Ads** monthly spend. QuickBooks card charges (Google Adspend and Facebook Marketing) are the fallback.
- An FX rate (PKR per USD) per payroll month, from a single source.
- An employee master with the plan's bands, rates, ROAS gates and payout currency.

## Questions / oddities

1. **Bands: marginal or whole count?** The count is typed into the band row. If Sadam gets 50 new customers, is that 40 × 5 + 10 × 7 = 270, or 50 × 7 = 350? The hidden `Lead Criteria` sheet in the bonus workbook uses "upto 50 / upto 100 / onwards" wording for a different (lead) scheme, which suggests whole-count tiers, but this is unconfirmed.
2. **Three different FX rates** are in use: 277.8 (G5, H13), 278.5 (G6, G7, H14), and 277.85 in the bonus workbook. Use one rate per month.
3. **The ROAS gate depends on another person's channel.** Sadam's 5% needs Meta ROAS > 1.5, which is Rafay's channel, and vice versa. Rafay's file computes 5% on **Meta** revenue. So when both gates pass, does each person get 5% of their own channel's revenue? Confirm.
4. The Meta row (hidden row 14) holds **stale values**: ROAS 0.1696 and revenue 612.08, against the working sheet's 0.3548 and 1,277.46. Because the row is hidden, the gate check is not visible to the reader.
5. `F13 = 5%*0` is a manual override to zero. The gate is not a formula. In the portal, compute it.
6. ROAS here is **Shopify first-click revenue ÷ platform spend**, which is not platform-reported ROAS. It includes returning customers whose first click was Google.
7. The PKR total (40,281) does **not** match what the bonus sheet carries for Sadam (`AN6` = 75,723.4185, typed). See `controlled-chaos-bonus-calculations-4.md`.
8. "Net Basis" in the sheet names implies net sales (after discounts and returns). Confirm that the first-click "Net sales" column is the intended basis.
