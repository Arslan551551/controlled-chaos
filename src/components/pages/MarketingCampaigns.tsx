// Marketing → Campaigns and Conversion & MER tabs.

import { useMemo, useState, type FormEvent } from "react";

import { Assume, Badge, Field, HBar, Modal, ModalActions, ModuleStat, Progress, Section, Source, useCanEdit, type Tone } from "@/components/cc/ui";
import { analyzeCampaign, blended, CAMPAIGN_TYPES, funnel, merRow, type Campaign, type CampaignAnalysis, type CampaignType, type Verdict } from "@/lib/engine/campaigns";
import { formatDate } from "@/lib/engine/dates";
import type { SalesChannel } from "@/lib/engine/types";
import { int, money, monthLabel, pct, ratio, usd } from "@/lib/format";
import { newId, useCosting, useStore } from "@/lib/store";

const VERDICT_TONE: Record<Verdict, Tone> = { Profitable: "green", "Break-even": "amber", "Lost money": "red", "Not started": "grey" };
const MARKETPLACES: SalesChannel[] = ["Amazon", "Shopify", "TikTok Shop", "Walmart"];

// ---------------------------------------------------------------- campaigns

export function CampaignsTab() {
  const { data } = useStore();
  const { unitCost } = useCosting();
  const canEdit = useCanEdit("marketing");
  const [channel, setChannel] = useState<SalesChannel | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(data.campaigns[0]?.id ?? null);
  const [adding, setAdding] = useState(false);
  const [closing, setClosing] = useState<Campaign | null>(null);

  const all = useMemo(() => data.campaigns.map((c) => analyzeCampaign(c, unitCost)), [data.campaigns, unitCost]);
  const rows = all.filter((a) => channel === "all" || a.campaign.channel === channel).sort((a, b) => b.campaign.startDate.localeCompare(a.campaign.startDate));
  const done = rows.filter((a) => a.campaign.status !== "Planned");
  const sel = all.find((a) => a.campaign.id === selectedId) ?? null;

  const totCost = done.reduce((a, x) => a + x.totalCost, 0);
  const totDiscount = done.reduce((a, x) => a + x.campaign.costs.discountCost, 0);
  const totProfit = done.reduce((a, x) => a + x.incrementalProfit, 0);
  const lost = done.filter((a) => a.verdict === "Lost money");

  const byChannel = MARKETPLACES.map((ch) => {
    const r = all.filter((a) => a.campaign.channel === ch && a.campaign.status !== "Planned");
    return { ch, cost: r.reduce((a, x) => a + x.totalCost, 0), profit: r.reduce((a, x) => a + x.incrementalProfit, 0), n: r.length };
  });
  const maxAbs = Math.max(1, ...byChannel.map((b) => Math.abs(b.profit)));

  return (
    <>
      <div className="toolbar">
        <select className="control" value={channel} onChange={(e) => setChannel(e.target.value as SalesChannel | "all")} aria-label="Marketplace">
          <option value="all">All marketplaces</option>
          {MARKETPLACES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {canEdit ? <button className="btn primary" type="button" onClick={() => setAdding(true)}>+ Add Campaign</button> : null}
        <span className="spacer" />
        <Source>Seller Central / Sellerboard</Source>
        <Source>Shopify discount codes</Source>
        <Source>TikTok Shop promotions</Source>
        <Source>Walmart Connect</Source>
      </div>

      <div className="module-stats stat-strip">
        <ModuleStat label="Campaigns run" value={done.length} note={`${rows.length - done.length} planned`} />
        <ModuleStat label="Total campaign cost" value={usd(totCost)} note="Ads + discounts + fees + agency / influencer + samples" />
        <ModuleStat label="Discounts given away" value={usd(totDiscount)} note={`${pct(totCost > 0 ? totDiscount / totCost : 0, 0)} of campaign cost`} />
        <ModuleStat label="Incremental profit" value={<span className={totProfit < 0 ? "neg" : "pos"}>{usd(totProfit)}</span>} note="After product cost, discounts and fees" />
        <ModuleStat label="Lost money" value={<span className={lost.length ? "neg" : ""}>{lost.length}</span>} note={lost.map((l) => l.campaign.name).slice(0, 2).join(" · ") || "None"} />
      </div>

      <div className="grid-main-side">
        <Section title="Campaign results" kicker="BY MARKETPLACE" hint="Click a campaign for the cost breakdown">
          <div className="table-wrap">
            <table style={{ minWidth: 1240 }}>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Marketplace</th>
                  <th>Dates</th>
                  <th className="num">Discount</th>
                  <th className="num">Ad spend</th>
                  <th className="num">Discounts given</th>
                  <th className="num">Fees / agency / influencer</th>
                  <th className="num">Total cost</th>
                  <th className="num">Net sales</th>
                  <th className="num">Sales lift</th>
                  <th className="num">Incremental profit</th>
                  <th className="num">ROI</th>
                  <th>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const c = a.campaign;
                  const other = c.costs.dealFees + c.costs.agencyFees + c.costs.influencerFees + c.costs.samplesCost;
                  const planned = c.status === "Planned";
                  return (
                    <tr key={c.id} className={`click-row${selectedId === c.id ? " selected-row" : ""}`} onClick={() => setSelectedId(c.id)}>
                      <td><strong>{c.name}</strong><div className="small">{c.type} · {c.owner}</div></td>
                      <td>{c.channel}</td>
                      <td className="nowrap">{formatDate(c.startDate)}<div className="small">to {formatDate(c.endDate)} · {a.days}d</div></td>
                      <td className="num">{c.discountPct ? `${c.discountPct}%` : "—"}</td>
                      <td className="num">{planned ? "—" : usd(c.costs.adSpend)}</td>
                      <td className="num">{planned ? "—" : usd(c.costs.discountCost)}</td>
                      <td className="num">{planned ? "—" : usd(other)}</td>
                      <td className="num">{planned ? <span className="muted">Budget {usd(c.budget)}</span> : <strong>{usd(a.totalCost)}</strong>}</td>
                      <td className="num">{planned ? "—" : usd(c.results.netSales)}</td>
                      <td className="num">{planned ? "—" : <span className={a.incrementalUnits < 0 ? "neg" : ""}>{a.liftPct >= 0 ? "+" : ""}{pct(a.liftPct, 0)}</span>}</td>
                      <td className={`num ${a.incrementalProfit < 0 ? "neg" : "pos"}`}>{planned ? "—" : usd(a.incrementalProfit)}</td>
                      <td className="num">{planned ? "—" : pct(a.roi, 0)}</td>
                      <td><Badge tone={c.status === "Live" && a.verdict !== "Lost money" ? "blue" : VERDICT_TONE[a.verdict]}>{c.status === "Live" ? `Live · ${a.verdict}` : a.verdict}</Badge></td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? <tr><td colSpan={13} className="empty">No campaigns for this marketplace.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="small" style={{ marginTop: 8 }}>
            Sales lift = units sold vs the same SKUs' normal daily units before the campaign. Incremental profit = extra net sales − product cost of the extra units − ads, fees, agency, influencer and samples (discounts are already out of net sales).{" "}
            <Assume title="Baseline = average daily units/sales of the same SKUs on the same marketplace in the 28 days before the campaign. Confirm the window.">28-day baseline</Assume>
          </div>
        </Section>

        <div className="stack">
          {sel ? <CampaignDetail a={sel} canEdit={canEdit} onClose={() => setClosing(sel.campaign)} /> : null}
          <Section title="Profit from campaigns" kicker="BY MARKETPLACE">
            {byChannel.map((b) => (
              <HBar key={b.ch} label={`${b.ch} (${b.n})`} value={Math.abs(b.profit)} max={maxAbs} display={<span className={b.profit < 0 ? "neg" : "pos"}>{usd(b.profit)}</span>} tone={b.profit < 0 ? "bad" : "alt"} />
            ))}
          </Section>
        </div>
      </div>

      {adding ? <CampaignModal onClose={() => setAdding(false)} /> : null}
      {closing ? <ResultsModal campaign={closing} onClose={() => setClosing(null)} /> : null}
    </>
  );
}

function CampaignDetail({ a, canEdit, onClose }: { a: CampaignAnalysis; canEdit: boolean; onClose: () => void }) {
  const c = a.campaign;
  const planned = c.status === "Planned";
  const lines: { label: string; v: number; tone: "" | "warn" | "bad" | "alt" }[] = [
    { label: "Discounts given", v: c.costs.discountCost, tone: "warn" },
    { label: "Ad spend", v: c.costs.adSpend, tone: "" },
    { label: "Deal / coupon fees", v: c.costs.dealFees, tone: "warn" },
    { label: "Agency", v: c.costs.agencyFees, tone: "" },
    { label: "Influencers", v: c.costs.influencerFees, tone: "" },
    { label: "Free samples", v: c.costs.samplesCost, tone: "" },
  ];
  const max = Math.max(1, a.totalCost, Math.abs(a.incrementalGrossProfit) + c.costs.discountCost);
  return (
    <Section title={c.name} kicker={`${c.channel.toUpperCase()} · ${c.type.toUpperCase()}`} hint={<Badge tone={VERDICT_TONE[a.verdict]}>{a.verdict}</Badge>}>
      <div className="small" style={{ marginBottom: 8 }}>
        {formatDate(c.startDate)} – {formatDate(c.endDate)} · SKUs {c.skus.join(", ")} · owner {c.owner}
      </div>
      {planned ? (
        <div className="notice">Planned · budget {usd(c.budget)}. Results and costs are recorded when the campaign ends. {c.notes}</div>
      ) : (
        <>
          <div className="section-kicker" style={{ marginBottom: 4 }}>WHAT IT COST</div>
          {lines.filter((l) => l.v > 0).map((l) => (
            <HBar key={l.label} label={l.label} value={l.v} max={max} display={usd(l.v)} tone={l.tone} />
          ))}
          <HBar label={<strong>Total cost</strong>} value={a.totalCost} max={max} display={<strong>{usd(a.totalCost)}</strong>} tone="bad" />
          <div className="section-kicker" style={{ margin: "12px 0 4px" }}>WHAT IT BROUGHT IN</div>
          <div className="summary-line"><span>Units sold vs baseline</span><strong>{int(c.results.units)} vs {int(a.baselineUnits)}</strong></div>
          <div className="summary-line"><span>Extra units (lift)</span><strong>{int(a.incrementalUnits)} ({pct(a.liftPct, 0)})</strong></div>
          <div className="summary-line"><span>Extra net sales</span><strong>{usd(a.incrementalSales)}</strong></div>
          <div className="summary-line"><span>− Product cost of extra units ({money(a.unitCost)}/unit)</span><strong>{usd(a.incrementalUnits * a.unitCost)}</strong></div>
          <div className="summary-line"><span>= Extra gross profit</span><strong>{usd(a.incrementalGrossProfit)}</strong></div>
          <div className="summary-line"><span>− Ads, fees, agency, influencer, samples</span><strong>{usd(a.cashCost)}</strong></div>
          <div className="summary-line"><span><strong>Incremental profit</strong></span><strong className={a.incrementalProfit < 0 ? "neg" : "pos"}>{usd(a.incrementalProfit)}</strong></div>
          <div className="metric-grid" style={{ marginTop: 10 }}>
            <div className="metric"><div className="small">ROI</div><div className="v">{pct(a.roi, 0)}</div></div>
            <div className="metric"><div className="small">ROAS (net sales ÷ ads)</div><div className="v">{c.costs.adSpend ? ratio(a.roas) : "—"}</div></div>
            <div className="metric"><div className="small">MER (sales ÷ all cost)</div><div className="v">{ratio(a.mer)}</div></div>
            <div className="metric"><div className="small">Cost / extra order</div><div className="v">{a.costPerIncrementalOrder ? money(a.costPerIncrementalOrder) : "—"}</div></div>
            <div className="metric"><div className="small">New customers</div><div className="v">{int(c.results.newCustomers)}</div></div>
            <div className="metric"><div className="small">CAC</div><div className="v">{a.cac ? money(a.cac) : "—"}</div></div>
          </div>
          {a.postCampaignDip ? <div className="notice readonly" style={{ marginTop: 10 }}>Sales dropped below normal after the campaign — part of the lift was demand pulled forward.</div> : null}
          {c.notes ? <div className="small" style={{ marginTop: 8 }}>{c.notes}</div> : null}
        </>
      )}
      {canEdit && c.status !== "Ended" ? (
        <button className="btn primary full-width-action" type="button" onClick={onClose}>{planned ? "Record results" : "Close campaign & record results"}</button>
      ) : null}
    </Section>
  );
}

function CampaignModal({ onClose }: { onClose: () => void }) {
  const { data, update, flash, asOf, role } = useStore();
  const products = data.skus.filter((s) => s.active && s.type !== "Empty Tube");
  const [f, setF] = useState({ name: "", channel: "Amazon" as SalesChannel, type: "Amazon Coupon" as CampaignType, owner: role, start: asOf, end: asOf, sku: products[0]?.sku ?? "", discount: "0", budget: "", baseUnits: "", baseSales: "" });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim() || f.end < f.start) return;
    const c: Campaign = {
      id: newId("CMP"),
      name: f.name.trim(),
      channel: f.channel,
      type: f.type,
      owner: f.owner,
      startDate: f.start,
      endDate: f.end,
      skus: [f.sku],
      discountPct: Number(f.discount) || 0,
      budget: Number(f.budget) || 0,
      costs: { adSpend: 0, discountCost: 0, dealFees: 0, agencyFees: 0, influencerFees: 0, samplesCost: 0 },
      results: { orders: 0, units: 0, grossSales: 0, netSales: 0, newCustomers: 0 },
      baseline: { dailyUnits: Number(f.baseUnits) || 0, dailySales: Number(f.baseSales) || 0 },
      status: f.start <= asOf ? "Live" : "Planned",
      notes: "",
    };
    update("campaigns", (prev) => [...prev, c]);
    flash(`Campaign "${c.name}" added`);
    onClose();
  };
  return (
    <Modal open title="Add Campaign" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Campaign name" span2><input value={f.name} onChange={(e) => set("name", e.target.value)} required /></Field>
          <Field label="Marketplace">
            <select value={f.channel} onChange={(e) => set("channel", e.target.value)}>{MARKETPLACES.map((m) => <option key={m}>{m}</option>)}</select>
          </Field>
          <Field label="Type">
            <select value={f.type} onChange={(e) => set("type", e.target.value)}>{CAMPAIGN_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          </Field>
          <Field label="Start"><input type="date" value={f.start} onChange={(e) => set("start", e.target.value)} required /></Field>
          <Field label="End"><input type="date" min={f.start} value={f.end} onChange={(e) => set("end", e.target.value)} required /></Field>
          <Field label="Main SKU">
            <select value={f.sku} onChange={(e) => set("sku", e.target.value)}>{products.map((s) => <option key={s.sku} value={s.sku}>{s.sku} — {s.description}</option>)}</select>
          </Field>
          <Field label="Discount %"><input type="number" min={0} max={90} value={f.discount} onChange={(e) => set("discount", e.target.value)} /></Field>
          <Field label="Budget ($)"><input type="number" min={0} value={f.budget} onChange={(e) => set("budget", e.target.value)} /></Field>
          <Field label="Owner"><input value={f.owner} onChange={(e) => set("owner", e.target.value)} /></Field>
          <Field label="Baseline units / day"><input type="number" min={0} step="0.1" value={f.baseUnits} onChange={(e) => set("baseUnits", e.target.value)} placeholder="Auto from sales history in live version" /></Field>
          <Field label="Baseline net sales / day ($)"><input type="number" min={0} step="0.01" value={f.baseSales} onChange={(e) => set("baseSales", e.target.value)} /></Field>
        </div>
        <div className="notice" style={{ marginTop: 12, marginBottom: 0 }}>
          Live version fills the baseline automatically from the 28 days before the start date, and pulls ad spend, coupon redemptions and deal fees from the marketplace once the campaign ends.
        </div>
        <ModalActions onCancel={onClose} submitLabel="Save Campaign" />
      </form>
    </Modal>
  );
}

function ResultsModal({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const { update, flash } = useStore();
  const [costs, setCosts] = useState(campaign.costs);
  const [res, setRes] = useState(campaign.results);
  const num = (v: string) => Number(v) || 0;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    update("campaigns", (prev) => prev.map((c) => (c.id === campaign.id ? { ...c, costs, results: res, status: "Ended" } : c)));
    flash(`${campaign.name} closed`);
    onClose();
  };
  const costField = (k: keyof typeof costs, label: string) => (
    <Field label={label}><input type="number" min={0} step="0.01" value={costs[k]} onChange={(e) => setCosts({ ...costs, [k]: num(e.target.value) })} /></Field>
  );
  const resField = (k: "orders" | "units" | "grossSales" | "netSales" | "newCustomers", label: string) => (
    <Field label={label}><input type="number" min={0} step="0.01" value={res[k]} onChange={(e) => setRes({ ...res, [k]: num(e.target.value) })} /></Field>
  );
  return (
    <Modal open title={`Results · ${campaign.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="section-kicker">COSTS</div>
        <div className="form-grid">
          {costField("adSpend", "Ad spend")}
          {costField("discountCost", "Discounts given (revenue given away)")}
          {costField("dealFees", "Deal / coupon fees")}
          {costField("agencyFees", "Agency fees")}
          {costField("influencerFees", "Influencer fees")}
          {costField("samplesCost", "Free samples (cost + shipping)")}
        </div>
        <div className="section-kicker" style={{ marginTop: 12 }}>RESULTS</div>
        <div className="form-grid">
          {resField("orders", "Orders")}
          {resField("units", "Units")}
          {resField("grossSales", "Gross sales (list price)")}
          {resField("netSales", "Net sales (after discount)")}
          {resField("newCustomers", "New customers")}
        </div>
        <ModalActions onCancel={onClose} submitLabel="Close campaign" />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- conversion & MER

export function ConversionTab({ months }: { months: string[] }) {
  const { data } = useStore();
  const rows = data.trafficSources.filter((t) => months.includes(t.month));
  const channels: SalesChannel[] = ["Shopify", "Amazon", "TikTok Shop", "Walmart"];
  const byChannel = channels.map((ch) => funnel(ch, rows.filter((r) => r.channel === ch)));
  const shopifySources = [...new Set(rows.filter((r) => r.channel === "Shopify").map((r) => r.source))].map((s) =>
    funnel(s, rows.filter((r) => r.channel === "Shopify" && r.source === s)),
  );
  const mer = data.merInputs.filter((m) => months.includes(m.month));
  const merChannels = [...new Set(mer.map((m) => m.channel))];
  const merRows = merChannels.map((ch) => {
    const r = mer.filter((m) => m.channel === ch);
    const paidKnown = r.every((x) => x.paidAdSales !== null && x.paidAdSpend !== null);
    return merRow({
      channel: ch,
      month: months.join(","),
      totalSales: r.reduce((a, x) => a + x.totalSales, 0),
      marketingSellingCost: r.reduce((a, x) => a + x.marketingSellingCost, 0),
      marketingPayroll: r.reduce((a, x) => a + x.marketingPayroll, 0),
      paidAdSales: paidKnown ? r.reduce((a, x) => a + (x.paidAdSales ?? 0), 0) : null,
      paidAdSpend: paidKnown ? r.reduce((a, x) => a + (x.paidAdSpend ?? 0), 0) : null,
    });
  });
  const b = blended(mer);
  const maxSessions = Math.max(1, ...byChannel.map((f) => f.sessions));
  const label = months.length === 1 ? monthLabel(months[0] ?? "") : `${monthLabel(months[0] ?? "")} – ${monthLabel(months[months.length - 1] ?? "")}`;

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <Source>Shopify first-click referrer</Source>
        <Source>Seller Central Business Report</Source>
        <Source>Sellerboard</Source>
        <Source>TikTok Shop analytics</Source>
        <Source>Walmart Seller Center</Source>
      </div>

      <div className="module-stats stat-strip">
        <ModuleStat label="Blended MER" value={ratio(b.mer)} note={`${usd(b.totalSales)} sales ÷ ${usd(b.totalCost)} marketing cost`} />
        <ModuleStat label="Blended ROAS (paid ads)" value={ratio(b.roas)} note={`${usd(b.paidSales)} ÷ ${usd(b.paidSpend)} · wholesale excluded`} />
        <ModuleStat label="New customers" value={int(byChannel.reduce((a, f) => a + f.newCustomers, 0))} note={`${int(byChannel.reduce((a, f) => a + f.returningCustomers, 0))} returning`} />
        <ModuleStat label="Orders" value={int(byChannel.reduce((a, f) => a + f.orders, 0))} note={label} />
      </div>

      <Section title="MER by channel" kicker="AS IN THE ROAS REPORT" hint={label}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Channel</th>
                <th className="num">Total sales</th>
                <th className="num">Ads &amp; selling cost</th>
                <th className="num">Marketing payroll</th>
                <th className="num">Total marketing cost</th>
                <th className="num">MER</th>
                <th className="num">Paid-ad sales</th>
                <th className="num">Paid ad spend</th>
                <th className="num">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {merRows.map((r) => (
                <tr key={r.channel}>
                  <td><strong>{r.channel === "Distributor" ? "Wholesale / Distributor" : r.channel}</strong></td>
                  <td className="num">{money(r.totalSales)}</td>
                  <td className="num">{money(r.marketingSellingCost)}</td>
                  <td className="num">{money(r.marketingPayroll)}</td>
                  <td className="num">{money(r.totalMarketingCost)}</td>
                  <td className="num"><strong>{ratio(r.mer)}</strong></td>
                  <td className="num">{r.paidAdSales === null ? "N/A" : money(r.paidAdSales)}</td>
                  <td className="num">{r.paidAdSpend === null ? "N/A" : money(r.paidAdSpend)}</td>
                  <td className="num">{r.roas === null ? "N/A" : <span className={`badge ${r.roas >= 3 ? "b-green" : r.roas >= 1 ? "b-amber" : "b-red"}`}>{ratio(r.roas)}</span>}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td>Blended</td>
                <td className="num">{money(b.totalSales)}</td>
                <td className="num" colSpan={2} />
                <td className="num">{money(b.totalCost)}</td>
                <td className="num">{ratio(b.mer)}</td>
                <td className="num">{money(b.paidSales)}</td>
                <td className="num">{money(b.paidSpend)}</td>
                <td className="num">{ratio(b.roas)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="notice" style={{ marginTop: 10, marginBottom: 0 }}>
          <strong>ROAS</strong> only counts sales the ad platforms claim against paid ad spend. <strong>MER</strong> divides <em>all</em> channel sales by <em>all</em> marketing cost — ads, Reddit, email, TikTok samples, Join brand / Direct Marketing, and the marketing payroll allocated to the channel. MER is the better measure of whether marketing pays for itself.{" "}
          <Assume title="Amazon sales come from one locked Sellerboard month-end pull; the Sep report mixed two pulls that disagree ($51,178.52 vs $50,983.59).">one locked Amazon figure</Assume>
        </div>
      </Section>

      <div className="grid-2 mt">
        <Section title="Conversion funnel by marketplace" kicker="SESSIONS → CART → ORDERS" hint={label}>
          <div className="table-wrap">
            <table className="compact" style={{ minWidth: 640 }}>
              <thead>
                <tr><th>Channel</th><th className="num">Sessions</th><th className="num">Add to cart</th><th className="num">Orders</th><th className="num">CVR</th><th className="num">Cart → order</th><th className="num">AOV</th><th className="num">New share</th></tr>
              </thead>
              <tbody>
                {byChannel.map((f) => (
                  <tr key={f.key}>
                    <td><strong>{f.key}</strong></td>
                    <td className="num">{int(f.sessions)}</td>
                    <td className="num">{int(f.addToCart)}</td>
                    <td className="num">{int(f.orders)}</td>
                    <td className="num">{pct(f.conversionRate, 2)}</td>
                    <td className="num">{pct(f.cartToOrder, 0)}</td>
                    <td className="num">{money(f.aov)}</td>
                    <td className="num">{pct(f.newCustomerShare, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt">
            {byChannel.map((f) => (
              <HBar key={f.key} label={f.key} value={f.sessions} max={maxSessions} display={`${pct(f.conversionRate, 1)} CVR`} />
            ))}
          </div>
        </Section>

        <Section title="Shopify by traffic source" kicker="FIRST-CLICK" hint="google · facebook/instagram · email · direct · others · affiliate">
          <div className="table-wrap">
            <table className="compact" style={{ minWidth: 640 }}>
              <thead>
                <tr><th>Source</th><th className="num">Sessions</th><th className="num">CVR</th><th className="num">Sales</th><th className="num">New / returning</th><th className="num">Ad spend</th><th className="num">ROAS</th><th className="num">CAC</th></tr>
              </thead>
              <tbody>
                {shopifySources.map((f) => (
                  <tr key={f.key}>
                    <td><strong>{f.key}</strong></td>
                    <td className="num">{int(f.sessions)}</td>
                    <td className="num">{pct(f.conversionRate, 2)}</td>
                    <td className="num">{money(f.revenue)}</td>
                    <td className="num">{int(f.newCustomers)} / {int(f.returningCustomers)}</td>
                    <td className="num">{f.adSpend ? money(f.adSpend) : "—"}</td>
                    <td className="num">{f.adSpend ? <span className={f.roas < 1 ? "neg" : ""}>{ratio(f.roas)}</span> : "N/A"}</td>
                    <td className="num">{f.adSpend && f.newCustomers ? money(f.cac) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt">
            {shopifySources.map((f) => (
              <div key={f.key} className="row" style={{ justifyContent: "space-between", padding: "4px 0" }}>
                <span className="small" style={{ width: 130 }}>{f.key} · new share</span>
                <div style={{ flex: 1 }}><Progress value={f.newCustomerShare} tone={f.newCustomerShare >= 0.3 ? "good" : "warn"} /></div>
                <span className="small num" style={{ width: 50 }}>{pct(f.newCustomerShare, 0)}</span>
              </div>
            ))}
          </div>
          <div className="small" style={{ marginTop: 8 }}>
            Every referrer is mapped to a source; unknown referrers go to "others" instead of dropping out, and Klaviyo maps to email.{" "}
            <Assume title="The Sep workbook mapped Klaviyo to 'Others' and lost unmapped referrers. Confirm Klaviyo should count as email.">Klaviyo = email</Assume>{" "}
            <Assume title="Sessions and add-to-cart are sample values; Sep sales, customers and spend per source are the real ROAS report figures.">sessions are sample</Assume>
          </div>
        </Section>
      </div>
    </>
  );
}
