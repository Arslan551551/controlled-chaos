# KPI / Bonus Framework — Common Model for the Portal

This note synthesises every employee and contractor pay plan seen so far:

| Plan | Source note |
|---|---|
| Mehran (Amazon) | `mehran-kpi-sep-26.md` |
| Sadam (Google) | `sadam-kpi-aug-2026.md` |
| Rafay (Meta) | `rafay-kpi-aug-2026.md` |
| Support-team review bonus | `controlled-chaos-bonus-calculations-4.md` |
| Shumaila (TikTok) | `shumaila-tiktok-kpi.md` |
| TikTok GMV Max consultant | `tiktok-kpi-final.md` |
| Walmart sales KPI | `walmart-kpi-final-version.md` |

The goal is **one configurable engine**: a plan is a list of components, each component is one of a small set of types, and every input metric comes from a locked month-end metric snapshot.

## 1. Inventory of plans

| Person / role | Currency | Components (as built today) |
|---|---|---|
| **Mehran**, Amazon account manager | USD | Retainer 350 + 5% × (Amazon Sellerboard net profit − 6,000) + 2% × (Amazon sales − 50,000) |
| **Sadam**, Google Ads (Shopify) | USD → PKR | New-customer bands (1–40 @ $5, 41–80 @ $7, 81+ @ $9) + 5% × Google-sourced revenue **if** Google ROAS > 2.5 **and** Meta ROAS > 1.5 |
| **Rafay**, Meta Ads (Shopify) | USD → PKR | New-customer bands (1–50 @ $3, 51+ @ $4) + 5% × Meta-sourced revenue under the same dual-ROAS gate |
| **Support team** (finance, creative, design, social: 11 people) | PKR | Achievable bonus (fixed target, optionally × days/working-days, × company share) × average review score (Excellent 100 / Good 75 / Fair 35 / Poor 0) ± manual additions and deductions |
| **Shahrukh**, creative content strategist | USD → PKR | Achievable = 1% × Shopify revenue (USD), × review score |
| **Shumaila**, TikTok Shop | PKR + USD | Base PKR 45,000 + KPI bonus PKR 10,000 + GMV step bonus ($0 / 50 / 100 / 200 at <10k / 10–15k / 15–20k / ≥20k) |
| **TikTok GMV Max consultant** | USD | Gate GMV ≥ 10k. Fixed step by GMV (100 / 150 / 200) + ROAS step (0 / 100 / 150 / 200 at <3 / 3–3.5 / 3.51–4.5 / ≥4.51) + growth step against the prior 30 days (0 / 75 / 100 / 120 at <15% / 15–35% / 35–60% / ≥60%) |
| **Walmart owner** | USD | Gate net sales ≥ 1,000 **and** ROAS ≥ 2.0. Progressive slabs: 3% to 2.5k, 2.75% to 5k, 2.5% to 10k, 1.5% above |
| Sadam (hidden `Lead Criteria`; probably Urtasker) | PKR | Per qualified lead: ≤50 @ 2,000; ≤100 @ 1,500; >100 @ 1,000 |

## 2. Component types (the engine's vocabulary)

Every component above maps to one of seven types:

| Type | Formula | Parameters | Used by |
|---|---|---|---|
| **FIXED** | `amount` | amount, currency, optional pro-rata | Mehran retainer, Shumaila base |
| **PCT_ABOVE_THRESHOLD** | `rate × max(0, metric − threshold)` | metric, threshold, rate, `floor_at_zero` (default true) | Mehran profit share (net profit, 6,000, 5%) and growth commission (sales, 50,000, 2%) |
| **PCT_OF_METRIC** | `rate × metric` | metric, rate | Sadam/Rafay ROAS incentive (5% × channel revenue); Shahrukh achievable (1% × Shopify revenue) |
| **STEP_TIER** (whole-tier lookup) | `value of the tier containing the metric` | metric, ordered tiers `[lower_inclusive, upper_exclusive) → amount` | Shumaila GMV bonus; GMV Max fixed, ROAS and growth; possibly the Sadam/Rafay customer bands |
| **PROGRESSIVE_SLAB** (marginal) | `Σ rate_i × portion of metric in slab_i` | metric, slabs `[from, to) → rate` | Walmart; possibly the Sadam/Rafay customer bands and the lead scheme |
| **PER_UNIT_TIERED** | `count × rate(tier)` (whole) **or** `Σ count_in_band × rate_band` (marginal) | count metric, bands, mode | Sadam/Rafay new customers, Sadam leads |
| **SCORED_REVIEW** | `base × mean(score(rating_q))` or a weighted mean | question set, rating scale map, weights (default equal), `base` (which can itself be any component) | support-team bonus; Shumaila's PKR 10,000 KPI bonus (assumed) |

