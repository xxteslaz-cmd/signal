import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshTicker } from "@/lib/recommendations";
import { normalizeTicker } from "@/lib/tickers";
import { clampRiskTolerance } from "@/lib/risk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Short-term cache: if a recommendation for the same ticker AND the same risk
// tolerance was generated within this window, return it instead of burning a
// fresh Finnhub + Claude call. Risk tolerance is part of the key because it is
// injected into the Claude prompt and changes the output — two different risk
// settings must never share a cached result.
const CACHE_WINDOW_MINUTES = 15;

// POST /api/recommendations/:ticker — refresh a single ticker's recommendation.
// Optional body: { riskTolerance?: number } (0-100, defaults to moderate).
// Responses carry `cached: true` when served from the cache window.
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

  // --- Cache check (before any Finnhub/Claude work) ---
  const cutoff = new Date(Date.now() - CACHE_WINDOW_MINUTES * 60 * 1000);
  const recent = await prisma.recommendation.findFirst({
    where: {
      ticker,
      riskTolerance, // exact match; old rows with null riskTolerance never match
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: "desc" },
  });

  if (recent) {
    return NextResponse.json({
      ticker,
      ok: true,
      cached: true,
      recommendation: recent.recommendation,
      confidence: recent.confidence,
      reasoning: recent.reasoning,
      keyRisks: recent.keyRisks,
      priceAtRec: recent.priceAtRec,
      createdAt: recent.createdAt.toISOString(),
    });
  }

  // --- Cache miss: normal flow (generates, stores, flip-detects) ---
  const result = await refreshTicker(ticker, riskTolerance);
  return NextResponse.json(
    { ...result, cached: false },
    { status: result.ok ? 200 : 502 }
  );
}
