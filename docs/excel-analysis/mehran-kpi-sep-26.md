# Mehran KPI / Compensation — Sep 2026

Source file: `Mehran_KPI_Sep-26.xlsx` (2 sheets, no charts, no images, no named ranges).

## Purpose

Monthly compensation statement for **Mehran Nisar**, the Amazon account manager. (In the ROAS workbook he appears as employee `CDC-009-26`, with 100% of his payroll cost allocated to Amazon.) The sheet title reads "Mehran Compensation FTMO Sep 2026".

Pay is made up of three parts:

1. A fixed monthly retainer.
2. A profit share: 5% of Amazon net profit above a threshold.
3. A growth commission: 2% of Amazon sales above a revenue threshold.

All inputs come from a **Sellerboard** Amazon P&L export, pasted into the sheet `PnL SB` ("SB" = Sellerboard). TACoS is calculated and shown on the sheet but is **not** used in the payout.

There is no weighted KPI score, and there are no tiers or slabs. Each component is a single threshold with a flat rate.

## Sheets & columns

### `Sheet1` (the compensation statement, range C2:K19)

| Cell | Label | Type | Value / formula |
|---|---|---|---|
| C2 | Title "Mehran Compensation FTMO Sep 2026" | text | |
| D4 | Monthly Retainer | **input** | 350 |
| D5 | Profit Share ("($523.12*5%)" is typed into the label) | calc | `=I15*5%` → 26.156 |
| D6 | Growth Commission ("($983.59*2%)" is typed into the label) | calc | `=K7*2%` → 19.6718 |
| D8 | Total Compensation | calc | `=SUM(D4:D6)` → **395.8278** |
| H3/I3 | "TACOS" / "Ad Spend/Revenue*100" | label | |
| I6 | Ad Spend | lookup | `=-'PnL SB'!B16` → 9,604.51 |
| I7 | Revenue | lookup | `='PnL SB'!B2` → 50,983.59 |
| K7 | Revenue above threshold | calc | `=I7-50000` → 983.59 |
| I8 | Tacos | calc | `=I6/I7` → 0.18838 (18.84%) |
| I13 | Profit Share base (net profit) | **hard-coded input** | 6,523.12 |
| I14 | Threshold | **input** | 6,000 |
| I15 | Profit above threshold | calc | `=I13-I14` → 523.12 |
| C14:D19 | Payee bank details: account title, bank name, IBAN, branch, branch code, SWIFT | static | *(deliberately left out of this note; store them in the HR/payee master, not in code)* |

### `PnL SB` (Sellerboard P&L export, A1:D83)

- Columns: `Parameter/Date` | `September 2026` | `August 2026` | `Total`.
- 82 metric rows. All of them are static values, with no formulas.
- Top-level rows and their sub-rows (sub-rows are indented with 4 spaces):

| Row | Metric | Sep 2026 (B) |
|---|---|---|
| 2 | Sales | 50,983.59 |
| 3–5 | Organic / Sponsored Products (same day) / Sponsored Display (same day) | 35,481.90 / 15,501.69 / 0 |
| 6–7 | Direct sales / Subscription sales (est.) | 44,481.99 / 6,501.60 |
| 8 | Units | 1,995 (Organic 1,322, SP 673, Direct 1,765, Subscribe & Save 230) |
| 14 | Refunds (count) | 33 |
| 15 | Promo | −1,219.45 |
| 16 | Advertising cost | −9,604.51 (SP −9,585.76, SB −18.75, SBV/SD/STV/Vendor 0) |
| 23 | Shipping costs | 0 |
| 24 | Refund cost | −750.56 (rows 25–30 are its components) |
| 31 | Amazon fees | −16,716.00 (rows 32–50: FBA fulfilment, referral, inbound, storage, reimbursements, …) |
| 51 | Cost of goods | −6,468.24 |
| 57 | VAT | 0 |
| 60 | Gross profit | 16,224.83 |
| 61 | Indirect expenses | −9,701.71 (freight, salaries, interest, advertising & marketing, office, legal, shipping, insurance, bookkeeping) |
| 72 | Net profit | **6,523.12** |
| 73 | Estimated payout | 22,609.54 |
| 74 | TACOS | 0.1884 |
| 75 | % Refunds | 0.0165 |
| 76 | Sellable returns | 0.6667 |
| 77 | Margin | 0.1279 |
| 78 | ROI | 1.0085 |
| 79 | Active subscriptions (SnS) | 673 |
| 80–82 | Sessions (browser + mobile app) | 8,571 (2,479 + 6,090) |
| 83 | Unit session percentage | 0.2328 |

## Calculations

Inputs for month *m*, all taken from the Amazon P&L for that month:

- `Revenue` = Amazon **Sales**, which Sellerboard reports gross of fees (= Organic + Sponsored Products + Sponsored Display).
- `AdSpend` = |Advertising cost|, covering every Amazon ads type.
- `NetProfit` = Sellerboard **Net profit**, which is after COGS, Amazon fees, ads, refunds **and indirect expenses**.

Compensation:

```
Retainer         = 350                                  (fixed, USD)
ProfitShare      = 5% × (NetProfit − 6,000)             = 0.05 × 523.12 = 26.156
GrowthCommission = 2% × (Revenue − 50,000)              = 0.02 × 983.59 = 19.6718
TotalComp        = Retainer + ProfitShare + GrowthCommission = 395.8278
TACoS            = AdSpend / Revenue                     = 9,604.51 / 50,983.59 = 0.18838  (shown on the sheet, not paid on)
```

