"use client";

import { useEffect, useState } from "react";
import type { HistoryRow } from "@/lib/types";
import { RecBadge, fmtPrice, fmtPct, pctClass } from "./RecBadges";

export default function HistoryTab() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/history");
        if (!res.ok) throw new Error("Failed to load history");
        setRows(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <div className="muted small" style={{ marginBottom: 12 }}>
        Every past recommendation with the price move since it was made. A buy
        that&apos;s green (or a sell that&apos;s red) aged well.
      </div>

      {error && <div className="error-box">{error}</div>}

      {loading ? (
        <div className="empty">
          <span className="spinner" /> Loading history…
        </div>
      ) : rows.length === 0 ? (
        <div className="empty">
          No recommendations yet. Generate some from the Watchlist tab.
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
          <table className="feed">
            <thead>
              <tr>
                <th>Date</th>
                <th>Ticker</th>
                <th>Call</th>
                <th className="hide-mobile">Price at call</th>
                <th className="hide-mobile">Current</th>
                <th>Move since</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="small muted">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="ticker">{r.ticker}</td>
                  <td>
                    <RecBadge action={r.recommendation} />
                  </td>
                  <td className="hide-mobile mono">{fmtPrice(r.priceAtRec)}</td>
                  <td className="hide-mobile mono">{fmtPrice(r.currentPrice)}</td>
                  <td className={`mono ${pctClass(r.priceChangePercent)}`}>
                    {fmtPct(r.priceChangePercent)}
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
