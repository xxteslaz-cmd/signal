// Risk tolerance is a 0-100 slider: 0 = strongly prefer capital preservation,
// 100 = actively seek speculative, high-volatility upside. Shared between the
// client (slider UI) and server (Claude prompt) so both agree on the scale.

export const DEFAULT_RISK_TOLERANCE = 50;

export function clampRiskTolerance(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return DEFAULT_RISK_TOLERANCE;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function riskLabel(v: number): string {
  if (v < 20) return "Very conservative";
  if (v < 40) return "Conservative";
  if (v < 60) return "Balanced";
  if (v < 80) return "Growth-leaning";
  return "Aggressive";
}

// Qualitative directive fed into the Claude prompt so recommendations skew
// toward the investor's stated risk appetite.
export function riskDescriptor(v: number): string {
  if (v < 20)
    return "very risk-averse: strongly prefer capital preservation and low-volatility, blue-chip names; be quick to call hold or sell on speculative or highly volatile positions, and reserve buy for high-conviction, stable setups";
  if (v < 40)
    return "risk-averse: favor established companies with strong fundamentals and low volatility; only recommend buy on high-conviction, lower-risk setups";
  if (v < 60)
    return "moderate risk tolerance: balance growth and stability, comfortable with some volatility in pursuit of solid upside";
  if (v < 80)
    return "risk-tolerant: comfortable with above-average volatility and speculative growth names in pursuit of higher returns";
  return "highly risk-tolerant: actively seeks high-volatility, high-growth, speculative opportunities and is comfortable with a buy call even under elevated uncertainty, provided the upside case is compelling";
}
