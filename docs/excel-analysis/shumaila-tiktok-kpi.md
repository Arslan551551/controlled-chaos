# Shumaila — TikTok Shop Role & KPI Compensation Plan

Source file: `Shumaila_TikTok_KPI.pdf`. One page, written in Word, with no figures or images.

## Purpose

This is the compensation plan for **Shumaila Mazhar** (TikTok Shop role). Her objective is to drive TikTok Shop sales growth while supporting affiliate execution, listing conversion, customer engagement and Shopify SEO content.

In the August FMO allocation her salary (USD 142.48 booked) is split **40% Shopify / 60% TikTok**. In the ROAS workbook she appears as CDC-006-25 (40/60).

Her responsibilities:

1. TikTok Shop sales and growth: grow GMV month over month through content, promotions and campaigns.
2. Affiliate and influencer management: recruit and manage creators, daily TikTok posting, Shop customer service.
3. Listing optimisation and design support.
4. Shopify blog writing (SEO).

## Structure (plan terms)

**Monthly compensation**

| Component | Amount | Treatment |
|---|---|---|
| Base salary | PKR 45,000 | fixed monthly |
| KPI bonus | PKR 10,000 | monthly KPI bonus. No scoring rule is stated. Presumably it goes through the review-points process of the bonus workbook (see below). |
| GMV KPI bonus | USD 50–200 | additional amount from the GMV tier table |

**TikTok Shop GMV KPI (whole-tier step, not progressive)**

| Monthly TikTok Shop GMV (USD) | GMV KPI bonus |
|---|---|
| < 10,000 | $0 |
| 10,000 – 14,999 | $50 |
| 15,000 – 19,999 | $100 |
| ≥ 20,000 | $200 |

Example from the PDF: GMV $17,000 → $100.

## Calculations

```
GMVBonus_USD = 0    if GMV < 10,000
             = 50   if 10,000 ≤ GMV < 15,000
             = 100  if 15,000 ≤ GMV < 20,000
             = 200  if GMV ≥ 20,000
KPIBonus_PKR = 10,000 × KPI%       (assumed: the same manager-rating KPI% as the bonus workbook; the plan does not say)
MonthlyPay   = 45,000 PKR + KPIBonus_PKR + GMVBonus_USD × FX
```

## Key numbers (test fixtures)

| GMV | GMV bonus |
|---|---|
| 9,999.99 | $0 |
| 10,000 | $50 |
| 14,999 | $50 |
| 15,000 | $100 |
| 17,000 | $100 (from the PDF) |
| 20,000 | $200 |
| 35,000 | $200 (capped) |

Actuals for orientation, all below $10k, so the GMV bonus would be $0:

- Aug-26 TikTok QuickBooks gross "Revenue Tiktok" was 8,521.10 and net revenue 6,725.85.
- Sep-26 settlement net sales were 8,863.13 and gross sales 11,113.27.

Under a GMV definition based on gross sales (11,113.27), September would pay **$50**. The definition matters.

## Data sources needed

- **TikTok Shop** monthly GMV, from the Seller Center analytics GMV figure or computed from orders.
- FX rate PKR/USD.
- The manager KPI rating, if the PKR 10,000 KPI bonus is score-based.

## Questions / oddities

1. **Which "GMV" counts?** Options:
   - TikTok's GMV, which includes buyer-paid shipping and is before seller discounts and refunds;
   - settlement gross sales;
   - net sales after discounts and returns.

   Settlement-date or order-date basis? This can change the tier, as September shows ($0 against $50).
2. **How is the PKR 10,000 KPI bonus earned?** Is it all-or-nothing, or scaled by a review score? Shumaila is not in the August bonus register, so the review questions for her role need defining.
3. Are tier boundaries at whole dollars or cents? "10,000 – 14,999" leaves a gap between 14,999 and 15,000. Implement them as half-open intervals: [10,000, 15,000).
4. Which FX rate and payment date apply to the USD component? This PDF does not say. The other PDFs say "by the 10th of the following month".
5. Shopify blog writing is a responsibility but carries no KPI. Is any SEO or blog metric meant to count?
