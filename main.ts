import { webhookCallback } from "grammy";
import { createBot } from "./src/bot.ts";
import { config } from "./src/config.ts";
import { audioQueue } from "./src/queue/queue.ts";

const bot = createBot();

// Determine execution mode
const isWebhookMode = config.isDenoDeploy || !!config.webhookUrl;

if (isWebhookMode) {
  console.log("Starting bot in Webhook mode (Deno Deploy / HTTP server)...");

  const handleUpdate = webhookCallback(bot, "std/http", {
    secretToken: config.webhookSecret || undefined,
  });

  // Track if webhook has been registered
  let webhookRegistered = false;

  const autoRegisterWebhook = async (originUrl?: string) => {
    if (webhookRegistered) return;
    try {
      const targetUrl = config.webhookUrl || (originUrl ? `${originUrl}/webhook` : "");
      if (targetUrl) {
        await bot.api.setWebhook(targetUrl, {
          secret_token: config.webhookSecret || undefined,
          allowed_updates: ["message", "callback_query", "my_chat_member"],
        });
        webhookRegistered = true;
        console.log(`[Webhook] Webhook successfully registered to: ${targetUrl}`);
      }
    } catch (err) {
      console.warn("[Webhook] Auto-register webhook failed (will retry on incoming request):", err);
    }
  };

  // If explicit WEBHOOK_URL is provided in environment, register immediately on startup
  if (config.webhookUrl) {
    autoRegisterWebhook();
  }

  Deno.serve({ port: config.port }, async (req: Request) => {
    const url = new URL(req.url);

    // Auto-register webhook from public server domain if not registered yet
    if (!webhookRegistered && !config.webhookUrl) {
      const detectedOrigin = url.origin;
      if (!detectedOrigin.includes("localhost") && !detectedOrigin.includes("127.0.0.1")) {
        await autoRegisterWebhook(detectedOrigin);
      }
    }

    // Health check endpoint
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return new Response(
        JSON.stringify({
          status: "healthy",
          mode: "webhook",
          webhookRegistered,
          queue: audioQueue.getStatus(),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Explicit webhook setup endpoint
    if (req.method === "GET" && url.pathname === "/setup-webhook") {
      const targetUrl = config.webhookUrl || `${url.origin}/webhook`;
      try {
        await bot.api.setWebhook(targetUrl, {
          secret_token: config.webhookSecret || undefined,
          allowed_updates: ["message", "callback_query", "my_chat_member"],
        });
        webhookRegistered = true;
        return new Response(
          JSON.stringify({ success: true, message: `Webhook set to ${targetUrl}` }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    // Handle Telegram webhook updates
    if (url.pathname === "/webhook" || url.pathname === "/") {
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
