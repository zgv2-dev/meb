import { assertEquals } from "@std/assert";
import type { Track } from "../src/db/types.ts";
import { dateBounds, filterTracks, NO_FILTERS, sortTracks } from "../src/utils/library.ts";

const t = (id: string, over: Partial<Track>): Track => ({
  id,
  userId: 1,
  channelId: -1,
  channelTitle: "Ch",
  postId: 1,
  postUrl: "",
  title: "",
  artist: "",
  album: "",
  year: null,
  coverUrl: null,
  createdAt: 0,
  ...over,
});

const now = new Date(2026, 9, 15, 14, 30); // Oct 15, 14:30 local
const at = (d: number, h = 12) => new Date(2026, 9, d, h).getTime();
const ids = (ts: Track[]) => ts.map((x) => x.id);

Deno.test("sortTracks: text A–Z with blanks last, year and date newest first", () => {
  const tracks = [
    t("a", { title: "beta", artist: "Zed", year: 1999, createdAt: at(1) }),
    t("b", { title: "Alpha", artist: "", year: null, createdAt: at(2) }),
    t("c", { title: "track 10", artist: "abba", year: 2020, createdAt: at(3) }),
    t("d", { title: "track 9", artist: "Abba", year: 2020, createdAt: at(4) }),
  ];
  assertEquals(ids(sortTracks(tracks, "title", false)), ["b", "a", "d", "c"]);
  assertEquals(ids(sortTracks(tracks, "artist", false)), ["d", "c", "a", "b"]);
  assertEquals(ids(sortTracks(tracks, "artist", true)), ["a", "d", "c", "b"]);
  assertEquals(ids(sortTracks(tracks, "year", true)), ["d", "c", "a", "b"]);
  assertEquals(ids(sortTracks(tracks, "forwarded", true)), ["d", "c", "b", "a"]);
});

Deno.test("dateBounds: today, yesterday, last week, last month, custom (inclusive)", () => {
  const f = (over: object) => ({ ...NO_FILTERS, ...over });
  assertEquals(dateBounds(f({ date: "today" }), now), [at(15, 0), Infinity]);
  assertEquals(dateBounds(f({ date: "yesterday" }), now), [at(14, 0), at(15, 0)]);
  assertEquals(dateBounds(f({ date: "week" }), now), [at(8, 0), Infinity]);
  assertEquals(dateBounds(f({ date: "month" }), now), [new Date(2026, 8, 15).getTime(), Infinity]);
  assertEquals(dateBounds(f({ date: "custom", from: "2026-10-03", to: "2026-10-05" }), now), [at(3, 0), at(6, 0)]);
  assertEquals(dateBounds(f({ date: "custom", from: "", to: "" }), now), [-Infinity, Infinity]);
});

Deno.test("filterTracks combines title, artist, album, year and date", () => {
  const tracks = [
    t("a", { title: "Karma Police", artist: "Radiohead", album: "OK Computer", year: 1997, createdAt: at(15, 9) }),
    t("b", { title: "Airbag", artist: "Radiohead", album: "OK Computer", year: 1997, createdAt: at(14) }),
    t("c", { title: "Song", year: null, createdAt: at(1) }),
  ];
  const run = (over: object) => ids(filterTracks(tracks, { ...NO_FILTERS, ...over }, now));
  assertEquals(run({ title: "karma" }), ["a"]);
  assertEquals(run({ artist: "Unknown artist" }), ["c"]);
  assertEquals(run({ album: "OK Computer", year: "1997" }), ["a", "b"]);
  assertEquals(run({ date: "yesterday" }), ["b"]);
  assertEquals(run({ date: "custom", from: "2026-10-01", to: "2026-10-01" }), ["c"]);
});
