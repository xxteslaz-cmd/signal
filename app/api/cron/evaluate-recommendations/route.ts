import { NextRequest, NextResponse } from "next/server";
import { evaluateRecommendations } from "@/lib/backtest";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// GET /api/cron/evaluate-recommendations — invoked daily by Vercel Cron (and
// manually for testing). Backfills the 7-day price checkpoint and computes
// the final 30-day outcomeCorrect verdict for recommendations that have
// reached those windows. Read-only with respect to recommendation
// generation — this only fills in evaluation columns on existing rows.
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

  const summary = await evaluateRecommendations();

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    ...summary,
  });
}
