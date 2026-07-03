import { NextRequest, NextResponse } from "next/server";
import { refreshTicker } from "@/lib/recommendations";
import { normalizeTicker } from "@/lib/tickers";
import { clampRiskTolerance } from "@/lib/risk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/recommendations/:ticker — refresh a single ticker's recommendation.
// Optional body: { riskTolerance?: number } (0-100, defaults to moderate).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker: raw } = await params;
  const ticker = normalizeTicker(raw);

  let body: { riskTolerance?: number } = {};
  try {
    body = await req.json();
  } catch {
    // no body provided — fine, use the default risk tolerance
  }
  const riskTolerance = clampRiskTolerance(body.riskTolerance);

  const result = await refreshTicker(ticker, riskTolerance);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
