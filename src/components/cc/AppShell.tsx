import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { access, MODULES, ROLES, SECTIONS, sectionOf, visibleTabs, type Role } from "@/lib/access";
import { useStore } from "@/lib/store";

export function AppShell({ children }: { children: ReactNode }) {
  const { role, setRole, notice, flash } = useStore();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current =
    MODULES.find((m) => (m.path === "/" ? pathname === "/" : pathname.startsWith(m.path))) ??
    MODULES[0]!;
  const currentSection = sectionOf(current.id);
  const [refreshing, setRefreshing] = useState(false);

  const sections = SECTIONS.map((s) => ({ ...s, tabs: visibleTabs(s, role) })).filter(
    (s) => s.tabs.length > 0,
  );
  const sectionTabs = currentSection ? visibleTabs(currentSection, role) : [];
  const pageTitle = current.id === "reports" ? "Reports" : (currentSection?.label ?? current.label);

  return (
    <div className="cc">
      <div className="app" id="app">
        <aside className="sidebar">
          <div className="brand">
            <img src="/cc-logo.png" alt="Controlled Chaos" />
          </div>
          <nav className="nav" aria-label="Primary">
            {sections.map((s) => (
              <Link
                key={s.id}
                to={s.tabs[0]!.path}
                className={s.id === currentSection?.id ? "active" : ""}
              >
                <span className="ico">{s.icon}</span>
                <span className="label">{s.label}</span>
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="label" style={{ fontWeight: 800 }}>
              Controlled Chaos
            </div>
            <div className="role-small">{role}</div>
          </div>
        </aside>

        <main className="main">
          <header className="topbar">
            <div>
              <div className="page-title">{pageTitle}</div>
              <div className="page-sub">{current.subtitle}</div>
            </div>
            <div className="top-actions">
              <select
                className="control role-select"
                aria-label="Preview as role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <ExportMenu
                fileName={current.id === "dashboard" ? "home" : current.id}
                canOpenReports={access(role, "reports") !== null}
                onNothing={() => flash("Nothing to export on this view")}
              />
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

          {sectionTabs.length > 1 ? (
            <nav className="section-tabs" aria-label={`${currentSection?.label} pages`}>
              {sectionTabs.map((t) => (
                <Link key={t.id} to={t.path} className={t.id === current.id ? "active" : ""}>
                  {t.tab}
                </Link>
              ))}
            </nav>
          ) : null}

          <div className="content">
            <div className="proto-banner">
              <span>
                <strong>Prototype</strong> · sample data · use the role switcher to preview each
                user's view. Items marked <span className="assume">⚑ assumption</span> need your
                confirmation.
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

/** One button for every page: download the tables on screen, or open the report builder. */
function ExportMenu({
  fileName,
  canOpenReports,
  onNothing,
}: {
  fileName: string;
  canOpenReports: boolean;
  onNothing: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="export-menu" ref={ref}>
      <button className="btn" type="button" onClick={() => setOpen((o) => !o)}>
        ⇩ Export / Report
      </button>
      {open ? (
        <div className="export-pop" role="menu">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              if (!downloadTables(fileName)) onNothing();
            }}
          >
            Download this page (Excel / CSV)
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              window.print();
            }}
          >
            Print or save as PDF
          </button>
          {canOpenReports ? (
            <Link to="/reports" onClick={() => setOpen(false)}>
              Build a custom report →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Writes every table currently on screen into one CSV file. Returns false if there are none. */
function downloadTables(fileName: string): boolean {
  const tables = [...document.querySelectorAll<HTMLTableElement>(".content table")];
  if (tables.length === 0) return false;
  const cell = (t: string) => {
    const v = t.replace(/\s+/g, " ").trim();
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const blocks = tables.map((table) => {
    const title = table.closest(".card")?.querySelector(".section-title h3")?.textContent ?? "";
    const rows = [...table.rows].map((r) =>
      [...r.cells].map((c) => cell(c.innerText ?? c.textContent ?? "")).join(","),
    );
    return [title ? cell(title) : null, ...rows].filter((x) => x !== null).join("\n");
  });
  const blob = new Blob([blocks.join("\n\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `controlled-chaos-${fileName}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}
