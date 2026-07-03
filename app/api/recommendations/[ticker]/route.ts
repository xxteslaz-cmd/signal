import { NextRequest, NextResponse } from "next/server";
import { refreshTicker } from "@/lib/recommendations";
import { normalizeTicker } from "@/lib/tickers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/recommendations/:ticker — refresh a single ticker's recommendation.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker: raw } = await params;
  const ticker = normalizeTicker(raw);
  const result = await refreshTicker(ticker);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
