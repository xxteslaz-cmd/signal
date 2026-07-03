"use client";

import { riskLabel } from "@/lib/risk";

const STORAGE_KEY = "signal_risk_tolerance";

export function loadRiskTolerance(): number {
  if (typeof window === "undefined") return 50;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 50;
}

export function saveRiskTolerance(v: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, String(v));
}

export default function RiskSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="panel">
      <div className="risk-slider-label">Risk Tolerance</div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="risk-slider"
        aria-label="Risk tolerance"
      />
      <div className="risk-ends">
        <span>Low risk</span>
        <span>High risk</span>
      </div>
      <div className="risk-value">
        {riskLabel(value)} <span className="muted">({value})</span>
      </div>
      <div className="muted small" style={{ marginTop: 10, textAlign: "center" }}>
        Shapes buy/hold/sell calls when a recommendation is generated.
      </div>
    </div>
  );
}
