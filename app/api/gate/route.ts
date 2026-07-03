import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  const secret = env.appSecret;
  if (!secret) {
    // Gate disabled; nothing to authenticate against.
    return NextResponse.json({ ok: true });
  }

  let body: { secret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  if (body.secret !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("signal_auth", secret, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90, // 90 days
  });
  return res;
}
