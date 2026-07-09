import { prisma } from "@/lib/prisma";
import { getPrice } from "@/lib/finnhub";
import type { RecAction } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

// A "hold" call is correct if price stayed within this band. No existing
// threshold convention was found elsewhere in the codebase (the only other
// percent-based constant, INSIDER_BUY_ALERT_THRESHOLD, is a dollar amount for
// a different feature), so this is a fresh default — tunable if 3% turns out
// too tight or too loose once real data comes in.
export const HOLD_BAND_PERCENT = 3;

// A recommendation has exactly one outcomeCorrect field but two price
// checkpoints (7d, 30d). Rather than invent a second boolean, 30 days is
// treated as the authoritative evaluation window — long enough to smooth out
// single-day noise — and 7d is stored purely as an interim checkpoint you can
// see in the UI before the 30-day verdict lands.
export function isRecommendationCorrect(signal: RecAction, pctMove: number): boolean {
  switch (signal) {
    case "buy":
      return pctMove > 0;
    case "sell":
      return pctMove < 0;
    case "hold":
      return Math.abs(pctMove) <= HOLD_BAND_PERCENT;
  }
}

async function batchPrices(tickers: string[]): Promise<Map<string, number | null>> {
  const map = new Map<string, number | null>();
  await Promise.all(
    tickers.map(async (t) => {
      map.set(t, await getPrice(t));
    })
  );
  return map;
}

export interface EvaluationSummary {
  checkpointed7d: number;
  evaluated30d: number;
  skipped: number;
}

// Fills in priceAfter7d for calls that have hit the 7-day mark, and computes
// the final outcomeCorrect/priceAfter30d/evaluatedAt for calls that have hit
// the 30-day mark. Idempotent — safe to run more than once a day.
export async function evaluateRecommendations(): Promise<EvaluationSummary> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);

  let skipped7d = 0;
  let skipped30d = 0;

  // --- 7-day checkpoint (informational; does not set outcomeCorrect) ---
  const due7d = await prisma.recommendation.findMany({
    where: { createdAt: { lte: sevenDaysAgo }, priceAfter7d: null },
    select: { id: true, ticker: true },
  });
  const prices7d = await batchPrices([...new Set(due7d.map((r) => r.ticker))]);
  for (const r of due7d) {
    const price = prices7d.get(r.ticker);
    if (price == null) {
      skipped7d++;
      continue; // Finnhub miss — retried automatically on the next run.
    }
    await prisma.recommendation.update({
      where: { id: r.id },
      data: { priceAfter7d: price },
    });
  }

  // --- 30-day final evaluation ---
  const due30d = await prisma.recommendation.findMany({
    where: { createdAt: { lte: thirtyDaysAgo }, outcomeCorrect: null },
    select: { id: true, ticker: true, recommendation: true, priceAtRec: true },
  });
  const prices30d = await batchPrices([...new Set(due30d.map((r) => r.ticker))]);
  let evaluated30d = 0;
  for (const r of due30d) {
    const price = prices30d.get(r.ticker);
    if (price == null || r.priceAtRec == null || r.priceAtRec <= 0) {
      skipped30d++;
      continue;
    }
    const pctMove = ((price - r.priceAtRec) / r.priceAtRec) * 100;
    const correct = isRecommendationCorrect(r.recommendation as RecAction, pctMove);
    await prisma.recommendation.update({
      where: { id: r.id },
      data: {
        priceAfter30d: price,
        outcomeCorrect: correct,
        evaluatedAt: now,
      },
    });
    evaluated30d++;
  }

  return {
    checkpointed7d: due7d.length - skipped7d,
    evaluated30d,
    skipped: skipped7d + skipped30d,
  };
}
