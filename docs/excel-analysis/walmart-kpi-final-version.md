# Walmart Sales KPI — Final Commission Structure

Source file: `Walmart_KPI_Final_Version.pdf`. Two pages, written in Word, PDF title "Walmart Sales KPI — Final Commission Structure". Marked "Approved KPI Structure". No payee is named.

## Purpose

A **progressive (marginal) slab commission on Walmart net sales**, for whoever owns the Walmart channel. The marginal rate falls as sales scale. It is gated by:

- a minimum of **$1,000 Eligible Walmart Net Sales**, and
- monthly **ROAS ≥ 2.00x**.

## Structure (plan terms)

**Gate.** Commission is payable only if `NetSales ≥ 1,000` **and** `ROAS ≥ 2.00`. Otherwise it is 0.

**Slabs** (applied to each portion of sales):

| Portion of monthly eligible net sales | Rate |
|---|---|
| 0 – 2,500 | 3.00% |
| 2,500 – 5,000 | 2.75% |
| 5,000 – 10,000 | 2.50% |
| > 10,000 | 1.50% |

The "Below $1,000 → 0%" row is the gate, not a slab. Once the gate is passed, the first $1,000 earns 3% too (the $1,000 example pays $30).

**Eligible Walmart Net Sales** is gross product sales less discounts, cancellations, returns and refunds for the month. Walmart referral fees, fulfilment fees, ad spend and other marketplace charges are **not** deducted.

**Payment.** Finance finalises net sales and ROAS after month-end, and pays by the **10th of the following month**.

## Calculations

```
S = Eligible Walmart Net Sales (month)
ROAS = Walmart Connect attributed sales / Walmart Connect ad spend   (assumed — the plan does not define ROAS)
if S < 1,000 or ROAS < 2.00: Commission = 0
else:
  Commission = 3.00% × min(S, 2,500)
             + 2.75% × clamp(S − 2,500, 0, 2,500)
             + 2.50% × clamp(S − 5,000, 0, 5,000)
             + 1.50% × max(S − 10,000, 0)
EffectiveRate = Commission / S
```

## Key numbers (test fixtures: the PDF's illustrative table)

| Eligible net sales | Commission | Effective rate |
|---|---|---|
| 999.99 | 0 (below the gate) | 0 |
| 1,000 | 30.00 | 3.00% |
| 2,500 | 75.00 | 3.00% |
| 5,000 | 143.75 | 2.875% |
| 10,000 | 268.75 (= 75 + 68.75 + 125) | 2.6875% |
| 15,000 | 343.75 | 2.29% |
| 20,000 | 418.75 | 2.09% |

Any of these with ROAS 1.99 pays 0.

Actuals for orientation:

- **Aug-26.** QuickBooks Walmart Sales = 365.80, below $1,000, so 0.
- **Sep-26.** The CEO summary has sales of 1,125.35, but ROAS is 1.85 (673.47 / 364.26), below 2.00, so 0. If ROAS had been ≥ 2, the commission would be 3% × 1,125.35 = 33.76.

## Data sources needed

- **Walmart Marketplace** orders and returns/refunds (Orders API / Reports), at order-line level for the month: gross item price, discounts, cancellations, refunds.
- **Walmart Connect** ad report: spend and attributed sales, for ROAS.
- A Finance month-end lock.

## Questions / oddities

1. **ROAS is not defined.** Is it Walmart Connect "ROAS" (attributed sales ÷ ad spend), or total Walmart net sales ÷ ad spend (which would be MER/TACoS-style)? With September figures these give 1.85 and 3.09 respectively, which changes eligibility.
2. **Is it month by order date or settlement date?** Are cancellations made after month-end handled by a later adjustment?
3. Is shipping income included in "gross product sales"? It reads as product only.
4. The Walmart sales in the ROAS workbook (1,125.35) do not reconcile with the Walmart order export (item price sum 2,138.89 for 116 September lines). The "eligible net sales" calculation must be agreed and auditable.
5. Who is the payee? No employee is named. Is it an internal role (Walmart is not in the bonus register) or a contractor?
6. Is the slab boundary at 2,500 inclusive? The text says "First $2,500" then "$2,501 – $5,000". Implement it as continuous at 2,500.00.
