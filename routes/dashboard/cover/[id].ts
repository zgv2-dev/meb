import { define } from "../../../utils.ts";
import { config } from "../../../src/config.ts";
import { getTrack } from "../../../src/db/kv.ts";

// Proxies a track's embedded Telegram thumbnail, so the bot token never reaches the browser
export const handler = define.handlers({
  async GET(ctx) {
    const track = await getTrack(ctx.state.userId, ctx.params.id);
    if (!track?.thumbFileId) return new Response("Not Found", { status: 404 });
    const file = await ctx.state.api.getFile(track.thumbFileId);
    const res = await fetch(`https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`);
    return new Response(res.body, {
      status: res.status,
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" },
    });
  },
});
