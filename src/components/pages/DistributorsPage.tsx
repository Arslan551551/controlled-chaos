// Distributors: per-distributor Marketing Fund and Product Credit ledgers
// (same columns as the "Malys Ledger" workbook), invoices & aging from
// QuickBooks, and consignment stock for distributors holding our stock.

import { useMemo, useState, type FormEvent } from "react";

import {
  Assume,
  Badge,
  Field,
  Modal,
  ModalActions,
  ModuleGate,
  ModuleHead,
  ModuleStat,
  Progress,
  Section,
  Source,
  StatusBadge,
  Tabs,
  ViewOnlyBanner,
  useCanEdit,
  sum,
} from "@/components/cc/ui";
import { addDays, daysBetween } from "@/lib/engine/dates";
import {
  consignmentPosition,
  invoicePaid,
  type ConsignmentMovement,
  type Distributor,
  type DistributorInvoice,
  type DistributorPosition,
  type LedgerEntry,
  type LedgerName,
  type LedgerRow,
} from "@/lib/engine/distributors";
import { useDistributors } from "@/lib/derived";
import { formatDate, int, pct } from "@/lib/format";
import { newId, useCosting, useStore } from "@/lib/store";

const SYMBOL: Record<Distributor["currency"], string> = { USD: "$", EUR: "€", GBP: "£" };

