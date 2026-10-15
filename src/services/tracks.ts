import type { AudioQueueItem, Track } from "../db/types.ts";
import { getChannel, saveTrack } from "../db/kv.ts";
import { buildPostUrl } from "../utils/links.ts";
import { normalize } from "../utils/duplicates.ts";

interface TrackMetadata {
  album: string;
  year: number | null;
  coverUrl: string | null;
}

/**
 * Saves a published audio post to the dashboard library.
 * Telegram audio carries only title/performer, so album, year and artwork come from Deezer's public API.
 */
export async function recordTrack(item: AudioQueueItem, postId: number): Promise<Track> {
  const channel = await getChannel(item.channelId);
  const title = item.title?.trim() ?? "";
  const artist = item.performer?.trim() ?? "";
  const meta = item.isVoice ? null : await lookupMetadata(artist, title);

  const track: Track = {
    id: item.id,
    userId: item.userId,
    channelId: item.channelId,
    channelTitle: channel?.title ?? String(item.channelId),
    postId,
    postUrl: buildPostUrl(item.channelId, channel?.username, postId),
    fileUniqueId: item.fileUniqueId,
    title,
    artist,
    album: meta?.album ?? "",
    year: meta?.year ?? null,
    coverUrl: meta?.coverUrl ?? null,
    thumbFileId: item.thumbFileId,
    duration: item.duration,
    isVoice: item.isVoice,
    createdAt: Date.now(),
  };
  await saveTrack(track);
  return track;
}

async function lookupMetadata(artist: string, title: string): Promise<TrackMetadata | null> {
  if (!artist || !title) return null;
  try {
    // Deezer's advanced `artist:"…"` syntax returns nothing, so search plainly and check the artist
    const search = await getJson(`https://api.deezer.com/search?limit=5&q=${encodeURIComponent(`${artist} ${title}`)}`);
    const wanted = normalize(artist);
    // deno-lint-ignore no-explicit-any
    const hit = search?.data?.find((h: any) => {
      const name = normalize(h.artist?.name ?? "");
      return name && (wanted.includes(name) || name.includes(wanted));
    });
    if (!hit?.album) return null;
    // Search results lack the release date; the album endpoint has it
    const album = await getJson(`https://api.deezer.com/album/${hit.album.id}`).catch(() => null);
    return {
      album: hit.album.title ?? "",
      year: Number(String(album?.release_date ?? "").slice(0, 4)) || null,
      coverUrl: hit.album.cover_xl ?? null,
    };
  } catch (err) {
    console.warn(`[Tracks] Metadata lookup failed for "${artist} - ${title}":`, err);
    return null;
  }
}

// deno-lint-ignore no-explicit-any
async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return await res.json();
}
