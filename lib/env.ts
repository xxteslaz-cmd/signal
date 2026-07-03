// Centralized access to server-side environment variables. Never import this
// into a client component — these must stay server-side only.

export const env = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  finnhubApiKey: process.env.FINNHUB_API_KEY ?? "",
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
    authToken: process.env.TWILIO_AUTH_TOKEN ?? "",
    fromNumber: process.env.TWILIO_PHONE_NUMBER ?? "",
    toNumber: process.env.MY_PHONE_NUMBER ?? "",
  },
  appSecret: process.env.APP_SECRET ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",
  insiderBuyAlertThreshold: Number(
    process.env.INSIDER_BUY_ALERT_THRESHOLD ?? "50000"
  ),
  // Risk tolerance (0-100) used by the automatic cron refresh, which has no
  // slider to read from. The in-app slider overrides this for manual/on-page
  // refreshes.
  defaultRiskTolerance: Number(process.env.DEFAULT_RISK_TOLERANCE ?? "50"),
} as const;

export function isConfigured(...keys: string[]): boolean {
  return keys.every((k) => k.trim().length > 0);
}
