import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal — Watchlist & AI Recommendations",
  description: "Personal stock watchlist, AI recommendations, and insider trade alerts.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0e14",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: browser extensions (Grammarly, password
    // managers, dark-mode/translation add-ons) commonly inject attributes into
    // <html>/<body> before React hydrates, which otherwise trips a hydration
    // warning even though our own markup matches.
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