function cur(v: number, c: Distributor["currency"], decimals = 2): string {
  const s = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${v < 0 ? "−" : ""}${SYMBOL[c]}${s}`;
}

function cashPaid(inv: DistributorInvoice) {
  return inv.payments
    .filter((p) => (p.method ?? "Cash") === "Cash")
    .reduce((a, p) => a + p.amount, 0);
}
function creditApplied(inv: DistributorInvoice) {
  return inv.payments
    .filter((p) => (p.method ?? "Cash") !== "Cash")
    .reduce((a, p) => a + p.amount, 0);
}
function openAmount(inv: DistributorInvoice) {
  return Math.max(0, Math.round((inv.amount - invoicePaid(inv)) * 100) / 100);
}

type DetailTab = "fund" | "credit" | "invoices" | "consignment";

export function DistributorsPage() {
  const positions = useDistributors();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = positions.find((p) => p.distributor.id === selectedId) ?? null;

  const usdPositions = positions.filter((p) => p.distributor.currency === "USD");

  return (
    <ModuleGate id="distributors">
      <section className="screen active" id="screen-distributors">
        <ModuleHead
          title="Distributors"
          subtitle="Marketing fund, product credits, invoices and consignment stock per distributor"
        >
          {selected ? (
            <button className="btn" type="button" onClick={() => setSelectedId(null)}>
              ← All distributors
            </button>
          ) : null}
        </ModuleHead>
        <ViewOnlyBanner
          id="distributors"
          text="View only for this role. Finance maintains distributor ledgers."
        />

        {selected ? (
          <DistributorDetail position={selected} />
        ) : (
          <>
            <div className="module-stats">
              <ModuleStat
                label="Active distributors"
                value={positions.filter((p) => p.distributor.status === "Active").length}
                note={`${positions.filter((p) => p.distributor.model === "Consignment").length} on consignment`}
              />
              <ModuleStat
                label="Open AR (USD distributors)"
                value={cur(
                  sum(usdPositions, (p) => p.openAR),
                  "USD",
                  0,
                )}
                note={`${cur(
                  sum(usdPositions, (p) => p.overdue),
                  "USD",
                  0,
                )} overdue`}
              />
              <ModuleStat
                label="Owed to distributors (USD)"
                value={cur(
                  sum(usdPositions, (p) => p.marketingFundBalance + p.productCreditBalance),
                  "USD",
                  0,
                )}
                note="Marketing fund + product credit balances"
              />
            </div>

            <Section
              title="Distributor Overview"
              hint={
                <>
                  <Source>QuickBooks invoices &amp; payments</Source>{" "}
                  <Assume title="Each distributor is shown in its own currency. No FX conversion in the prototype.">
                    Own currency, no FX
                  </Assume>
                </>
              }
            >
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Distributor</th>
                      <th>Model</th>
                      <th>Country</th>
                      <th className="num">Invoiced YTD</th>
                      <th className="num">Open AR</th>
                      <th className="num">Overdue</th>
                      <th className="num">Marketing Fund</th>
                      <th className="num">Product Credit</th>
                      <th className="num">Net Position</th>
                      <th>Credit Used</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((p) => {
                      const c = p.distributor.currency;
                      return (
                        <tr
                          key={p.distributor.id}
                          className="click-row"
                          onClick={() => setSelectedId(p.distributor.id)}
                        >
                          <td>
                            <strong>{p.distributor.name}</strong>
                            <div className="small">{p.distributor.legalName}</div>
                          </td>
                          <td>
                            {p.distributor.model === "Consignment" ? (
                              <Badge tone="purple">Consignment</Badge>
                            ) : (
                              <Badge tone="blue">Wholesale</Badge>
                            )}
                          </td>
                          <td>{p.distributor.country}</td>
                          <td className="num">{cur(p.invoicedYtd, c, 0)}</td>
                          <td className="num">{cur(p.openAR, c)}</td>
                          <td className="num">
                            {p.overdue > 0 ? (
                              <span className="neg strong">{cur(p.overdue, c)}</span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="num">{cur(p.marketingFundBalance, c)}</td>
                          <td className="num">{cur(p.productCreditBalance, c)}</td>
                          <td className="num">
                            <strong>{cur(p.netPosition, c)}</strong>
                          </td>
                          <td style={{ minWidth: 110 }}>
                            {p.distributor.creditLimit > 0 ? (
                              <>
                                <Progress
                                  value={p.creditUsedPct}
                                  tone={
                                    p.creditUsedPct > 0.9
                                      ? "bad"
                                      : p.creditUsedPct > 0.7
                                        ? "warn"
                                        : "good"
                                  }
                                />
                                <div className="small">
                                  {pct(p.creditUsedPct, 0)} of{" "}
                                  {cur(p.distributor.creditLimit, c, 0)}
                                </div>
                              </>
                            ) : (
                              <span className="small">No limit set</span>
                            )}
                          </td>
                          <td>
                            <span className="view-cue">Open →</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="notice mt" style={{ marginBottom: 0 }}>
                Net position = open invoices they owe us − marketing fund and product credit we owe
                them. The marketing fund is created automatically at each distributor's % of{" "}
                <strong>cash paid</strong> on invoices; any part of an invoice settled with credit
                or fund does not create new fund.
              </div>
            </Section>
          </>
        )}
      </section>
    </ModuleGate>
  );
}

function DistributorDetail({ position }: { position: DistributorPosition }) {
  const d = position.distributor;
  const canEdit = useCanEdit("distributors");
  const [tab, setTab] = useState<DetailTab>("fund");
  const tabs: { id: DetailTab; label: string }[] = [
    { id: "fund", label: "Marketing Fund" },
    { id: "credit", label: "Product Credit" },
    { id: "invoices", label: "Invoices & Aging" },
    ...(d.model === "Consignment"
      ? [{ id: "consignment" as const, label: "Consignment Stock" }]
      : []),
  ];
  const c = d.currency;

  return (
    <div className="stack">
      <div className="grid-main-side">
        <div className="card">
          <div className="section-title">
            <div>
              <span className="section-kicker">
                {d.model.toUpperCase()} DISTRIBUTOR · {d.country.toUpperCase()}
              </span>
              <h3>{d.name}</h3>
              <div className="small">
                {d.legalName} · {d.city} · {d.contact}
              </div>
            </div>
            <StatusBadge status={d.status} />
          </div>
          <div className="stat-strip" style={{ marginBottom: 0 }}>
            <ModuleStat
              label="Open AR"
              value={cur(position.openAR, c)}
              note={
                position.overdue > 0 ? `${cur(position.overdue, c)} overdue` : "Nothing overdue"
              }
            />
            <ModuleStat
              label="Marketing fund balance"
              value={cur(position.marketingFundBalance, c)}
              note="Owed to distributor"
            />
            <ModuleStat
              label="Product credit balance"
              value={cur(position.productCreditBalance, c)}
              note="Owed to distributor"
            />
            <ModuleStat
              label="Net position"
              value={cur(position.netPosition, c)}
              note="They owe us − we owe them"
            />
          </div>
        </div>
        <div className="card">
          <div className="section-title">
            <div>
              <span className="section-kicker">SETTINGS</span>
              <h3>Agreement</h3>
            </div>
            <span className="hint">Read only</span>
          </div>
          <div className="summary-line">
            <span>Business model</span>
            <strong>{d.model}</strong>
          </div>
          <div className="summary-line">
            <span>Marketing fund</span>
            <strong>
              {d.marketingFundPct > 0 ? `${d.marketingFundPct}% of cash paid` : "None"}
            </strong>
          </div>
          <div className="summary-line">
            <span>Payment terms</span>
            <strong>Net {d.paymentTermsDays}</strong>
          </div>
          <div className="summary-line">
            <span>Credit limit</span>
            <strong>{d.creditLimit > 0 ? cur(d.creditLimit, c, 0) : "Not set"}</strong>
          </div>
          <div className="summary-line">
            <span>Currency</span>
            <strong>{d.currency}</strong>
          </div>
        </div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === "fund" && (
        <LedgerSection
          position={position}
          ledger="Marketing Fund"
          rows={position.marketingFund}
          canEdit={canEdit}
        />
      )}
      {tab === "credit" && (
        <LedgerSection
          position={position}
          ledger="Product Credit"
          rows={position.productCredit}
          canEdit={canEdit}
        />
      )}
      {tab === "invoices" && <InvoicesSection position={position} />}
      {tab === "consignment" && <ConsignmentSection distributor={d} canEdit={canEdit} />}
    </div>
  );
}

function LedgerSection({
  position,
  ledger,
  rows,
  canEdit,
}: {
  position: DistributorPosition;
  ledger: LedgerName;
  rows: LedgerRow[];
  canEdit: boolean;
}) {
  const d = position.distributor;
  const c = d.currency;
  const [form, setForm] = useState<null | "goods" | "memo" | "apply">(null);
  const balance = rows.at(-1)?.balance ?? 0;
  const isFund = ledger === "Marketing Fund";

  return (
    <Section
      title={`${ledger} Ledger`}
      kicker={d.name.toUpperCase()}
      hint={
        isFund
          ? d.marketingFundPct > 0
            ? `${d.marketingFundPct}% of each cash payment · created automatically`
            : "No marketing fund agreed"
          : "QuickBooks credit memos and applications"
      }
      actions={
        canEdit ? (
          isFund ? (
            <button className="btn primary" type="button" onClick={() => setForm("goods")}>
              + Goods Issued
            </button>
          ) : (
            <>
              <button
                className="btn"
                type="button"
                onClick={() => setForm("apply")}
                disabled={balance <= 0}
              >
                + Apply Credit on Invoice
              </button>
              <button className="btn primary" type="button" onClick={() => setForm("memo")}>
                + Credit Memo
              </button>
            </>
          )
        ) : null
      }
    >
      <div className="table-wrap">
        <table className="ledger">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Ref</th>
              <th>Description</th>
              <th className="num">Fund +</th>
              <th className="num">Fund −</th>
              <th className="num">Balance</th>
              <th>Support</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="nowrap">{formatDate(r.date)}</td>
                <td>
                  <Badge tone={r.plus > 0 ? "green" : "amber"}>{r.type}</Badge>
                </td>
                <td className="nowrap">{r.ref}</td>
                <td>
                  {r.description}
                  {r.source === "Auto from QuickBooks payment" ? (
                    <div className="small">Auto · from QuickBooks payment</div>
                  ) : null}
                </td>
                <td className="num plus">{r.plus ? cur(r.plus, c) : ""}</td>
                <td className="num minus">{r.minus ? cur(r.minus, c) : ""}</td>
                <td className="num balance">{cur(r.balance, c)}</td>
                <td className="small">
                  {r.support ? (r.support.startsWith("http") ? "QuickBooks link" : r.support) : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty">
                  No entries yet.
                </td>
              </tr>
            ) : (
              <tr className="total-row">
                <td colSpan={4}>Total</td>
                <td className="num">
                  {cur(
                    sum(rows, (r) => r.plus),
                    c,
                  )}
                </td>
                <td className="num">
                  {cur(
                    sum(rows, (r) => r.minus),
                    c,
                  )}
                </td>
                <td className="num">{cur(balance, c)}</td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {isFund ? (
        <div className="notice mt" style={{ marginBottom: 0 }}>
          “Fund Created” lines come automatically from QuickBooks: {d.marketingFundPct}% of the cash
          paid on each invoice. Parts of an invoice settled with product credit or marketing fund do
          not create new fund. Free goods issued against the fund are entered as “Goods Issued”.
        </div>
      ) : (
        <div className="notice mt" style={{ marginBottom: 0 }}>
          Credit memos are issued in QuickBooks (e.g. reimbursing an ad the distributor paid for, or
          product credit for units). Applying a credit on an invoice reduces this balance and
          settles that part of the invoice — it does not create marketing fund.
        </div>
      )}

      <GoodsIssuedModal
        open={form === "goods"}
        onClose={() => setForm(null)}
        distributor={d}
        balance={balance}
      />
      <CreditMemoModal open={form === "memo"} onClose={() => setForm(null)} distributor={d} />
      <ApplyCreditModal
        open={form === "apply"}
        onClose={() => setForm(null)}
        distributor={d}
        balance={balance}
      />
    </Section>
  );
}

function useLedgerAdd() {
  const { update } = useStore();
  return (entry: Omit<LedgerEntry, "id">) =>
    update("distributorLedger", (prev) => [...prev, { ...entry, id: newId("L") }]);
}

function GoodsIssuedModal({
  open,
  onClose,
  distributor,
  balance,
}: {
  open: boolean;
  onClose: () => void;
  distributor: Distributor;
  balance: number;
}) {
  const { asOf, flash } = useStore();
  const add = useLedgerAdd();
  const [date, setDate] = useState(asOf);
  const [ref, setRef] = useState("");
  const [desc, setDesc] = useState("Free Goods Issued");
  const [amount, setAmount] = useState("");
  const amt = Number(amount);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!(amt > 0)) return;
    add({
      distributorId: distributor.id,
      ledger: "Marketing Fund",
      date,
      type: "Goods Issued",
      ref: ref.trim() ? (ref.startsWith("#") ? ref.trim() : `#${ref.trim()}`) : "—",
      description: desc.trim() || "Free Goods Issued",
      plus: 0,
      minus: amt,
      support: null,
      source: "Manual",
    });
    flash(
      `Goods issued ${cur(amt, distributor.currency)} recorded against ${distributor.name}'s marketing fund`,
    );
    setAmount("");
    setRef("");
    onClose();
  };

  return (
    <Modal open={open} title="Goods Issued against Marketing Fund" onClose={onClose} width={600}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="QuickBooks Ref (invoice / order #)">
            <input value={ref} placeholder="#30600" onChange={(e) => setRef(e.target.value)} />
          </Field>
          <Field label="Description" span2>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </Field>
          <Field label={`Value of goods (${distributor.currency})`}>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </Field>
          <Field label="Fund balance available">
            <input readOnly value={cur(balance, distributor.currency)} />
          </Field>
        </div>
        {amt > balance ? (
          <div className="notice readonly" style={{ marginTop: 12, marginBottom: 0 }}>
            This exceeds the available fund balance — the ledger will go negative.
          </div>
        ) : null}
        <ModalActions onCancel={onClose} submitLabel="Record Goods Issued" />
      </form>
    </Modal>
  );
}