The sheet has **no floor at zero**. If net profit is below 6,000, or sales are below 50,000, the formula gives a negative component. The portal should use `max(0, …)` unless the owner confirms that clawbacks are intended.

Relationships inside the Sellerboard P&L (checked against September; reproduce them if the portal computes its own P&L):

- Sales = Organic + Sponsored Products + Sponsored Display → 35,481.90 + 15,501.69 + 0 = 50,983.59 ✓
- Sales = Direct sales + Subscription sales → 44,481.99 + 6,501.60 ✓
- Units = Organic + SP + SD units → 1,322 + 673 = 1,995 ✓
- Gross profit = Sales + Promo + Advertising + Shipping + Refund cost + Amazon fees + Cost of goods + VAT (costs are negative) → 16,224.83 ✓
- Net profit = Gross profit + Indirect expenses → 16,224.83 − 9,701.71 = 6,523.12 ✓
- TACOS = |Advertising| / Sales → 0.1884 ✓
- % Refunds = Refunds (count) / Units → 33 / 1,995 = 0.0165 ✓
- Margin = Net profit / Sales → 0.1279 ✓
- ROI = Net profit / |Cost of goods| → 6,523.12 / 6,468.24 = 1.0085 ✓
- Unit session % = Units / Sessions → 1,995 / 8,571 = 0.2328 ✓
- Estimated payout comes straight from Sellerboard. It does **not** equal Sales + Promo + Ads + Refund cost + Amazon fees (that gives 22,693.07, against 22,609.54 reported), so treat it as a Sellerboard-provided figure.

## Key numbers (test fixtures, Sep 2026)

| Item | Value |
|---|---|
| Revenue (Amazon sales) | 50,983.59 |
| Ad spend | 9,604.51 |
| TACoS | 0.188384 (18.84%) |
| Net profit | 6,523.12 |
| Profit above threshold | 523.12 |
| Sales above threshold | 983.59 |
| Retainer | 350.00 |
| Profit share | 26.156 |
| Growth commission | 19.6718 |
| **Total compensation** | **395.8278 (≈ 395.83)** |
| August 2026 comparison: Sales / Ads / Net profit / TACOS | 57,804.79 / 12,844.03 / 6,479.32 / 0.2222 |

At the August figures the same rules would give a growth commission of 2% × 7,804.79 = 156.10 and a profit share of 5% × 479.32 = 23.97. These are handy as a second test case.

## Data sources / integrations needed

- **Sellerboard** (or the Amazon SP-API Finance/Settlement data, the Amazon Ads API and Brand Analytics/Business Reports, if the P&L is rebuilt natively). The sheet needs, per month: Sales, the ad cost breakdown, Net profit and Sessions.
- **Indirect expenses** (freight, salaries, interest, legal, office and so on) are pushed into Sellerboard from the accounting ledger, probably QuickBooks. Net profit, and therefore the profit share, depends on these being complete before the month is closed.
- **Payee master**: employee code, retainer, rates, thresholds, bank details (sensitive; access-controlled).
- Granularity: monthly, Amazon channel only, one person.

## Questions / oddities

1. **Net profit is typed in, not linked.** `I13` is the hard-coded number 6,523.12, while revenue and ad spend are linked to `PnL SB`. The labels "($523.12*5%)" and "($983.59*2%)" are also typed text and will go stale. In the portal, compute everything from the P&L record.
2. **No zero floor** on either variable component (see above). Confirm whether a shortfall reduces pay or just gives 0.
3. Are the thresholds (6,000 net profit, 50,000 sales) and rates (5%, 2%) fixed, or reviewed each month or quarter? They should be configurable per person and per period.
4. The TACoS label says "Ad Spend/Revenue*100", but the formula does not multiply by 100. It returns a fraction (0.188). Is there a TACoS target (for example a bonus if TACoS is below X%) that is meant to feed the pay? Today it is informational only.
5. **The Amazon numbers disagree with the ROAS/FMO workbook.** The `Amazon Trend` sheet in `ROAS_Report_FMO_Sep-26_-_Final.xlsx` is the same Sellerboard export but shows different September figures: Sales 51,178.52 against 50,983.59, Ads 9,632.21 against 9,604.51, Net profit 6,654.05 against 6,523.12. Its September indirect-expense block also equals this file's **August** block. Agree which pull is the "closed" month, and lock it, before computing pay.
6. Payroll inconsistency: the `Others` sheet of the ROAS workbook allocates 197.66 of payroll to Mehran (100% Amazon), but this statement totals 395.83. That could be a different month, a currency conversion, or retainer only. Confirm which figure is the true cost for the MER/payroll allocation.
7. "FTMO" in the title against "FMO" in the other file name: is this a period code (for example "for the month of")?
8. The `PnL SB` "Total" column is inconsistent for two rows: Direct sales Total = 108,788.38, which is the Sales total, not Sep + Aug direct; Subscription Total = 0. Session sub-rows 2,479 + 6,090 = 8,569, not 8,571. These are Sellerboard export quirks; do not rely on the Total column.
9. Bank details (IBAN and so on) sit in the same sheet as pay figures. In the portal, store them in a restricted payee table.
