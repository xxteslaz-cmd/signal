import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLiveQuote, FinnhubError } from "@/lib/finnhub";
import type { Quote, RecAction } from "@/lib/types";

export const dynamic = "force-dynamic";

interface LiveRow {
  ticker: string;
  quote: Quote | null;
  recommendation: RecAction | null;
  error?: string;
}

// GET /api/quotes — live quotes for every watchlist ticker, paired with the
// latest stored AI recommendation. Powers the Live Trading dashboard.
export async function GET() {
  const watchlist = await prisma.watchlist.findMany({
    orderBy: { ticker: "asc" },
  });

  const rows: LiveRow[] = await Promise.all(
    watchlist.map(async (w): Promise<LiveRow> => {
      const latest = await prisma.recommendation.findFirst({
        where: { ticker: w.ticker },
        orderBy: { createdAt: "desc" },
        select: { recommendation: true },
      });
      const recommendation = (latest?.recommendation as RecAction | undefined) ?? null;

      try {
        const quote = await getLiveQuote(w.ticker);
        return { ticker: w.ticker, quote, recommendation };
      } catch (e) {
        return {
          ticker: w.ticker,
          quote: null,
          recommendation,
          error: e instanceof FinnhubError ? e.message : "Failed to fetch quote",
        };
      }
    })
  );

  return NextResponse.json({ rows, asOf: new Date().toISOString() });
}
