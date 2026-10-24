import { useMemo, useState } from "react";

import {
  Assume,
  ModuleGate,
  ModuleHead,
  ModuleStat,
  Section,
  Source,
  Tabs,
  ViewOnlyBanner,
  useCanEdit,
} from "@/components/cc/ui";
import { CampaignsTab, ConversionTab } from "@/components/pages/MarketingCampaigns";
import { SALES_MONTHS, useMarketing } from "@/lib/derived";
import { AD_PLATFORMS, type AdPlatform } from "@/lib/engine/marketing";
import { int, monthLabel, money, pct, ratio, usd, usdK } from "@/lib/format";
import { HEALTH_TARGETS } from "@/lib/sample/finance";
import { useStore } from "@/lib/store";

const PLATFORM_COLOR: Record<AdPlatform, string> = {
  "Amazon Ads": "#2f6fed",
  "Meta Ads": "#6f52d9",
  "Google Ads": "#148a60",
  "TikTok Ads": "#e09a25",
};

const SOURCE: Record<AdPlatform, string> = {
  "Amazon Ads": "Amazon Ads API",
  "Meta Ads": "Meta Marketing API",
  "Google Ads": "Google Ads API",
  "TikTok Ads": "TikTok Ads API",
};

export function MarketingPage() {
  return (
    <ModuleGate id="marketing">
      <MarketingInner />
    </ModuleGate>
  );
}

