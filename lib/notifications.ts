import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/twilio";
import { env } from "@/lib/env";
import type { InsiderTrade, RecAction } from "@/lib/types";

// Send an SMS at most once per unique event. Returns true if a new SMS was
// sent, false if it was a duplicate or SMS is unconfigured.
async function notifyOnce(opts: {
  eventKey: string;
  eventType: "insider_buy" | "rec_flip";
  ticker: string;
  message: string;
}): Promise<boolean> {
  const existing = await prisma.notificationLog.findUnique({
    where: { eventKey: opts.eventKey },
  });
  if (existing) return false;

  const sent = await sendSms(opts.message);
  if (!sent) return false;

  // Only log once we've actually sent, so an unconfigured/failed send can be
  // retried later.
  await prisma.notificationLog.create({
    data: {
      eventKey: opts.eventKey,
      eventType: opts.eventType,
      ticker: opts.ticker,
      message: opts.message,
    },
  });
  return true;
}

function fmtUsd(n: number | null): string {
  if (n === null) return "$?";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// Alert on a large open-market insider BUY on a watchlist ticker.
export async function maybeAlertInsiderBuy(trade: InsiderTrade): Promise<boolean> {
  if (!trade.isOpenMarketBuy) return false;
  if ((trade.value ?? 0) < env.insiderBuyAlertThreshold) return false;

  const eventKey = `insider_buy:${trade.id}`;
  const message = `${trade.ticker} insider buy: ${trade.name} bought ${fmtUsd(
    trade.value
  )} (filed ${trade.filingDate})`;

  return notifyOnce({
    eventKey,
    eventType: "insider_buy",
    ticker: trade.ticker,
    message,
  });
}

// Alert when a recommendation flips direction (e.g. hold -> buy, buy -> sell).
export async function maybeAlertRecFlip(opts: {
  ticker: string;
  previous: RecAction | null;
  current: RecAction;
  recId: number;
}): Promise<boolean> {
  if (!opts.previous || opts.previous === opts.current) return false;

  const eventKey = `rec_flip:${opts.ticker}:${opts.previous}->${opts.current}:${opts.recId}`;
  const message = `${opts.ticker} recommendation flipped: ${opts.previous.toUpperCase()} → ${opts.current.toUpperCase()}`;

  return notifyOnce({
    eventKey,
    eventType: "rec_flip",
    ticker: opts.ticker,
    message,
  });
}
