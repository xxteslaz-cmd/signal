"use client";

import { useEffect, useState, useCallback } from "react";
import type { Recommendation } from "@/lib/types";
import { RecBadge, ConfBadge, fmtPrice } from "./RecBadges";

interface Row {
  ticker: string;
  notes: string | null;
  latest: Recommendation | null;
}

export default function WatchlistTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newTicker, setNewTicker] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/recommendations");
      if (!res.ok) throw new Error("Failed to load watchlist");
      setRows(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addTicker(e: React.FormEvent) {
    e.preventDefault();
    if (!newTicker.trim()) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: newTicker, notes: newNotes }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to add");
      setNewTicker("");
      setNewNotes("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setAdding(false);
    }
  }

  async function remove(ticker: string) {
    if (!confirm(`Remove ${ticker} from your watchlist?`)) return;
    setBusy((b) => ({ ...b, [ticker]: true }));
    try {
      await fetch(`/api/watchlist/${ticker}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy((b) => ({ ...b, [ticker]: false }));
    }
  }

  async function refreshOne(ticker: string) {
    setBusy((b) => ({ ...b, [ticker]: true }));
    setError("");
    try {
      const res = await fetch(`/api/recommendations/${ticker}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Refresh failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy((b) => ({ ...b, [ticker]: false }));
    }
  }

  async function refreshAll() {
    setRefreshingAll(true);
    setError("");
    try {
      const res = await fetch("/api/recommendations", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Refresh failed");
      const failures = (body.results ?? []).filter((r: { ok: boolean }) => !r.ok);
      if (failures.length > 0) {
        setError(
          `${failures.length} ticker(s) failed: ${failures
            .map((f: { ticker: string; error: string }) => `${f.ticker} (${f.error})`)
            .join(", ")}`
        );
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setRefreshingAll(false);
    }
  }

  return (
    <div>
      <div className="panel">
        <form onSubmit={addTicker} className="row wrap">
          <input
            type="text"
            placeholder="Ticker (e.g. AAPL)"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value)}
            style={{ maxWidth: 160, textTransform: "uppercase" }}
            aria-label="Ticker"
          />
          <input
            type="text"
            placeholder="Notes (optional)"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            style={{ flex: 1, minWidth: 160 }}
            aria-label="Notes"
          />
          <button className="btn" disabled={adding}>
            {adding ? "Adding…" : "Add"}
          </button>
        </form>
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <span className="muted small">
          {rows.length} ticker{rows.length === 1 ? "" : "s"} on watchlist
        </span>
        <div className="spacer" />
        <button className="btn secondary" onClick={refreshAll} disabled={refreshingAll || rows.length === 0}>
          {refreshingAll ? (
            <>
              <span className="spinner" /> Refreshing all…
            </>
          ) : (
            "Refresh all recommendations"
          )}
        </button>
      </div>

      {error && <div className="error-box">{error}</div>}

      {loading ? (
        <div className="empty">
          <span className="spinner" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="empty">No tickers yet. Add one above to get started.</div>
      ) : (
        <div className="grid">
          {rows.map((row) => (
            <div className="panel" key={row.ticker}>
              <div className="rec-card-head">
                <span className="ticker">{row.ticker}</span>
                {row.latest ? (
                  <>
                    <RecBadge action={row.latest.recommendation} />
                    <ConfBadge confidence={row.latest.confidence} />
                  </>
                ) : (
                  <span className="badge muted">no call yet</span>
                )}
                <div className="spacer" />
                <button
                  className="btn secondary small"
                  onClick={() => refreshOne(row.ticker)}
                  disabled={busy[row.ticker]}
                  style={{ padding: "5px 10px" }}
                >
                  {busy[row.ticker] ? <span className="spinner" /> : "↻"}
                </button>
                <button
                  className="btn danger"
                  onClick={() => remove(row.ticker)}
                  disabled={busy[row.ticker]}
                >
                  Remove
                </button>
              </div>

              {row.notes && <div className="muted small" style={{ marginBottom: 6 }}>📝 {row.notes}</div>}

              {row.latest ? (
                <div className="small">
                  <div style={{ marginBottom: 4 }}>{row.latest.reasoning}</div>
                  <div className="muted">
                    <strong>Risks:</strong> {row.latest.keyRisks}
                  </div>
                  <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                    Price at call: {fmtPrice(row.latest.priceAtRec)} ·{" "}
                    {new Date(row.latest.createdAt).toLocaleString()}
                  </div>
                </div>
              ) : (
                <div className="muted small">
                  Hit ↻ to generate a recommendation from recent data.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
