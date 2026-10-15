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
  const sigBytes = Uint8Array.from(sig.match(/../g)!, (h) => parseInt(h, 16));
  const ok = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(`${userId}.${expiresAt}`));
  return ok ? Number(userId) : null;
}

/** Login link the bot sends in reply to /dashboard. */
export async function createLoginUrl(userId: number): Promise<string> {
  const base = config.publicDomain || `http://localhost:${config.port}`;
  return `${base}/dashboard/login?t=${await signToken(userId, LOGIN_TTL_MS)}`;
}
