# Controlled Chaos Bonus Calculations (v4) — Aug 2026

Source file: `Controlled_Choas_Bonus_Calculations_4.xlsx`.

- 6 sheets. `Lead Criteria ` and `Sheet2` are hidden.
- No charts, images or named ranges.
- `Main !` has an autofilter on A1:AY12, and rows 2–6 and 8–12 are **manually hidden**, so only Muhammad Shahrukh Khan's row is visible.

## Purpose

This is the monthly **KPI bonus run** for the Pakistan-based support team: finance, digital marketing and creative staff. Bonuses are paid in **PKR**.

For each employee, the reporting manager rates 4–7 qualitative review questions on a 4-point scale. The average becomes a **KPI %**, which is applied to an **achievable bonus** amount. Manual additions and deductions are then applied.

The sheet also:

- records how each person's bonus is split between **Controlled Chaos** and the sister company **Urtasker**;
- carries the path and file name for generating a PDF slip per employee (mail-merge or VBA style; no macros are present in this .xlsx).

Month: `Review Points`!B1 = 2026-08-01. Working days: B2 = 21. Dollar rate: B3 = 277.85 PKR/USD.

## Structure

### `Review Points` (A1:AF95): ratings entry

Header cells:

| Cell | Label | Value |
|---|---|---|
| B1 | Month | 2026-08-01 |
| B2 | Working Days | 21 (not referenced by any formula) |
| B3 | Dollar Rate | 277.85 (not referenced by any formula; constants are typed inline instead) |

Below the header, one block per employee:

- **Header row**: serial number (D), employee name (E), and `G = VLOOKUP(name, 'Main !'!B:C, 2, 0)`, which returns the employee code.
- **Column headers**: `Sr. No | Review Questions | Reviews | Review Points | KPI Points | Achievable KPI Bonus | Achieved KPI Bonus`.
- **Question rows**:
  - E = question text;
  - F = rating (input: `Excellent` / `Good` / `Fair` / `Poor`);
  - G = `IF(F="Excellent",100, IF(F="Good",75, IF(F="Fair",35, IF(F="Poor",0, 0))))`. A blank rating gives 0.
- **On the first question row of each block**:
  - H = `AVERAGE(G_first:G_last)`, the KPI points;
  - I = `'Main !'!AN<row>`, the achievable bonus;
  - J = `'Main !'!AO<row>`, the achieved bonus.

Blocks:

| # | Employee | Rows | Questions | Ratings (Aug) | KPI pts |
|---|---|---|---|---|---|
| 1 | Arslan Nasir (Director Finance) | 8–13 | 6 (reporting, internal control, cost reduction, AR efficiency, team, cross-dept) | 5 × Excellent, 1 × Good | 95.83 |
| 2 | Asim Javed Butt (Creative Manager) | 18–21 | 4 (on-time videos, quality/revisions, creative CTR/conversion, brand guidelines) | all Excellent | 100 |
| 3 | Ayaz Yasin (Google AdWords Manager) | 26–30 | 5 (internal projects, professionalism, ideas, team building, relationship with manager) | all Excellent | 100 |
| 4 | Muhammad Shahrukh Khan (Creative Content Strategist) | 35–38 | 4 (Shopify revenue ownership, conversion-focused creative, execution with revenue impact, revenue reporting) | all Excellent | 100 |
| 6 | Sadam Hussain | 43–47 | 5 (team, Urtasker ads/SEO, CC digital marketing, client projects, coordination) | **blank** → 0 | 0; `I43 = 'Main !'!#REF!`; K43 = 121,651.16725 (typed) |
| 7 | Soman Yasir (Jr Graphic Designer) | 52–55 | 4 | all Excellent | 100 |
| 8 | Nazma Shareef (Graphic Designer) | 60–64 | 5 | all Excellent | 100 |
| 9 | Hamza Naveed (Finance Officer) | 69–75 | 7 | all Excellent | 100 |
| 10 | Hamza Bilal (Deputy Finance Manager) | 80–86 | 7 | all Excellent | 100 |
| 11 | Zubiya Shahid (Social Media & Research Intern) | 91–95 | 5 | all Excellent | 100 |

