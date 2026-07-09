import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrice } from "@/lib/finnhub";
import type {
  BacktestResponse,
  BacktestRow,
  BacktestSummary,
  Confidence,
  ConfidenceBucketStats,
  RecAction,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const CONFIDENCE_LEVELS: Confidence[] = ["low", "medium", "high"];

function emptyBucket(): ConfidenceBucketStats {
  return { evaluated: 0, correct: 0, accuracyPercent: null };
}

// GET /api/history — recommendation-tracking / backtest data: overall +
// per-confidence accuracy, plus every past call with its evaluation status.
export async function GET() {
  const recs = await prisma.recommendation.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  // Only fetch a live price for calls that haven't reached a 30-day verdict
  // yet — evaluated rows already have a fixed priceAfter30d checkpoint, so
  // there's no need to burn a Finnhub call refreshing something that's done.
  const unevaluated = recs.filter((r) => r.outcomeCorrect === null);
  const tickersNeedingLive = [...new Set(unevaluated.map((r) => r.ticker))];
  const livePriceByTicker = new Map<string, number | null>();
  await Promise.all(
    tickersNeedingLive.map(async (t) => {
      livePriceByTicker.set(t, await getPrice(t));
    })
  );

  const byConfidence: Record<Confidence, ConfidenceBucketStats> = {
    low: emptyBucket(),
    medium: emptyBucket(),
    high: emptyBucket(),
  };

  let evaluatedCount = 0;
  let correctCount = 0;

  const rows: BacktestRow[] = recs.map((r) => {
    const confidence = r.confidence as Confidence;
    if (r.outcomeCorrect !== null) {
      evaluatedCount++;
      const bucket = byConfidence[confidence];
      bucket.evaluated++;
      if (r.outcomeCorrect) {
        correctCount++;
        bucket.correct++;
      }
    }

    return {
      id: r.id,
      ticker: r.ticker,
      recommendation: r.recommendation as RecAction,
      confidence,
      riskTolerance: r.riskTolerance,
      createdAt: r.createdAt.toISOString(),
      priceAtRec: r.priceAtRec,
      priceAfter7d: r.priceAfter7d,
      priceAfter30d: r.priceAfter30d,
      currentPrice:
        r.outcomeCorrect === null ? livePriceByTicker.get(r.ticker) ?? null : null,
      outcomeCorrect: r.outcomeCorrect,
      evaluatedAt: r.evaluatedAt ? r.evaluatedAt.toISOString() : null,
    };
  });

  for (const level of CONFIDENCE_LEVELS) {
    const bucket = byConfidence[level];
    bucket.accuracyPercent =
      bucket.evaluated > 0 ? (bucket.correct / bucket.evaluated) * 100 : null;
  }

  const summary: BacktestSummary = {
    totalRecommendations: recs.length,
    evaluatedCount,
    correctCount,
    overallAccuracyPercent:
      evaluatedCount > 0 ? (correctCount / evaluatedCount) * 100 : null,
    byConfidence,
  };

  const body: BacktestResponse = { summary, rows };
  return NextResponse.json(body);
}
