// Pure module: sorting and filtering for the dashboard island, which runs in the browser
import type { Track } from "../db/types.ts";

export type SortKey = "forwarded" | "title" | "artist" | "album" | "year";
export type DateRange = "" | "today" | "yesterday" | "week" | "month" | "custom";

export interface Filters {
  title: string;
  artist: string;
  album: string;
  year: string;
  date: DateRange;
  // Custom range, as <input type="date"> values (YYYY-MM-DD), both inclusive
  from: string;
  to: string;
}

export const NO_FILTERS: Filters = { title: "", artist: "", album: "", year: "", date: "", from: "", to: "" };

export const artistOf = (t: Track) => t.artist || "Unknown artist";
export const albumOf = (t: Track) => t.album || "Unknown album";

/** Newest first for dates and years, A–Z for text. */
export const defaultDescending = (key: SortKey) => key === "forwarded" || key === "year";

/** [start, end) of a forwarded-date range in ms, in the viewer's local time zone. */
export function dateBounds(f: Filters, now = new Date()): [number, number] {
  // Date arithmetic instead of 24h steps keeps day boundaries right across DST changes
  const day = (offset: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset).getTime();
  const parse = (s: string, offset: number) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d + offset).getTime();
  };
  switch (f.date) {
    case "today":
      return [day(0), Infinity];
    case "yesterday":
      return [day(-1), day(0)];
    case "week":
      return [day(-7), Infinity];
    case "month":
      return [new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).getTime(), Infinity];
    case "custom":
      return [f.from ? parse(f.from, 0) : -Infinity, f.to ? parse(f.to, 1) : Infinity];
    default:
      return [-Infinity, Infinity];
  }
}

export function filterTracks(tracks: Track[], f: Filters, now = new Date()): Track[] {
  const title = f.title.trim().toLowerCase();
  const [start, end] = dateBounds(f, now);
  return tracks.filter((t) =>
    (!title || t.title.toLowerCase().includes(title)) &&
    (!f.artist || artistOf(t) === f.artist) &&
    (!f.album || albumOf(t) === f.album) &&
    (!f.year || String(t.year ?? "") === f.year) &&
    t.createdAt >= start && t.createdAt < end
  );
}

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/** Sorts a copy; tracks missing the sort value go last either way, ties go newest first. */
export function sortTracks(tracks: Track[], key: SortKey, descending: boolean): Track[] {
  const value = (t: Track): string | number | null =>
    key === "forwarded" ? t.createdAt : key === "year" ? t.year : t[key] || null;
  return [...tracks].sort((a, b) => {
    const va = value(a), vb = value(b);
    if (va === null || vb === null) return va === vb ? b.createdAt - a.createdAt : va === null ? 1 : -1;
    const c = typeof va === "number" ? va - (vb as number) : collator.compare(va, vb as string);
    return (descending ? -c : c) || b.createdAt - a.createdAt;
  });
}
