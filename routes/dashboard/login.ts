import { define } from "../../utils.ts";
import { SESSION_COOKIE, SESSION_TTL_MS, signToken, verifyToken } from "../../src/dashboard/auth.ts";

// Exchanges the short-lived link token from /dashboard for a 30-day session cookie
export const handler = define.handlers({
  async GET(ctx) {
    const userId = await verifyToken(ctx.url.searchParams.get("t") ?? "");
    if (!userId) {
      return new Response("Login link expired. Send /dashboard to the bot for a new one.", {
        status: 401,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    const secure = ctx.url.protocol === "https:" ? "; Secure" : "";
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/dashboard",
        "Set-Cookie": `${SESSION_COOKIE}=${await signToken(userId, SESSION_TTL_MS)}; Path=/dashboard; ` +
          `Max-Age=${SESSION_TTL_MS / 1000}; HttpOnly; SameSite=Lax${secure}`,
      },
    });
  },
});
