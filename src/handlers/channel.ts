import type { Bot, Context } from "grammy";
import {
  saveChannel,
  getChannel,
  getUserChannels,
  setActiveChannel,
  deleteChannel,
  setAwaitingDescription,
  getUserSettings,
  updateChannelLastPostId,
} from "../db/kv.ts";
import type { Channel } from "../db/types.ts";
import { buildChannelsMenu, buildChannelDetailMenu } from "./menus.ts";
import { escapeMarkdownV2 } from "../utils/markdown.ts";

export function registerChannelHandlers(bot: Bot) {
  // 1. Auto-detection when bot is added to a channel as administrator
  bot.on("my_chat_member", async (ctx) => {
    const update = ctx.myChatMember;
    const chat = update.chat;
    const from = update.from;
    const newMember = update.new_chat_member;

    if (chat.type !== "channel") {
      return;
    }

    if (newMember.status === "administrator") {
      const channelId = chat.id;
      const channelTitle = chat.title || "Unnamed Channel";
      const channelUsername = chat.username || null;

      const existing = await getChannel(channelId);
      const channel: Channel = {
        id: channelId,
        ownerId: from.id,
        title: channelTitle,
        username: channelUsername,
        description: existing?.description || channelTitle,
        lastPostId: existing?.lastPostId || 0,
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      await saveChannel(channel);

      // If user has no active channel, set this one
      const settings = await getUserSettings(from.id);
      if (!settings?.activeChannelId) {
        await setActiveChannel(from.id, channelId);
      }

      // Notify the user in private chat
      try {
        await ctx.api.sendMessage(
          from.id,
          `🎉 *Channel Added Automatically\\!*\n\n` +
            `• *Title:* ${escapeMarkdownV2(channelTitle)}\n` +
            `• *ID:* \`${channelId}\`\n` +
            (channelUsername ? `• *Username:* @${escapeMarkdownV2(channelUsername)}\n` : "") +
            `\nUse /channels to configure its description or switch active channels\\.`,
          { parse_mode: "MarkdownV2" },
        );
      } catch (_err) {
        // User may not have started the bot in PM yet
      }
    } else if (newMember.status === "left" || newMember.status === "kicked") {
      // Bot was removed from channel
      const existing = await getChannel(chat.id);
      if (existing) {
        await deleteChannel(existing.ownerId, chat.id);
      }
    }
  });

  // 2. Inline Keyboard Callbacks
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;

    if (data === "channel:list") {
      const { text, keyboard } = await buildChannelsMenu(userId);
      await ctx.editMessageText(text, { reply_markup: keyboard, parse_mode: "MarkdownV2" });
      await ctx.answerCallbackQuery();
      return;
    }

    if (data.startsWith("channel:view:")) {
      const channelId = Number(data.split(":")[2]);
      const detail = await buildChannelDetailMenu(userId, channelId);
      if (!detail) {
        await ctx.answerCallbackQuery({ text: "Channel not found or unauthorized.", show_alert: true });
        return;
      }
      await ctx.editMessageText(detail.text, { reply_markup: detail.keyboard, parse_mode: "MarkdownV2" });
      await ctx.answerCallbackQuery();
      return;
    }

    if (data.startsWith("channel:activate:")) {
      const channelId = Number(data.split(":")[2]);
      const channel = await getChannel(channelId);
      if (!channel || channel.ownerId !== userId) {
        await ctx.answerCallbackQuery({ text: "Channel not found.", show_alert: true });
        return;
      }

      await setActiveChannel(userId, channelId);
      await ctx.answerCallbackQuery({ text: `Active channel set to: ${channel.title}` });

      const detail = await buildChannelDetailMenu(userId, channelId);
      if (detail) {
        await ctx.editMessageText(detail.text, { reply_markup: detail.keyboard, parse_mode: "MarkdownV2" });
      }
      return;
    }

    if (data.startsWith("channel:edit_desc:")) {
      const channelId = Number(data.split(":")[2]);
      const channel = await getChannel(channelId);
      if (!channel || channel.ownerId !== userId) {
        await ctx.answerCallbackQuery({ text: "Channel not found.", show_alert: true });
        return;
      }

      await setAwaitingDescription(userId, channelId);
      await ctx.answerCallbackQuery();
      await ctx.reply(
        `✏️ *Editing Description for ${escapeMarkdownV2(channel.title)}*\n\n` +
          `Current description:\n\`${escapeMarkdownV2(channel.description || "(none)")}\`\n\n` +
          `Please reply to this message with the *new description text* \\(the text that will appear as the link\\), or send /cancel\\.`,
        { parse_mode: "MarkdownV2" },
      );
      return;
    }

    if (data.startsWith("channel:set_id:")) {
      const channelId = Number(data.split(":")[2]);
      const channel = await getChannel(channelId);
      if (!channel || channel.ownerId !== userId) {
        await ctx.answerCallbackQuery({ text: "Channel not found.", show_alert: true });
        return;
      }

      await ctx.answerCallbackQuery();
      await ctx.reply(
        `🔢 *Set Last Post ID for ${escapeMarkdownV2(channel.title)}*\n\n` +
          `Current Last Post ID: \`${channel.lastPostId}\`\n\n` +
          `To manually update it, use the command:\n\`/setpostid ${channel.id} <number>\``,
        { parse_mode: "MarkdownV2" },
      );
      return;
    }

    if (data.startsWith("channel:delete:")) {
      const channelId = Number(data.split(":")[2]);
      const channel = await getChannel(channelId);
      if (!channel || channel.ownerId !== userId) {
        await ctx.answerCallbackQuery({ text: "Channel not found.", show_alert: true });
        return;
      }

      await deleteChannel(userId, channelId);
      await ctx.answerCallbackQuery({ text: `Removed channel: ${channel.title}` });

      const { text, keyboard } = await buildChannelsMenu(userId);
      await ctx.editMessageText(text, { reply_markup: keyboard, parse_mode: "MarkdownV2" });
      return;
    }
  });
}