Modifiers that apply to any component:

- **Gates (eligibility conditions).** Any number of `metric op value` predicates combined with AND or OR. If a gate fails, the component pays 0.
  - Examples: `ROAS_google > 2.5 AND ROAS_meta > 1.5` (Sadam/Rafay); `GMV ≥ 10,000` (GMV Max, gating all components); `NetSales ≥ 1,000 AND ROAS ≥ 2.0` (Walmart).
  - Gates can reference **another person's metric**, as in the Sadam/Rafay cross-gate.
- **Caps and floors**: `min` / `max` payout. Mehran's sheet has no zero floor, which gives a negative component if he misses the threshold. Default the floor to 0 unless the owner says clawbacks apply.
- **Pro-rata**: `× days_worked / basis_days`, where `basis_days` is the working days in the month (21) or calendar days (30). Mid-month rate changes are split into periods (Hamza Bilal: 5,000 × 16/30 + 7,500 × 14/30).
- **Company share**: `× entity_share` (Controlled Chaos against Urtasker). Store the **full** amount and the split separately; apply the split only for cost booking.
- **FX conversion**: compute in the plan currency (USD), then convert at **one** monthly rate (today the rates 277.4 / 277.8 / 277.85 / 278.5 are all in use).
- **Rounding**: per component or on the total (to the whole PKR, as `ROUND(…,0)` does in `Sheet1`).
- **Manual adjustments**: additions and deductions with a reason text and an approver (bonus register AP–AU).

## 3. Data model (minimum)

```
employee(id, name, codes[CDC-…, DT00-…], department, designation, manager_id, entity_split{CC%, Urtasker%}, payout_currency, payee_ref→restricted bank table)
plan(id, employee_id, valid_from, valid_to, currency, version, approved_by, approved_at)
plan_component(id, plan_id, type, label, metric_key, params_json, gates_json, cap, floor, prorate_basis, order)
review_template(id, role, version, questions[{id, text, weight}], scale{Excellent:100, Good:75, Fair:35, Poor:0})
review_submission(employee_id, period, template_id, ratings{q_id: rating}, submitted_by, approved_by)   -- block if any rating is blank
metric_snapshot(period, metric_key, scope{channel, source, person}, value, source_system, pulled_at, locked_by, locked_at)
fx_rate(period, pair, rate, source)
attendance(employee_id, period, days_worked, working_days)
payout(employee_id, period, plan_version, component_lines[{label, metric_values, formula_trace, amount_ccy}], fx, total_pkr, total_usd, adjustments[], status{draft, approved, paid}, slip_pdf)
```

## 4. Metric catalogue required by the plans

| metric_key | Definition | Source |
|---|---|---|
| `amazon.sales` | Sellerboard "Sales" (gross, all ad types) | Sellerboard / SP-API |
| `amazon.net_profit` | Sellerboard "Net profit", **after** the indirect expenses posted from the FMO allocation | Sellerboard + FMO allocation |
| `amazon.tacos` | ad cost / sales (informational) | Sellerboard |
| `shopify.newcust.{source}` | distinct D2C first-order orders by first-click source | Shopify first-click report + source map |
| `shopify.rev.{source}` | first-click net sales, D2C, new + returning | same |
| `shopify.revenue` | Shopify revenue (definition needed for Shahrukh: QuickBooks total 13,817.49 against first-click 12,837.72 against the 13,334.63 used) | QuickBooks / Shopify |
| `ads.spend.{google, meta}` | monthly platform spend | Google Ads / Meta API (QuickBooks card charges as fallback) |
| `roas.shopify.{source}` | `shopify.rev.{source} / ads.spend.{source}` (first-click ROAS, **not** platform ROAS) | derived |
| `tiktok.gmv` | **to define**: TikTok GMV, settlement gross, or net | TikTok Shop |
| `tiktok.gmvmax.{gmv, cost, roas, growth_30d}` | GMV Max dashboard, daily | TikTok Ads / GMV Max |
| `walmart.net_sales_eligible` | gross product sales − discounts − cancellations − returns/refunds | Walmart Marketplace |
| `walmart.roas` | **to define**: Walmart Connect attributed sales / spend | Walmart Connect |
| `leads.qualified` | qualified leads (Urtasker?) | CRM |
| `review.score.{employee}` | mean rating score | portal |

