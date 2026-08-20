import { Bot } from "grammy";
import { config, validateConfig } from "./config.ts";
import { registerCommandHandlers } from "./handlers/commands.ts";
import { registerChannelHandlers } from "./handlers/channel.ts";
import { registerAudioHandlers } from "./handlers/audio.ts";
import { audioQueue } from "./queue/queue.ts";

export function createBot(): Bot {
  validateConfig();

  const bot = new Bot(config.botToken);

  // Initialize the audio processing queue
  audioQueue.init(bot.api, {
    onComplete: (item, result) => {
      console.log(
        `[Publisher] Published item ${item.id} to channel ${item.channelId}. ` +
          `Predicted post ID: ${result.predictedPostId}, Actual: ${result.actualPostId}, ` +
          `Correction needed: ${result.neededCorrection}`,
      );
    },
    onError: (item, error) => {
      console.error(`[Publisher] Failed to publish item ${item.id} to channel ${item.channelId}:`, error);
    },
  });

  // Register all handlers
  registerCommandHandlers(bot);
  registerChannelHandlers(bot);
  registerAudioHandlers(bot);

  // Global error handler
  bot.catch((err) => {
    console.error("Error in bot middleware:", err);
  });

  return bot;
}
