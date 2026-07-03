import type { RecAction, Confidence } from "@/lib/types";

export function RecBadge({ action }: { action: RecAction }) {
  return <span className={`badge ${action}`}>{action}</span>;
}

export function ConfBadge({ confidence }: { confidence: Confidence }) {
  return <span className="badge conf">{confidence} conf</span>;
}

export function pctClass(pct: number | null): string {
  if (pct === null) return "";
  return pct >= 0 ? "pos" : "neg";
}

export function fmtPct(pct: number | null): string {
  if (pct === null) return "—";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function fmtPrice(p: number | null | undefined): string {
  if (p === null || p === undefined) return "—";
  return `$${p.toFixed(2)}`;
}
