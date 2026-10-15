import { config } from "../config.ts";

/** Never log the bot token: fetch errors embed it in the Telegram API URL. */
export function redactBotTokenInLogs() {
  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    const write = console[level];
    console[level] = (...args: unknown[]) =>
      write(
        args.map((a) => (typeof a === "string" ? a : Deno.inspect(a))).join(" ")
          .replaceAll(config.botToken || "\0", "<BOT_TOKEN>"),
      );
  }
}
