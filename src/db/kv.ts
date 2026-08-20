import type { Channel, UserSettings } from "./types.ts";

let kvInstance: Deno.Kv | null = null;

export async function getKv(): Promise<Deno.Kv> {
  if (!kvInstance) {
    kvInstance = await Deno.openKv();
  }
  return kvInstance;
}

export async function saveChannel(channel: Channel): Promise<void> {
  const kv = await getKv();
  channel.updatedAt = Date.now();
  await kv.atomic()
    .set(["channels", channel.id], channel)
    .set(["user_channels", channel.ownerId, channel.id], channel)
    .commit();
}

export async function getChannel(channelId: number): Promise<Channel | null> {
  const kv = await getKv();
  const res = await kv.get<Channel>(["channels", channelId]);
  return res.value;
}

export async function getUserChannels(userId: number): Promise<Channel[]> {
  const kv = await getKv();
  const channels: Channel[] = [];
  const entries = kv.list<Channel>({ prefix: ["user_channels", userId] });
  for await (const entry of entries) {
    if (entry.value) {
      channels.push(entry.value);
    }
  }
  return channels;
}

export async function deleteChannel(userId: number, channelId: number): Promise<void> {
  const kv = await getKv();
  await kv.atomic()
    .delete(["channels", channelId])
    .delete(["user_channels", userId, channelId])
    .commit();

  // If active channel was this channel, reset it
  const settings = await getUserSettings(userId);
  if (settings && settings.activeChannelId === channelId) {
    await setActiveChannel(userId, null);
  }
}

export async function updateChannelDescription(channelId: number, description: string): Promise<Channel | null> {
  const channel = await getChannel(channelId);
  if (!channel) return null;
  channel.description = description;
  await saveChannel(channel);
  return channel;
}

export async function updateChannelLastPostId(channelId: number, lastPostId: number): Promise<Channel | null> {
  const channel = await getChannel(channelId);
  if (!channel) return null;
  channel.lastPostId = lastPostId;
  await saveChannel(channel);
  return channel;
}

export async function getUserSettings(userId: number): Promise<UserSettings | null> {
  const kv = await getKv();
  const res = await kv.get<UserSettings>(["user_settings", userId]);
  return res.value;
}

export async function setActiveChannel(userId: number, channelId: number | null): Promise<void> {
  const kv = await getKv();
  const existing = await getUserSettings(userId);
  const settings: UserSettings = {
    userId,
    activeChannelId: channelId,
    awaitingDescriptionChannelId: existing?.awaitingDescriptionChannelId ?? null,
    updatedAt: Date.now(),
  };
  await kv.set(["user_settings", userId], settings);
}

export async function setAwaitingDescription(userId: number, channelId: number | null): Promise<void> {
  const kv = await getKv();
  const existing = await getUserSettings(userId);
  const settings: UserSettings = {
    userId,
    activeChannelId: existing?.activeChannelId ?? null,
    awaitingDescriptionChannelId: channelId,
    updatedAt: Date.now(),
  };
  await kv.set(["user_settings", userId], settings);
}

export async function getActiveChannelForUser(userId: number): Promise<Channel | null> {
  const settings = await getUserSettings(userId);
  if (!settings || !settings.activeChannelId) return null;
  return await getChannel(settings.activeChannelId);
}
