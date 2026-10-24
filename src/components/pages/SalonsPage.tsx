// Salon Direct: salon accounts, orders (manual or tagged from Shopify),
// dated commission plans and automatic commission.

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
  Section,
  Source,
  StatusBadge,
  Tabs,
  ViewOnlyBanner,
  useCanEdit,
  sum,
} from "@/components/cc/ui";
import { isFinance, ROLE_PERSON } from "@/lib/access";
import { monthKey } from "@/lib/engine/dates";
import {
  addressLine,
  autoTagShopifyOrders,
  calculateCommission,
  nextClientCode,
  type Address,
  type CommissionLine,
  type CommissionPlan,
  type SalonAccount,
  type SalonOrder,
} from "@/lib/engine/people";
import { formatDate, monthLabel, usd, money } from "@/lib/format";
import { newId, useStore } from "@/lib/store";

type TabId = "orders" | "accounts" | "plans" | "tagging";

const TABS: { id: TabId; label: string }[] = [
  { id: "accounts", label: "Salons" },
  { id: "orders", label: "Orders & Commission" },
  { id: "tagging", label: "Shopify Orders to Tag" },
  { id: "plans", label: "Commission Plans" },
];

type OnboardState = { name: string; email: string; tagNumber: string | null };

function basisTone(b: CommissionLine["basis"]) {
  if (b === "First Order") return "purple" as const;
  if (b === "Recurring") return "blue" as const;
  if (b === "Outside Recurring Window") return "grey" as const;
  return "red" as const;
}

