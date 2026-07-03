import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeTicker } from "@/lib/tickers";

export const dynamic = "force-dynamic";

// PATCH /api/watchlist/:ticker — update notes.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker: raw } = await params;
  const ticker = normalizeTicker(raw);

  let body: { notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const updated = await prisma.watchlist.update({
      where: { ticker },
      data: { notes: body.notes?.trim() || null },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

// DELETE /api/watchlist/:ticker — remove from watchlist.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker: raw } = await params;
  const ticker = normalizeTicker(raw);

  try {
    await prisma.watchlist.delete({ where: { ticker } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