/**
 * Checks if a message was forwarded from a channel to register it automatically.
 */
export async function tryHandleForwardedChannelRegistration(ctx: Context): Promise<boolean> {
  const msg = ctx.message;
  if (!msg || !ctx.from) return false;

  let channelId: number | null = null;
  let channelTitle: string | null = null;
  let channelUsername: string | null = null;
  let postId: number = 0;

  // Telegram Bot API 7.0+ forward_origin
  if (msg.forward_origin && msg.forward_origin.type === "channel") {
    channelId = msg.forward_origin.chat.id;
    channelTitle = msg.forward_origin.chat.title;
    channelUsername = msg.forward_origin.chat.username || null;
    postId = msg.forward_origin.message_id;
  } else {
    // Fallback for legacy fields if present on raw message
    const rawMsg = msg as unknown as Record<string, unknown>;
    const forwardChat = rawMsg["forward_from_chat"] as { id: number; title: string; username?: string; type: string } | undefined;
    if (forwardChat && forwardChat.type === "channel") {
      channelId = forwardChat.id;
      channelTitle = forwardChat.title;
      channelUsername = forwardChat.username || null;
      postId = typeof rawMsg["forward_from_message_id"] === "number" ? rawMsg["forward_from_message_id"] : 0;
    }
  }

  if (!channelId || !channelTitle) {
    return false;
  }

  const userId = ctx.from.id;

  // Verify bot's administrative privileges in the channel
  try {
    const botMember = await ctx.api.getChatMember(channelId, ctx.me.id);
    if (
      botMember.status !== "administrator" &&
      botMember.status !== "creator"
    ) {
      await ctx.reply(
        `⚠️ *Channel Detected: ${escapeMarkdownV2(channelTitle)}*\n\n` +
          `The bot is not an administrator in this channel\\. Please add the bot as an *Administrator* with post permissions in the channel first\\.`,
        { parse_mode: "MarkdownV2" },
      );
      return true;
    }
  } catch (_err) {
    await ctx.reply(
      `⚠️ *Channel Detected: ${escapeMarkdownV2(channelTitle)}*\n\n` +
        `The bot cannot access this channel\\. Please add the bot to the channel as an *Administrator* with post permissions\\.`,
      { parse_mode: "MarkdownV2" },
    );
    return true;
  }

  const existing = await getChannel(channelId);
  const channel: Channel = {
    id: channelId,
    ownerId: userId,
    title: channelTitle,
    username: channelUsername,
    description: existing?.description || channelTitle,
    lastPostId: postId > 0 ? postId : (existing?.lastPostId || 0),
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  await saveChannel(channel);

  const settings = await getUserSettings(userId);
  if (!settings?.activeChannelId) {
    await setActiveChannel(userId, channelId);
  }

  await ctx.reply(
    `✅ *Channel Registered Successfully\\!*\n\n` +
      `• *Title:* ${escapeMarkdownV2(channelTitle)}\n` +
      `• *ID:* \`${channelId}\`\n` +
      (channelUsername ? `• *Username:* @${escapeMarkdownV2(channelUsername)}\n` : "") +
      `• *Last Post ID:* \`${channel.lastPostId}\`\n\n` +
      `Use /channels to set a custom link description or switch active channels\\.`,
    { parse_mode: "MarkdownV2" },
  );

  return true;
}
