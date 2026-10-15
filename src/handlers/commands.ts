import type { Bot } from "grammy";
import {
  getUserChannels,
  getActiveChannelForUser,
  setActiveChannel,
  updateChannelDescription,
  updateChannelLastPostId,
  setAwaitingDescription,
  getChannel,
  saveChannel,
} from "../db/kv.ts";
import { buildChannelsMenu } from "./menus.ts";
import { escapeMarkdownV2 } from "../utils/markdown.ts";

export function registerCommandHandlers(bot: Bot) {
  // /start
  bot.command("start", async (ctx) => {
    const text = `👋 *Welcome to Audio Channel Forwarder Bot\\!*\n\n` +
      `This bot helps you post audio files to your Telegram channels with clean descriptions and verified post links\\.\n\n` +
      `🚀 *Getting Started:*\n` +
      `1\\. Add this bot as an *Administrator* \\(with post permissions\\) to your channel, OR forward any post from your channel to this chat\\.\n` +
      `2\\. Open /channels to configure your channel's link description \\(formatted as \`[description](https://t.me/...)\`\\)\\.\n` +
      `3\\. Forward one or multiple audio tracks to this bot, and they will be safely queued and published to your active channel\\.\n\n` +
      `📌 *Commands:*\n` +
      `• /channels \\- View and manage your channels\n` +
      `• /active \\- Check or switch your active channel\n` +
      `• /setdesc \\<text\\> \\- Set description for active channel\n` +
      `• /queue \\- Check audio publishing queue status\n` +
      `• /help \\- Detailed instructions`;

    await ctx.reply(text, { parse_mode: "MarkdownV2" });
  });

  // /help
  bot.command("help", async (ctx) => {
    const text = `📖 *Bot Help & Instructions*\n\n` +
      `*1\\. Channel Configuration:*\n` +
      `• Auto\\-add: Add the bot as an administrator to your channel, or forward a post from your channel here\\.\n` +
      `• Manage: Use /channels to switch active channels, edit descriptions, or set post IDs\\.\n\n` +
      `*2\\. Audio Forwarding Flow:*\n` +
      `• Forward any audio track \\(single or batch up to 100\\) to this chat\\.\n` +
      `• The bot strips all previous headers/captions and attaches: \`[Your Description](https://t.me/channel/post_id)\`\\.\n` +
      `• Optimistic Post ID is automatically verified against Telegram servers; if the ID shifted, the caption link is instantly corrected\\.\n\n` +
      `*3\\. Rate Limiting:*\n` +
      `• Batches are processed in a paced queue with exponential backoff on Telegram 429 errors\\.\n` +
      `• Check queue status anytime with /queue\\.`;

    await ctx.reply(text, { parse_mode: "MarkdownV2" });
  });

  // /channels
  bot.command("channels", async (ctx) => {
    if (!ctx.from) return;
    const { text, keyboard } = await buildChannelsMenu(ctx.from.id);
    await ctx.reply(text, { reply_markup: keyboard, parse_mode: "MarkdownV2" });
  });

  // /active
  bot.command("active", async (ctx) => {
    if (!ctx.from) return;
    const active = await getActiveChannelForUser(ctx.from.id);
    if (!active) {
      await ctx.reply(
        `⚠️ *No active channel selected\\.*\n\nUse /channels to select an active channel\\.`,
        { parse_mode: "MarkdownV2" },
      );
      return;
    }

    await ctx.reply(
      `📌 *Current Active Channel:*\n` +
        `• *Title:* ${escapeMarkdownV2(active.title)}\n` +
        `• *ID:* \`${active.id}\`\n` +
        (active.username ? `• *Username:* @${escapeMarkdownV2(active.username)}\n` : "") +
        `• *Description:* \`${escapeMarkdownV2(active.description || "(none)")}\`\n` +
        `• *Last Post ID:* \`${active.lastPostId}\``,
      { parse_mode: "MarkdownV2" },
    );
  });

  // /setdesc <description>
  bot.command("setdesc", async (ctx) => {
    if (!ctx.from) return;
    const descText = ctx.match?.trim();
    const active = await getActiveChannelForUser(ctx.from.id);

    if (!active) {
      await ctx.reply(
        `⚠️ *No active channel selected\\.*\n\nPlease select an active channel first using /channels\\.`,
        { parse_mode: "MarkdownV2" },
      );
      return;
    }

    if (!descText) {
      await ctx.reply(
        `ℹ️ *Usage:* \`/setdesc <your description text>\`\n\n` +
          `Example: \`/setdesc Listen to our full episode\``,
        { parse_mode: "MarkdownV2" },
      );
      return;
    }

    await updateChannelDescription(active.id, descText);
    await ctx.reply(
      `✅ *Description updated for ${escapeMarkdownV2(active.title)}\\!*\n\n` +
        `New description text: \`${escapeMarkdownV2(descText)}\`\n` +
        `Audio captions will be formatted as: \`[${escapeMarkdownV2(descText)}](https://t.me/...)\``,
      { parse_mode: "MarkdownV2" },
    );
  });

  // /setpostid <channel_id> <post_id>
  bot.command("setpostid", async (ctx) => {
    if (!ctx.from) return;
    const args = ctx.match?.trim().split(/\s+/);
    if (!args || args.length < 2) {
      await ctx.reply(
        `ℹ️ *Usage:* \`/setpostid <channel_id> <last_post_id_number>\`\n\n` +
          `Example: \`/setpostid -1001234567890 42\``,
        { parse_mode: "MarkdownV2" },
      );
      return;
    }

    const channelId = Number(args[0]);
    const postId = Number(args[1]);

    if (isNaN(channelId) || isNaN(postId)) {
      await ctx.reply(`⚠️ Channel ID and Post ID must be numbers.`);
      return;
    }

    const channel = await getChannel(channelId);
    if (!channel || channel.ownerId !== ctx.from.id) {
      await ctx.reply(`⚠️ Channel not found or you are not its owner.`);
      return;
    }

    await updateChannelLastPostId(channelId, postId);
    await ctx.reply(
      `✅ *Last Post ID for ${escapeMarkdownV2(channel.title)} updated to \`${postId}\`\\.*`,
      { parse_mode: "MarkdownV2" },
    );
  });

  // /addchannel <@username or ID>
  bot.command("addchannel", async (ctx) => {
    if (!ctx.from) return;
    const target = ctx.match?.trim();
    if (!target) {
      await ctx.reply(
        `ℹ️ *Usage:* \`/addchannel <@username or channel_id>\`\n\n` +
          `Example: \`/addchannel @mychannel\` or \`/addchannel -1001234567890\`\n\n` +
          `_Note: Ensure the bot is added as an administrator with post rights first\\._`,
        { parse_mode: "MarkdownV2" },
      );
      return;
    }

    try {
      const chat = await ctx.api.getChat(target);
      if (chat.type !== "channel") {
        await ctx.reply(`⚠️ That chat is a ${chat.type}, not a channel.`);
        return;
      }

      const botMember = await ctx.api.getChatMember(chat.id, ctx.me.id);
      if (botMember.status !== "administrator" && botMember.status !== "creator") {
        await ctx.reply(`⚠️ The bot is not an administrator in that channel.`);
        return;
      }

      const channelId = chat.id;
      const channelTitle = chat.title || target;
      const channelUsername = chat.username || null;

      const existing = await getChannel(channelId);
      await saveChannel({
        id: channelId,
        ownerId: ctx.from.id,
        title: channelTitle,
        username: channelUsername,
        description: existing?.description || channelTitle,
        lastPostId: existing?.lastPostId || 0,
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
      });

      const settings = await getUserChannels(ctx.from.id);
      if (settings.length === 1) {
        await setActiveChannel(ctx.from.id, channelId);
      }

      await ctx.reply(
        `✅ *Channel ${escapeMarkdownV2(channelTitle)} registered successfully\\!*`,
        { parse_mode: "MarkdownV2" },
      );
    } catch (err) {
      await ctx.reply(`⚠️ Failed to access channel: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // /queue
  bot.command("queue", async (ctx) => {
    // Telegram holds the backlog (max_connections=1); pending updates are the queue
    const info = await ctx.api.getWebhookInfo();
    const text = `📊 *Audio Queue Status*\n\n` +
      `• *Pending Updates:* \`${info.pending_update_count}\`\n`;

    await ctx.reply(text, { parse_mode: "MarkdownV2" });
  });

  // /cancel
  bot.command("cancel", async (ctx) => {
    if (!ctx.from) return;
    await setAwaitingDescription(ctx.from.id, null);
    await ctx.reply("Action cancelled.");
  });
}