## 5. Worked fixtures (the engine must reproduce these)

| Plan | Inputs | Expected |
|---|---|---|
| Mehran, Sep-26 | sales 50,983.59, net profit 6,523.12 | 350 + 26.156 + 19.6718 = **395.8278 USD** |
| Mehran, Aug-26 inputs | sales 57,804.79, net profit 6,479.32 | 350 + 23.966 + 156.0958 = 530.06 USD |
| Sadam, Aug-26 | 29 new Google customers; ROAS G 2.3282, M 0.3548; revenue G 4,466.84 | $145 → **PKR 40,281** @ 277.8 |
| Rafay, Aug-26 | 10 new Meta customers; same ROAS | $30 → **PKR 8,322** @ 277.4 |
| Arslan, Aug-26 review | 5 × Excellent + 1 × Good; target 16,500; 21/21 days | **15,812.50 PKR** |
| Hamza Bilal pro-rata | 5,000 × 16/30 + 7,500 × 14/30 | 6,167 PKR (rounded) |
| Shahrukh | 1% × 13,334.63 × 277.85 × 100% | 37,050.27 PKR |
| Bonus register total, Aug-26 | 11 employees | **191,586.79 PKR** |
| Shumaila GMV | GMV 17,000 | $100 |
| GMV Max | (16,000; 3.0x; +18%) / (27,000; 4.6x; +65%) / (27,000; 4.2x; +40%) / (10,200; 1.9x; +10%) | 325 / 520 / 450 / 100 |
| Walmart | 1,000 / 5,000 / 10,000 / 15,000 / 20,000 at ROAS ≥ 2 | 30 / 143.75 / 268.75 / 343.75 / 418.75 |

## 6. Process requirements observed

- **Month-end lock.** Every plan says, or implies, "Finance finalises after month-end; pay by the 10th". The portal needs a period close: lock the metric snapshots, compute draft payouts, then manager review and Finance approval, then paid.
- **Show the trace.** The typed labels such as "($523.12*5%)" are there so the employee sees how the figure was derived. Generate the trace automatically: every slip shows the metric values, thresholds, tier hit and gate results.
- **One version of each metric.** Today the same Amazon month exists in two Sellerboard pulls, and the KPI files carry stale typed values (in the hidden rows). The engine must read only locked snapshots.
- **Cross-person dependencies.** The Sadam/Rafay gate uses both channels, so both payouts must use the same snapshot.
- **Payslips.** One PDF per employee per month, with a correct file name (today Rafay's slip is mis-named "Sadam Hussain").
- **Bank details** live in a restricted payee table, never on the calculation sheet.

## 7. Open questions for the owner (KPI side)

1. Are the Sadam/Rafay customer bands **marginal** or **whole-count**? (The same question applies to the lead slabs.)
2. Is the dual ROAS gate intentional (a shared team target)? Does each person get 5% of **their own** channel's revenue?
3. How do the KPI-file incentives relate to the review-based bonus for Sadam and Rafay? Today the bonus register carries typed amounts (75,723.42 and 3,333.60) that match neither August KPI file (40,281 and 8,322).
4. Should Mehran's components be floored at 0? Should the TACoS he is shown be a gate?
5. Which revenue is the base for Shahrukh's 1%?
6. Should one monthly FX rate apply to all PKR conversions? From which source?
7. What are the definitions of TikTok "GMV" (Shumaila, GMV Max) and of Walmart "ROAS" and "eligible net sales"?
8. How is Shumaila's PKR 10,000 KPI bonus scored? Which review questions apply?
9. Is the bonus register's AN the full bonus or the CC-borne share? Today Ayaz is 25%, and Arslan and Hamza Bilal carry the full amount.
10. Is the review scale 100 / 75 / 35 / 0 final, with equal question weights? Should a blank rating be blocked?
