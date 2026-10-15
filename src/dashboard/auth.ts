import { config } from "../config.ts";

export const SESSION_COOKIE = "meb_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
const LOGIN_TTL_MS = 10 * 60_000;

const encoder = new TextEncoder();
// Prefixed so the key is never empty and differs from any other use of the token
const key = await crypto.subtle.importKey(
  "raw",
  encoder.encode(`dashboard:${config.botToken}`),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);

/** Token format: `<userId>.<expiresAtMs>.<hex HMAC of the first two parts>`. */
export async function signToken(userId: number, ttlMs: number): Promise<string> {
  const payload = `${userId}.${Date.now() + ttlMs}`;
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return `${payload}.${Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** Returns the user ID of a valid, unexpired token, else null. */
export async function verifyToken(token: string): Promise<number | null> {
  const [userId, expiresAt, sig] = token.split(".");
  if (!sig || !/^[0-9a-f]{64}$/.test(sig) || !(Number(expiresAt) > Date.now())) return null;
  const ok = await crypto.subtle.verify("HMAC", key, hexToBytes(sig), encoder.encode(`${userId}.${expiresAt}`));
  return ok ? Number(userId) : null;
}

/** Login link the bot sends in reply to /dashboard. */
export async function createLoginUrl(userId: number): Promise<string> {
  const base = config.publicDomain || `http://localhost:${config.port}`;
  return `${base}/dashboard/login?t=${await signToken(userId, LOGIN_TTL_MS)}`;
}

// Mini App initData key: HMAC-SHA256 of the bot token, keyed with "WebAppData" (core.telegram.org/bots/webapps)
const initDataKey = await crypto.subtle.importKey(
  "raw",
  await crypto.subtle.sign(
    "HMAC",
    await crypto.subtle.importKey("raw", encoder.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, [
      "sign",
    ]),
    encoder.encode(config.botToken),
  ),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);

/**
 * Returns the Telegram user ID from Mini App initData signed by Telegram for this bot, else null.
 * initData is only exchanged right after the Mini App opens, so a day is a generous age limit.
 */
export async function verifyInitData(initData: string, maxAgeMs = 24 * 60 * 60_000): Promise<number | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") ?? "";
  if (!/^[0-9a-f]{64}$/.test(hash)) return null;
  params.delete("hash");
  // Data-check-string: every other field as key=value, sorted by key, joined by line feeds
  const checkString = [...params].sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => `${k}=${v}`).join("\n");
  const ok = await crypto.subtle.verify("HMAC", initDataKey, hexToBytes(hash), encoder.encode(checkString));
  if (!ok || !(Date.now() - Number(params.get("auth_date")) * 1000 < maxAgeMs)) return null;
  try {
    const id = JSON.parse(params.get("user") ?? "").id;
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}

/** Set-Cookie value for a new 30-day dashboard session. */
export async function sessionCookie(userId: number, https: boolean): Promise<string> {
  // SameSite=None: Telegram Web runs the Mini App in a cross-site iframe, where Lax cookies are not sent.
  // Mutations stay safe because PATCH/DELETE with JSON need a CORS preflight that this app never allows.
  const sameSite = https ? "SameSite=None; Secure" : "SameSite=Lax";
  return `${SESSION_COOKIE}=${await signToken(userId, SESSION_TTL_MS)}; Path=/dashboard; ` +
    `Max-Age=${SESSION_TTL_MS / 1000}; HttpOnly; ${sameSite}`;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(hex.match(/../g)!, (h) => parseInt(h, 16));
}
