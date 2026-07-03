import { NextRequest, NextResponse } from "next/server";
import { refreshAllWatchlist } from "@/lib/recommendations";
import { getWatchlistInsiders } from "@/lib/insiders";
import { maybeAlertInsiderBuy } from "@/lib/notifications";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/cron/refresh — invoked by Vercel Cron (and manually for testing).
// 1. Refresh Claude recommendations for the whole watchlist (fires flip alerts).
// 2. Scan recent insider trades on watchlist tickers for large open-market buys.
//
// Protected by CRON_SECRET: Vercel Cron sends `Authorization: Bearer <secret>`.
// If CRON_SECRET is unset, the endpoint is open (fine for local/dev).
export async function GET(req: NextRequest) {
  if (env.cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${env.cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const recResults = await refreshAllWatchlist(env.defaultRiskTolerance);

  // Insider buy alerts on watchlist tickers.
  let insiderAlerts = 0;
  try {
    const trades = await getWatchlistInsiders();
    for (const trade of trades) {
      if (await maybeAlertInsiderBuy(trade)) insiderAlerts++;
    }
  } catch (e) {
    // Don't fail the whole cron run if the insider feed is unavailable.
    console.error("[cron] insider scan failed:", e);
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    recommendations: recResults,
    recFlipsAlerted: recResults.filter((r) => r.alerted).length,
    insiderAlerts,
  });
}
