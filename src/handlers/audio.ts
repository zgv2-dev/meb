import type { Bot, Context } from "grammy";
import {
  getUserSettings,
  setAwaitingDescription,
  updateChannelDescription,
  getChannel,
  getActiveChannelForUser,
} from "../db/kv.ts";
import { publishAudioItem } from "../queue/queue.ts";
import type { AudioQueueItem } from "../db/types.ts";
import { escapeMarkdownV2 } from "../utils/markdown.ts";
import { tryHandleForwardedChannelRegistration } from "./channel.ts";

export function registerAudioHandlers(bot: Bot) {
  // Catch-all handler for incoming messages
  bot.on("message", async (ctx: Context) => {
    const msg = ctx.message;
    if (!msg || !ctx.from) return;

    // Only process private chats for direct user interactions
    if (ctx.chat?.type !== "private") {
      return;
    }

    const userId = ctx.from.id;
    const settings = await getUserSettings(userId);

    // 1. Check if user is currently awaiting channel description input
    if (settings?.awaitingDescriptionChannelId && msg.text && !msg.text.startsWith("/")) {
      const channelId = settings.awaitingDescriptionChannelId;
      const channel = await getChannel(channelId);
      if (channel && channel.ownerId === userId) {
        const newDesc = msg.text.trim();
        await updateChannelDescription(channelId, newDesc);
        await setAwaitingDescription(userId, null);

        await ctx.reply(
          `✅ *Description updated for ${escapeMarkdownV2(channel.title)}\\!*\n\n` +
            `New description: \`${escapeMarkdownV2(newDesc)}\`\n` +
            `Links on audio posts will use this text\\.`,
          { parse_mode: "MarkdownV2" },
        );
        return;
      }
    }

    // 2. Check if this is a forwarded message from a channel (for channel auto-registration)
    if (!msg.audio && !msg.voice && !(msg.document && msg.document.mime_type?.startsWith("audio/"))) {
      const handled = await tryHandleForwardedChannelRegistration(ctx);
      if (handled) {
        return;
      }

      // Ignore standard commands (they are handled by command handlers)
      if (msg.text && msg.text.startsWith("/")) {
        return;
      }

      // Any other non-audio message in private chat
      await ctx.reply("Unsupported message type. Please forward audio files.");
      return;
    }

    // 3. Process Audio Message
    const activeChannel = await getActiveChannelForUser(userId);
    if (!activeChannel) {
      await ctx.reply(
        `⚠️ *No active channel selected\\.*\n\n` +
          `Please set an active channel using /channels before forwarding audio files\\.`,
        { parse_mode: "MarkdownV2" },
      );
      return;
    }

    let fileId = "";
    let title: string | undefined;
    let performer: string | undefined;
    let duration: number | undefined;
    let isVoice = false;

    if (msg.audio) {
      fileId = msg.audio.file_id;
      title = msg.audio.title;
      performer = msg.audio.performer;
      duration = msg.audio.duration;
    } else if (msg.voice) {
      fileId = msg.voice.file_id;
      duration = msg.voice.duration;
      isVoice = true;
    } else if (msg.document && msg.document.mime_type?.startsWith("audio/")) {
      fileId = msg.document.file_id;
      title = msg.document.file_name;
    }

    if (!fileId) {
      await ctx.reply("Unsupported audio format.");
      return;
    }

    const item: AudioQueueItem = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      channelId: activeChannel.id,
      fileId,
      title,
      performer,
      duration,
      isVoice,
      sourceChatId: ctx.chat.id,
      sourceMessageId: msg.message_id,
      queuedAt: Date.now(),
    };

    console.log(`[Audio] Publishing audio from user ${userId} to channel ${activeChannel.title}`);
    const published = await publishAudioItem(ctx.api, item);
    if (!published) {
      await ctx.reply("⚠️ Could not post this track. Forward it again later.", {
        reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true },
      });
    }
  });
}
