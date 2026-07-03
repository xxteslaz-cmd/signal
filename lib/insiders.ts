import { prisma } from "@/lib/prisma";
import { getInsiderTransactions } from "@/lib/finnhub";
import type { InsiderTrade } from "@/lib/types";

// Aggregate insider transactions across every watchlist ticker, newest filing
// first. Finnhub is per-symbol, so this fans out one request per ticker (each
// cached in the finnhub layer).
export async function getWatchlistInsiders(): Promise<InsiderTrade[]> {
  const watchlist = await prisma.watchlist.findMany();
  const perTicker = await Promise.all(
    watchlist.map((w) =>
      getInsiderTransactions(w.ticker).catch(() => [] as InsiderTrade[])
    )
  );
  return perTicker
    .flat()
    .sort((a, b) => (a.filingDate < b.filingDate ? 1 : -1));
}
