"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Quote, RecAction } from "@/lib/types";
import { RecBadge, fmtPrice, fmtPct, pctClass } from "./RecBadges";

interface LiveRow {
  ticker: string;
  quote: Quote | null;
  recommendation: RecAction | null;
  error?: string;
}

const POLL_MS = 20000; // 20s — paired with the 15s server-side quote cache

export default function LiveTradingTab() {
  const [rows, setRows] = useState<LiveRow[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [live, setLive] = useState(true);

  // Previous price per ticker, to flash green/red on change.
  const prevPrices = useRef<Record<string, number>>({});
  const [flash, setFlash] = useState<Record<string, "up" | "down">>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/quotes");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to load quotes");

      const nextRows: LiveRow[] = body.rows ?? [];
      const nextFlash: Record<string, "up" | "down"> = {};
      for (const r of nextRows) {
        const price = r.quote?.price;
        if (price == null) continue;
        const prev = prevPrices.current[r.ticker];
        if (prev !== undefined && price !== prev) {
          nextFlash[r.ticker] = price > prev ? "up" : "down";
        }
        prevPrices.current[r.ticker] = price;
      }

      setRows(nextRows);
      setAsOf(body.asOf ?? null);
      setError("");
      if (Object.keys(nextFlash).length > 0) {
        setFlash(nextFlash);
        setTimeout(() => setFlash({}), 700);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while live is on.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [live, load]);

  return (
    <div>
      <div className="row wrap" style={{ marginBottom: 12 }}>
        <span>
          <span className={`live-dot ${live ? "" : "paused"}`} />
          {live ? "Live" : "Paused"}
        </span>
        {asOf && (
          <span className="muted small">
            updated {new Date(asOf).toLocaleTimeString()}
          </span>
        )}
        <div className="spacer" />
        <button className="btn secondary" onClick={() => setLive((v) => !v)}>
          {live ? "Pause" : "Resume"}
        </button>
        <button className="btn secondary" onClick={load}>
          ↻ Refresh
        </button>
      </div>

      <div className="muted small" style={{ marginBottom: 10 }}>
        Live prices for your watchlist, refreshed every 20s. Read-only — this app
        never places orders; execution stays manual.
      </div>

      {error && <div className="error-box">{error}</div>}

      {loading ? (
        <div className="empty">
          <span className="spinner" /> Loading live quotes…
        </div>
      ) : rows.length === 0 ? (
        <div className="empty">
          No tickers on your watchlist yet. Add some from the Watchlist tab.
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
          <table className="feed">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Price</th>
                <th>Chg%</th>
                <th className="hide-mobile">Day range</th>
                <th>Call</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ticker}>
                  <td className="ticker">{r.ticker}</td>
                  <td
                    className={`price-cell live-price mono ${
                      flash[r.ticker] ? `flash-${flash[r.ticker]}` : ""
                    }`}
                  >
                    {r.quote?.price != null ? fmtPrice(r.quote.price) : "—"}
                  </td>
                  <td className={`mono ${pctClass(r.quote?.changePercent ?? null)}`}>
                    {r.quote?.changePercent != null
                      ? fmtPct(r.quote.changePercent)
                      : "—"}
                  </td>
                  <td className="hide-mobile mono small muted">
                    {r.quote?.low != null && r.quote?.high != null
                      ? `${fmtPrice(r.quote.low)} – ${fmtPrice(r.quote.high)}`
                      : "—"}
                  </td>
                  <td>
                    {r.recommendation ? (
                      <RecBadge action={r.recommendation} />
                    ) : (
                      <span className="badge muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
