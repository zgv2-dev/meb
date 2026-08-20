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

// Configuration loaded from environment variables
export const config = {
  botToken,
  publicDomain,
  webhookPath: botToken ? `/${botToken}` : "/webhook",
  get webhookUrl(): string {
    if (!this.publicDomain) return Deno.env.get("WEBHOOK_URL") || "";
    // If user passed a full URL with a custom path, use it, else append token path
    if (this.publicDomain.endsWith(`/${this.botToken}`) || this.publicDomain.endsWith("/webhook")) {
      return this.publicDomain;
    }
    return `${this.publicDomain}${this.webhookPath}`;
  },
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