function CreditMemoModal({
  open,
  onClose,
  distributor,
}: {
  open: boolean;
  onClose: () => void;
  distributor: Distributor;
}) {
  const { asOf, flash } = useStore();
  const add = useLedgerAdd();
  const [date, setDate] = useState(asOf);
  const [ref, setRef] = useState("");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [support, setSupport] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!(amt > 0) || !ref.trim()) return;
    add({
      distributorId: distributor.id,
      ledger: "Product Credit",
      date,
      type: "Credit Memo",
      ref: ref.trim(),
      description: desc.trim() || "Credit memo",
      plus: amt,
      minus: 0,
      support: support || `Credit memo ${ref.trim()}.pdf`,
      source: "QuickBooks credit memo",
    });
    flash(`Credit memo ${ref.trim()} added · ${cur(amt, distributor.currency)}`);
    setRef("");
    setDesc("");
    setAmount("");
    setSupport("");
    onClose();
  };

  return (
    <Modal open={open} title="Add Credit Memo" onClose={onClose} width={620}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="QuickBooks Credit Memo #">
            <input
              value={ref}
              placeholder="30420"
              onChange={(e) => setRef(e.target.value)}
              required
            />
          </Field>
          <Field label="Description" span2>
            <input
              value={desc}
              placeholder="e.g. Nov/Dec magazine ad reimbursement · or 29 units of Curl Creme 32oz @ $22.25"
              onChange={(e) => setDesc(e.target.value)}
            />
          </Field>
          <Field label={`Credit Amount (${distributor.currency})`}>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </Field>
          <Field label="Supporting Document">
            <input type="file" onChange={(e) => setSupport(e.target.files?.[0]?.name ?? "")} />
          </Field>
        </div>
        <div className="notice" style={{ marginTop: 12, marginBottom: 0 }}>
          Live version: memos are pulled from QuickBooks automatically and the PDF is stored with
          the entry (replaces pasted screenshots).
        </div>
        <ModalActions onCancel={onClose} submitLabel="Add Credit Memo" />
      </form>
    </Modal>
  );
}

