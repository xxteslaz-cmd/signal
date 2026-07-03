import twilio from "twilio";
import { env, isConfigured } from "@/lib/env";

export function smsConfigured(): boolean {
  return isConfigured(
    env.twilio.accountSid,
    env.twilio.authToken,
    env.twilio.fromNumber,
    env.twilio.toNumber
  );
}

// Send an SMS to the single configured recipient. Returns false (without
// throwing) when Twilio isn't configured, so callers can no-op gracefully.
export async function sendSms(body: string): Promise<boolean> {
  if (!smsConfigured()) {
    console.warn("[twilio] not configured — skipping SMS:", body);
    return false;
  }
  const client = twilio(env.twilio.accountSid, env.twilio.authToken);
  await client.messages.create({
    body: body.slice(0, 320), // keep it short
    from: env.twilio.fromNumber,
    to: env.twilio.toNumber,
  });
  return true;
}
