"use client";

import { useState } from "react";
import WatchlistTab from "./WatchlistTab";
import InsidersTab from "./InsidersTab";
import HistoryTab from "./HistoryTab";

type Tab = "watchlist" | "insiders" | "history";

const TABS: { id: Tab; label: string }[] = [
  { id: "watchlist", label: "Watchlist" },
  { id: "insiders", label: "Insider Trades" },
  { id: "history", label: "History / Backtest" },
];

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("watchlist");

  return (
    <div>
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

      {tab === "watchlist" && <WatchlistTab />}
      {tab === "insiders" && <InsidersTab />}
      {tab === "history" && <HistoryTab />}
    </div>
  );
}
