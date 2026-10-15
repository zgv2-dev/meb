import { Bot } from "grammy";
import { config, validateConfig } from "./config.ts";
import { registerCommandHandlers } from "./handlers/commands.ts";
import { registerChannelHandlers } from "./handlers/channel.ts";
import { registerAudioHandlers } from "./handlers/audio.ts";

export function createBot(): Bot {
  validateConfig();

  const bot = new Bot(config.botToken);

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
