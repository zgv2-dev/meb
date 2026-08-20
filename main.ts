import { webhookCallback } from "grammy";
import { createBot } from "./src/bot.ts";
import { config } from "./src/config.ts";
import { audioQueue } from "./src/queue/queue.ts";

const bot = createBot();

// Determine execution mode
const isWebhookMode = config.isDenoDeploy || !!config.publicDomain || !!config.webhookUrl;

if (isWebhookMode) {
  console.log(`Starting HTTP server on port ${config.port}...`);

  const handleUpdate = webhookCallback(bot, "std/http", {
    secretToken: config.webhookSecret || undefined,
  });

  const webhookUrl = config.webhookUrl;

  // Set webhook automatically on startup if public domain / webhook URL is available
  if (webhookUrl) {
    try {
      console.log(`Setting Telegram webhook to: ${webhookUrl}`);
      await bot.api.setWebhook(webhookUrl, {
        secret_token: config.webhookSecret || undefined,
        allowed_updates: ["message", "callback_query", "my_chat_member"],
      });
      console.log("Webhook set successfully");
    } catch (err) {
      console.error("Failed to set webhook on startup:", err);
    }
  }

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
          webhookUrl,
          queue: audioQueue.getStatus(),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // POST /<bot_token>, POST /webhook, or POST /
    const isWebhookPath =
      url.pathname === config.webhookPath ||
      url.pathname === `/${config.botToken}` ||
      url.pathname === "/webhook" ||
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
