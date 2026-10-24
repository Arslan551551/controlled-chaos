# TikTok Shop GMV Max — Consultant Compensation Plan

Source file: `TikTok_KPI_Final.pdf`. Three pages, written in Word, PDF title "TikTok Shop GMV Max — Consultant Compensation Plan". There is a signature block (Controlled Chaos / Consultant), but no consultant is named.

## Purpose

This is the pay plan for an external **GMV Max consultant**, who runs TikTok Shop's automated GMV Max ad campaigns. Pay is in USD:

- a **fixed fee that steps up with monthly GMV** (USD 100 / 150 / 200);
- two **independent performance commissions**, one for **ROAS** and one for **GMV growth against the prior 30-day baseline**.

Nothing is paid below $10,000 GMV.

## Structure (plan terms)

**1. Fixed monthly compensation (tier by monthly GMV sales)**

| Monthly GMV | Fixed |
|---|---|
| < $10,000 | $0, and **no commission at all** |
| $10,000 – <$15,000 | $100 |
| $15,000 – <$20,000 | $150 |
| ≥ $20,000 | $200 |

**2A. ROAS commission** (paid only if GMV ≥ $10,000)

| ROAS | Commission |
|---|---|
| < 3.0x | $0 |
| 3.0x – 3.50x | $100 |
| 3.51x – 4.50x | $150 |
| ≥ 4.51x | $200 |

**2B. GMV growth commission** (paid only if GMV ≥ $10,000). Growth is measured against the **prior 30-day baseline**, "using figures finalised by Finance".

| Growth | Commission |
|---|---|
| < 15% | $0 |
| 15% – 34.99% | $75 |
| 35% – 59.99% | $100 |
| ≥ 60% | $120 |

The two commissions are earned independently and added together. The maximum performance commission is $320, so the maximum payout is 200 + 320 = **$520**.

Other terms:

- **Governance**: all GMV Max product selection and ad budget must be approved by the CEO (Omer) before launch or spend.
- **Payment**: Finance calculates after month-end from the finalised GMV Max dashboard. Fixed and commissions are paid together by the **10th of the following month** (August results are paid by 10 September).
- **Reporting metrics**: cost, SKU orders / GMV revenue, ROAS, and GMV growth against baseline.

## Calculations

```
GMV       = monthly GMV Max sales (dashboard "GMV revenue")              -- see Questions: GMV Max vs total shop GMV
Cost      = GMV Max ad cost for the month
ROAS      = GMV / Cost
Growth    = GMV / Baseline − 1, Baseline = prior 30-day GMV

if GMV < 10,000: Payout = 0
else:
  Fixed   = 100 if GMV < 15,000 ; 150 if GMV < 20,000 ; else 200
  RoasC   = 0 if ROAS < 3.0 ; 100 if ROAS ≤ 3.50 ; 150 if ROAS ≤ 4.50 ; else 200
  GrowthC = 0 if Growth < 0.15 ; 75 if Growth < 0.35 ; 100 if Growth < 0.60 ; else 120
  Payout  = Fixed + RoasC + GrowthC
```

Implementation note on the ROAS bands: the printed bands leave gaps (3.50–3.51 and 4.50–4.51). Use continuous half-open bounds: [3.0, 3.505) → 100, [3.505, 4.505) → 150, ≥ 4.505 → 200. Alternatively, round ROAS to 2 decimals first; confirm with the owner.

## Key numbers (test fixtures: the PDF's worked examples)

| Example | GMV | ROAS | Growth | Fixed | ROAS C | Growth C | Total |
|---|---|---|---|---|---|---|---|
| A | 10,200 | 1.9 | +10% | 100 | 0 | 0 | **100** |
| B | 16,000 | 3.0 | +18% | 150 | 100 | 75 | **325** |
| C | 27,000 | 4.6 | +65% | 200 | 200 | 120 | **520** |
| D | 27,000 | 4.2 | +40% | 200 | 150 | 100 | **450** |
| Extra (derived) | 9,999 | 6.0 | +100% | 0 | 0 | 0 | 0 |

Actuals for orientation, from the ROAS/FMO workbook:

- The September GMV Max daily table for 1–20 Sep shows spend 1,664.65 and revenue 2,374.70, so ROI 1.43.
- The CEO summary has TikTok paid sales of 5,838.14 against spend of 3,297.06, so ROAS 1.77.

Either way GMV is below $10k, so the payout would be $0.

## Data sources needed

- **TikTok Shop GMV Max dashboard / TikTok Ads (Marketing API)**: daily cost, SKU orders and GMV revenue per campaign. Store it daily, so the "prior 30-day baseline" can be computed for any window.
- A month-end **finalised** snapshot, locked by Finance.
- A CEO approval record for product selection and budget. The portal could hold this as an approval workflow.

## Questions / oddities

1. **Is the GMV threshold based on GMV Max-attributed sales or total TikTok Shop GMV?** The title and the reporting section suggest GMV Max dashboard revenue.
2. **What is the "prior 30-day baseline"?** The previous calendar month, the 30 days before campaign start, or a rolling window? If it is the previous month, months of different length matter.
3. Is growth measured on the same GMV definition as the tier?
4. Is ROAS computed on gross GMV, or after refunds and cancellations? Is it rounded to 2 decimals before banding?
5. Headings say "$10,000 sales month", but example A uses $10,200 and B uses $16,000. Tiers are by "at least" thresholds. Confirm that $15,000 exactly maps to $150.
6. Is the consultant's cost charged to TikTok marketing? In the P&L, "Tiktok Marketing" is an indirect expense allocated 100% to TikTok.
7. No consultant is named and the plan is unsigned in the PDF. Confirm the start date and the payee in the vendor master.