There is no block for Muhammad Rafay (#5).

### `Main !` (A1:AY31): bonus register (one row per employee, rows 2–12)

| Col | Header | Rule |
|---|---|---|
| A | Sr.No | `=ROW()-1` |
| B, C | Employee Name, DT-Code | input. Codes are the new `CDC-xxx-yy` codes. |
| D | Month | `='Review Points'!$B$1` |
| E | Days | **typed 21** (days worked/eligible) |
| F–H | Designation, Department, Reporting Manager | input |
| I/J/K … AJ/AK/AL | Review *n*, Review Points *n*, KPI Points *n* (n = 1..10) | links to `Review Points` E (question), F (rating) and G (points) |
| AM | Points | `=AVERAGE(K,N,Q,T,W,Z,AC,AF)` (KPI points 1–8 only; 9–10 are ignored). AVERAGE skips blank cells, so a 4-question employee averages over 4. |
| AN | Achievable Bonus | per-employee formula or typed constant (see below) |
| AO | Achieved Bonus | `=AN × AM / 100` |
| AP / AQ | Other Additions Rs / details | input |
| AR | Total Additions | `=AP` |
| AS / AT | Other Deduction Rs / details | input |
| AU | Total Deduction | `=AS` (U9 is typed 0) |
| AV | **TOTAL KPI BONUS** | `=(AO + AR) − AU` |
| AW | Comments | |
| AX, AY | PdfFolderPath, PdfFileName | text: a OneDrive path "…\Bonus 2026\4-April\Support Department\Slips" (stale month) and the slip file name |

Achievable-bonus (AN) logic per employee:

| Row | Employee | AN | Meaning |
|---|---|---|---|
| 2 | Arslan Nasir | `=(16500/21)*E2` | PKR 16,500 monthly target × days/21 (pro rata by working days) |
| 3 | Asim Javed Butt | `=(20000/21)*E3` | PKR 20,000 × days/21 |
| 4 | Ayaz Yasin | `=20000*25%` | PKR 20,000 target, of which **25% charged to Controlled Chaos** (75% Urtasker; see allocation sheet) |
| 5 | Muhammad Rafay | 3,333.60 (typed) | = $12 × 277.8. A KPI-file incentive (customer acquisition), **not** his Aug KPI file value (PKR 8,322) |
| 6 | Sadam Hussain | 75,723.4185 (typed) | the KPI-file incentive; **not** his Aug KPI file value (PKR 40,281); derivation unknown |
| 7 | Muhammad Shahrukh Khan | `=(13334.63*1%)*277.85` | **1% of a USD revenue figure** (13,334.63; probably Shopify revenue, see Questions) × FX |
| 8 | Soman Yasir | 7,500 (typed) | fixed target |
| 9 | Nazma Shareef | 5,000 (typed) | fixed target |
| 10 | Hamza Naveed | 10,000 (typed) | fixed target |
| 11 | Hamza Bilal | 6,167 (typed) | pro-rated: see `Sheet1` |
| 12 | Zubiya Shahid | 6,000 (typed) | fixed target |

Rows 5 and 6 (Rafay and Sadam):

- I–T are **wrong links**. They point at Ayaz Yasin's ratings (`Review Points`!F26:G30), and the question cells are typed "N/A".
- `AM5` and `AM6` are **typed 100**.
- Their bonus is therefore entirely the KPI-file incentive, with no review-score multiplier.

Rows 15–25 (AT:AW) hold a **previous-month** list (Sr.No, Name, old `DT00-…` code, TOTAL KPI BONUS). These are typed values that total **PKR 168,958.54**:

| Employee | Prior-month bonus (PKR) |
|---|---|
| Arslan Nasir | 16,500 |
| Asim Javed Butt | 20,000 |
| Ayaz Yasin | 10,000 |
| Muhammad Shahrukh Khan | 33,989.04 |
| Sadam Hussain | 57,649.50 |
| Soman Yasir | 7,500 |
| Nazma Shareef | 4,000 |
| Hamza Naveed | 10,000 |
| Hamza Bilal | 5,000 |
| Zubiya Shahid | 4,320 |

### `Bonus Allocation Percentage` (A1:H12)

Columns: `S.no | Employees Name | Urtasker Pak% | Controlled Chaos % | E | G | H`.

- **E** = `XLOOKUP(name, Main!B, Main!AN, "NA")`, the current achievable bonus.
- **G** = a typed control value.
- **H** = `E = G`, a check.

| Employee | Urtasker % | CC % | E (AN) | G (control) | Check |
|---|---|---|---|---|---|
| Asim Javed Butt | 0 | 100% | 20,000 | 20,000 | ✓ |
| Sadam Hussain | 0 | 100% | 75,723.42 | (blank) | ✗ |
| Ayaz Yasin | 75% | 25% | 5,000 | `=20000*25%` 5,000 | ✓ |
| Arslan Nasir | 45% | 55% | 16,500 | 16,500 | ✓ |
| Muhammad Shahrukh Khan | 0 | 100% | 37,050.27 | 35,745.475 | ✗ (= 12,865 × 1% × 277.85, the prior base) |
| Soman Yasir | 0 | 100% | 7,500 | 7,500 | ✓ |
| Nazma Shareef | 0 | 100% | 5,000 | 5,000 | ✓ |
| Hamza Bilal | 50% | 50% | 6,167 | 5,000 | ✗ (pro-rata change) |
| Hamza Naveed | 0 | 100% | 10,000 | 10,000 | ✓ |
| Nasir Ali Khan | 0 | 100% | "NA" (not in Main) | 19,428.57 | ✗ |
| Zubiya Shahid | 0 | 100% | 6,000 | 6,000 | ✓ |

The CC/Urtasker percentages are **not applied anywhere**:

- Ayaz's 25% is hard-coded into AN4.
- Arslan's 55% and Hamza Bilal's 50% are not applied, so their AN is the full amount.

### `Sheet1` (G5:I8): pro-rata helper for Hamza Bilal

```
H5 = 5000 × 16/30 = 2,666.67      (old target for 16 days of a 30-day month)
H6 = 7500 × 14/30 = 3,500.00      (new target for 14 days)
H8 = SUM = 6,166.67 ; I8 = ROUND(H8, 0) = 6,167 → typed into Main!AN11
```

This uses a **30-day** basis, whereas `Main !` pro-rates over 21 working days.

### `Lead Criteria ` (hidden): Sadam's lead scheme (not used in any formula)

"Sadam Hussain Leads Calculation Criteria", per qualified lead:

| Qualified leads | Rate per qualified lead |
|---|---|
| up to 50 | PKR 2,000 |
| up to 100 | PKR 1,500 |
| onwards 100 | PKR 1,000 |

This is probably the Urtasker (agency) lead-generation incentive.

### `Sheet2` (hidden)

A helper that builds text references "Data!J13", "Data!J26", … stepping by 13 rows, using `CONCATENATE`. It is left over from an older template that read a `Data` sheet. Unused.

## Calculations (exact)

For employee *e* in month *m*:

```
ScorePoint(rating) = {Excellent: 100, Good: 75, Fair: 35, Poor: 0, blank: 0}
KPI%_e        = mean over the employee's questions of ScorePoint(rating)          (unweighted; max 8 questions in AM)
Achievable_e  = one of:
                 (a) FixedTarget_e × DaysWorked_e / WorkingDays_m        (Arslan, Asim)
                 (b) FixedTarget_e × CC_share_e                           (Ayaz: 20,000 × 25%)
                 (c) FixedTarget_e                                        (Soman, Nazma, Hamza N., Zubiya)
                 (d) Σ_periods Target_p × days_p / 30                     (Hamza Bilal mid-month change)
                 (e) Rate × RevenueUSD × FX                               (Shahrukh: 1% × 13,334.63 × 277.85)
                 (f) KPI-file incentive in PKR, KPI% forced to 100        (Sadam, Rafay)
Achieved_e    = Achievable_e × KPI%_e / 100
TotalBonus_e  = Achieved_e + Additions_e − Deductions_e
```

Worked example (Arslan): KPI% = (100 + 100 + 100 + 100 + 75 + 100) / 6 = 95.8333. Achievable = 16,500 / 21 × 21 = 16,500. Achieved = 16,500 × 0.958333 = **15,812.50**.

## Key numbers (test fixtures, Aug 2026, PKR)

| Employee | Code | KPI % | Achievable | Total KPI Bonus |
|---|---|---|---|---|
| Arslan Nasir | CDC-011-22 | 95.8333 | 16,500 | **15,812.50** |
| Asim Javed Butt | CDC-013-26 | 100 | 20,000 | 20,000 |
| Ayaz Yasin | CDC-012-26 | 100 | 5,000 | 5,000 |
| Muhammad Rafay | CDC-015-26 | 100 (typed) | 3,333.60 | 3,333.60 |
| Sadam Hussain | CDC-014-26 | 100 (typed) | 75,723.4185 | 75,723.42 |
| Muhammad Shahrukh Khan | CDC-001-24 | 100 | 37,050.2695 | 37,050.27 |
| Soman Yasir | CDC-003-24 | 100 | 7,500 | 7,500 |
| Nazma Shareef | CDC-004-24 | 100 | 5,000 | 5,000 |
| Hamza Naveed | CDC-008-26 | 100 | 10,000 | 10,000 |
| Hamza Bilal | CDC-010-25 | 100 | 6,167 | 6,167 |
| Zubiya Shahid | CDC-007-25 | 100 | 6,000 | 6,000 |
| **Total** | | | | **191,586.79** |

The previous-month total (AT:AW) is 168,958.54.

## Data sources needed

- **HR master**: employee, both codes (`CDC-…` and legacy `DT00-…`), designation, department, reporting manager, company split (CC % against Urtasker %), and the plan type and parameters (target amount, pro-rata basis, revenue %).
- **Review questions per role**, versioned (questions change by role and over time), and **manager ratings per month**. These should be entered in the portal by the reporting manager, with sign-off.
- **Attendance / days worked** (E column) and working days per month.
- **FX rate**, from the same source as the KPI files.
- **Revenue feeds** for revenue-linked bonuses: Shopify revenue for Shahrukh, and the KPI-file results for Sadam and Rafay.
- **Payslip generation**: the PDF folder and file name per employee.

## Questions / oddities

1. **Sadam's and Rafay's bonuses do not match their own August KPI files.**

   | Person | Bonus sheet | Aug KPI file |
   |---|---|---|
   | Sadam | 75,723.42 | 40,281 |
   | Rafay | 3,333.60 | 8,322 |

   Which month or file produced the typed values? Should the KPI incentive be added on top of a review-based bonus (Sadam has a 5-question review block that is blank), or replace it?
2. **Wrong rating links for rows 5–6.** Rafay's and Sadam's review cells point at Ayaz's ratings, and their Points are typed 100. Sadam's review block ends in `#REF!`. Rafay has no review block at all.
3. **Shahrukh's base of 13,334.63 USD is unexplained.** It is close to, but not equal to, Shopify August revenue: QuickBooks 13,817.49, first-click 12,837.72. The prior month used 12,865.00. Which revenue definition is it?
4. **The company split is not applied consistently.** Ayaz's AN is pre-multiplied by 25%, but Arslan (55% CC) and Hamza Bilal (50% CC) carry the full amount. Is AN the CC-borne cost or the full bonus? The portal should store the full bonus and the split separately.
5. **Pro-rata bases differ**: days/21 working days for Arslan and Asim, days/30 for Hamza Bilal. Also, E (Days) is typed 21 for everybody, and `Review Points`!B2 is unused.
6. **Blank rating = 0 points** (Sadam's block). The portal must block submission until every rating is filled, or explicitly treat blank as excluded.
7. **AM averages only KPI points 1–8**, so a 9th or 10th question would be ignored even though the register has columns for 10.
8. **PdfFileName for Rafay is "Sadam Hussain"** (AY5), so his slip would overwrite or be mislabelled as Sadam's. The PdfFolderPath says "4-April", which is stale.
9. "Nasir Ali Khan" is in the allocation sheet (control 19,428.57) but not in `Main !`. Has he left, or was he omitted?
10. **Scale points (100 / 75 / 35 / 0) are hard-coded** in every formula. The gap between Good (75) and Fair (35) is large. Confirm the scale and keep it configurable.
11. **Mehran (Amazon, USD retainer plus profit share)** and Shumaila (TikTok, PKR base plus GMV tier) are not in this register. Their incentives run separately.
12. The hidden `Lead Criteria` (per-qualified-lead slabs) is not implemented anywhere. Is it still active for Sadam, perhaps for Urtasker?
