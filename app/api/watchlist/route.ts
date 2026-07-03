import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidTicker, normalizeTicker } from "@/lib/tickers";

export const dynamic = "force-dynamic";

// GET /api/watchlist — list all watchlist tickers, newest first.
export async function GET() {
  const items = await prisma.watchlist.findMany({
    orderBy: { addedAt: "desc" },
  });
  return NextResponse.json(items);
}

// POST /api/watchlist — add a ticker { ticker, notes? }.
export async function POST(req: NextRequest) {
  let body: { ticker?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ticker = normalizeTicker(body.ticker ?? "");
  if (!ticker || !isValidTicker(ticker)) {
    return NextResponse.json({ error: "Invalid ticker symbol" }, { status: 400 });
  }

  const existing = await prisma.watchlist.findUnique({ where: { ticker } });
  if (existing) {
    return NextResponse.json({ error: `${ticker} is already on your watchlist` }, { status: 409 });
  }

  const notes = body.notes?.trim() || null;
  const item = await prisma.watchlist.create({ data: { ticker, notes } });
  return NextResponse.json(item, { status: 201 });
}
