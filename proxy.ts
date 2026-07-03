import { NextRequest, NextResponse } from "next/server";

// Basic single-user shared-secret gate. If APP_SECRET is unset, the gate is
// disabled entirely (fine for local use). When set, every request must carry a
// matching `signal_auth` cookie; otherwise it is redirected to /gate.
//
// NOTE: proxy (formerly middleware) runs on the Edge runtime, so we read the
// secret from the raw process env here rather than importing lib/env (which is
// fine, but kept explicit).
export function proxy(req: NextRequest) {
  const secret = process.env.APP_SECRET ?? "";
  if (!secret) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Always allow the gate page and its submit endpoint through.
  if (pathname === "/gate" || pathname === "/api/gate") {
    return NextResponse.next();
  }

  // Allow Vercel cron calls that carry the cron secret (they can't hold cookies).
  if (pathname.startsWith("/api/cron")) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("signal_auth")?.value;
  if (cookie && cookie === secret) {
    return NextResponse.next();
  }

  // API calls get a 401; page navigations get redirected to the gate.
  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/gate";
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
