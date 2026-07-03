import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrice } from "@/lib/finnhub";
import type { HistoryRow } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/history — every past recommendation with the price-move since it was
// made, so you can eyeball how the calls have played out (backtest).
export async function GET() {
  const recs = await prisma.recommendation.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  // Fetch current price once per unique ticker (cached in the finnhub layer).
  const tickers = [...new Set(recs.map((r) => r.ticker))];
  const priceByTicker = new Map<string, number | null>();
  await Promise.all(
    tickers.map(async (t) => {
      priceByTicker.set(t, await getPrice(t));
    })
  );

  const rows: HistoryRow[] = recs.map((r) => {
    const currentPrice = priceByTicker.get(r.ticker) ?? null;
    let priceChangePercent: number | null = null;
    if (currentPrice !== null && r.priceAtRec && r.priceAtRec > 0) {
      priceChangePercent = ((currentPrice - r.priceAtRec) / r.priceAtRec) * 100;
    }
    return {
      id: r.id,
      ticker: r.ticker,
      recommendation: r.recommendation as HistoryRow["recommendation"],
      confidence: r.confidence as HistoryRow["confidence"],
      reasoning: r.reasoning,
      keyRisks: r.keyRisks,
      priceAtRec: r.priceAtRec,
      createdAt: r.createdAt.toISOString(),
      currentPrice,
      priceChangePercent,
    };
  });

  return NextResponse.json(rows);
}
