import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshAllWatchlist } from "@/lib/recommendations";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/recommendations — latest recommendation per watchlist ticker.
export async function GET() {
  const watchlist = await prisma.watchlist.findMany({
    orderBy: { ticker: "asc" },
  });

  const results = await Promise.all(
    watchlist.map(async (w) => {
      const latest = await prisma.recommendation.findFirst({
        where: { ticker: w.ticker },
        orderBy: { createdAt: "desc" },
      });
      return { ticker: w.ticker, notes: w.notes, latest };
    })
  );

  return NextResponse.json(results);
}

// POST /api/recommendations — refresh recommendations for the whole watchlist.
export async function POST() {
  const results = await refreshAllWatchlist();
  return NextResponse.json({ results });
}