function ApplyCreditModal({
  open,
  onClose,
  distributor,
  balance,
}: {
  open: boolean;
  onClose: () => void;
  distributor: Distributor;
  balance: number;
}) {
  const { data, update, asOf, flash } = useStore();
  const add = useLedgerAdd();
  const openInvoices = data.distributorInvoices.filter(
    (i) => i.distributorId === distributor.id && openAmount(i) > 0,
  );
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(asOf);
  const inv = openInvoices.find((i) => i.id === (invoiceId || openInvoices[0]?.id));
  const max = inv ? Math.min(balance, openAmount(inv)) : 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const amt = Number(amount || max);
    if (!inv || !(amt > 0) || amt > max + 0.001) return;
    const credits = data.distributorLedger
      .filter(
        (l) =>
          l.distributorId === distributor.id &&
          l.ledger === "Product Credit" &&
          l.type === "Credit Memo",
      )
      .map((l) => l.ref)
      .slice(-2)
      .join(", ");
    add({
      distributorId: distributor.id,
      ledger: "Product Credit",
      date,
      type: "Credit Applied",
      ref: inv.id,
      description: `Credit ${credits ? `memos ${credits} ` : ""}applied on invoice ${inv.id}`,
      plus: 0,
      minus: amt,
      support: null,
      source: "Manual",
    });
    update("distributorInvoices", (prev) =>
      prev.map((i) =>
        i.id === inv.id
          ? {
              ...i,
              payments: [
                ...i.payments,
                { date, amount: amt, method: "Credit / Fund Applied" as const },
              ],
            }
          : i,
      ),
    );
    flash(
      `${cur(amt, distributor.currency)} credit applied on invoice ${inv.id} · no new marketing fund created`,
    );
    setAmount("");
    onClose();
  };

  return (
    <Modal open={open} title="Apply Product Credit on Invoice" onClose={onClose} width={600}>
      <form onSubmit={submit}>
        {openInvoices.length === 0 ? (
          <div className="notice">No open invoices for {distributor.name}.</div>
        ) : null}
        <div className="form-grid">
          <Field label="Open Invoice">
            <select value={inv?.id ?? ""} onChange={(e) => setInvoiceId(e.target.value)}>
              {openInvoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.id} · open {cur(openAmount(i), distributor.currency)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label={`Amount to apply (max ${cur(max, distributor.currency)})`}>
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={max}
              value={amount}
              placeholder={max.toFixed(2)}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Credit balance">
            <input readOnly value={cur(balance, distributor.currency)} />
          </Field>
        </div>
        <div className="notice" style={{ marginTop: 12, marginBottom: 0 }}>
          The applied amount settles part of the invoice as “Credit / Fund Applied”. It does not
          count as cash paid, so no marketing fund is created on it.
        </div>
        <ModalActions onCancel={onClose} submitLabel="Apply Credit" disabled={!inv || max <= 0} />
      </form>
    </Modal>
  );
}

