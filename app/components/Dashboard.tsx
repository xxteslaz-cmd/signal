"use client";

import { useEffect, useState } from "react";
import WatchlistTab from "./WatchlistTab";
import InsidersTab from "./InsidersTab";
import HistoryTab from "./HistoryTab";
import LiveTradingTab from "./LiveTradingTab";
import RiskSlider, { loadRiskTolerance, saveRiskTolerance } from "./RiskSlider";

type Tab = "watchlist" | "live" | "insiders" | "history";

const TABS: { id: Tab; label: string }[] = [
  { id: "watchlist", label: "Watchlist" },
  { id: "live", label: "Live Trading" },
  { id: "insiders", label: "Insider Trades" },
  { id: "history", label: "History / Backtest" },
];

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("watchlist");
  const [riskTolerance, setRiskTolerance] = useState<number>(50);

  // Load the saved risk tolerance after mount (localStorage isn't available
  // during server render).
  useEffect(() => {
    setRiskTolerance(loadRiskTolerance());
  }, []);

  function updateRisk(v: number) {
    setRiskTolerance(v);
    saveRiskTolerance(v);
  }

  return (
    <div className="app-layout">
      <aside className="risk-panel">
        <RiskSlider value={riskTolerance} onChange={updateRisk} />
      </aside>

      <div className="app-main">
        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
              role="tab"
              aria-selected={tab === t.id}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "watchlist" && <WatchlistTab riskTolerance={riskTolerance} />}
        {tab === "live" && <LiveTradingTab />}
        {tab === "insiders" && <InsidersTab />}
        {tab === "history" && <HistoryTab />}
      </div>
    </div>
  );
}
