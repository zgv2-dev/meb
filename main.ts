import { webhookCallback } from "grammy";
import { createBot } from "./src/bot.ts";
import { config } from "./src/config.ts";
import { redactBotTokenInLogs } from "./src/utils/logging.ts";

redactBotTokenInLogs();

const bot = createBot();

// Determine execution mode
const isWebhookMode = config.isDenoDeploy || !!config.publicDomain || !!config.webhookUrl;

if (isWebhookMode) {
  console.log(`Starting HTTP server on port ${config.port}...`);

  const handleUpdate = webhookCallback(bot, "std/http", {
    secretToken: config.webhookSecret || undefined,
    // Audio updates publish inline (see src/queue/queue.ts); never let grammY cut them short.
    // "return" acks the update instead of failing it, so Telegram does not redeliver and double-post.
    timeoutMilliseconds: config.updateBudgetMs + 10_000,
    onTimeout: "return",
  });

  const webhookUrl = config.webhookUrl;

  // The webhook itself is registered once per deploy by scripts/set_webhook.ts (pre-deploy command)

  Deno.serve({ port: config.port }, async (req: Request) => {
    const url = new URL(req.url);

    // GET / -> Root endpoint
    if (req.method === "GET" && url.pathname === "/") {
      return new Response("hi!", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // GET /health -> Health check & queue status
    if (req.method === "GET" && url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "healthy",
          mode: "webhook",
          webhookUrl: webhookUrl.replace(config.botToken, "<BOT_TOKEN>"),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // POST /webhook or POST /
    const isWebhookPath =
      url.pathname === config.webhookPath ||
      url.pathname === "/";

    if (req.method === "POST" && isWebhookPath) {
      try {
        return await handleUpdate(req);
      } catch (err) {
        console.error("Error processing webhook update:", err);
        return new Response("Internal Server Error", { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  });
} else {
  console.log("Starting bot in Long Polling mode (Local Development)...");

  // Remove any leftover webhooks so long polling can receive updates
  try {
    await bot.api.deleteWebhook({ drop_pending_updates: false });
    console.log("Deleted existing webhook for long polling.");
  } catch (err) {
    console.warn("Could not delete webhook:", err);
  }

  bot.start({
    onStart: (botInfo) => {
      console.log(`🚀 Bot is live and listening as @${botInfo.username}`);
    },
  });
}
