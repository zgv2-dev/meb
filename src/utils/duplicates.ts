// Pure module: imported by the dashboard island, so it must not touch KV or Deno APIs
import type { Track } from "../db/types.ts";

export const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Groups tracks posted more than once to the same channel: same artist + title, or the same file. */
export function findDuplicateGroups(tracks: Track[]): Track[][] {
  const groups = new Map<string, Track[]>();
  for (const t of tracks) {
    const name = t.artist && t.title
      ? `${normalize(t.artist)}|${normalize(t.title)}`
      : `file:${t.fileUniqueId ?? t.id}`;
    const key = `${t.channelId}|${name}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}
