// Physical stock count — replicates "Physical Stock Counting.xlsx":
// one sheet per month and location, SKUs listed fastest burn first, each line
// counted on its own date/time as No. of Boxes × Units/Box (+ loose units),
// compared with the ShipStation quantity at that moment. Differences are
// emailed to Finance, who adjust ShipStation.

import { useMemo, useState } from "react";

import { Assume, Badge, Field, Modal, ModalActions, ModuleGate, ModuleHead, ModuleStat, Progress, Section, Source, StatusBadge, ViewOnlyBanner, useCanEdit } from "@/components/cc/ui";
import { isFinance, ROLE_PERSON } from "@/lib/access";
import {
  newCountSheet,
  sheetProgress,
  sheetVariances,
  varianceEmail,
  type CountSheet,
  type CountSheetLine,
  type SheetVarianceLine,
} from "@/lib/engine/operations";
import type { Location } from "@/lib/engine/types";
import { formatDate, int, money, monthLabel, pct } from "@/lib/format";
import { FINANCE_EMAIL } from "@/lib/sample/people";
import { newId, useCosting, usePlanning, useStore, type OutboxEmail } from "@/lib/store";

function fmtDateTime(dt: string | null) {
  if (!dt) return "—";
  return `${formatDate(dt.slice(0, 10))} · ${dt.slice(11, 16)}`;
}

function signed(n: number) {
  return `${n > 0 ? "+" : ""}${int(n)}`;
}

function toNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function StockCountPage() {
  return (
    <ModuleGate id="stock-count">
      <StockCountInner />
    </ModuleGate>
  );
}

