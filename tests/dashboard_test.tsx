import { assert, assertEquals } from "@std/assert";
import { App } from "fresh";
import { type Api, GrammyError } from "grammy";
import { getTrack, saveTrack } from "../src/db/kv.ts";
import type { Track } from "../src/db/types.ts";
import { SESSION_COOKIE, signToken, verifyToken } from "../src/dashboard/auth.ts";
import { findDuplicateGroups } from "../src/utils/duplicates.ts";
import type { State } from "../utils.ts";
import authMiddleware from "../routes/dashboard/_middleware.ts";
import { handler as loginHandler } from "../routes/dashboard/login.ts";
import { handler as trackHandler } from "../routes/dashboard/api/tracks/[id].ts";
import Library from "../islands/Library.tsx";

const userId = 424242;

function track(id: string, over: Partial<Track> = {}): Track {
  return {
    id,
    userId,
    channelId: -1001,
    channelTitle: "Ch",
    postId: 1,
    postUrl: "https://t.me/ch/1",
    title: "Song",
    artist: "Band",
    album: "",
    year: null,
    coverUrl: null,
    createdAt: Date.now(),
    ...over,
  };
}

Deno.test("dashboard tokens verify, and reject tampering and expiry", async () => {
  const token = await signToken(userId, 60_000);
  assertEquals(await verifyToken(token), userId);
  assertEquals(await verifyToken(token.replace(String(userId), "1")), null);
  assertEquals(await verifyToken(await signToken(userId, -1)), null);
  assertEquals(await verifyToken("garbage"), null);
});

Deno.test("findDuplicateGroups matches artist+title per channel, or the same file", () => {
  const groups = findDuplicateGroups([
    track("a"),
    track("b", { title: " song ", artist: "BAND" }),
    track("c", { channelId: -1002 }), // other channel: not a duplicate
    track("d", { title: "", artist: "", fileUniqueId: "f1" }),
    track("e", { title: "", artist: "", fileUniqueId: "f1" }),
    track("f", { title: "Other" }),
  ]);
  assertEquals(groups.map((g) => g.map((t) => t.id)), [["a", "b"], ["d", "e"]]);
});

Deno.test("dashboard routes require login, edit, and delete only on request", async () => {
  const deleted: number[] = [];
  const api = {
    deleteMessage: (_chat: number, postId: number) => {
      deleted.push(postId);
      // Post 6 was already deleted by hand in Telegram
      return postId === 6
        ? Promise.reject(
          new GrammyError(
            "x",
            { ok: false, error_code: 400, description: "Bad Request: message to delete not found" },
            "deleteMessage",
            {},
          ),
        )
        : Promise.resolve(true);
    },
  } as unknown as Api;
  await saveTrack(track("dash1", { postId: 5 }));
  await saveTrack(track("dash2", { postId: 6 }));

  // Same wiring as main.ts + routes/dashboard/*
  const handle = new App<State>()
    .use((ctx) => {
      ctx.state.api = api;
      return ctx.next();
    })
    .use(authMiddleware)
    .get("/dashboard/login", loginHandler.GET!)
    .patch("/dashboard/api/tracks/:id", trackHandler.PATCH!)
    .delete("/dashboard/api/tracks/:id", trackHandler.DELETE!)
    .handler();
  const base = "http://localhost/dashboard";

  assertEquals((await handle(new Request(`${base}/api/tracks/dash1`, { method: "DELETE" }))).status, 401);

  const login = await handle(new Request(`${base}/login?t=${await signToken(userId, 60_000)}`));
  assertEquals(login.status, 303);
  const cookie = login.headers.get("Set-Cookie")!.split(";")[0];
  assert(cookie.startsWith(`${SESSION_COOKIE}=`));
  const req = (path: string, init: RequestInit) =>
    handle(new Request(`${base}${path}`, { ...init, headers: { Cookie: cookie } }));

  const patched = await req("/api/tracks/dash1", { method: "PATCH", body: JSON.stringify({ album: " LP ", year: "1999" }) });
  assertEquals((await patched.json()).album, "LP");
  assertEquals((await req("/api/tracks/dash1", { method: "PATCH", body: JSON.stringify({ year: "abc" }) })).status, 400);

  assertEquals((await req("/api/tracks/dash1?post=0", { method: "DELETE" })).status, 204);
  assertEquals((await req("/api/tracks/dash2?post=1", { method: "DELETE" })).status, 204);
  assertEquals(deleted, [6]);
  assertEquals(await getTrack(userId, "dash1"), null);
  assertEquals(await getTrack(userId, "dash2"), null);
});

Deno.test("Library island renders songs and flags duplicates", async () => {
  const handle = new App<State>()
    .get("/", (ctx) => ctx.render(<Library tracks={[track("x", { album: "LP" }), track("y")]} />))
    .handler();
  const html = await (await handle(new Request("http://localhost/"))).text();
  assert(html.includes("Band · LP · Ch"));
  assert(html.includes('class="badge">1<'));
  // Sort/filter toolbar, defaulting to newest forwarded first
  assert(html.includes('<select value="forwarded" >'));
  assert(html.includes(">Newest first<"));
  assert(html.includes(">Custom range</option>"));
});
