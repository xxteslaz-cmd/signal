import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findOpportunities, OpportunityError } from "@/lib/opportunities";
import { clampRiskTolerance } from "@/lib/risk";

export const dynamic = "force-dynamic";
// Web search + reasoning genuinely takes 1-3 minutes in practice — give it
// real headroom rather than the ~60-90s used by the lighter recommendation
// routes.
export const maxDuration = 280;

// GET /api/opportunities?riskTolerance=NN — AI-discovered trade ideas outside
// the current watchlist, tailored to the given risk tolerance via web search.
export async function GET(req: NextRequest) {
  const riskTolerance = clampRiskTolerance(
    req.nextUrl.searchParams.get("riskTolerance")
  );

  try {
    const watchlist = await prisma.watchlist.findMany();
    const excludeTickers = watchlist.map((w) => w.ticker);
    const opportunities = await findOpportunities(riskTolerance, excludeTickers);
    return NextResponse.json({ riskTolerance, opportunities });
  } catch (e) {
    const msg =
      e instanceof OpportunityError ? e.message : "Failed to find opportunities";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