function StockCountInner() {
  const { data, role, update, flash, asOf } = useStore();
  const canEdit = useCanEdit("stock-count");
  const finance = isFinance(role);
  const seesValue = finance || role === "CEO";
  const { unitCost } = useCosting();
  const planning = usePlanning();

  const burn = useMemo(() => new Map(planning.finishedGoods.map((p) => [p.sku, p.projectionBurn])), [planning.finishedGoods]);
  const skuOf = (sku: string) => data.skus.find((s) => s.sku === sku);
  const masterUnits = (sku: string) => skuOf(sku)?.unitsPerBox ?? 0;

  const sheets = [...data.stockCounts].sort((a, b) => b.month.localeCompare(a.month) || a.location.localeCompare(b.location));
  const [selectedId, setSelectedId] = useState<string | null>(sheets[0]?.id ?? null);
  const [starting, setStarting] = useState(false);
  const [emailPreview, setEmailPreview] = useState<OutboxEmail | null>(null);

  const selected = sheets.find((s) => s.id === selectedId) ?? null;
  const variancesOf = (s: CountSheet) => sheetVariances(s, unitCost, masterUnits);
  const totals = (s: CountSheet) => {
    const v = variancesOf(s);
    return {
      units: v.reduce((a, l) => a + (l.variance ?? 0), 0),
      value: v.reduce((a, l) => a + (l.valueImpact ?? 0), 0),
      review: v.filter((l) => l.needsReview || l.anomaly).length,
    };
  };

  const waiting = sheets.filter((s) => s.status === "Sent to Finance");
  const inProgress = sheets.filter((s) => s.status === "In Progress");
  const currentMonth = asOf.slice(0, 7);

  const replaceSheet = (next: CountSheet) => update("stockCounts", (prev) => prev.map((s) => (s.id === next.id ? next : s)));

  const startSheet = (month: string, location: Location) => {
    const skus = data.skus
      .filter((s) => s.active && (s.type === "Finished Goods" || s.type === "Accessory"))
      .map((s) => ({ sku: s.sku, unitsPerBox: s.unitsPerBox, burnPerDay: burn.get(s.sku) ?? 0 }));
    const sheet = newCountSheet(`CS-${month}-${location === "Brentwood" ? "BW" : "GA"}`, month, location, skus);
    update("stockCounts", (prev) => [...prev, sheet]);
    setSelectedId(sheet.id);
    setStarting(false);
    flash(`${monthLabel(month)} ${location} count sheet started · ${sheet.lines.length} SKUs`);
  };

  const sendToFinance = (s: CountSheet) => {
    const sent: CountSheet = { ...s, status: "Sent to Finance", sentAt: `${asOf}T${nowTime()}` };
    replaceSheet(sent);
    const email = varianceEmail(sent, variancesOf(sent), FINANCE_EMAIL);
    const queued: OutboxEmail = { id: newId("MAIL"), ...email, queuedAt: `${asOf}T${nowTime()}`, status: "Queued (Gmail not connected yet)" };
    update("outbox", (prev) => [...prev, queued]);
    setEmailPreview(queued);
    flash(`${monthLabel(s.month)} ${s.location} count sent to Finance`);
  };

  const markAdjusted = (s: CountSheet) => {
    replaceSheet({ ...s, status: "Adjusted in ShipStation", adjustedBy: role, adjustedAt: `${asOf}T${nowTime()}` });
    flash("Marked as adjusted in ShipStation");
  };

  const emailFor = (s: CountSheet) =>
    data.outbox.filter((m) => m.subject.includes(`– ${s.location} – ${s.month}`)).at(-1) ?? null;

  return (
    <section className="screen active" id="screen-stock-count">
      <ModuleHead title="Stock Count" subtitle="Monthly physical count vs ShipStation — differences go to Finance to adjust in ShipStation">
        {canEdit ? (
          <button className="btn primary" type="button" onClick={() => setStarting(true)}>
            + Start {monthLabel(currentMonth)} count sheet
          </button>
        ) : null}
      </ModuleHead>

      <ViewOnlyBanner id="stock-count" text="View only for this role. The warehouse team records counts; Finance adjusts ShipStation." />

      <div className="module-stats stat-strip">
        <ModuleStat
          label="Current sheet progress"
          value={selected ? `${sheetProgress(selected).counted} / ${sheetProgress(selected).total}` : "—"}
          note={selected ? `${monthLabel(selected.month)} · ${selected.location}` : "No sheet selected"}
        />
        <ModuleStat label="Sheets in progress" value={inProgress.length} note="Counting over several days" />
        <ModuleStat label="Waiting for Finance" value={waiting.length} note="Sent, ShipStation not yet adjusted" />
        {seesValue && selected ? (
          <ModuleStat
            label="Net difference · selected sheet"
            value={<span className={totals(selected).value < 0 ? "neg" : totals(selected).value > 0 ? "pos" : ""}>{money(totals(selected).value)}</span>}
            note={`${signed(totals(selected).units)} units at current full COGS`}
          />
        ) : (
          <ModuleStat label="Lines to review" value={selected ? totals(selected).review : 0} note="≥2% difference or units/box check" />
        )}
      </div>

      <Section title="Count sheets" kicker="HISTORY" hint={<Source>ShipStation quantity captured at count time</Source>}>
        <div className="table-wrap">
          <table className="compact" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>Month</th>
                <th>Location</th>
                <th>Progress</th>
                <th className="num">Lines to review</th>
                {seesValue ? <th className="num">Net difference</th> : null}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sheets.map((s) => {
                const p = sheetProgress(s);
                const t = totals(s);
                return (
                  <tr key={s.id} className={`click-row${s.id === selectedId ? " selected-row" : ""}`} onClick={() => setSelectedId(s.id)}>
                    <td><strong>WH Stock Count {monthLabel(s.month)}</strong></td>
                    <td>{s.location}</td>
                    <td>
                      <div className="row" style={{ flexWrap: "nowrap" }}>
                        <Progress value={p.pct} {...(p.pct >= 1 ? { tone: "good" as const } : {})} />
                        <span className="small nowrap">{p.counted}/{p.total}</span>
                      </div>
                    </td>
                    <td className="num">{t.review}</td>
                    {seesValue ? <td className={`num ${t.value < 0 ? "neg" : t.value > 0 ? "pos" : ""}`}>{money(t.value)}</td> : null}
                    <td><StatusBadge status={s.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {selected ? (
        <SheetGrid
          key={selected.id}
          sheet={selected}
          lines={variancesOf(selected)}
          editable={canEdit && selected.status === "In Progress"}
          seesValue={seesValue}
          canAdjust={finance && canEdit && selected.status === "Sent to Finance"}
          canSend={canEdit && selected.status === "In Progress"}
          email={emailFor(selected)}
          description={(sku) => skuOf(sku)?.description ?? sku}
          masterUnits={masterUnits}
          burn={(sku) => burn.get(sku) ?? 0}
          onChange={replaceSheet}
          captureSystemQty={(sku) =>
            data.finishedGoodsStock.filter((p) => p.sku === sku && p.location === selected.location).reduce((a, p) => a + p.qty, 0)
          }
          counterName={ROLE_PERSON[role] ? data.employees.find((e) => e.id === ROLE_PERSON[role])?.name ?? role : role}
          asOf={asOf}
          onSend={() => sendToFinance(selected)}
          onAdjusted={() => markAdjusted(selected)}
          onShowEmail={setEmailPreview}
        />
      ) : (
        <div className="card empty mt">No count sheet yet. Start this month's sheet to begin counting.</div>
      )}

      <StartSheetModal
        open={starting}
        defaultMonth={currentMonth}
        existing={data.stockCounts}
        onClose={() => setStarting(false)}
        onStart={startSheet}
      />

      <Modal open={emailPreview !== null} title="Email to Finance" onClose={() => setEmailPreview(null)} width={640}>
        {emailPreview ? (
          <>
            <div className="notice">
              Queued in the outbox · {emailPreview.status}. It sends automatically once the Gmail connector is set up.
            </div>
            <div className="summary-line"><span>To</span><strong>{emailPreview.to}</strong></div>
            <div className="summary-line"><span>Subject</span><strong>{emailPreview.subject}</strong></div>
            <div className="email-preview mt">{emailPreview.body}</div>
            <div className="toolbar" style={{ justifyContent: "flex-end", marginTop: 16, marginBottom: 0 }}>
              <button className="btn primary" type="button" onClick={() => setEmailPreview(null)}>Done</button>
            </div>
          </>
        ) : null}
      </Modal>
    </section>
  );
}

interface GridProps {
  sheet: CountSheet;
  lines: SheetVarianceLine[];
  editable: boolean;
  seesValue: boolean;
  canAdjust: boolean;
  canSend: boolean;
  email: OutboxEmail | null;
  description: (sku: string) => string;
  masterUnits: (sku: string) => number;
  burn: (sku: string) => number;
  onChange: (s: CountSheet) => void;
  captureSystemQty: (sku: string) => number;
  counterName: string;
  asOf: string;
  onSend: () => void;
  onAdjusted: () => void;
  onShowEmail: (m: OutboxEmail) => void;
}

function SheetGrid(p: GridProps) {
  const { sheet, lines } = p;
  const progress = sheetProgress(sheet);

  const patchLine = (idx: number, patch: Partial<CountSheetLine>) => {
    const next = sheet.lines.map((l, i) => {
      if (i !== idx) return l;
      const merged: CountSheetLine = { ...l, ...patch };
      const hasQty = merged.boxes !== null || merged.looseUnits !== null;
      // First quantity entered: stamp date/time, counter and the ShipStation qty at that moment.
      if (hasQty && merged.countedAt === null) {
        merged.countedAt = `${p.asOf}T${nowTime()}`;
        merged.systemQty = p.captureSystemQty(merged.sku);
        merged.counter = p.counterName;
      }
      if (!hasQty && patch.countedAt === undefined) {
        merged.countedAt = null;
        merged.systemQty = null;
        merged.counter = null;
      }
      return merged;
    });
    p.onChange({ ...sheet, lines: next });
  };

  const totalValue = lines.reduce((a, l) => a + (l.valueImpact ?? 0), 0);
  const totalUnits = lines.reduce((a, l) => a + (l.variance ?? 0), 0);

  return (
    <Section
      className="mt"
      kicker={`${sheet.location.toUpperCase()} · ${progress.counted} OF ${progress.total} SKUS COUNTED`}
      title={`WH Stock Count ${monthLabel(sheet.month)}`}
      hint={
        <span className="row">
          <StatusBadge status={sheet.status} />
          {sheet.sentAt ? <span className="small">Sent {fmtDateTime(sheet.sentAt)}</span> : null}
          {sheet.adjustedAt ? <span className="small">Adjusted by {sheet.adjustedBy} · {fmtDateTime(sheet.adjustedAt)}</span> : null}
        </span>
      }
    >
      {p.editable ? (
        <div className="notice">
          Enter boxes × units/box and/or loose units for each SKU as you count it. Date &amp; time and the ShipStation quantity are captured when you enter the first quantity — you can count different SKUs on different days.
        </div>
      ) : null}

      <div className="table-wrap">
        <table style={{ minWidth: 1320 }}>
          <thead>
            <tr>
              <th>Sr #</th>
              <th>SKU</th>
              <th>Description</th>
              <th>Count date &amp; time</th>
              <th className="num">No. of boxes</th>
              <th className="num">Units / box</th>
              <th className="num">Loose units</th>
              <th className="num">Physical count</th>
              <th className="num">ShipStation qty <Assume title="Live version reads ShipStation's quantity at the count date & time. The prototype uses today's stock.">at count time</Assume></th>
              <th className="num">Difference</th>
              {p.seesValue ? <th className="num">Value</th> : null}
              <th className="num">Avg burn / day</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.sku}>
                <td>{i + 1}</td>
                <td><strong>{l.sku}</strong></td>
                <td>{p.description(l.sku)}</td>
                <td className="nowrap">
                  {p.editable ? (
                    <input
                      className="control"
                      type="datetime-local"
                      value={l.countedAt ?? ""}
                      disabled={l.boxes === null && l.looseUnits === null}
                      onChange={(e) => patchLine(i, { countedAt: e.target.value === "" ? null : e.target.value })}
                      style={{ minHeight: 32, padding: "4px 6px" }}
                    />
                  ) : (
                    fmtDateTime(l.countedAt)
                  )}
                  {l.counter ? <div className="small">{l.counter}</div> : null}
                </td>
                <td className="num">
                  {p.editable ? (
                    <NumInput value={l.boxes} disabled={l.unitsPerBox === 0} onChange={(v) => patchLine(i, { boxes: v })} />
                  ) : l.boxes === null ? "—" : int(l.boxes)}
                </td>
                <td className="num">
                  {p.editable ? (
                    <NumInput value={l.unitsPerBox} onChange={(v) => patchLine(i, { unitsPerBox: v ?? 0 })} />
                  ) : l.unitsPerBox === 0 ? "Loose" : int(l.unitsPerBox)}
                </td>
                <td className="num">
                  {p.editable ? (
                    <NumInput value={l.looseUnits} onChange={(v) => patchLine(i, { looseUnits: v })} />
                  ) : l.looseUnits === null ? "—" : int(l.looseUnits)}
                </td>
                <td className="num"><strong>{l.counted === null ? "—" : int(l.counted)}</strong></td>
                <td className="num">{l.systemQty === null ? "—" : int(l.systemQty)}</td>
                <td className={`num ${l.variance === null ? "" : l.variance < 0 ? "neg" : l.variance > 0 ? "pos" : ""}`}>
                  {l.variance === null ? "—" : (
                    <>
                      <strong>{signed(l.variance)}</strong>
                      {l.variancePct !== null && l.variance !== 0 ? <div className="small">{pct(l.variancePct)}</div> : null}
                    </>
                  )}
                </td>
                {p.seesValue ? (
                  <td className={`num ${(l.valueImpact ?? 0) < 0 ? "neg" : (l.valueImpact ?? 0) > 0 ? "pos" : ""}`}>
                    {l.valueImpact === null ? "—" : money(l.valueImpact)}
                  </td>
                ) : null}
                <td className="num">{int(p.burn(l.sku))}</td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    {l.counted === null ? <Badge tone="grey">Not counted</Badge> : null}
                    {l.anomaly ? (
                      <span title={`SKU master says ${int(p.masterUnits(l.sku))} units/box`}>
                        <Badge tone="red">Check units/box</Badge>
                      </span>
                    ) : null}
                    {l.needsReview ? <Badge tone="amber">Review ≥2%</Badge> : null}
                    {l.counted !== null && l.variance === 0 ? <Badge tone="green">Matches</Badge> : null}
                  </div>
                </td>
              </tr>
            ))}
            <tr className="total-row">
              <td colSpan={9}>Total difference on counted lines</td>
              <td className={`num ${totalUnits < 0 ? "neg" : totalUnits > 0 ? "pos" : ""}`}>{signed(totalUnits)}</td>
              {p.seesValue ? <td className={`num ${totalValue < 0 ? "neg" : totalValue > 0 ? "pos" : ""}`}>{money(totalValue)}</td> : null}
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid-2 mt">
        <Field label="Warehouse notes">
          {p.editable ? (
            <textarea value={sheet.notes} onChange={(e) => p.onChange({ ...sheet, notes: e.target.value })} placeholder="e.g. 2 cases found crushed on rack B4" />
          ) : (
            <div className="notice" style={{ marginBottom: 0 }}>{sheet.notes || "No notes."}</div>
          )}
        </Field>
        <div className="row" style={{ justifyContent: "flex-end", alignItems: "flex-end" }}>
          {p.email ? (
            <button className="btn" type="button" onClick={() => p.email && p.onShowEmail(p.email)}>View email to Finance</button>
          ) : null}
          {p.canSend ? (
            <button className="btn primary" type="button" disabled={progress.counted === 0} onClick={p.onSend}>
              Send to Finance ({progress.counted} counted)
            </button>
          ) : null}
          {p.canAdjust ? (
            <button className="btn blue" type="button" onClick={p.onAdjusted}>Mark adjusted in ShipStation</button>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

function NumInput({ value, onChange, disabled }: { value: number | null; onChange: (v: number | null) => void; disabled?: boolean }) {
  return (
    <input
      className="control num"
      type="number"
      min={0}
      value={value === null ? "" : value}
      disabled={disabled ?? false}
      onChange={(e) => onChange(toNum(e.target.value))}
      style={{ width: 90, minHeight: 32, padding: "4px 6px" }}
    />
  );
}

function StartSheetModal({
  open,
  defaultMonth,
  existing,
  onClose,
  onStart,
}: {
  open: boolean;
  defaultMonth: string;
  existing: CountSheet[];
  onClose: () => void;
  onStart: (month: string, location: Location) => void;
}) {
  const [month, setMonth] = useState(defaultMonth);
  const [location, setLocation] = useState<Location>("Brentwood");
  const duplicate = existing.some((s) => s.month === month && s.location === location);
  return (
    <Modal open={open} title="Start count sheet" onClose={onClose} width={520}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!duplicate && month) onStart(month, location);
        }}
      >
        <div className="form-grid">
          <Field label="Month">
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} required />
          </Field>
          <Field label="Location">
            <select value={location} onChange={(e) => setLocation(e.target.value as Location)}>
              <option>Brentwood</option>
              <option>Georgia</option>
            </select>
          </Field>
        </div>
        <div className={`notice${duplicate ? " readonly" : ""}`} style={{ marginTop: 12, marginBottom: 0 }}>
          {duplicate
            ? `A ${location} sheet for ${monthLabel(month)} already exists — open it from the history list.`
            : "All active Finished Goods and Accessory SKUs are listed, fastest burn first, with units/box from SKU / MOQ Setup."}
        </div>
        <ModalActions onCancel={onClose} submitLabel="Start sheet" disabled={duplicate} />
      </form>
    </Modal>
  );
}
