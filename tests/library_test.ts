import { assertEquals } from "@std/assert";
import type { Track } from "../src/db/types.ts";
import { albumOf, artistsOf, dateBounds, filterTracks, NO_FILTERS, sortTracks } from "../src/utils/library.ts";

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

Deno.test("artistsOf splits credited artists, keeping names with no joiner whole", () => {
  const of = (artist: string) => artistsOf(t("x", { artist }));
  assertEquals(of("Metro Boomin & Travis Scott & Kodak Black & 21 Savage"), [
    "Metro Boomin",
    "Travis Scott",
    "Kodak Black",
    "21 Savage",
  ]);
  assertEquals(of("Metro Boomin, Gunna feat. Young Thug"), ["Metro Boomin", "Gunna", "Young Thug"]);
  assertEquals(of("Skrillex x Fred again.. ft. Flowdan"), ["Skrillex", "Fred again..", "Flowdan"]);
  assertEquals(of("AC/DC"), ["AC/DC"]);
  assertEquals(of("Malcolm X"), ["Malcolm X"]);
  assertEquals(of("Gunna & Gunna"), ["Gunna"]);
  assertEquals(of(""), ["Unknown artist"]);
});

Deno.test("artist filter matches any credited artist", () => {
  const tracks = [
    t("a", { artist: "Metro Boomin & Gunna" }),
    t("b", { artist: "Gunna" }),
    t("c", { artist: "Metro Boomin & 21 Savage" }),
  ];
  assertEquals(ids(filterTracks(tracks, { ...NO_FILTERS, artist: "Gunna" }, now)), ["a", "b"]);
});

Deno.test("albumOf merges deluxe/bonus/remaster editions into the base album", () => {
  const of = (album: string) => albumOf(t("x", { album }));
  assertEquals(of("NOT ALL HEROES WEAR CAPES (Deluxe)"), "NOT ALL HEROES WEAR CAPES");
  assertEquals(of("Views [Deluxe Edition]"), "Views");
  assertEquals(of("Rumours (2011 Remaster)"), "Rumours");
  assertEquals(of("Rumours - Super Deluxe Edition"), "Rumours");
  assertEquals(of("Thriller (Deluxe) [Remastered]"), "Thriller");
  assertEquals(of("21 (Bonus Track Version)"), "21");
  // Not editions: kept as is
  assertEquals(of("(What's the Story) Morning Glory?"), "(What's the Story) Morning Glory?");
  assertEquals(of("Fearless (Taylor's Version)"), "Fearless (Taylor's Version)");
  assertEquals(of("Blonde (Live)"), "Blonde (Live)");
  assertEquals(of("(Deluxe)"), "(Deluxe)");
  assertEquals(of(""), "Unknown album");
});
