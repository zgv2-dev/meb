import { define } from "../../utils.ts";
import { sessionCookie, verifyInitData, verifyToken } from "../../src/dashboard/auth.ts";

const unauthorized = (message: string) =>
  new Response(message, { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export const handler = define.handlers({
  // Login link from /dashboard (local dev, where Telegram refuses non-HTTPS Mini App URLs)
  async GET(ctx) {
    const userId = await verifyToken(ctx.url.searchParams.get("t") ?? "");
    if (!userId) return unauthorized("Login link expired. Send /dashboard to the bot for a new one.");
    return new Response(null, {
      status: 303,
      headers: { Location: "/dashboard", "Set-Cookie": await sessionCookie(userId, ctx.url.protocol === "https:") },
    });
  },

  // Mini App: routes/dashboard/app.tsx posts Telegram's signed initData
  async POST(ctx) {
    const userId = await verifyInitData(await ctx.req.text());
    if (!userId) return unauthorized("Telegram login data is invalid or expired. Reopen the dashboard from the bot.");
    return new Response(null, {
      status: 204,
      headers: { "Set-Cookie": await sessionCookie(userId, ctx.url.protocol === "https:") },
    });
  },
});
