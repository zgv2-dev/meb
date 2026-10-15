// Registers the Telegram webhook. Runs as the Deno Deploy pre-deploy command, once per
// deploy instead of on every instance start (which raced, hit 429s, and let preview
// timelines repoint the webhook). Also usable locally: deno run --env -A scripts/set_webhook.ts
import { config, validateConfig } from "../src/config.ts";
import { redactBotTokenInLogs } from "../src/utils/logging.ts";

redactBotTokenInLogs();

// Pre-deploy runs once per timeline (production, git-branch/*, preview/*); only production owns the bot
const timeline = Deno.env.get("DENO_TIMELINE");
if (timeline && timeline !== "production") {
  console.log(`Skipping webhook setup for timeline ${timeline}`);
  Deno.exit(0);
}

validateConfig();
if (!config.webhookUrl) {
  throw new Error("PUBLIC_DOMAIN or WEBHOOK_URL is required to set the webhook.");
}

console.log(`Setting Telegram webhook to: ${config.webhookUrl}`);
// Plain Deno fetch instead of grammY: its npm build uses node-fetch, which fails in the
// pre-deploy environment while Deno's own fetch (used for npm downloads there) works.
try {
  const res = await fetch(`https://api.telegram.org/bot${config.botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: config.webhookUrl,
      secret_token: config.webhookSecret || undefined,
      // One update at a time: Telegram holds the backlog while each audio publishes inline
      max_connections: 1,
      allowed_updates: ["message", "callback_query", "my_chat_member"],
    }),
  });
  const body = await res.json();
  if (!body.ok) throw new Error(`Telegram ${body.error_code}: ${body.description}`);
} catch (err) {
  // Logged through the redacting console: fetch errors embed the token in the URL
  console.error("Failed to set webhook:", err);
  Deno.exit(1);
}
console.log("Webhook set successfully");
