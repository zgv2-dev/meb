import { define } from "../../utils.ts";
import { SESSION_COOKIE, verifyToken } from "../../src/dashboard/auth.ts";

// Every /dashboard route except the login link needs a valid session cookie
export default define.middleware(async (ctx) => {
  if (ctx.url.pathname === "/dashboard/login") return ctx.next();
  const cookie = ctx.req.headers.get("Cookie")?.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  const userId = await verifyToken(cookie?.slice(SESSION_COOKIE.length + 1) ?? "");
  if (!userId) {
    return new Response("Not logged in. Send /dashboard to the bot for a login link.", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  ctx.state.userId = userId;
  return ctx.next();
});
