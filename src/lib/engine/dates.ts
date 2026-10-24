// Date helpers. All business dates are ISO "YYYY-MM-DD" strings handled in UTC
// so that a date never shifts because of the viewer's time zone.

const DAY_MS = 86_400_000;

export function toDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toIso(new Date(toDate(iso).getTime() + days * DAY_MS));
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY_MS);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function addMonths(iso: string, months: number): string {
  const d = toDate(iso);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return toIso(target);
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonth(iso: string): string {
  const d = toDate(startOfMonth(iso));
  return toIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

/** Next `count` month keys starting with the month containing `iso`. */
export function monthKeys(iso: string, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(monthKey(addMonths(startOfMonth(iso), i)));
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10" -> "Oct 26" */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1]} ${String(y).slice(2)}`;
}

/** "2026-10-08" -> "08 Oct 2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

export function inRange(iso: string, fromInclusive: string, toInclusive: string): boolean {
  return iso >= fromInclusive && iso <= toInclusive;
}
