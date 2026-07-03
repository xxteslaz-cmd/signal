// Shared types used across API routes and client components.

export interface WatchlistItem {
  id: number;
  ticker: string;
  notes: string | null;
  addedAt: string;
}

export type RecAction = "buy" | "hold" | "sell";
export type Confidence = "low" | "medium" | "high";

export interface Recommendation {
  id: number;
  ticker: string;
  recommendation: RecAction;
  confidence: Confidence;
  reasoning: string;
  keyRisks: string;
  priceAtRec: number | null;
  createdAt: string;
}

export interface Quote {
  ticker: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  high: number | null;
  low: number | null;
  open: number | null;
  prevClose: number | null;
}

export interface InsiderTrade {
  id: string;
  ticker: string;
  name: string;
  transactionType: string; // Purchase | Sale | Option Exercise | ...
  isOpenMarketBuy: boolean;
  shares: number | null;
  price: number | null;
  value: number | null;
  filingDate: string;
  transactionDate: string;
}

export interface HistoryRow extends Recommendation {
  currentPrice: number | null;
  priceChangePercent: number | null;
}
