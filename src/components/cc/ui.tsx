// Small building blocks that reproduce the v16 prototype's markup and classes.

import { useEffect, type ReactNode } from "react";

import { access, MODULES, VIEW_ONLY_NOTE, type ModuleId } from "@/lib/access";
import { useStore } from "@/lib/store";

export type Tone = "red" | "amber" | "green" | "blue" | "purple" | "grey";

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const cls = tone === "grey" ? "badge" : `badge b-${tone}`;
  return (
    <span
      className={cls}
      style={tone === "grey" ? { background: "#eef1f5", color: "#5b6779" } : undefined}
    >
      {children}
    </span>
  );
}

/** Same colour rules as the prototype's statusBadge(). */
export function StatusBadge({ status }: { status: string }) {
  let tone: Tone = "amber";
  if (
    status === "Closed" ||
    status === "Finalized" ||
    status.includes("No PO Required") ||
    status.includes("No Tube PO Required") ||
    status.includes("No Transfer Required") ||
    status === "Paid" ||
    status === "Approved" ||
    status === "Adjusted in ShipStation" ||
    status === "Active" ||
    status === "Submitted" ||
    status === "Matches register" ||
    status === "Complete"
  )
    tone = "green";
  else if (status.includes("Transfer") || status === "Delayed" || status === "Sent to Finance")
    tone = "blue";
  else if (
    status === "Cancelled" ||
    status === "Rejected" ||
    status === "No Georgia Stock" ||
    status === "Not registered"
  )
    tone = "red";
  else if (status === "Fulfilled") tone = "purple";
  else if (status.includes("PO Due Soon")) tone = "amber";
  else if (status.includes("PO")) tone = "red";
  return <Badge tone={tone}>{status}</Badge>;
}

export function ModuleHead({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="module-head">
      <div>
        <h2>{title}</h2>
        <div className="muted">{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  disabled = [],
  className = "",
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: T[];
  className?: string;
}) {
  return (
    <div className={`tabs ${className}`} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`tab${value === t.id ? " active" : ""}`}
          disabled={disabled.includes(t.id)}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function ModuleStat({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="module-stat">
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

export function Section({
  title,
  kicker,
  hint,
  actions,
  children,
  className = "",
  id,
}: {
  title: ReactNode;
  kicker?: string;
  hint?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div className={`card ${className}`} id={id}>
      <div className="section-title">
        <div>
          {kicker ? <span className="section-kicker">{kicker}</span> : null}
          <h3>{title}</h3>
        </div>
        <div className="row">
          {hint ? <span className="hint">{hint}</span> : null}
          {actions}
        </div>
      </div>
      {children}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  width,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="modal-backdrop open"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal" style={width ? { width: `min(${width}px,96vw)` } : undefined}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ModalActions({
  onCancel,
  submitLabel,
  disabled,
}: {
  onCancel: () => void;
  submitLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="toolbar" style={{ justifyContent: "flex-end", marginTop: 16, marginBottom: 0 }}>
      <button className="btn" type="button" onClick={onCancel}>
        Cancel
      </button>
      <button className="btn primary" type="submit" disabled={disabled}>
        {submitLabel}
      </button>
    </div>
  );
}

export function Field({
  label,
  children,
  span2,
}: {
  label: string;
  children: ReactNode;
  span2?: boolean;
}) {
  return (
    <div className={`field${span2 ? " span2" : ""}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}

/** Marks something in the prototype that is an assumption awaiting confirmation. */
export function Assume({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span className="assume" title={title}>
      ⚑ {children}
    </span>
  );
}

export function Source({ children }: { children: ReactNode }) {
  return (
    <span className="source-chip">
      <span className="fresh-dot" /> {children}
    </span>
  );
}

export function HBar({
  label,
  value,
  max,
  display,
  tone = "",
}: {
  label: ReactNode;
  value: number;
  max: number;
  display: ReactNode;
  tone?: "" | "alt" | "warn" | "bad" | "ghost";
}) {
  const w = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="hbar">
      <span>{label}</span>
      <div className="hbar-track">
        <div className={`hbar-fill ${tone}`} style={{ width: `${w}%` }} />
      </div>
      <span className="num">{display}</span>
    </div>
  );
}

export function Progress({ value, tone }: { value: number; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className={`progress ${tone ?? ""}`}>
      <div style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

/** Shows the page only to roles with access; otherwise a clear message. */
export function ModuleGate({ id, children }: { id: ModuleId; children: ReactNode }) {
  const { role } = useStore();
  const a = access(role, id);
  const mod = MODULES.find((m) => m.id === id);
  if (!a) {
    return (
      <div className="card no-access">
        <div className="empty-icon">🔒</div>
        <h3>
          {mod?.label} isn't available for {role}
        </h3>
        <p className="muted">Switch role in the top bar to preview another user's view.</p>
      </div>
    );
  }
  return <>{children}</>;
}

export function ViewOnlyBanner({ id, text }: { id: ModuleId; text?: string }) {
  const { role } = useStore();
  if (access(role, id) === "edit") return null;
  return (
    <div className="permission-banner notice readonly show">
      {text ?? VIEW_ONLY_NOTE[id] ?? "View only for this role."}
    </div>
  );
}

export function useCanEdit(id: ModuleId) {
  const { role } = useStore();
  return access(role, id) === "edit";
}

export function sum<T>(rows: T[], f: (r: T) => number): number {
  return rows.reduce((a, r) => a + f(r), 0);
}
