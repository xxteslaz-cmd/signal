"use client";

import { useEffect, useState, useCallback } from "react";
import type { InsiderTrade } from "@/lib/types";
import { fmtPrice } from "./RecBadges";

function fmtValue(v: number | null): string {
  if (v === null) return "—";
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function TypeBadge({ trade }: { trade: InsiderTrade }) {
  if (trade.isOpenMarketBuy) {
    return <span className="badge buy">buy</span>;
  }
  const t = trade.transactionType.toLowerCase();
  if (t.includes("sale")) return <span className="badge sell">sell</span>;
  if (t.includes("option") || t.includes("exercise"))
    return <span className="badge muted">exercise</span>;
  return <span className="badge muted">{trade.transactionType}</span>;
}

export default function InsidersTab() {
  const [trades, setTrades] = useState<InsiderTrade[]>([]);
  const [scope, setScope] = useState<string>("watchlist");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lookup, setLookup] = useState("");

  // Load insider trades for a scope: undefined = watchlist, else a ticker.
  const load = useCallback(async (ticker?: string) => {
    setLoading(true);
    setError("");
    try {
      const qs = ticker ? `?ticker=${encodeURIComponent(ticker)}` : "";
      const res = await fetch(`/api/insiders${qs}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to load insider trades");
      setTrades(body.trades ?? []);
      setScope(body.scope ?? "watchlist");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setTrades([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function submitLookup(e: React.FormEvent) {
    e.preventDefault();
    const t = lookup.trim().toUpperCase();
    if (t) load(t);
  }

  const viewingTicker = scope !== "watchlist";

  return (
    <div>
      <div className="row wrap" style={{ marginBottom: 12 }}>
        <button
          className={`btn ${viewingTicker ? "secondary" : ""}`}
          onClick={() => {
            setLookup("");
            load();
          }}
        >
          My watchlist
        </button>
        <form onSubmit={submitLookup} className="row" style={{ gap: 6, flex: 1, minWidth: 180 }}>
          <input
            type="text"
            placeholder="Look up any ticker…"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            style={{ maxWidth: 200, textTransform: "uppercase" }}
            aria-label="Look up ticker insiders"
          />
          <button className="btn secondary" disabled={loading || !lookup.trim()}>
            Search
          </button>
        </form>
        <div className="spacer" />
        <button
          className="btn secondary"
          onClick={() => load(viewingTicker ? scope : undefined)}
          disabled={loading}
        >
          {loading ? <span className="spinner" /> : "↻ Refresh"}
        </button>
      </div>

      <div className="muted small" style={{ marginBottom: 10 }}>
        {viewingTicker ? (
          <>
            Showing <span className="ticker">{scope}</span> ·{" "}
          </>
        ) : (
          "Insider flow across your watchlist · "
        )}
        <span className="badge buy">buy</span> = open-market purchase (higher signal) ·{" "}
        <span className="badge muted">exercise</span> /{" "}
        <span className="badge sell">sell</span> = routine (lower signal)
      </div>

      {error && <div className="error-box">{error}</div>}

      {loading ? (
        <div className="empty">
          <span className="spinner" /> Loading insider flow…
        </div>
      ) : trades.length === 0 ? (
        <div className="empty">
          {viewingTicker
            ? `No recent insider transactions for ${scope}.`
            : "No recent insider transactions on your watchlist tickers."}
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
          <table className="feed">
            <thead>
              <tr>
                <th>Type</th>
                <th>Ticker</th>
                <th>Insider</th>
                <th className="hide-mobile">Shares</th>
                <th className="hide-mobile">Price</th>
                <th>Value</th>
                <th>Filed</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className={t.isOpenMarketBuy ? "signal-strong" : "signal-weak"}>
                  <td>
                    <TypeBadge trade={t} />
                  </td>
                  <td className="ticker">{t.ticker}</td>
                  <td className="small">{t.name}</td>
                  <td className="hide-mobile mono">{t.shares?.toLocaleString() ?? "—"}</td>
                  <td className="hide-mobile mono">{fmtPrice(t.price)}</td>
                  <td className="mono">{fmtValue(t.value)}</td>
                  <td className="small muted">{t.filingDate?.slice(0, 10) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
