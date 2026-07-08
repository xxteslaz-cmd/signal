import { env, isConfigured } from "@/lib/env";
import { cached, MINUTE, HOUR } from "@/lib/cache";
import type { Quote, InsiderTrade } from "@/lib/types";

const BASE = "https://finnhub.io/api/v1";

export class FinnhubError extends Error {}

function requireKey() {
  if (!isConfigured(env.finnhubApiKey)) {
    throw new FinnhubError(
      "FINNHUB_API_KEY is not set. Add it to your environment to fetch market data."
    );
  }
}

async function fhGet<T>(path: string): Promise<T> {
  requireKey();
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${sep}token=${env.finnhubApiKey}`;
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 429) {
    throw new FinnhubError("Finnhub rate limit hit. Try again shortly.");
  }
  if (!res.ok) {
    throw new FinnhubError(`Finnhub request failed (${res.status}) for ${path}`);
  }
  return (await res.json()) as T;
}

interface RawQuote {
  c: number; // current
  d: number | null; // change
  dp: number | null; // percent change
  h: number; // high
  l: number; // low
  o: number; // open
  pc: number; // prev close
}

// Latest quote. Cached ~2 min so repeated dashboard loads don't burn calls.
export async function getQuote(ticker: string): Promise<Quote> {
  return cached(`quote:${ticker}`, 2 * MINUTE, async () => {
    const q = await fhGet<RawQuote>(`/quote?symbol=${encodeURIComponent(ticker)}`);
    // Finnhub returns c=0 for unknown symbols.
    const price = q.c && q.c > 0 ? q.c : null;
    return {
      ticker,
      price,
      change: q.d,
      changePercent: q.dp,
      high: q.h || null,
      low: q.l || null,
      open: q.o || null,
      prevClose: q.pc || null,
    };
  });
}

// Live quote for the Live Trading dashboard: short 15s cache so repeated polls
// feel real-time without blowing the free-tier rate limit.
const LIVE_QUOTE_TTL = 15 * 1000;
export async function getLiveQuote(ticker: string): Promise<Quote> {
  return cached(`quote-live:${ticker}`, LIVE_QUOTE_TTL, async () => {
    const q = await fhGet<RawQuote>(`/quote?symbol=${encodeURIComponent(ticker)}`);
    const price = q.c && q.c > 0 ? q.c : null;
    return {
      ticker,
      price,
      change: q.d,
      changePercent: q.dp,
      high: q.h || null,
      low: q.l || null,
      open: q.o || null,
      prevClose: q.pc || null,
    };
  });
}

// Lightweight "just the price" helper used by history/backtest.
export async function getPrice(ticker: string): Promise<number | null> {
  try {
    const q = await getQuote(ticker);
    return q.price;
  } catch {
    return null;
  }
}

export interface CompanyProfile {
  name?: string;
  finnhubIndustry?: string;
  marketCapitalization?: number;
  exchange?: string;
  weburl?: string;
}

export async function getProfile(ticker: string): Promise<CompanyProfile> {
  return cached(`profile:${ticker}`, 12 * HOUR, () =>
    fhGet<CompanyProfile>(`/stock/profile2?symbol=${encodeURIComponent(ticker)}`)
  );
}

export interface BasicFinancials {
  metric?: Record<string, number | null>;
}

export async function getBasicFinancials(ticker: string): Promise<BasicFinancials> {
  return cached(`fin:${ticker}`, 6 * HOUR, () =>
    fhGet<BasicFinancials>(
      `/stock/metric?symbol=${encodeURIComponent(ticker)}&metric=all`
    )
  );
}

export interface NewsItem {
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number; // unix seconds
}

export async function getCompanyNews(ticker: string, days = 7): Promise<NewsItem[]> {
  return cached(`news:${ticker}:${days}`, 2 * HOUR, async () => {
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const items = await fhGet<NewsItem[]>(
      `/company-news?symbol=${encodeURIComponent(ticker)}&from=${fmt(from)}&to=${fmt(to)}`
    );
    return (items ?? []).slice(0, 8);
  });
}

// Aggregate snapshot fed to Claude for a recommendation.
export interface TickerSnapshot {
  ticker: string;
  quote: Quote;
  profile: CompanyProfile;
  keyMetrics: Record<string, number | null>;
  news: { headline: string; summary: string; datetime: string }[];
}

const INTERESTING_METRICS = [
  "peBasicExclExtraTTM",
  "peTTM",
  "psTTM",
  "pbAnnual",
  "52WeekHigh",
  "52WeekLow",
  "dividendYieldIndicatedAnnual",
  "roeTTM",
  "netProfitMarginTTM",
  "revenueGrowthTTMYoy",
  "epsGrowthTTMYoy",
  "currentRatioQuarterly",
  "totalDebt/totalEquityQuarterly",
  "beta",
];

export async function getTickerSnapshot(ticker: string): Promise<TickerSnapshot> {
  const [quote, profile, financials, news] = await Promise.all([
    getQuote(ticker),
    getProfile(ticker).catch(() => ({}) as CompanyProfile),
    getBasicFinancials(ticker).catch(() => ({}) as BasicFinancials),
    getCompanyNews(ticker).catch(() => [] as NewsItem[]),
  ]);

  const metric = financials.metric ?? {};
  const keyMetrics: Record<string, number | null> = {};
  for (const k of INTERESTING_METRICS) {
    if (metric[k] !== undefined) keyMetrics[k] = metric[k] ?? null;
  }

  return {
    ticker,
    quote,
    profile,
    keyMetrics,
    news: news.map((n) => ({
      headline: n.headline,
      summary: n.summary?.slice(0, 280) ?? "",
      datetime: new Date(n.datetime * 1000).toISOString().slice(0, 10),
    })),
  };
}

// --- Insider transactions -------------------------------------------------
// Finnhub returns SEC Form 3/4/5 insider transactions per symbol. There is no
// market-wide feed, so callers aggregate across the watchlist.

interface RawInsiderTx {
  name: string;
  share: number; // shares held after the transaction
  change: number; // shares transacted (signed: + acquired, - disposed)
  filingDate: string;
  transactionDate: string;
  transactionCode: string; // P, S, M, A, G, F, ...
  transactionPrice: number;
}

// Human-readable label + open-market-buy classification from the SEC code.
function classifyInsiderCode(code: string, change: number): {
  transactionType: string;
  isOpenMarketBuy: boolean;
} {
  switch (code.toUpperCase()) {
    case "P":
      return { transactionType: "Purchase", isOpenMarketBuy: change > 0 };
    case "S":
      return { transactionType: "Sale", isOpenMarketBuy: false };
    case "M":
      return { transactionType: "Option Exercise", isOpenMarketBuy: false };
    case "A":
      return { transactionType: "Award", isOpenMarketBuy: false };
    case "G":
      return { transactionType: "Gift", isOpenMarketBuy: false };
    case "F":
      return { transactionType: "Tax Withholding", isOpenMarketBuy: false };
    case "C":
      return { transactionType: "Conversion", isOpenMarketBuy: false };
    case "X":
      return { transactionType: "Option Exercise", isOpenMarketBuy: false };
    default:
      return {
        transactionType: code ? `Code ${code}` : "Other",
        isOpenMarketBuy: false,
      };
  }
}

// Insider transactions for one ticker, newest filing first. Cached ~3h since
// this data updates a few times a day at most.
export async function getInsiderTransactions(
  ticker: string,
  monthsBack = 6
): Promise<InsiderTrade[]> {
  const t = ticker.toUpperCase();
  return cached(`insider:${t}:${monthsBack}`, 3 * HOUR, async () => {
    const to = new Date();
    const from = new Date(to);
    from.setMonth(from.getMonth() - monthsBack);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const resp = await fhGet<{ data?: RawInsiderTx[] }>(
      `/stock/insider-transactions?symbol=${encodeURIComponent(t)}&from=${fmt(
        from
      )}&to=${fmt(to)}`
    );

    const rows = resp.data ?? [];
    return rows
      .map((r, idx): InsiderTrade => {
        const { transactionType, isOpenMarketBuy } = classifyInsiderCode(
          r.transactionCode ?? "",
          r.change ?? 0
        );
        const shares = Math.abs(r.change ?? 0) || null;
        const price = r.transactionPrice || null;
        const value = shares !== null && price !== null ? shares * price : null;
        return {
          id: `${t}-${r.name}-${r.transactionDate}-${idx}`,
          ticker: t,
          name: r.name || "Unknown",
          transactionType,
          isOpenMarketBuy,
          shares,
          price,
          value,
          filingDate: r.filingDate ?? "",
          transactionDate: r.transactionDate ?? r.filingDate ?? "",
        };
      })
      .sort((a, b) => (a.filingDate < b.filingDate ? 1 : -1));
  });
}
