// Configuration loaded from environment variables
export const config = {
  botToken: Deno.env.get("BOT_TOKEN") || "",
  webhookUrl: Deno.env.get("WEBHOOK_URL") || "",
  webhookSecret: Deno.env.get("WEBHOOK_SECRET") || "",
  port: Number(Deno.env.get("PORT") || "8000"),
  isDenoDeploy: !!Deno.env.get("DENO_DEPLOYMENT_ID"),
  // Delay between audio posts per channel in ms (Telegram allows ~20 msgs/min per channel = 3000ms safe interval)
  postPacingMs: Number(Deno.env.get("POST_PACING_MS") || "1500"),
  // Maximum retry attempts for rate-limited requests
  maxRetries: Number(Deno.env.get("MAX_RETRIES") || "5"),
};

export function validateConfig() {
  if (!config.botToken) {
    throw new Error("BOT_TOKEN environment variable is required.");
  }
}
