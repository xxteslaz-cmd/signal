import { prisma } from "@/lib/prisma";
import { getTickerSnapshot } from "@/lib/finnhub";
import { getRecommendation } from "@/lib/claude";
import { maybeAlertRecFlip } from "@/lib/notifications";
import type { RecAction } from "@/lib/types";

export interface RefreshResult {
  ticker: string;
  ok: boolean;
  recommendation?: RecAction;
  flippedFrom?: RecAction | null;
  alerted?: boolean;
  error?: string;
}

// Generate and store a fresh recommendation for one ticker, detecting flips
// vs. the previous stored recommendation and firing an SMS alert if configured.
export async function refreshTicker(ticker: string): Promise<RefreshResult> {
  const t = ticker.toUpperCase();
  try {
    const snapshot = await getTickerSnapshot(t);
    const rec = await getRecommendation(snapshot);

    // Find the most recent prior recommendation to detect a flip.
    const prior = await prisma.recommendation.findFirst({
      where: { ticker: t },
      orderBy: { createdAt: "desc" },
    });
    const previous = (prior?.recommendation as RecAction | undefined) ?? null;

    const stored = await prisma.recommendation.create({
      data: {
        ticker: t,
        recommendation: rec.recommendation,
        confidence: rec.confidence,
        reasoning: rec.reasoning,
        keyRisks: rec.key_risks,
        priceAtRec: snapshot.quote.price ?? null,
      },
    });

    let alerted = false;
    if (previous && previous !== rec.recommendation) {
      alerted = await maybeAlertRecFlip({
        ticker: t,
        previous,
        current: rec.recommendation,
        recId: stored.id,
      });
    }

    return {
      ticker: t,
      ok: true,
      recommendation: rec.recommendation,
      flippedFrom: previous && previous !== rec.recommendation ? previous : null,
      alerted,
    };
  } catch (e) {
    return {
      ticker: t,
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

// Refresh recommendations for the entire watchlist. Runs sequentially to be
// gentle on free-tier rate limits.
export async function refreshAllWatchlist(): Promise<RefreshResult[]> {
  const watchlist = await prisma.watchlist.findMany({
    orderBy: { ticker: "asc" },
  });
  const results: RefreshResult[] = [];
  for (const item of watchlist) {
    results.push(await refreshTicker(item.ticker));
  }
  return results;
}

// Latest recommendation per ticker, for the dashboard.
export async function getLatestRecommendations() {
  const watchlist = await prisma.watchlist.findMany();
  const tickers = watchlist.map((w) => w.ticker);
  const out: Record<string, Awaited<ReturnType<typeof latestFor>>> = {};
  for (const t of tickers) {
    out[t] = await latestFor(t);
  }
  return out;
}

async function latestFor(ticker: string) {
  return prisma.recommendation.findFirst({
    where: { ticker },
    orderBy: { createdAt: "desc" },
  });
}
