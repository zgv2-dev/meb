import { App, staticFiles } from "fresh";
import { type Bot, webhookCallback } from "grammy";
import { createBot } from "./src/bot.ts";
import { config } from "./src/config.ts";
import { redactBotTokenInLogs } from "./src/utils/logging.ts";
import type { State } from "./utils.ts";

redactBotTokenInLogs();

const bot = createBot();

// Determine execution mode
const isWebhookMode = config.isDenoDeploy || !!config.publicDomain || !!config.webhookUrl;

const webhookUrl = config.webhookUrl;

// The webhook itself is registered once per deploy by scripts/set_webhook.ts (pre-deploy command)

// Served by `deno task start` (deno serve _fresh/server.js) or `deno task dev` (Vite)
export const app = new App<State>()
  .use(staticFiles())
  .use((ctx) => {
    ctx.state.api = bot.api;
    return ctx.next();
  })
  // GET / -> Root endpoint
  .get("/", () =>
    new Response("hi!", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    }))
  // GET /health -> Health check & queue status
  .get("/health", () =>
    Response.json({
      status: "healthy",
      mode: isWebhookMode ? "webhook" : "polling",
      webhookUrl: webhookUrl.replace(config.botToken, "<BOT_TOKEN>"),
    }));

if (isWebhookMode) {
  const handleUpdate = webhookCallback(bot, "std/http", {
    secretToken: config.webhookSecret || undefined,
    // Audio updates publish inline (see src/queue/queue.ts); never let grammY cut them short.
    // "return" acks the update instead of failing it, so Telegram does not redeliver and double-post.
    timeoutMilliseconds: config.updateBudgetMs + 10_000,
    onTimeout: "return",
  });

  // POST /webhook or POST /
  const onUpdate = async ({ req }: { req: Request }) => {
    try {
      return await handleUpdate(req);
    } catch (err) {
      console.error("Error processing webhook update:", err);
      return new Response("Internal Server Error", { status: 500 });
    }
  };
  app.post(config.webhookPath, onUpdate).post("/", onUpdate);
}

// File-system routes: the /dashboard music library
app.fsRoutes();

if (!isWebhookMode) {
  console.log("Starting bot in Long Polling mode (Local Development)...");

  // Vite dev re-evaluates this module on edits; stop the previous poller so only one calls getUpdates
  const globals = globalThis as { pollingBot?: Bot };
  await globals.pollingBot?.stop();
  globals.pollingBot = bot;

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
