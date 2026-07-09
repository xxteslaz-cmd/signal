"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { Recommendation } from "@/lib/types";
import { RecBadge, ConfBadge, fmtPrice } from "./RecBadges";

interface Row {
  ticker: string;
  notes: string | null;
  latest: Recommendation | null;
}

interface Opportunity {
  ticker: string;
  name: string;
  rationale: string;
  riskFit: "low" | "medium" | "high";
  suggestedAction: "buy" | "watch";
}

// Auto-refresh a ticker in the background (no click required) if it has no
// recommendation yet, or its latest call is older than this.
const AUTO_REFRESH_STALE_MS = 6 * 60 * 60 * 1000; // 6 hours

function riskFitBadgeClass(fit: Opportunity["riskFit"]): string {
  if (fit === "low") return "buy";
  if (fit === "medium") return "hold";
  return "sell";
}

export default function WatchlistTab({ riskTolerance }: { riskTolerance: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newTicker, setNewTicker] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [oppLoading, setOppLoading] = useState(false);
  const [oppError, setOppError] = useState("");
  const [oppSearched, setOppSearched] = useState(false);

  // Tickers we've already auto-triggered a refresh for this page load, so we
  // don't retry in a loop (e.g. if Claude/Finnhub keys aren't configured).
  const autoTriedRef = useRef<Set<string>>(new Set());

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

  // Automatically fill in missing recommendations and refresh stale ones —
  // no button click required. Runs once per ticker per page load.
  useEffect(() => {
    if (rows.length === 0) return;
    const needsRefresh = rows.filter((r) => {
      if (autoTriedRef.current.has(r.ticker)) return false;
      if (!r.latest) return true;
      const age = Date.now() - new Date(r.latest.createdAt).getTime();
      return age > AUTO_REFRESH_STALE_MS;
    });
    if (needsRefresh.length === 0) return;

    needsRefresh.forEach((r) => autoTriedRef.current.add(r.ticker));

    (async () => {
      // Sequential, not parallel — gentler on Claude/Finnhub rate limits.
      for (const r of needsRefresh) {
        await refreshOne(r.ticker);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

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

  async function addTickerSilently(ticker: string) {
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Failed to add");
    setOpportunities((list) => list.filter((o) => o.ticker !== ticker));
    await load();
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

  function toggleSelect(ticker: string) {
    setSelected((s) => (s === ticker ? null : ticker));
  }

  async function refreshOne(ticker: string) {
    setBusy((b) => ({ ...b, [ticker]: true }));
    setError("");
    try {
      const res = await fetch(`/api/recommendations/${ticker}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riskTolerance }),
      });
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
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riskTolerance }),
      });
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

  async function findOpportunities() {
    setOppLoading(true);
    setOppError("");
    setOppSearched(true);
    try {
      const res = await fetch(
        `/api/opportunities?riskTolerance=${riskTolerance}`
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Search failed");
      setOpportunities(body.opportunities ?? []);
    } catch (e) {
      setOppError(e instanceof Error ? e.message : "Error");
      setOpportunities([]);
    } finally {
      setOppLoading(false);
    }
  }

  const selectedRow = selected ? rows.find((r) => r.ticker === selected) ?? null : null;

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
        <>
          <div className="ticker-grid">
            {rows.map((row) => {
              const rec = row.latest?.recommendation;
              return (
                <button
                  key={row.ticker}
                  className={`ticker-tile ${selected === row.ticker ? "selected" : ""}`}
                  data-rec={rec ?? "none"}
                  onClick={() => toggleSelect(row.ticker)}
                >
                  <div className="tile-top">
                    <span className="tile-ticker">{row.ticker}</span>
                    {row.notes && <span className="tile-note" title={row.notes}>📝</span>}
                  </div>
                  <div className="spacer" />
                  <div className="tile-foot">
                    {row.latest ? (
                      <>
                        <RecBadge action={row.latest.recommendation} />
                        <span className="tile-conf muted">{row.latest.confidence}</span>
                      </>
                    ) : busy[row.ticker] ? (
                      <span className="muted small">
                        <span className="spinner" /> …
                      </span>
                    ) : (
                      <span className="muted small">no call</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedRow && (
            <div className="panel" style={{ marginTop: 14 }}>
              <div className="rec-card-head">
                <span className="ticker">{selectedRow.ticker}</span>
                {selectedRow.latest && (
                  <>
                    <RecBadge action={selectedRow.latest.recommendation} />
                    <ConfBadge confidence={selectedRow.latest.confidence} />
                  </>
                )}
                <div className="spacer" />
                <button
                  className="btn secondary small"
                  onClick={() => refreshOne(selectedRow.ticker)}
                  disabled={busy[selectedRow.ticker]}
                  style={{ padding: "5px 10px" }}
                >
                  {busy[selectedRow.ticker] ? <span className="spinner" /> : "↻"}
                </button>
                <button
                  className="btn danger"
                  onClick={() => remove(selectedRow.ticker)}
                  disabled={busy[selectedRow.ticker]}
                >
                  Remove
                </button>
                <button
                  className="btn secondary chevron-btn"
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="rec-card-body">
                {selectedRow.notes && (
                  <div className="muted small" style={{ marginBottom: 6 }}>
                    📝 {selectedRow.notes}
                  </div>
                )}
                {selectedRow.latest ? (
                  <div className="small">
                    <div style={{ marginBottom: 4 }}>{selectedRow.latest.reasoning}</div>
                    <div className="muted">
                      <strong>Risks:</strong> {selectedRow.latest.keyRisks}
                    </div>
                    <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                      Price at call: {fmtPrice(selectedRow.latest.priceAtRec)} ·{" "}
                      {new Date(selectedRow.latest.createdAt).toLocaleString()}
                    </div>
                  </div>
                ) : (
                  <div className="muted small">
                    {busy[selectedRow.ticker] ? (
                      <>
                        <span className="spinner" /> Generating recommendation…
                      </>
                    ) : (
                      "Waiting to generate a recommendation…"
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <div className="opportunities-header">
        <h2>Suggested Opportunities</h2>
        <span className="muted small">tickers not on your watchlist, matched to your risk tolerance</span>
        <div className="spacer" />
        <button className="btn secondary" onClick={findOpportunities} disabled={oppLoading}>
          {oppLoading ? (
            <>
              <span className="spinner" /> Searching…
            </>
          ) : oppSearched ? (
            "Search again"
          ) : (
            "Find opportunities"
          )}
        </button>
      </div>

      {oppError && <div className="error-box">{oppError}</div>}

      {!oppSearched && !oppLoading && (
        <div className="empty">
          Hit &ldquo;Find opportunities&rdquo; to have Claude search the web for trade
          ideas matching your current risk tolerance.
        </div>
      )}

      {oppLoading && (
        <div className="empty">
          <span className="spinner" /> Searching the web for ideas… this can take a
          minute or two.
        </div>
      )}

      {!oppLoading && oppSearched && opportunities.length === 0 && !oppError && (
        <div className="empty">No suggestions found. Try again in a bit.</div>
      )}

      {!oppLoading && opportunities.length > 0 && (
        <div className="grid">
          {opportunities.map((o) => (
            <div className="panel opp-card" key={o.ticker}>
              <div className="rec-card-head">
                <span className="ticker">{o.ticker}</span>
                <span className="muted small">{o.name}</span>
                <div className="spacer" />
                <span className={`badge ${o.suggestedAction === "buy" ? "buy" : "muted"}`}>
                  {o.suggestedAction}
                </span>
                <span className={`badge ${riskFitBadgeClass(o.riskFit)}`}>{o.riskFit} risk</span>
              </div>
              <div className="small" style={{ marginBottom: 10 }}>
                {o.rationale}
              </div>
              <button className="btn" onClick={() => addTickerSilently(o.ticker)}>
                + Add to watchlist
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
