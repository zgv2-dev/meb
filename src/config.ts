function resolvePublicDomain(): string {
  const raw = Deno.env.get("PUBLIC_DOMAIN") || Deno.env.get("PUBLIC_URL") || Deno.env.get("WEBHOOK_URL") || "";
  if (!raw.trim()) return "";
  let domain = raw.trim();
  if (!domain.startsWith("http://") && !domain.startsWith("https://")) {
    domain = `https://${domain}`;
  }
  return domain.replace(/\/+$/, "");
}

const botToken = Deno.env.get("BOT_TOKEN") || "";
const publicDomain = resolvePublicDomain();

// Webhook secret defaults to sha256(BOT_TOKEN): /webhook stays authenticated without
// putting the token in the URL, which Deno Deploy records in request traces.
async function deriveWebhookSecret(): Promise<string> {
  const explicit = Deno.env.get("WEBHOOK_SECRET");
  if (explicit || !botToken) return explicit || "";
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(botToken));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
const webhookSecret = await deriveWebhookSecret();

// Configuration loaded from environment variables
export const config = {
  botToken,
  publicDomain,
  webhookPath: "/webhook",
  get webhookUrl(): string {
    if (!this.publicDomain) return Deno.env.get("WEBHOOK_URL") || "";
    // If user passed a full URL with a custom path, use it, else append /webhook
    if (this.publicDomain.endsWith(`/${this.botToken}`) || this.publicDomain.endsWith("/webhook")) {
      return this.publicDomain;
    }
    return `${this.publicDomain}${this.webhookPath}`;
  },
  webhookSecret,
  port: Number(Deno.env.get("PORT") || "8000"),
  isDenoDeploy: !!Deno.env.get("DENO_DEPLOYMENT_ID"),
  // Delay between audio posts per channel in ms (Telegram allows ~20 msgs/min per channel = 3000ms safe interval)
  postPacingMs: Number(Deno.env.get("POST_PACING_MS") || "1500"),
  // Maximum retry attempts for rate-limited requests
  maxRetries: Number(Deno.env.get("MAX_RETRIES") || "5"),
  // Max time one audio update may spend publishing, retries included. Must stay below
  // Telegram's webhook timeout, or Telegram redelivers the update and the track is posted twice.
  updateBudgetMs: Number(Deno.env.get("UPDATE_BUDGET_MS") || "40000"),
};

export function validateConfig() {
  if (!config.botToken) {
    throw new Error("BOT_TOKEN environment variable is required.");
  }
}
