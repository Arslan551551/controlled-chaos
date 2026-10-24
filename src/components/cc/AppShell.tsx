import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { access, MODULES, ROLES, type Role } from "@/lib/access";
import { useStore } from "@/lib/store";

export function AppShell({ children }: { children: ReactNode }) {
  const { role, setRole, notice, flash } = useStore();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = MODULES.find((m) => (m.path === "/" ? pathname === "/" : pathname.startsWith(m.path))) ?? MODULES[0]!;
  const [refreshing, setRefreshing] = useState(false);

  const visible = MODULES.filter((m) => access(role, m.id));
  const groups: { name: string; items: typeof MODULES }[] = [];
  for (const m of visible) {
    const g = groups.find((x) => x.name === m.group);
    if (g) g.items.push(m);
    else groups.push({ name: m.group, items: [m] });
  }

  return (
    <div className="cc">
      <div className="app" id="app">
        <aside className="sidebar">
          <div className="brand">
            <img src="/cc-logo.png" alt="Controlled Chaos" />
          </div>
          <nav className="nav" aria-label="Primary">
            {groups.map((g) => (
              <div key={g.name || "main"}>
                {g.name ? <div className="nav-group">{g.name}</div> : null}
                {g.items.map((m) => (
                  <Link key={m.id} to={m.path} className={m.id === current.id ? "active" : ""}>
                    <span className="ico">{m.icon}</span>
                    <span className="label">{m.label}</span>
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="label" style={{ fontWeight: 800 }}>Controlled Chaos</div>
            <div className="role-small">{role}</div>
          </div>
        </aside>

        <main className="main">
          <header className="topbar">
            <div>
              <div className="page-title">Controlled Chaos</div>
              <div className="page-sub">{current.label} · {current.subtitle}</div>
            </div>
            <div className="top-actions">
              <select className="control role-select" aria-label="Preview as role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setRefreshing(true);
                  window.setTimeout(() => {
                    setRefreshing(false);
                    flash("Data synced · ShipStation, marketplaces, QuickBooks, ad platforms");
                  }, 700);
                }}
              >
                {refreshing ? "Syncing…" : "↻ Refresh"}
              </button>
            </div>
          </header>

          <div className="content">
            <div className="proto-banner">
              <span>
                <strong>Prototype</strong> · sample data · use the role switcher to preview each user's view. Items marked <span className="assume">⚑ assumption</span> need your confirmation.
              </span>
              <span className="muted">Data as of 24 Oct 2026, 06:00</span>
            </div>
            {children}
          </div>
        </main>
      </div>
      {notice ? <div className="toast">✓ {notice}</div> : null}
    </div>
  );
}
