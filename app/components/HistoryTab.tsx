"use client";

import { useEffect, useState } from "react";
import type { BacktestResponse, BacktestRow, Confidence } from "@/lib/types";
import { RecBadge, fmtPrice } from "./RecBadges";

function fmtAccuracy(pct: number | null): string {
  return pct === null ? "—" : `${pct.toFixed(0)}%`;
}

function accuracyClass(pct: number | null): string {
  if (pct === null) return "muted";
  if (pct >= 60) return "pos";
  if (pct >= 45) return "";
  return "neg";
}

// Which price to show for the "now / eval" column, and how to label it.
function evalPrice(row: BacktestRow): { value: number | null; label: string } {
  if (row.outcomeCorrect !== null && row.priceAfter30d !== null) {
    return { value: row.priceAfter30d, label: "30d" };
  }
  if (row.priceAfter7d !== null) {
    return { value: row.priceAfter7d, label: "7d" };
  }
  if (row.currentPrice !== null) {
    return { value: row.currentPrice, label: "live" };
  }
  return { value: null, label: "" };
}

function ResultBadge({ row }: { row: BacktestRow }) {
  if (row.outcomeCorrect === null) {
    return <span className="badge muted">pending</span>;
  }
  return row.outcomeCorrect ? (
    <span className="badge buy">✓ correct</span>
  ) : (
    <span className="badge sell">✗ wrong</span>
  );
}

const CONFIDENCE_ORDER: Confidence[] = ["high", "medium", "low"];

export default function HistoryTab() {
  const [data, setData] = useState<BacktestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/history");
        if (!res.ok) throw new Error("Failed to load backtest data");
        setData(await res.json());
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
        How the AI&apos;s past buy/hold/sell calls actually played out. Each call
        gets a checkpoint at 7 days and a final correct/wrong verdict at 30
        days — a &ldquo;buy&rdquo; counts as correct if price went up, a
        &ldquo;sell&rdquo; if it went down, and a &ldquo;hold&rdquo; if price
        stayed within ±3%. Verdicts land automatically once a call is 30 days
        old, so this fills in over time.
      </div>

      {error && <div className="error-box">{error}</div>}

      {loading ? (
        <div className="empty">
          <span className="spinner" /> Loading backtest data…
        </div>
      ) : !data || data.rows.length === 0 ? (
        <div className="empty">
          No recommendations yet. Generate some from the Watchlist tab.
        </div>
      ) : (
        <>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 14 }}>
            <div className="panel">
              <div className="muted small" style={{ marginBottom: 6 }}>
                Overall accuracy
              </div>
              <div
                className={`mono ${accuracyClass(data.summary.overallAccuracyPercent)}`}
                style={{ fontSize: 28, fontWeight: 700 }}
              >
                {fmtAccuracy(data.summary.overallAccuracyPercent)}
              </div>
              <div className="muted small" style={{ marginTop: 4 }}>
                {data.summary.correctCount} / {data.summary.evaluatedCount} evaluated
                {data.summary.totalRecommendations > data.summary.evaluatedCount && (
                  <> · {data.summary.totalRecommendations - data.summary.evaluatedCount} pending</>
                )}
              </div>
            </div>

            {CONFIDENCE_ORDER.map((level) => {
              const bucket = data.summary.byConfidence[level];
              return (
                <div className="panel" key={level}>
                  <div className="muted small" style={{ marginBottom: 6 }}>
                    {level} confidence
                  </div>
                  <div
                    className={`mono ${accuracyClass(bucket.accuracyPercent)}`}
                    style={{ fontSize: 28, fontWeight: 700 }}
                  >
                    {fmtAccuracy(bucket.accuracyPercent)}
                  </div>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    {bucket.correct} / {bucket.evaluated} evaluated
                  </div>
                </div>
              );
            })}
          </div>

          <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
            <table className="feed">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ticker</th>
                  <th>Call</th>
                  <th className="hide-mobile">Confidence</th>
                  <th className="hide-mobile">Price at call</th>
                  <th>Price now / eval</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const ep = evalPrice(r);
                  return (
                    <tr key={r.id}>
                      <td className="small muted">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                      <td className="ticker">{r.ticker}</td>
                      <td>
                        <RecBadge action={r.recommendation} />
                      </td>
                      <td className="hide-mobile small muted">{r.confidence}</td>
                      <td className="hide-mobile mono">{fmtPrice(r.priceAtRec)}</td>
                      <td className="mono">
                        {fmtPrice(ep.value)}
                        {ep.label && <span className="muted small"> ({ep.label})</span>}
                      </td>
                      <td>
                        <ResultBadge row={r} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
