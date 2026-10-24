export function money(v: number | null | undefined, decimals = 2): string {
  const n = Number(v ?? 0);
  const s = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${n < 0 ? "−" : ""}$${s}`;
}

/** Whole dollars, e.g. $28,000 */
export function usd(v: number | null | undefined): string {
  return money(v, 0);
}

/** Compact dollars, e.g. $1.2M / $86k */
export function usdK(v: number): string {
  const a = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 10_000) return `${sign}$${Math.round(a / 1000)}k`;
  if (a >= 1000) return `${sign}$${(a / 1000).toFixed(1)}k`;
  return `${sign}$${Math.round(a)}`;
}

export function int(v: number | null | undefined): string {
  return Math.round(Number(v ?? 0)).toLocaleString("en-US");
}

export function pct(v: number, decimals = 1): string {
  return `${(v * 100).toFixed(decimals)}%`;
}

export function ratio(v: number): string {
  return v.toFixed(2);
}

export { formatDate, monthLabel } from "./engine/dates";
