import { define } from "../../utils.ts";
import { getUserTracks } from "../../src/db/kv.ts";
import Library from "../../islands/Library.tsx";

export default define.page(async (ctx) => {
  const tracks = await getUserTracks(ctx.state.userId);
  return <Library tracks={tracks} />;
});
