import { NextRequest, NextResponse } from "next/server";
import { getInsiderTransactions, FinnhubError } from "@/lib/finnhub";
import { getWatchlistInsiders } from "@/lib/insiders";
import { isValidTicker, normalizeTicker } from "@/lib/tickers";

export const dynamic = "force-dynamic";

// GET /api/insiders            → insider trades across all watchlist tickers
// GET /api/insiders?ticker=XYZ → insider trades for a single ticker
export async function GET(req: NextRequest) {
  const rawTicker = req.nextUrl.searchParams.get("ticker");

  try {
    if (rawTicker) {
      const ticker = normalizeTicker(rawTicker);
      if (!isValidTicker(ticker)) {
        return NextResponse.json({ error: "Invalid ticker symbol" }, { status: 400 });
      }
      const trades = await getInsiderTransactions(ticker);
      return NextResponse.json({ scope: ticker, trades });
    }

    const trades = await getWatchlistInsiders();
    return NextResponse.json({ scope: "watchlist", trades: trades.slice(0, 300) });
  } catch (e) {
    const msg =
      e instanceof FinnhubError ? e.message : "Failed to fetch insider trades";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
