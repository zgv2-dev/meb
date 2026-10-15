// Registers the Telegram webhook. Runs as the Deno Deploy pre-deploy command, once per
// deploy instead of on every instance start (which raced, hit 429s, and let preview
// timelines repoint the webhook). Also usable locally: deno run --env -A scripts/set_webhook.ts
import { Api } from "grammy";
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
await new Api(config.botToken).setWebhook(config.webhookUrl, {
  secret_token: config.webhookSecret || undefined,
  // One update at a time: Telegram holds the backlog while each audio publishes inline
  max_connections: 1,
  allowed_updates: ["message", "callback_query", "my_chat_member"],
});
console.log("Webhook set successfully");