export function SalonsPage() {
  const { role, data, update, asOf, flash } = useStore();
  const canEdit = useCanEdit("salons");
  const finance = isFinance(role);
  const isRep = role === "Salon Sales Rep";
  const myRepId = isRep ? (ROLE_PERSON[role] ?? null) : null;
  const [tab, setTab] = useState<TabId>("accounts");
  const [orderOpen, setOrderOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState<OnboardState | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const repName = (id: string) => data.salesReps.find((r) => r.id === id)?.name ?? id;
  const accountName = (id: string) => data.salonAccounts.find((a) => a.id === id)?.name ?? id;

  const allLines = useMemo(
    () => calculateCommission(data.salonOrders, data.commissionPlans),
    [data.salonOrders, data.commissionPlans],
  );
  const lines = myRepId ? allLines.filter((l) => l.order.repId === myRepId) : allLines;
  const accounts = myRepId
    ? data.salonAccounts.filter((a) => a.repId === myRepId)
    : data.salonAccounts;
  const plans = myRepId
    ? data.commissionPlans.filter((p) => p.repId === myRepId)
    : data.commissionPlans;

  const thisMonth = monthKey(asOf);
  const monthLines = lines.filter(
    (l) => monthKey(l.order.date) === thisMonth && l.order.status !== "Rejected",
  );
  const pending = lines.filter((l) => l.order.status === "Pending Review");
  const firstOrders = monthLines.filter((l) => l.basis === "First Order").length;

  // Commission payable by rep by month (approved orders only)
  const payable = useMemo(() => {
    const approved = lines.filter((l) => l.order.status === "Approved");
    const months = [...new Set(approved.map((l) => monthKey(l.order.date)))]
      .sort()
      .reverse()
      .slice(0, 4);
    const reps = [...new Set(approved.map((l) => l.order.repId))];
    return {
      months,
      rows: reps.map((repId) => ({
        repId,
        byMonth: months.map((m) =>
          sum(
            approved.filter((l) => l.order.repId === repId && monthKey(l.order.date) === m),
            (l) => l.commission,
          ),
        ),
      })),
    };
  }, [lines]);

  const setStatus = (id: string, status: SalonOrder["status"]) => {
    update("salonOrders", (prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    flash(
      `Order ${id} ${status === "Approved" ? "approved" : "rejected"} · commission recalculated`,
    );
  };

  return (
    <ModuleGate id="salons">
      <section className="screen active" id="screen-salons">
        <ModuleHead
          title="Salons"
          subtitle={
            myRepId
              ? `Salon Direct · your accounts and commission (${repName(myRepId)})`
              : "Salon Direct · accounts, orders and commission"
          }
        >
          <Tabs tabs={TABS} value={tab} onChange={setTab} />
        </ModuleHead>
        <ViewOnlyBanner
          id="salons"
          text="View only for this role. Salon reps enter orders; Finance approves orders and manages commission plans."
        />

        <div className="module-stats">
          <ModuleStat
            label="Salon sales this month"
            value={usd(sum(monthLines, (l) => l.order.netAmount))}
            note={`${monthLabel(thisMonth)} · month to date`}
          />
          <ModuleStat
            label="Commission this month"
            value={money(sum(monthLines, (l) => l.commission))}
            note="Calculated automatically"
          />
          <ModuleStat
            label="Pending review"
            value={pending.length}
            note={finance ? "Waiting for your approval" : "Waiting for Finance approval"}
          />
          <ModuleStat
            label="First orders this month"
            value={firstOrders}
            note="New salon accounts ordering"
          />
        </div>

        {tab === "orders" && (
          <div className="stack">
            <Section
              title="Salon Orders"
              hint={<Source>Manual entry + Shopify API</Source>}
              actions={
                isRep && canEdit ? (
                  <button className="btn primary" type="button" onClick={() => setOrderOpen(true)}>
                    + Add Salon Order
                  </button>
                ) : null
              }
            >
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Salon</th>
                      <th>Rep</th>
                      <th>Date</th>
                      <th>Source</th>
                      <th className="num">Net Amount</th>
                      <th>Commission Basis</th>
                      <th className="num">Rate</th>
                      <th className="num">Commission</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...lines]
                      .sort((a, b) => b.order.date.localeCompare(a.order.date))
                      .map((l) => (
                        <tr key={l.order.id}>
                          <td>
                            <strong>{l.order.id}</strong>
                          </td>
                          <td>{accountName(l.order.accountId)}</td>
                          <td>{repName(l.order.repId)}</td>
                          <td className="nowrap">{formatDate(l.order.date)}</td>
                          <td>
                            {l.order.source === "Shopify" ? (
                              <>
                                <Badge tone="green">
                                  Shopify {l.order.shopifyOrderNumber ?? ""}
                                </Badge>
                                {l.order.matchedBy ? (
                                  <div className="small">
                                    Auto-tagged · matched by {l.order.matchedBy}
                                  </div>
                                ) : null}
                              </>
                            ) : (
                              <Badge tone="grey">Manual</Badge>
                            )}
                          </td>
                          <td className="num">{usd(l.order.netAmount)}</td>
                          <td>
                            <Badge tone={basisTone(l.basis)}>{l.basis}</Badge>
                            {l.plan ? <div className="small">{l.plan.name}</div> : null}
                          </td>
                          <td className="num">{l.ratePct ? `${l.ratePct}%` : "—"}</td>
                          <td className="num">
                            <strong>{money(l.commission)}</strong>
                          </td>
                          <td>
                            <StatusBadge status={l.order.status} />
                          </td>
                          <td>
                            {finance && l.order.status === "Pending Review" ? (
                              <div className="planned-actions">
                                <button
                                  className="mini-action"
                                  type="button"
                                  onClick={() => setStatus(l.order.id, "Approved")}
                                >
                                  Approve
                                </button>
                                <button
                                  className="mini-action danger"
                                  type="button"
                                  onClick={() => setStatus(l.order.id, "Rejected")}
                                >
                                  Reject
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    {lines.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="empty">
                          No salon orders yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section
              title="Commission Payable"
              kicker="BY REP · BY MONTH"
              hint="Approved orders only"
            >
              <div className="table-wrap">
                <table className="compact">
                  <thead>
                    <tr>
                      <th>Rep</th>
                      {payable.months.map((m) => (
                        <th key={m} className="num">
                          {monthLabel(m)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payable.rows.map((r) => (
                      <tr key={r.repId}>
                        <td>
                          <strong>{repName(r.repId)}</strong>
                        </td>
                        {r.byMonth.map((v, i) => (
                          <td key={payable.months[i] ?? i} className="num">
                            {v ? money(v) : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {payable.rows.length > 1 ? (
                      <tr className="total-row">
                        <td>Total</td>
                        {payable.months.map((m, i) => (
                          <td key={m} className="num">
                            {money(sum(payable.rows, (r) => r.byMonth[i] ?? 0))}
                          </td>
                        ))}
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="notice mt" style={{ marginBottom: 0 }}>
                First order per salon earns the first-order rate. Repeat orders earn the recurring
                rate while inside the plan's recurring window (N months after the salon's first
                order, or forever). Rejected orders earn nothing.
              </div>
            </Section>
          </div>
        )}

        {tab === "accounts" && (
          <Section
            title={myRepId ? "My Salons" : "Salons"}
            hint={`${accounts.length} salon${accounts.length === 1 ? "" : "s"} · click a row for full details`}
            actions={
              canEdit ? (
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => setAccountOpen({ name: "", email: "", tagNumber: null })}
                >
                  + Onboard New Salon
                </button>
              ) : null
            }
          >
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Salon</th>
                    <th>Contact</th>
                    <th>Ship to</th>
                    <th>Rep</th>
                    <th>Onboarded</th>
                    <th className="num">Orders</th>
                    <th className="num">Sales (all time)</th>
                    <th className="num">Commission (all time)</th>
                    <th>Active Plan</th>
                  </tr>
                </thead>
                <tbody>
                  {[...accounts]
                    .sort((x, y) => y.clientCode - x.clientCode)
                    .map((a) => {
                      const al = allLines.filter(
                        (l) => l.order.accountId === a.id && l.order.status !== "Rejected",
                      );
                      const plan =
                        data.commissionPlans.find(
                          (p) =>
                            p.repId === a.repId && p.accountId === a.id && p.effectiveTo === null,
                        ) ??
                        data.commissionPlans.find(
                          (p) =>
                            p.repId === a.repId &&
                            p.accountId === null &&
                            (p.effectiveTo === null || p.effectiveTo >= asOf),
                        );
                      const open = expanded === a.id;
                      return [
                        <tr
                          key={a.id}
                          className="clickable"
                          onClick={() => setExpanded(open ? null : a.id)}
                        >
                          <td>
                            <strong>{a.clientCode}</strong>
                          </td>
                          <td>
                            <strong>{a.name}</strong>
                          </td>
                          <td>
                            {a.contactName}
                            <div className="small">{a.email}</div>
                          </td>
                          <td>
                            {a.shippingAddress.city}, {a.shippingAddress.state}
                          </td>
                          <td>{repName(a.repId)}</td>
                          <td className="nowrap">{formatDate(a.onboardedOn)}</td>
                          <td className="num">{al.length}</td>
                          <td className="num">{usd(sum(al, (l) => l.order.netAmount))}</td>
                          <td className="num">{money(sum(al, (l) => l.commission))}</td>
                          <td>
                            {plan ? (
                              <>
                                {plan.name}
                                {plan.accountId ? (
                                  <div className="small">Account override</div>
                                ) : null}
                              </>
                            ) : (
                              <Badge tone="red">No plan</Badge>
                            )}
                          </td>
                        </tr>,
                        open ? (
                          <tr key={`${a.id}-detail`}>
                            <td colSpan={10}>
                              <div className="form-grid salon-detail">
                                <div>
                                  <span className="small">Phone</span>
                                  <div>{a.phone || "—"}</div>
                                </div>
                                <div>
                                  <span className="small">Email</span>
                                  <div>{a.email}</div>
                                </div>
                                <div>
                                  <span className="small">Shipping address</span>
                                  <div>{addressLine(a.shippingAddress)}</div>
                                </div>
                                <div>
                                  <span className="small">Billing address</span>
                                  <div>{addressLine(a.billingAddress)}</div>
                                </div>
                                <div>
                                  <span className="small">Shopify customer</span>
                                  <div>
                                    {a.shopifyCustomerId ? (
                                      <Badge tone="green">Linked · {a.shopifyCustomerId}</Badge>
                                    ) : (
                                      "Matched by email or salon name"
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null,
                      ];
                    })}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {tab === "plans" && (
          <Section
            title="Commission Plans"
            hint={
              <Assume title="Commission structures change often, so each plan is a dated version. A new version takes over from its effective date; past orders keep the plan that applied on their date.">
                Variable structure · dated plan versions
              </Assume>
            }
            actions={
              finance ? (
                <button className="btn primary" type="button" onClick={() => setPlanOpen(true)}>
                  + New Plan Version
                </button>
              ) : null
            }
          >
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Rep</th>
                    <th>Applies To</th>
                    <th className="num">First Order %</th>
                    <th className="num">Recurring %</th>
                    <th>Recurring Window</th>
                    <th>Effective From</th>
                    <th>Effective To</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...plans]
                    .sort(
                      (a, b) =>
                        a.repId.localeCompare(b.repId) ||
                        b.effectiveFrom.localeCompare(a.effectiveFrom),
                    )
                    .map((p) => {
                      const active =
                        p.effectiveFrom <= asOf &&
                        (p.effectiveTo === null || p.effectiveTo >= asOf);
                      return (
                        <tr key={p.id}>
                          <td>
                            <strong>{p.name}</strong>
                            <div className="small">{p.id}</div>
                          </td>
                          <td>{repName(p.repId)}</td>
                          <td>{p.accountId ? accountName(p.accountId) : "All rep's salons"}</td>
                          <td className="num">{p.firstOrderPct}%</td>
                          <td className="num">{p.recurringPct}%</td>
                          <td>
                            {p.recurringMonths === null
                              ? "Forever"
                              : `${p.recurringMonths} months after first order`}
                          </td>
                          <td>{formatDate(p.effectiveFrom)}</td>
                          <td>{p.effectiveTo ? formatDate(p.effectiveTo) : "Open"}</td>
                          <td>
                            {active ? (
                              <Badge tone="green">Active</Badge>
                            ) : p.effectiveFrom > asOf ? (
                              <Badge tone="blue">Future</Badge>
                            ) : (
                              <Badge tone="grey">Ended</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {tab === "tagging" && (
          <TaggingTab
            canTag={canEdit}
            onNewAccount={(name, email, tagNumber) => setAccountOpen({ name, email, tagNumber })}
            myRepId={myRepId}
          />
        )}

        <AddOrderModal
          open={orderOpen}
          onClose={() => setOrderOpen(false)}
          accounts={accounts}
          repId={myRepId}
        />
        <PlanModal open={planOpen} onClose={() => setPlanOpen(false)} />
        <AccountModal
          state={accountOpen}
          onClose={() => setAccountOpen(null)}
          defaultRepId={myRepId}
        />
      </section>
    </ModuleGate>
  );
}

function TaggingTab({
  canTag,
  onNewAccount,
  myRepId,
}: {
  canTag: boolean;
  onNewAccount: (name: string, email: string, tagNumber: string) => void;
  myRepId: string | null;
}) {
  const { data, update, flash } = useStore();
  const [choice, setChoice] = useState<Record<string, string>>({});
  const accounts = myRepId
    ? data.salonAccounts.filter((a) => a.repId === myRepId)
    : data.salonAccounts;
  const auto = data.salonOrders
    .filter((o) => o.matchedBy && (!myRepId || o.repId === myRepId))
    .sort((a, b) => b.date.localeCompare(a.date));
  const salon = (id: string) => data.salonAccounts.find((a) => a.id === id);

  const tag = (number: string) => {
    const o = data.untaggedShopifyOrders.find((x) => x.number === number);
    const account = data.salonAccounts.find((a) => a.id === choice[number]);
    if (!o || !account) return;
    const order: SalonOrder = {
      id: newId("SO"),
      accountId: account.id,
      repId: account.repId,
      date: o.date,
      netAmount: o.netAmount,
      source: "Shopify",
      shopifyOrderNumber: o.number,
      status: "Pending Review",
    };
    update("salonOrders", (prev) => [...prev, order]);
    update("untaggedShopifyOrders", (prev) => prev.filter((x) => x.number !== number));
    flash(`Shopify ${number} tagged to ${account.name} · sent for Finance review`);
  };

  return (
    <div className="stack">
      <div className="notice">
        Every Shopify wholesale order is checked against the salon list. If the order's{" "}
        <strong>email</strong> or <strong>salon name</strong> matches a salon, it is tagged to that
        salon's rep automatically and goes to Finance for approval. Only orders with no match are
        left below. Onboard the salon and its orders are picked up straight away.
      </div>
      <Section
        title="Shopify orders with no matching salon"
        hint={<Source>Shopify API · wholesale orders</Source>}
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Shopify Order</th>
                <th>Date</th>
                <th>Customer (Shopify)</th>
                <th className="num">Net Amount</th>
                <th>Tag to Salon</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.untaggedShopifyOrders.map((o) => (
                <tr key={o.number}>
                  <td>
                    <strong>{o.number}</strong>
                  </td>
                  <td>{formatDate(o.date)}</td>
                  <td>
                    {o.customer}
                    <div className="small">{o.email}</div>
                  </td>
                  <td className="num">{usd(o.netAmount)}</td>
                  <td>
                    <select
                      className="control"
                      value={choice[o.number] ?? ""}
                      disabled={!canTag}
                      onChange={(e) => setChoice((c) => ({ ...c, [o.number]: e.target.value }))}
                    >
                      <option value="">Select salon…</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.clientCode} · {a.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {canTag ? (
                      <div className="planned-actions">
                        <button
                          className="mini-action"
                          type="button"
                          disabled={!choice[o.number]}
                          onClick={() => tag(o.number)}
                        >
                          Tag
                        </button>
                        <button
                          className="mini-action"
                          type="button"
                          onClick={() => onNewAccount(o.customer, o.email, o.number)}
                        >
                          Onboard as new salon
                        </button>
                      </div>
                    ) : (
                      <span className="small">View only</span>
                    )}
                  </td>
                </tr>
              ))}
              {data.untaggedShopifyOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    Every Shopify wholesale order is matched to a salon.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Tagged automatically" hint={`${auto.length} orders`}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Shopify Order</th>
                <th>Date</th>
                <th>Salon</th>
                <th>Rep</th>
                <th>Matched by</th>
                <th className="num">Net Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {auto.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>{o.shopifyOrderNumber}</strong>
                  </td>
                  <td>{formatDate(o.date)}</td>
                  <td>
                    {salon(o.accountId)?.clientCode} · {salon(o.accountId)?.name}
                  </td>
                  <td>{data.salesReps.find((r) => r.id === o.repId)?.name ?? o.repId}</td>
                  <td>
                    <Badge tone={o.matchedBy === "email" ? "green" : "amber"}>
                      {o.matchedBy === "email" ? "Email" : "Salon name"}
                    </Badge>
                  </td>
                  <td className="num">{usd(o.netAmount)}</td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
              {auto.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    No orders tagged automatically yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function AddOrderModal({
  open,
  onClose,
  accounts,
  repId,
}: {
  open: boolean;
  onClose: () => void;
  accounts: SalonAccount[];
  repId: string | null;
}) {
  const { update, flash, asOf } = useStore();
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(asOf);
  const [amount, setAmount] = useState("");
  const [shopify, setShopify] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const account = accounts.find((a) => a.id === (accountId || accounts[0]?.id));
    const net = Number(amount);
    if (!account || !(net > 0)) return;
    const order: SalonOrder = {
      id: newId("SO"),
      accountId: account.id,
      repId: repId ?? account.repId,
      date,
      netAmount: net,
      source: shopify.trim() ? "Shopify" : "Manual",
      shopifyOrderNumber: shopify.trim() || null,
      status: "Pending Review",
    };
    update("salonOrders", (prev) => [...prev, order]);
    flash(`Order for ${account.name} saved · pending Finance review`);
    setAmount("");
    setShopify("");
    onClose();
  };

  return (
    <Modal open={open} title="Add Salon Order" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Salon Account">
            <select
              value={accountId || accounts[0]?.id || ""}
              onChange={(e) => setAccountId(e.target.value)}
              required
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.clientCode} · {a.name} · {a.shippingAddress.city}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Order Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Net Amount (USD, excl. tax & shipping)">
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </Field>
          <Field label="Shopify Order # (optional)">
            <input
              value={shopify}
              placeholder="#S1400"
              onChange={(e) => setShopify(e.target.value)}
            />
          </Field>
        </div>
        <div className="notice" style={{ marginTop: 12, marginBottom: 0 }}>
          Commission is calculated automatically from your dated commission plan. Finance approves
          the order before commission becomes payable.
        </div>
        <ModalActions onCancel={onClose} submitLabel="Save Order" />
      </form>
    </Modal>
  );
}

function PlanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, update, flash, asOf } = useStore();
  const [repId, setRepId] = useState(data.salesReps[0]?.id ?? "");
  const [accountId, setAccountId] = useState("");
  const [name, setName] = useState("");
  const [first, setFirst] = useState("10");
  const [recurring, setRecurring] = useState("5");
  const [forever, setForever] = useState(false);
  const [months, setMonths] = useState("6");
  const [from, setFrom] = useState(asOf);
  const [to, setTo] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!repId || !from) return;
    const plan: CommissionPlan = {
      id: newId("CP"),
      name:
        name.trim() ||
        `${data.salesReps.find((r) => r.id === repId)?.name ?? repId} plan from ${formatDate(from)}`,
      repId,
      accountId: accountId || null,
      firstOrderPct: Number(first) || 0,
      recurringPct: Number(recurring) || 0,
      recurringMonths: forever ? null : Math.max(0, Number(months) || 0),
      effectiveFrom: from,
      effectiveTo: to || null,
    };
    // A new general plan ends the rep's previous open general plan the day before (same for account overrides).
    update("commissionPlans", (prev) => [
      ...prev.map((p) => {
        if (
          p.repId === plan.repId &&
          p.accountId === plan.accountId &&
          p.effectiveTo === null &&
          p.effectiveFrom < plan.effectiveFrom
        ) {
          const d = new Date(`${plan.effectiveFrom}T00:00:00Z`);
          d.setUTCDate(d.getUTCDate() - 1);
          return { ...p, effectiveTo: d.toISOString().slice(0, 10) };
        }
        return p;
      }),
      plan,
    ]);
    flash(`Plan "${plan.name}" saved · applies from ${formatDate(plan.effectiveFrom)}`);
    onClose();
  };

  return (
    <Modal open={open} title="New Commission Plan Version" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Sales Rep">
            <select
              value={repId}
              onChange={(e) => {
                setRepId(e.target.value);
                setAccountId("");
              }}
            >
              {data.salesReps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Applies To">
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">All of this rep's salons</option>
              {data.salonAccounts
                .filter((a) => a.repId === repId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    Override: {a.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Plan Name" span2>
            <input
              value={name}
              placeholder="e.g. Northeast 2027"
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="First Order Commission %">
            <input
              type="number"
              min="0"
              step="0.1"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              required
            />
          </Field>
          <Field label="Recurring Commission %">
            <input
              type="number"
              min="0"
              step="0.1"
              value={recurring}
              onChange={(e) => setRecurring(e.target.value)}
              required
            />
          </Field>
          <Field label="Recurring Window">
            <select
              value={forever ? "forever" : "months"}
              onChange={(e) => setForever(e.target.value === "forever")}
            >
              <option value="months">Limited number of months</option>
              <option value="forever">Forever</option>
            </select>
          </Field>
          <Field label="Months After First Order">
            <input
              type="number"
              min="0"
              value={months}
              disabled={forever}
              onChange={(e) => setMonths(e.target.value)}
            />
          </Field>
          <Field label="Effective From">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
          </Field>
          <Field label="Effective To (optional)">
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <div className="notice" style={{ marginTop: 12, marginBottom: 0 }}>
          The rep's current open plan for the same scope ends the day before this one starts. Orders
          keep the plan that applied on their order date.
        </div>
        <ModalActions onCancel={onClose} submitLabel="Save Plan" />
      </form>
    </Modal>
  );
}

const EMPTY_ADDRESS: Address = {
  street: "",
  city: "",
  state: "",
  zip: "",
  country: "United States",
};

function AddressFields({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: Address;
  onChange: (a: Address) => void;
  required?: boolean;
}) {
  const set = (k: keyof Address) => (e: { target: { value: string } }) =>
    onChange({ ...value, [k]: e.target.value });
  return (
    <>
      <Field label={`${label} · street`} span2>
        <input value={value.street} onChange={set("street")} required={required} />
      </Field>
      <Field label="City">
        <input value={value.city} onChange={set("city")} required={required} />
      </Field>
      <Field label="State">
        <input value={value.state} onChange={set("state")} required={required} />
      </Field>
      <Field label="ZIP">
        <input value={value.zip} onChange={set("zip")} required={required} />
      </Field>
      <Field label="Country">
        <input value={value.country} onChange={set("country")} required={required} />
      </Field>
    </>
  );
}

function AccountModal({
  state,
  onClose,
  defaultRepId,
}: {
  state: OnboardState | null;
  onClose: () => void;
  defaultRepId: string | null;
}) {
  const { data, update, flash, asOf } = useStore();
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [shipping, setShipping] = useState<Address>(EMPTY_ADDRESS);
  const [billing, setBilling] = useState<Address>(EMPTY_ADDRESS);
  const [sameBilling, setSameBilling] = useState(true);
  const [repId, setRepId] = useState(defaultRepId ?? data.salesReps[0]?.id ?? "");
  const [seenFor, setSeenFor] = useState<typeof state>(null);
  if (state !== seenFor) {
    setSeenFor(state);
    if (state) {
      setName(state.name);
      setEmail(state.email);
    }
  }
  const code = nextClientCode(data.salonAccounts);

  const reset = () => {
    setContactName("");
    setPhone("");
    setShipping(EMPTY_ADDRESS);
    setBilling(EMPTY_ADDRESS);
    setSameBilling(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const clash = data.salonAccounts.find(
      (a) =>
        a.name.toLowerCase() === name.trim().toLowerCase() ||
        a.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (clash) {
      flash(`Already onboarded as ${clash.clientCode} · ${clash.name}`);
      return;
    }
    const account: SalonAccount = {
      id: newId("SAL"),
      clientCode: code,
      name: name.trim(),
      contactName: contactName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      shippingAddress: shipping,
      billingAddress: sameBilling ? shipping : billing,
      repId: defaultRepId ?? repId,
      onboardedOn: asOf,
      shopifyCustomerId: null,
    };
    update("salonAccounts", (prev) => [...prev, account]);
    // Pick up any waiting Shopify orders that match the new salon.
    const res = autoTagShopifyOrders(data.untaggedShopifyOrders, [account], newId);
    if (res.tagged.length) {
      update("salonOrders", (prev) => [...prev, ...res.tagged]);
      update("untaggedShopifyOrders", () => res.untagged);
    }
    flash(
      `Salon ${account.clientCode} · ${account.name} onboarded` +
        (res.tagged.length
          ? ` · ${res.tagged.length} Shopify order${res.tagged.length === 1 ? "" : "s"} tagged`
          : ""),
    );
    reset();
    onClose();
  };

  return (
    <Modal open={state !== null} title="Onboard New Salon" onClose={onClose} width={720}>
      <form onSubmit={submit}>
        <div className="notice" style={{ marginBottom: 12 }}>
          Client code <strong>{code}</strong> will be assigned automatically (next after {code - 1}
          ).
        </div>
        <div className="form-grid">
          <Field label="Salon name" span2>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Client (contact) name">
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} required />
          </Field>
          <Field label="Phone">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(404) 555-0100"
              required
            />
          </Field>
          <Field label="Email (used to match Shopify orders)" span2>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <AddressFields
            label="Shipping address"
            value={shipping}
            onChange={setShipping}
            required
          />
          <Field label="Billing address" span2>
            <label className="row" style={{ gap: 8, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={sameBilling}
                onChange={(e) => setSameBilling(e.target.checked)}
              />
              Same as shipping address
            </label>
          </Field>
          {!sameBilling ? (
            <AddressFields label="Billing address" value={billing} onChange={setBilling} required />
          ) : null}
          <Field label="Sales rep">
            <select
              value={defaultRepId ?? repId}
              disabled={defaultRepId !== null}
              onChange={(e) => setRepId(e.target.value)}
            >
              {data.salesReps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="notice" style={{ marginTop: 12, marginBottom: 0 }}>
          From now on, any Shopify order with this email or salon name is tagged to{" "}
          {data.salesReps.find((r) => r.id === (defaultRepId ?? repId))?.name ?? "the rep"} for
          commission automatically.
        </div>
        <ModalActions onCancel={onClose} submitLabel="Onboard Salon" />
      </form>
    </Modal>
  );
}

export default SalonsPage;
