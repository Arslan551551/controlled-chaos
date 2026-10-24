# Rafay KPI / Incentive Calculation — Aug 2026

Source file: `Rafay_KPI_Calculation_Aug-2026.xlsx`.

- 2 sheets.
- No charts, images, comments or named ranges.
- Row 12 of `KPI Net Basis` (the Google row) is **hidden**.

## Purpose

Monthly incentive statement for **Muhammad Rafay**, Meta Ads Manager, employee `CDC-015-26`. He owns **Facebook/Instagram (Meta) ads** for Shopify.

The structure is the same as Sadam's file (see `sadam-kpi-aug-2026.md`):

1. A customer acquisition incentive, paid per new customer whose first click was Meta.
2. A ROAS incentive of 5% of **Meta-sourced** revenue, gated on Google ROAS > 2.5 **and** Meta ROAS > 1.5.

The bands, rates and FX rates differ from Sadam's.

## Structure

### `Net Basis Working` (B2:I20)

This sheet is **identical** to Sadam's working sheet: the same August Shopify first-click table, with every value the same. The only difference is that row 13 uses `=SUM(C12:C12)` where Sadam's uses `=C12`, which gives the same result.

Relevant column D (facebook/instagram):

| Item | Value |
|---|---|
| New revenue | 482.09 |
| Returning revenue | 795.37 |
| Total revenue | 1,277.46 |
| New customers | **10** |
| Returning customers | 19 |
| Spend | 3,600.53 |
| ROAS | **0.354798** |

### `KPI Net Basis` (C1:H22)

**Customer Acquisition Incentive (rows 4–7)**

| Row | Range | Total (D) | Rate $ (E) | Incentive $ (F) | Incentive PKR (G) |
|---|---|---|---|---|---|
| 5 | 1 to 50 | 10 (typed) | 3 | `=E5*D5` → 30 | `=F5*277.4` → 8,322 |
| 6 | 51 to ∞ | 0 | 4 | **0 (typed, no formula)** | **0 (typed)** |
| 7 | Total | `SUM` 10 | | `SUM` 30 | `SUM` 8,322 |

**ROAS Based (rows 11–14)**

| Row | Range | Actual (D) | Revenue (E) | % (F) | $ (G) | PKR (H) |
|---|---|---|---|---|---|---|
| 12 (hidden) | Google Ads > 2.5 | 3.029056 (typed, **stale**) | 3,637.55 (typed, **stale**) | 0 | `=E12*F12` → 0 | `=G12*278.5` → 0 |
| 13 | Meta Ads > 1.5 | 0.354798 (typed) | 1,277.46 (typed) | 0 (typed) | `=E13*F13` → 0 | `=G13*277.4` → 0 |
| 14 | Total | | | | 0 | 0 |

- Note: "Both Google Ads & Meta Ads target needs to meet to qualify for 5% revenue generated".
- Row 18, Total Incentive Payable: `G18 = F7 + G14` → **$30**; `H18 = H14 + G7` → **PKR 8,322**.
- Checks (rows 20–22), all TRUE:
  - `E20 = (E13 = Working!D6)` checks revenue.
  - `E21 = (Working!D7 = D5)` checks the customer count.
  - `E22 = (D13 = Working!D15)` checks ROAS.

## Calculations

```
NewCust_meta = distinct D2C "First order" orders with source facebook/instagram   = 10
Rev_meta     = 1,277.46 ; Spend_meta = 3,600.53 ; ROAS_meta = 0.3548
ROAS_google  = 4,466.84 / 1,918.57 = 2.3282   (the working sheet; NOT the stale 3.029 in hidden row 12)

AcqIncentive_USD = band 1 (1–50) @ $3, band 2 (51+) @ $4  → 10 × 3 = 30
Qualifies        = ROAS_google > 2.5 AND ROAS_meta > 1.5   → false
RoasIncentive    = Qualifies ? 5% × Rev_meta : 0           → 0
Total_USD = 30 ;  Total_PKR = 30 × 277.4 = 8,322
```

## Key numbers (test fixtures, Aug 2026)

| Item | Value |
|---|---|
| Meta new customers | 10 |
| Meta revenue / spend / ROAS | 1,277.46 / 3,600.53 / 0.3548 |
| Acquisition incentive | **$30 = PKR 8,322** (@ 277.4) |
| ROAS incentive | 0 (both gates fail) |
| **Total** | **$30 / PKR 8,322** |

Hypothetical test: if both gates pass, the ROAS incentive is 5% × 1,277.46 = $63.87.

## Data sources needed

Same as Sadam: the Shopify first-click order data, Meta Ads spend (with Google Ads spend for the shared gate), and the FX rate.

## Questions / oddities

1. **The hidden Google row has stale numbers**: ROAS 3.029 and revenue 3,637.55, against the actual 2.328 and 4,466.84. Had someone used the visible value, Rafay would wrongly appear to pass the Google gate.
2. The FX rate is 277.4 here, against 277.8 / 278.5 in Sadam's file and 277.85 in the bonus workbook.
3. Row 6 (51+ band) holds typed zeros with no formula, so the band would never calculate.
4. The bonus workbook carries Rafay's KPI incentive as `AN5` = 3,333.60 (= $12 × 277.8), not 8,322. That figure is from a different month or a different count.
5. Banding is marginal or whole-count? (The same question as for Sadam.)
6. The Meta spend of 3,600.53 excludes a 99.28 Facebook charge that QuickBooks includes (3,699.81). Is that intended?
