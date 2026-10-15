import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Track } from "../src/db/types.ts";
import { findDuplicateGroups } from "../src/utils/duplicates.ts";

type Tab = "songs" | "artists" | "albums" | "duplicates";
interface Filter {
  artist: string;
  album?: string;
}

const TABS: [Tab, string][] = [["songs", "Songs"], ["artists", "Artists"], ["albums", "Albums"], ["duplicates", "Duplicates"]];
const artistOf = (t: Track) => t.artist || "Unknown artist";
const albumOf = (t: Track) => t.album || "Unknown album";
const titleOf = (t: Track) => t.title || (t.isVoice ? "Voice message" : "Untitled");
const fmtTime = (s?: number) => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "";
const hasCover = (t: Track) => !!(t.coverUrl || t.thumbFileId);

function groupBy(tracks: Track[], keyFn: (t: Track) => string): [string, Track[]][] {
  const map = new Map<string, Track[]>();
  for (const t of tracks) map.set(keyFn(t), [...(map.get(keyFn(t)) ?? []), t]);
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function Cover({ track, label }: { track?: Track; label: string }) {
  const src = track?.coverUrl || (track?.thumbFileId ? `/dashboard/cover/${track.id}` : "");
  return src
    ? <img class="cover" src={src} alt="" loading="lazy" />
    : <div class="cover">{(label || "?")[0].toUpperCase()}</div>;
}

function Modal({ children, onClose }: { children: ComponentChildren; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);
  return <dialog ref={ref} onClose={onClose}>{children}</dialog>;
}

export default function Library(props: { tracks: Track[] }) {
  const [tracks, setTracks] = useState(() => [...props.tracks].sort((a, b) => b.createdAt - a.createdAt));
  const [tab, setTab] = useState<Tab>("songs");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter | null>(null);
  const [editing, setEditing] = useState<Track | null>(null);
  const [deleting, setDeleting] = useState<Track | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const duplicates = findDuplicateGroups(tracks).map((g) => [...g].sort((a, b) => a.createdAt - b.createdAt));
  const q = query.trim().toLowerCase();
  const visible = tracks.filter((t) =>
    (!q || [t.title, t.artist, t.album].some((v) => v.toLowerCase().includes(q))) &&
    (!filter || (artistOf(t) === filter.artist && (filter.album === undefined || albumOf(t) === filter.album)))
  );

  const openTab = (next: Tab, nextFilter: Filter | null = null) => {
    setTab(next);
    setFilter(nextFilter);
  };

  async function save(e: Event) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget as HTMLFormElement));
    const res = await fetch(`/dashboard/api/tracks/${editing!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return setToast((await res.json().catch(() => ({}))).error ?? "Save failed");
    const updated: Track = await res.json();
    setTracks((ts) => ts.map((t) => t.id === updated.id ? updated : t));
    setEditing(null);
  }

  async function remove(track: Track, deletePost: boolean) {
    setDeleting(null);
    const res = await fetch(`/dashboard/api/tracks/${track.id}?post=${deletePost ? 1 : 0}`, { method: "DELETE" });
    if (!res.ok) return setToast((await res.json().catch(() => ({}))).error ?? "Delete failed");
    setTracks((ts) => ts.filter((t) => t.id !== track.id));
    setToast(deletePost ? "Post deleted" : "Removed from library");
  }

  const songRow = (t: Track, note?: string) => (
    <div class="row" key={t.id}>
      <Cover track={t} label={t.title} />
      <div>
        <div>
          {titleOf(t)} {note && <span class="sub">{note}</span>}
        </div>
        <div class="sub">
          {[artistOf(t), t.album, t.year, t.channelTitle, fmtTime(t.duration)].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div class="actions">
        <a href={t.postUrl} target="_blank" rel="noopener">Open post</a>
        <button type="button" class="btn" onClick={() => setEditing(t)}>Edit</button>
        <button type="button" class="btn danger" onClick={() => setDeleting(t)}>Delete</button>
      </div>
    </div>
  );

  function view() {
    if (tab === "songs") {
      return (
        <>
          {filter && (
            <div class="chip">
              {filter.album !== undefined ? `${filter.album} — ${filter.artist}` : filter.artist}
              <button type="button" onClick={() => setFilter(null)} aria-label="Clear filter">✕</button>
            </div>
          )}
          {visible.length ? visible.map((t) => songRow(t)) : <p class="empty">No songs yet. Forward audio to the bot.</p>}
        </>
      );
    }
    if (tab === "artists") {
      const artists = groupBy(visible, artistOf);
      if (!artists.length) return <p class="empty">No artists.</p>;
      return (
        <div class="grid">
          {artists.map(([name, ts]) => (
            <button type="button" class="card round" key={name} onClick={() => openTab("songs", { artist: name })}>
              <Cover track={ts.find(hasCover)} label={name} />
              <div>{name}</div>
              <div class="sub">{ts.length} songs · {new Set(ts.map(albumOf)).size} albums</div>
            </button>
          ))}
        </div>
      );
    }
    if (tab === "albums") {
      const albums = groupBy(visible, (t) => `${albumOf(t)}\u0000${artistOf(t)}`);
      if (!albums.length) return <p class="empty">No albums.</p>;
      return (
        <div class="grid">
          {albums.map(([key, ts]) => {
            const t = ts.find(hasCover) ?? ts[0];
            const year = ts.find((x) => x.year)?.year;
            return (
              <button
                type="button"
                class="card"
                key={key}
                onClick={() => openTab("songs", { artist: artistOf(t), album: albumOf(t) })}
              >
                <Cover track={t} label={albumOf(t)} />
                <div>{albumOf(t)}</div>
                <div class="sub">{[artistOf(t), year, `${ts.length} songs`].filter(Boolean).join(" · ")}</div>
              </button>
            );
          })}
        </div>
      );
    }
    if (!duplicates.length) return <p class="empty">No duplicates found.</p>;
    return (
      <>
        <p class="sub">Tracks posted more than once to the same channel. Nothing is deleted automatically.</p>
        {duplicates.map((g) => (
          <div class="group" key={g[0].id}>
            <h2>{titleOf(g[0])} — {artistOf(g[0])} · {g.length}× in {g[0].channelTitle}</h2>
            {g.map((t, i) =>
              songRow(t, `${i === 0 ? "first posted" : "repeat"} ${new Date(t.createdAt).toLocaleString()}`)
            )}
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      <header>
        <h1>Music Library</h1>
        <nav>
          {TABS.map(([id, label]) => (
            <button type="button" key={id} aria-current={tab === id ? "page" : undefined} onClick={() => openTab(id)}>
              {label}
              {id === "duplicates" && duplicates.length > 0 && <span class="badge">{duplicates.length}</span>}
            </button>
          ))}
        </nav>
        <input
          type="search"
          placeholder="Search"
          aria-label="Search"
          value={query}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
      </header>
      <main>{view()}</main>

      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <form onSubmit={save}>
            <label>Title <input name="title" value={editing.title} /></label>
            <label>Artist <input name="artist" value={editing.artist} /></label>
            <label>Album <input name="album" value={editing.album} /></label>
            <label>Year <input name="year" inputMode="numeric" value={editing.year ?? ""} /></label>
            <menu>
              <button type="button" class="btn" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" class="btn">Save</button>
            </menu>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal onClose={() => setDeleting(null)}>
          <p><strong>Delete track?</strong></p>
          <p>{titleOf(deleting)} — {artistOf(deleting)} ({deleting.channelTitle})</p>
          <menu>
            <button type="button" class="btn" onClick={() => setDeleting(null)}>Cancel</button>
            <button
              type="button"
              class="btn"
              title="Use this if you already deleted the post in Telegram"
              onClick={() => remove(deleting, false)}
            >
              Remove from library only
            </button>
            <button type="button" class="btn danger" onClick={() => remove(deleting, true)}>Delete channel post</button>
          </menu>
        </Modal>
      )}

      {toast && <div id="toast" role="status">{toast}</div>}
    </>
  );
}