function MarketingInner() {
  const { data, flash } = useStore();
  const canEdit = useCanEdit("marketing");
  const [period, setPeriod] = useState<string>("2026-09");
  const months = useMemo(() => (period === "all" ? SALES_MONTHS : [period]), [period]);
  const m = useMarketing(months);
  const [targets, setTargets] = useState({
    roas: HEALTH_TARGETS.targetRoas,
    tacos: HEALTH_TARGETS.maxTacos,
  });
  const [draft, setDraft] = useState(targets);
  const [tab, setTab] = useState<"overview" | "campaigns" | "conversion">("overview");

  const roasTone = (v: number) => (v >= targets.roas ? "pos" : v >= 1 ? "" : "neg");
  const roasBadge = (v: number) =>
    v >= targets.roas ? "b-green" : v >= targets.roas * 0.8 ? "b-amber" : "b-red";

  // Trend: spend per platform per month
  const trend = SALES_MONTHS.map((month) => ({
    month,
    platforms: AD_PLATFORMS.map((p) => {
      const rows = data.adMetrics.filter((r) => r.platform === p && r.month === month);
      const spend = rows.reduce((a, r) => a + r.spend, 0);
      const adSales = rows.reduce((a, r) => a + r.adSales, 0);
      return { platform: p, spend, roas: spend > 0 ? adSales / spend : 0 };
    }),
  }));
  const maxSpend = Math.max(1, ...trend.flatMap((t) => t.platforms.map((p) => p.spend)));

  const t = m.total;
  const blendedTacos = m.totalSalesAllChannels > 0 ? t.spend / m.totalSalesAllChannels : 0;

  return (
    <section className="screen active" id="screen-marketing">
      <ModuleHead
        title="Marketing"
        subtitle="Ad spend, ROAS, TACoS and funnel indicators across every ad platform"
      >
        <div className="row">
          <Tabs<"overview" | "campaigns" | "conversion">
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "overview", label: "Ad Platforms" },
              { id: "campaigns", label: "Campaigns" },
              { id: "conversion", label: "Conversion & MER" },
            ]}
          />
          <select
            className="control"
            value={period}
            disabled={tab === "campaigns"}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label="Period"
          >
            {SALES_MONTHS.map((mo) => (
              <option key={mo} value={mo}>
                {monthLabel(mo)}
                {mo === "2026-10" ? " (month to date)" : ""}
              </option>
            ))}
            <option value="all">Jul – Oct 2026</option>
          </select>
        </div>
      </ModuleHead>

      <ViewOnlyBanner
        id="marketing"
        text="View only for this role. The Marketing Manager maintains targets; ad data syncs automatically."
      />

      {tab === "campaigns" ? <CampaignsTab /> : null}
      {tab === "conversion" ? <ConversionTab months={months} /> : null}

      {tab === "overview" ? (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            {AD_PLATFORMS.map((p) => (
              <Source key={p}>{SOURCE[p]}</Source>
            ))}
            <span className="small">Synced daily · last sync 24 Oct 2026, 06:00</span>
          </div>

          <div className="module-stats stat-strip">
            <ModuleStat
              label="Ad spend"
              value={usd(t.spend)}
              note={`${AD_PLATFORMS.length} platforms`}
            />
            <ModuleStat
              label="Ad-attributed sales"
              value={usd(t.adSales)}
              note={`${int(t.orders)} orders`}
            />
            <ModuleStat
              label="ROAS"
              value={<span className={roasTone(t.roas)}>{ratio(t.roas)}</span>}
              note={`Target ${ratio(targets.roas)}`}
            />
            <ModuleStat label="ACoS" value={pct(t.acos)} note="Spend ÷ ad sales" />
            <ModuleStat
              label="TACoS"
              value={
                <span className={blendedTacos > targets.tacos ? "neg" : "pos"}>
                  {pct(blendedTacos)}
                </span>
              }
              note={`Spend ÷ all-channel sales (${usdK(m.totalSalesAllChannels)}) · max ${pct(targets.tacos, 0)}`}
            />
            <ModuleStat label="CPC" value={money(t.cpc)} note={`CTR ${pct(t.ctr, 2)}`} />
            <ModuleStat label="Conversion rate" value={pct(t.cvr)} note={`CPA ${money(t.cpa)}`} />
          </div>

          <Section
            title="Performance by platform"
            kicker="AD PLATFORMS"
            hint={`ROAS coloured against target ${ratio(targets.roas)}`}
          >
            <div className="table-wrap">
              <table style={{ minWidth: 1180 }}>
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th>Drives channel</th>
                    <th className="num">Spend</th>
                    <th className="num">Impressions</th>
                    <th className="num">Clicks</th>
                    <th className="num">CTR</th>
                    <th className="num">CPC</th>
                    <th className="num">Orders</th>
                    <th className="num">CVR</th>
                    <th className="num">CPA</th>
                    <th className="num">Ad sales</th>
                    <th className="num">ROAS</th>
                    <th className="num">ACoS</th>
                    <th className="num">TACoS</th>
                  </tr>
                </thead>
                <tbody>
                  {m.byPlatform.map((p) => {
                    const channels = [
                      ...new Set(m.rows.filter((r) => r.platform === p.key).map((r) => r.channel)),
                    ].join(", ");
                    return (
                      <tr key={p.key}>
                        <td>
                          <strong>
                            <span
                              style={{
                                display: "inline-block",
                                width: 9,
                                height: 9,
                                borderRadius: 3,
                                background: PLATFORM_COLOR[p.key as AdPlatform],
                                marginRight: 7,
                              }}
                            />
                            {p.key}
                          </strong>
                        </td>
                        <td>{channels || "—"}</td>
                        <td className="num">{usd(p.spend)}</td>
                        <td className="num">{int(p.impressions)}</td>
                        <td className="num">{int(p.clicks)}</td>
                        <td className="num">{pct(p.ctr, 2)}</td>
                        <td className="num">{money(p.cpc)}</td>
                        <td className="num">{int(p.orders)}</td>
                        <td className="num">{pct(p.cvr)}</td>
                        <td className="num">{money(p.cpa)}</td>
                        <td className="num">{usd(p.adSales)}</td>
                        <td className="num">
                          <span className={`badge ${roasBadge(p.roas)}`}>{ratio(p.roas)}</span>
                        </td>
                        <td className="num">{pct(p.acos)}</td>
                        <td className={`num ${p.tacos > targets.tacos ? "neg" : ""}`}>
                          {pct(p.tacos)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="total-row">
                    <td>All platforms</td>
                    <td />
                    <td className="num">{usd(t.spend)}</td>
                    <td className="num">{int(t.impressions)}</td>
                    <td className="num">{int(t.clicks)}</td>
                    <td className="num">{pct(t.ctr, 2)}</td>
                    <td className="num">{money(t.cpc)}</td>
                    <td className="num">{int(t.orders)}</td>
                    <td className="num">{pct(t.cvr)}</td>
                    <td className="num">{money(t.cpa)}</td>
                    <td className="num">{usd(t.adSales)}</td>
                    <td className="num">{ratio(t.roas)}</td>
                    <td className="num">{pct(t.acos)}</td>
                    <td className="num">{pct(t.tacos)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="small" style={{ marginTop: 8 }}>
              TACoS per platform = spend ÷ total sales of the channel it drives (ad + organic). Meta
              and Google both drive Shopify.{" "}
              <Assume title="Confirm which sales channel each ad platform should be measured against">
                channel mapping
              </Assume>
            </div>
          </Section>

          <div className="grid-main-side mt">
            <Section
              title="Monthly spend by platform"
              kicker="TREND"
              hint="Jul – Oct 2026 · Oct is month to date"
            >
              <div className="legend" style={{ marginBottom: 6 }}>
                {AD_PLATFORMS.map((p) => (
                  <span key={p}>
                    <i style={{ background: PLATFORM_COLOR[p] }} />
                    {p}
                  </span>
                ))}
              </div>
              <div className="cols">
                {trend.map((tr) => (
                  <div className="col-group" key={tr.month}>
                    {tr.platforms.map((p) => (
                      <div
                        key={p.platform}
                        className="col"
                        title={`${p.platform} · ${monthLabel(tr.month)} · ${usd(p.spend)} · ROAS ${ratio(p.roas)}`}
                        style={{
                          height: `${(p.spend / maxSpend) * 100}%`,
                          background: PLATFORM_COLOR[p.platform],
                        }}
                      >
                        <span>{usdK(p.spend)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="col-labels">
                {trend.map((tr) => (
                  <span key={tr.month}>{monthLabel(tr.month)}</span>
                ))}
              </div>
              <div className="table-wrap mt">
                <table className="compact">
                  <thead>
                    <tr>
                      <th>ROAS by month</th>
                      {trend.map((tr) => (
                        <th key={tr.month} className="num">
                          {monthLabel(tr.month)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {AD_PLATFORMS.map((p) => (
                      <tr key={p}>
                        <td>
                          <strong>{p}</strong>
                        </td>
                        {trend.map((tr) => {
                          const v = tr.platforms.find((x) => x.platform === p)?.roas ?? 0;
                          return (
                            <td key={tr.month} className={`num ${roasTone(v)}`}>
                              {ratio(v)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Targets" kicker="MARKETING MANAGER">
              <div className="summary-line">
                <span>Target ROAS</span>
                <strong>{ratio(targets.roas)}</strong>
              </div>
              <div className="summary-line">
                <span>Maximum TACoS</span>
                <strong>{pct(targets.tacos, 0)}</strong>
              </div>
              <div className="small" style={{ margin: "8px 0 12px" }}>
                Targets drive the colours above, consultant KPI scores and Company Health alerts.
              </div>
              {canEdit ? (
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (draft.roas > 0 && draft.tacos > 0) {
                      setTargets(draft);
                      flash("Marketing targets saved");
                    }
                  }}
                >
                  <div className="field">
                    <label>Target ROAS</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={draft.roas}
                      onChange={(e) => setDraft({ ...draft, roas: Number(e.target.value) })}
                    />
                  </div>
                  <div className="field">
                    <label>Max TACoS (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={Math.round(draft.tacos * 1000) / 10}
                      onChange={(e) => setDraft({ ...draft, tacos: Number(e.target.value) / 100 })}
                    />
                  </div>
                  <button className="btn primary" type="submit">
                    Save targets
                  </button>
                </form>
              ) : (
                <div className="small">Only the Marketing Manager can change targets.</div>
              )}
              <div className="notice" style={{ marginTop: 14, marginBottom: 0 }}>
                Platform targets per consultant are set in Team KPIs.{" "}
                <Assume title="Prototype keeps one company-wide target; live version can hold targets per platform">
                  one target for all platforms
                </Assume>
              </div>
            </Section>
          </div>
        </>
      ) : null}
    </section>
  );
}
