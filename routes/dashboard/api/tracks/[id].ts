import { GrammyError } from "grammy";
import { define } from "../../../../utils.ts";
import { deleteTrack, getTrack, saveTrack } from "../../../../src/db/kv.ts";

export const handler = define.handlers({
  async PATCH(ctx) {
    const track = await getTrack(ctx.state.userId, ctx.params.id);
    if (!track) return Response.json({ error: "Track not found" }, { status: 404 });

    const body = await ctx.req.json().catch(() => null);
    if (!body || typeof body !== "object") return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    for (const field of ["title", "artist", "album"] as const) {
      if (typeof body[field] === "string") track[field] = body[field].trim().slice(0, 300);
    }
    if (body.year === null || body.year === "") {
      track.year = null;
    } else if (body.year !== undefined) {
      const year = Number(body.year);
      if (!Number.isInteger(year) || year < 1 || year > 2999) {
        return Response.json({ error: "Year must be a whole number" }, { status: 400 });
      }
      track.year = year;
    }
    await saveTrack(track);
    return Response.json(track);
  },

  // ?post=1 also deletes the channel post; without it only the library entry goes
  async DELETE(ctx) {
    const track = await getTrack(ctx.state.userId, ctx.params.id);
    if (!track) return Response.json({ error: "Track not found" }, { status: 404 });

    if (ctx.url.searchParams.get("post") === "1") {
      try {
        await ctx.state.api.deleteMessage(track.channelId, track.postId);
      } catch (err) {
        // Already deleted by hand in Telegram: removing the entry is all that is left to do
        const gone = err instanceof GrammyError && /message to delete not found/i.test(err.description);
        if (!gone) {
          const reason = err instanceof GrammyError ? err.description : String(err);
          return Response.json({ error: `Telegram refused to delete the post: ${reason}` }, { status: 502 });
        }
      }
    }
    await deleteTrack(ctx.state.userId, track.id);
    return new Response(null, { status: 204 });
  },
});