function InvoicesSection({ position }: { position: DistributorPosition }) {
  const { data, asOf } = useStore();
  const d = position.distributor;
  const c = d.currency;
  const invoices = data.distributorInvoices
    .filter((i) => i.distributorId === d.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const a = position.aging;
  const buckets: [string, number][] = [
    ["Current", a.current],
    ["1–30 days", a.d1_30],
    ["31–60 days", a.d31_60],
    ["61–90 days", a.d61_90],
    ["90+ days", a.d90plus],
  ];

  return (
    <div className="stack">
      <div className="stat-strip">
        {buckets.map(([label, v]) => (
          <ModuleStat
            key={label}
            label={label}
            value={cur(v, c)}
            note={label === "Current" ? "Not yet due" : "Overdue"}
          />
        ))}
      </div>
      <Section title="Invoices" hint={<Source>QuickBooks invoices &amp; payments</Source>}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Due</th>
                <th className="num">Amount</th>
                <th className="num">Cash Paid</th>
                <th className="num">Credit / Fund Applied</th>
                <th className="num">Open</th>
                <th className="num">Fund Created</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => {
                const open = openAmount(i);
                const late = daysBetween(i.dueDate, asOf);
                const status = open <= 0 ? "Paid" : late > 0 ? `${late} days overdue` : "Open";
                return (
                  <tr key={i.id}>
                    <td>
                      <strong>{i.id}</strong>
                    </td>
                    <td className="nowrap">{formatDate(i.date)}</td>
                    <td className="nowrap">{formatDate(i.dueDate)}</td>
                    <td className="num">{cur(i.amount, c)}</td>
                    <td className="num">{cashPaid(i) ? cur(cashPaid(i), c) : "—"}</td>
                    <td className="num">{creditApplied(i) ? cur(creditApplied(i), c) : "—"}</td>
                    <td className="num">
                      <strong>{open ? cur(open, c) : "—"}</strong>
                    </td>
                    <td className="num">
                      {d.marketingFundPct > 0 && cashPaid(i)
                        ? cur(Math.round(cashPaid(i) * d.marketingFundPct) / 100, c)
                        : "—"}
                    </td>
                    <td>
                      {open <= 0 ? (
                        <Badge tone="green">Paid</Badge>
                      ) : late > 0 ? (
                        <Badge tone={late > 60 ? "red" : "amber"}>{status}</Badge>
                      ) : (
                        <Badge tone="blue">Open</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="total-row">
                <td colSpan={3}>Total</td>
                <td className="num">
                  {cur(
                    sum(invoices, (i) => i.amount),
                    c,
                  )}
                </td>
                <td className="num">{cur(sum(invoices, cashPaid), c)}</td>
                <td className="num">{cur(sum(invoices, creditApplied), c)}</td>
                <td className="num">{cur(sum(invoices, openAmount), c)}</td>
                <td className="num">
                  {d.marketingFundPct > 0
                    ? cur(
                        sum(invoices, (i) => Math.round(cashPaid(i) * d.marketingFundPct) / 100),
                        c,
                      )
                    : "—"}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function ConsignmentSection({
  distributor,
  canEdit,
}: {
  distributor: Distributor;
  canEdit: boolean;
}) {
  const { data, update, asOf, flash } = useStore();
  const { unitCost } = useCosting();
  const [reportOpen, setReportOpen] = useState(false);
  const c = distributor.currency;
  const rows = useMemo(
    () => consignmentPosition(data.consignmentMovements, distributor.id, unitCost, distributor),
    [data.consignmentMovements, distributor.id, unitCost, distributor],
  );
  const uninvoiced = data.consignmentMovements.filter(
    (m) => m.distributorId === distributor.id && m.type === "Reported Sale" && !m.invoiceId,
  );
  const uninvoicedValue = sum(uninvoiced, (m) => m.amount ?? m.qty * (m.unitPrice ?? 0));
  const movements = data.consignmentMovements
    .filter((m) => m.distributorId === distributor.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const createInvoice = () => {
    if (uninvoiced.length === 0) return;
    const prefix = distributor.id.replace("D-", "");
    const lastNo = Math.max(
      0,
      ...data.distributorInvoices
        .filter((i) => i.distributorId === distributor.id)
        .map((i) => Number(i.id.split("-").pop()) || 0),
    );
    const id = `${prefix}-${String(lastNo + 1).padStart(4, "0")}`;
    const ids = new Set(uninvoiced.map((m) => m.id));
    const invoice: DistributorInvoice = {
      id,
      distributorId: distributor.id,
      date: asOf,
      dueDate: addDays(asOf, distributor.paymentTermsDays),
      amount: Math.round(uninvoicedValue * 100) / 100,
      payments: [],
      link: null,
    };
    update("distributorInvoices", (prev) => [...prev, invoice]);
    update("consignmentMovements", (prev) =>
      prev.map((m) => (ids.has(m.id) ? { ...m, invoiceId: id } : m)),
    );
    flash(`Invoice ${id} created for ${cur(invoice.amount, c)} · will post to QuickBooks`);
  };

  return (
    <div className="stack">
      <div className="stat-strip">
        <ModuleStat
          label="Units at distributor"
          value={int(sum(rows, (r) => r.onHandAtDistributor))}
          note="Our stock in their warehouse"
        />
        <ModuleStat
          label="Stock value at cost"
          value={cur(
            sum(rows, (r) => r.stockValueAtCost),
            "USD",
          )}
          note="Latest full COGS per unit (USD)"
        />
        <ModuleStat
          label="Remaining stock at agreed price"
          value={cur(
            sum(rows, (r) => r.remainingValueAtPriceUsd),
            "USD",
          )}
          note={
            distributor.fxToUsd !== 1
              ? `Price list in ${c} × ${distributor.fxToUsd} USD`
              : "Price list"
          }
        />
        <ModuleStat
          label="% sold"
          value={`${
            Math.round(
              (sum(rows, (r) => r.sold) /
                Math.max(
                  1,
                  sum(rows, (r) => r.shipped),
                )) *
                1000,
            ) / 10
          }%`}
          note={`${int(sum(rows, (r) => r.sold))} of ${int(sum(rows, (r) => r.shipped))} units`}
        />
        <ModuleStat
          label="Sold, not yet invoiced"
          value={cur(uninvoicedValue, c)}
          note={`${int(sum(uninvoiced, (m) => m.qty))} units reported`}
        />
      </div>

      <Section
        title="Consignment Stock"
        kicker={distributor.name.toUpperCase()}
        hint={
          <Assume title="Consignment stock is our inventory but sits outside Brentwood/Georgia, so it is not counted in PO Projection stock. Confirm if it should be.">
            Not counted in Brentwood / Georgia projection stock
          </Assume>
        }
        actions={
          canEdit ? (
            <>
              <button className="btn" type="button" onClick={() => setReportOpen(true)}>
                + Record Sell-Through Report
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={uninvoiced.length === 0}
                onClick={createInvoice}
              >
                Create Invoice for Reported Sales
              </button>
            </>
          ) : null
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th className="num">Shipped to Them</th>
                <th className="num">Sold (Reported)</th>
                <th className="num">Returned to Us</th>
                <th className="num">Adjustments</th>
                <th className="num">On Hand at Distributor</th>
                <th className="num">% Sold</th>
                <th className="num">Sales Reported</th>
                <th className="num">Sold, Not Invoiced</th>
                <th className="num">To Invoice</th>
                <th className="num">Stock Value at Cost</th>
                <th className="num">Remaining at Price (USD)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.sku}>
                  <td>
                    <strong>{r.sku}</strong>
                    <div className="small">
                      {data.skus.find((s) => s.sku === r.sku)?.description ?? ""}
                    </div>
                  </td>
                  <td className="num">{int(r.shipped)}</td>
                  <td className="num">{int(r.sold)}</td>
                  <td className="num">{r.returned ? int(r.returned) : "—"}</td>
                  <td className="num">{r.adjusted ? int(r.adjusted) : "—"}</td>
                  <td className="num">
                    <strong>{int(r.onHandAtDistributor)}</strong>
                  </td>
                  <td className="num">{(r.pctSold * 100).toFixed(1)}%</td>
                  <td className="num">{r.salesValue ? cur(r.salesValue, c) : "—"}</td>
                  <td className="num">{r.soldNotInvoicedQty ? int(r.soldNotInvoicedQty) : "—"}</td>
                  <td className="num">
                    {r.soldNotInvoicedValue ? cur(r.soldNotInvoicedValue, c) : "—"}
                  </td>
                  <td className="num">{cur(r.stockValueAtCost, "USD")}</td>
                  <td className="num">{cur(r.remainingValueAtPriceUsd, "USD")}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="empty">
                    No consignment stock recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Movements" hint="Shipments, reported sales, returns and adjustments">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>SKU</th>
                <th className="num">Qty</th>
                <th className="num">Unit Price</th>
                <th>Invoice</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="nowrap">{formatDate(m.date)}</td>
                  <td>
                    <Badge
                      tone={
                        m.type === "Reported Sale"
                          ? "green"
                          : m.type === "Shipment to Distributor"
                            ? "blue"
                            : "amber"
                      }
                    >
                      {m.type}
                    </Badge>
                  </td>
                  <td>{m.sku}</td>
                  <td className="num">{int(m.qty)}</td>
                  <td className="num">{m.unitPrice !== undefined ? cur(m.unitPrice, c) : "—"}</td>
                  <td>
                    {m.type === "Reported Sale" ? (
                      m.invoiceId ? (
                        m.invoiceId
                      ) : (
                        <Badge tone="amber">To invoice</Badge>
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="small">{m.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <SellThroughModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        distributor={distributor}
        onHand={(sku) => rows.find((r) => r.sku === sku)?.onHandAtDistributor ?? 0}
        skus={rows.map((r) => r.sku)}
      />
    </div>
  );
}

function SellThroughModal({
  open,
  onClose,
  distributor,
  onHand,
  skus,
}: {
  open: boolean;
  onClose: () => void;
  distributor: Distributor;
  onHand: (sku: string) => number;
  skus: string[];
}) {
  const { update, asOf, flash } = useStore();
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("6");
  const [date, setDate] = useState(asOf);
  const [ref, setRef] = useState("");
  const chosen = sku || skus[0] || "";
  const available = onHand(chosen);
  const q = Number(qty);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!chosen || !(q > 0) || q > available) return;
    const m: ConsignmentMovement = {
      id: newId("CM"),
      distributorId: distributor.id,
      date,
      sku: chosen,
      type: "Reported Sale",
      qty: q,
      unitPrice: Number(price) || 0,
      invoiceId: null,
      reference: ref.trim() || "Sell-through report",
    };
    update("consignmentMovements", (prev) => [...prev, m]);
    flash(`${int(q)} × ${chosen} reported sold · ready to invoice`);
    setQty("");
    setRef("");
    onClose();
  };

  return (
    <Modal open={open} title="Record Sell-Through Report" onClose={onClose} width={620}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="SKU">
            <select value={chosen} onChange={(e) => setSku(e.target.value)}>
              {skus.map((s) => (
                <option key={s} value={s}>
                  {s} · {int(onHand(s))} on hand there
                </option>
              ))}
            </select>
          </Field>
          <Field label="Report / Sale Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Units Sold">
            <input
              type="number"
              min="1"
              max={available}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
            />
          </Field>
          <Field label={`Agreed Price per Unit (${distributor.currency})`}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </Field>
          <Field label="Reference" span2>
            <input
              value={ref}
              placeholder="e.g. October sell-through report"
              onChange={(e) => setRef(e.target.value)}
            />
          </Field>
        </div>
        {q > available ? (
          <div className="notice readonly" style={{ marginTop: 12, marginBottom: 0 }}>
            Only {int(available)} units of {chosen} are at the distributor.
          </div>
        ) : null}
        <ModalActions onCancel={onClose} submitLabel="Save Report" disabled={q > available} />
      </form>
    </Modal>
  );
}

export default DistributorsPage;
