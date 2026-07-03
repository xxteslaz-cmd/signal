import Anthropic from "@anthropic-ai/sdk";
import { env, isConfigured } from "@/lib/env";
import type { TickerSnapshot } from "@/lib/finnhub";
import type { RecAction, Confidence } from "@/lib/types";

// Default to Anthropic's most capable model; override with CLAUDE_MODEL (e.g.
// claude-sonnet-5) if you want to trade some quality for lower cost on daily
// batch runs.
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";

export class ClaudeError extends Error {}

export interface RecResult {
  ticker: string;
  recommendation: RecAction;
  confidence: Confidence;
  reasoning: string;
  key_risks: string;
}

// JSON schema constraining the model to exactly the shape we store.
const REC_SCHEMA = {
  type: "object",
  properties: {
    ticker: { type: "string" },
    recommendation: { type: "string", enum: ["buy", "hold", "sell"] },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    reasoning: { type: "string", description: "2-3 sentence explanation" },
    key_risks: { type: "string", description: "1-2 sentence explanation" },
  },
  required: ["ticker", "recommendation", "confidence", "reasoning", "key_risks"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are a disciplined equity analyst producing structured, single-stock recommendations for a personal watchlist tool.

You receive a snapshot of recent market data, fundamentals, and news headlines for one ticker. Weigh valuation, momentum, fundamental health, and the tone of recent news. Be decisive but calibrated: reserve "high" confidence for cases where the data strongly aligns, and lean on "hold" when the picture is genuinely mixed.

This is informational only — never phrase output as financial advice, and never assume the reader will execute automatically. Base every judgment strictly on the data provided; do not invent figures. Keep reasoning to 2-3 sentences and key_risks to 1-2 sentences.`;

function getClient(): Anthropic {
  if (!isConfigured(env.anthropicApiKey)) {
    throw new ClaudeError(
      "ANTHROPIC_API_KEY is not set. Add it to your environment to generate recommendations."
    );
  }
  return new Anthropic({ apiKey: env.anthropicApiKey });
}

function buildUserContent(snapshot: TickerSnapshot): string {
  const { ticker, quote, profile, keyMetrics, news } = snapshot;
  const lines: string[] = [];
  lines.push(`Ticker: ${ticker}`);
  if (profile.name) lines.push(`Company: ${profile.name}`);
  if (profile.finnhubIndustry) lines.push(`Industry: ${profile.finnhubIndustry}`);
  if (profile.marketCapitalization)
    lines.push(`Market cap (M): ${profile.marketCapitalization.toFixed(0)}`);
  lines.push("");
  lines.push("Latest quote:");
  lines.push(`  Price: ${quote.price ?? "n/a"}`);
  lines.push(`  Day change %: ${quote.changePercent ?? "n/a"}`);
  lines.push(`  Day high/low: ${quote.high ?? "n/a"} / ${quote.low ?? "n/a"}`);
  lines.push(`  Prev close: ${quote.prevClose ?? "n/a"}`);
  lines.push("");
  lines.push("Key fundamentals:");
  const metricEntries = Object.entries(keyMetrics);
  if (metricEntries.length === 0) {
    lines.push("  (none available)");
  } else {
    for (const [k, v] of metricEntries) {
      lines.push(`  ${k}: ${v ?? "n/a"}`);
    }
  }
  lines.push("");
  lines.push("Recent news headlines:");
  if (news.length === 0) {
    lines.push("  (none available)");
  } else {
    for (const n of news) {
      lines.push(`  [${n.datetime}] ${n.headline}`);
      if (n.summary) lines.push(`      ${n.summary}`);
    }
  }
  lines.push("");
  lines.push(
    "Produce a recommendation for this ticker as structured JSON matching the required schema."
  );
  return lines.join("\n");
}

export async function getRecommendation(
  snapshot: TickerSnapshot
): Promise<RecResult> {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: REC_SCHEMA } },
    messages: [{ role: "user", content: buildUserContent(snapshot) }],
  });

  // With output_config.format the model returns a single text block of JSON.
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new ClaudeError("Claude returned no text content.");
  }

  let parsed: RecResult;
  try {
    parsed = JSON.parse(textBlock.text) as RecResult;
  } catch {
    throw new ClaudeError("Failed to parse Claude JSON response.");
  }

  // Normalize the ticker back to our canonical symbol regardless of what the
  // model echoed.
  parsed.ticker = snapshot.ticker;
  return parsed;
}
