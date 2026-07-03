import Anthropic from "@anthropic-ai/sdk";
import { env, isConfigured } from "@/lib/env";
import { riskDescriptor } from "@/lib/risk";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";

export class OpportunityError extends Error {}

export type RiskFit = "low" | "medium" | "high";
export type SuggestedAction = "buy" | "watch";

export interface Opportunity {
  ticker: string;
  name: string;
  rationale: string;
  riskFit: RiskFit;
  suggestedAction: SuggestedAction;
}

function getClient(): Anthropic {
  if (!isConfigured(env.anthropicApiKey)) {
    throw new OpportunityError(
      "ANTHROPIC_API_KEY is not set. Add it to your environment to search for opportunities."
    );
  }
  return new Anthropic({ apiKey: env.anthropicApiKey });
}

const SYSTEM_PROMPT = `You are a market opportunity scout for a personal stock watchlist tool. Given an investor's risk tolerance and their current watchlist, use web search to find current, timely trade ideas in individual US-listed common stocks they are not already tracking.

Only suggest real, liquid, tradable common stock tickers — no cryptocurrencies, no OTC or penny stocks under $1, no options or other derivatives. Ground every suggestion in what you actually find via search (recent news, momentum, analyst commentary, sector trends) — do not invent facts.

This is informational only — never phrase suggestions as financial advice, and never assume the reader will execute automatically.`;

function buildUserContent(riskTolerance: number, excludeTickers: string[]): string {
  const lines: string[] = [];
  lines.push(
    `Investor risk tolerance: ${riskDescriptor(riskTolerance)} (${riskTolerance}/100 on a low-to-high risk scale).`
  );
  lines.push(
    `Tickers already on their watchlist — do not suggest any of these: ${
      excludeTickers.length ? excludeTickers.join(", ") : "(none)"
    }.`
  );
  lines.push("");
  lines.push(
    "Search the web for 4-6 current trade opportunities that fit this risk profile. Prefer ideas grounded in recent (last few days to weeks) news, price action, or analyst commentary."
  );
  lines.push("");
  lines.push(
    "After your research, end your response with ONLY a fenced json code block (nothing after it) containing a JSON array of objects, each with exactly these fields:"
  );
  lines.push(`  ticker: string (stock symbol)`);
  lines.push(`  name: string (company name)`);
  lines.push(`  rationale: string (1-2 sentences, grounded in what you found)`);
  lines.push(`  riskFit: "low" | "medium" | "high" (how well it matches the stated risk tolerance)`);
  lines.push(`  suggestedAction: "buy" | "watch"`);
  return lines.join("\n");
}

function extractJsonBlock(text: string): unknown {
  const match = text.match(/```json\s*([\s\S]*?)```/i) ?? text.match(/```\s*([\s\S]*?)```/);
  if (!match) {
    throw new OpportunityError("Claude did not return a parseable suggestion list.");
  }
  try {
    return JSON.parse(match[1]);
  } catch {
    throw new OpportunityError("Failed to parse suggestion JSON.");
  }
}

function isValidRiskFit(v: unknown): v is RiskFit {
  return v === "low" || v === "medium" || v === "high";
}

function isValidAction(v: unknown): v is SuggestedAction {
  return v === "buy" || v === "watch";
}

export async function findOpportunities(
  riskTolerance: number,
  excludeTickers: string[]
): Promise<Opportunity[]> {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    tools: [{ type: "web_search_20260209", name: "web_search" }],
    messages: [
      { role: "user", content: buildUserContent(riskTolerance, excludeTickers) },
    ],
  });

  let text = "";
  for (const block of response.content) {
    if (block.type === "text") text += block.text + "\n";
  }
  if (!text.trim()) {
    throw new OpportunityError("Claude returned no text content.");
  }

  const parsed = extractJsonBlock(text);
  if (!Array.isArray(parsed)) {
    throw new OpportunityError("Suggestion list was not an array.");
  }

  const excludeSet = new Set(excludeTickers.map((t) => t.toUpperCase()));
  const results: Opportunity[] = [];
  for (const item of parsed) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as Record<string, unknown>).ticker === "string" &&
      typeof (item as Record<string, unknown>).name === "string" &&
      typeof (item as Record<string, unknown>).rationale === "string" &&
      isValidRiskFit((item as Record<string, unknown>).riskFit) &&
      isValidAction((item as Record<string, unknown>).suggestedAction)
    ) {
      const rec = item as Record<string, unknown>;
      const ticker = (rec.ticker as string).toUpperCase().trim();
      if (ticker && !excludeSet.has(ticker)) {
        results.push({
          ticker,
          name: rec.name as string,
          rationale: rec.rationale as string,
          riskFit: rec.riskFit as RiskFit,
          suggestedAction: rec.suggestedAction as SuggestedAction,
        });
      }
    }
  }

  return results;
}
