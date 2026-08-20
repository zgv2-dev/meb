import { InlineKeyboard } from "grammy";
import type { Channel } from "../db/types.ts";
import { getUserChannels, getUserSettings, getChannel } from "../db/kv.ts";
import { buildPostUrl } from "../utils/links.ts";

export async function buildChannelsMenu(userId: number): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const channels = await getUserChannels(userId);
  const settings = await getUserSettings(userId);
  const activeId = settings?.activeChannelId;

  if (channels.length === 0) {
    const keyboard = new InlineKeyboard()
      .text("🔄 Refresh", "channel:list");

    const text = `📋 *Your Channels*\n\n` +
      `You have not added any channels yet\\.\n\n` +
      `*How to add a channel:*\n` +
      `1\\. Add this bot to your channel as an *Administrator* with post permissions\\.\n` +
      `2\\. Or forward any post from your channel to this chat\\.\n` +
      `3\\. Or run \`/addchannel <@username or ID>\`\\.`;

    return { text, keyboard };
  }

  const keyboard = new InlineKeyboard();

  for (const ch of channels) {
    const isActive = ch.id === activeId;
    const prefix = isActive ? "✅ " : "📢 ";
    keyboard.text(`${prefix}${ch.title}`, `channel:view:${ch.id}`).row();
  }

  keyboard.text("🔄 Refresh", "channel:list");

  const activeChannel = channels.find((c) => c.id === activeId);
  const activeName = activeChannel ? activeChannel.title : "None (select one below)";

  const text = `📋 *Your Managed Channels*\n\n` +
    `📌 *Active Channel:* ${escapeText(activeName)}\n\n` +
    `_Click a channel below to view details, set as active, edit description, or remove:_`;

  return { text, keyboard };
}

export async function buildChannelDetailMenu(
  userId: number,
  channelId: number,
): Promise<{ text: string; keyboard: InlineKeyboard } | null> {
  const channel = await getChannel(channelId);
  if (!channel || channel.ownerId !== userId) {
    return null;
  }

  const settings = await getUserSettings(userId);
  const isActive = settings?.activeChannelId === channel.id;

  const sampleUrl = buildPostUrl(channel.id, channel.username, channel.lastPostId > 0 ? channel.lastPostId : 1);

  const text = `📢 *Channel Details*\n\n` +
    `• *Title:* ${escapeText(channel.title)}\n` +
    `• *ID:* \`${channel.id}\`\n` +
    `• *Username:* ${channel.username ? `@${escapeText(channel.username)}` : "_Private Channel_"}\n` +
    `• *Status:* ${isActive ? "✅ *Active*" : "⚪ Inactive"}\n` +
    `• *Last Post ID:* \`${channel.lastPostId}\`\n` +
    `• *Description / Caption Text:*\n\`${escapeText(channel.description || "(No description set)")}\`\n\n` +
    `• *Caption Link Preview:*\n[${escapeText(channel.description || "Audio Post")}](${sampleUrl})\n`;

  const keyboard = new InlineKeyboard();

  if (!isActive) {
    keyboard.text("✅ Set as Active", `channel:activate:${channel.id}`).row();
  }

  keyboard
    .text("✏️ Edit Description", `channel:edit_desc:${channel.id}`)
    .text("🔢 Set Post ID", `channel:set_id:${channel.id}`)
    .row()
    .text("🗑️ Remove Channel", `channel:delete:${channel.id}`)
    .row()
    .text("« Back to Channels", "channel:list");

  return { text, keyboard };
}

function escapeText(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}
