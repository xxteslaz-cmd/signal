import { NextRequest, NextResponse } from "next/server";
import { getQuote, FinnhubError } from "@/lib/finnhub";
import { normalizeTicker } from "@/lib/tickers";

export const dynamic = "force-dynamic";

// GET /api/quote/:ticker — latest quote for one ticker.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker: raw } = await params;
  const ticker = normalizeTicker(raw);
  try {
    const quote = await getQuote(ticker);
    return NextResponse.json(quote);
  } catch (e) {
    const msg = e instanceof FinnhubError ? e.message : "Failed to fetch quote";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
