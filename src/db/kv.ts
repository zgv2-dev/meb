import { DatabaseSync } from "node:sqlite";
import type { Channel, UserSettings } from "./types.ts";

let dbInstance: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (!dbInstance) {
    const dbPath = Deno.env.get("DB_PATH") || "bot.sqlite";
    dbInstance = new DatabaseSync(dbPath);

    // Initialize tables
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY,
        owner_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        username TEXT,
        description TEXT NOT NULL,
        last_post_id INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_channels_owner ON channels(owner_id);

      CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER PRIMARY KEY,
        active_channel_id INTEGER,
        awaiting_description_channel_id INTEGER,
        updated_at INTEGER NOT NULL
      );
    `);
  }
  return dbInstance;
}

export async function saveChannel(channel: Channel): Promise<void> {
  const db = getDb();
  channel.updatedAt = Date.now();

  const stmt = db.prepare(`
    INSERT INTO channels (id, owner_id, title, username, description, last_post_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      owner_id = excluded.owner_id,
      title = excluded.title,
      username = excluded.username,
      description = excluded.description,
      last_post_id = excluded.last_post_id,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    channel.id,
    channel.ownerId,
    channel.title,
    channel.username,
    channel.description,
    channel.lastPostId,
    channel.createdAt,
    channel.updatedAt,
  );
}

export async function getChannel(channelId: number): Promise<Channel | null> {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM channels WHERE id = ?");
  const row = stmt.get(channelId) as Record<string, unknown> | undefined;
  if (!row) return null;

  return {
    id: Number(row.id),
    ownerId: Number(row.owner_id),
    title: String(row.title),
    username: row.username ? String(row.username) : null,
    description: String(row.description),
    lastPostId: Number(row.last_post_id),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function getUserChannels(userId: number): Promise<Channel[]> {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM channels WHERE owner_id = ? ORDER BY created_at DESC");
  const rows = stmt.all(userId) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: Number(row.id),
    ownerId: Number(row.owner_id),
    title: String(row.title),
    username: row.username ? String(row.username) : null,
    description: String(row.description),
    lastPostId: Number(row.last_post_id),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }));
}

export async function deleteChannel(userId: number, channelId: number): Promise<void> {
  const db = getDb();
  const stmt = db.prepare("DELETE FROM channels WHERE id = ? AND owner_id = ?");
  stmt.run(channelId, userId);

  // If active channel was this channel, reset it
  const settings = await getUserSettings(userId);
  if (settings && settings.activeChannelId === channelId) {
    await setActiveChannel(userId, null);
  }
}

export async function updateChannelDescription(channelId: number, description: string): Promise<Channel | null> {
  const db = getDb();
  const now = Date.now();
  const stmt = db.prepare("UPDATE channels SET description = ?, updated_at = ? WHERE id = ?");
  stmt.run(description, now, channelId);
  return await getChannel(channelId);
}

export async function updateChannelLastPostId(channelId: number, lastPostId: number): Promise<Channel | null> {
  const db = getDb();
  const now = Date.now();
  const stmt = db.prepare("UPDATE channels SET last_post_id = ?, updated_at = ? WHERE id = ?");
  stmt.run(lastPostId, now, channelId);
  return await getChannel(channelId);
}

export async function getUserSettings(userId: number): Promise<UserSettings | null> {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM user_settings WHERE user_id = ?");
  const row = stmt.get(userId) as Record<string, unknown> | undefined;
  if (!row) return null;

  return {
    userId: Number(row.user_id),
    activeChannelId: row.active_channel_id ? Number(row.active_channel_id) : null,
    awaitingDescriptionChannelId: row.awaiting_description_channel_id ? Number(row.awaiting_description_channel_id) : null,
    updatedAt: Number(row.updated_at),
  };
}

export async function setActiveChannel(userId: number, channelId: number | null): Promise<void> {
  const db = getDb();
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO user_settings (user_id, active_channel_id, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      active_channel_id = excluded.active_channel_id,
      updated_at = excluded.updated_at
  `);
  stmt.run(userId, channelId, now);
}

export async function setAwaitingDescription(userId: number, channelId: number | null): Promise<void> {
  const db = getDb();
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO user_settings (user_id, awaiting_description_channel_id, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      awaiting_description_channel_id = excluded.awaiting_description_channel_id,
      updated_at = excluded.updated_at
  `);
  stmt.run(userId, channelId, now);
}

export async function getActiveChannelForUser(userId: number): Promise<Channel | null> {
  const settings = await getUserSettings(userId);
  if (!settings || !settings.activeChannelId) return null;
  return await getChannel(settings.activeChannelId);
}
