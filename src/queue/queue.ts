import type { Api } from "grammy";
import { GrammyError } from "grammy";
import type { AudioQueueItem } from "../db/types.ts";
import { publishAudioToChannel } from "../services/publisher.ts";
import { recordTrack } from "../services/tracks.ts";
import { config } from "../config.ts";

/**
 * Publishes one audio item inside the update that carried it, then waits the pacing delay.
 *
 * There is no in-memory queue: Deno Deploy stops instances with no open requests, which
 * silently dropped queued items. Telegram is the queue instead. The webhook is registered
 * with max_connections=1, so Telegram holds the rest of a batch until this update returns,
 * and the open request keeps the instance alive while publishing.
 *
 * Returns false if the item could not be published within config.updateBudgetMs.
 */
export async function publishAudioItem(api: Api, item: AudioQueueItem): Promise<boolean> {
  const deadline = Date.now() + config.updateBudgetMs;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await publishAudioToChannel(api, item);
      console.log(
        `[Publisher] Published item ${item.id} to channel ${item.channelId}. ` +
          `Predicted post ID: ${result.predictedPostId}, Actual: ${result.actualPostId}, ` +
          `Correction needed: ${result.neededCorrection}`,
      );

      // Delete the original forwarded audio message from the user's private chat
      if (item.sourceChatId && item.sourceMessageId) {
        try {
          await api.deleteMessage(item.sourceChatId, item.sourceMessageId);
        } catch (delErr) {
          console.warn(
            `[Queue] Could not delete forwarded message ${item.sourceMessageId} in chat ${item.sourceChatId}:`,
            delErr,
          );
        }
      }

      // Inter-message pacing: Telegram sends the next update only after this one returns.
      // The dashboard entry is recorded meanwhile; its failure must not fail (and re-post) the track.
      await Promise.all([
        recordTrack(item, result.actualPostId).catch((err) =>
          console.error(`[Queue] Could not record track ${item.id} for the dashboard:`, err)
        ),
        delay(config.postPacingMs),
      ]);
      return true;
    } catch (err: unknown) {
      let retryAfterSec: number;
      if (err instanceof GrammyError && err.error_code === 429) {
        // Telegram rate limit hit
        retryAfterSec = err.parameters?.retry_after ?? (Math.pow(2, attempt) * 2);
        console.warn(
          `[Queue] 429 Rate limited by Telegram. retry_after ${retryAfterSec}s (attempt ${attempt}/${config.maxRetries})`,
        );
      } else {
        // Other error - use exponential progression
        retryAfterSec = Math.pow(2, attempt);
        console.error(`[Queue] Error publishing audio (attempt ${attempt}/${config.maxRetries}):`, err);
      }

      const waitMs = (retryAfterSec + 0.5) * 1000;
      // Give up rather than outlive Telegram's webhook timeout (it would redeliver and double-post)
      if (attempt >= config.maxRetries || Date.now() + waitMs > deadline) {
        console.error(`[Publisher] Failed to publish item ${item.id} to channel ${item.channelId}:`, err);
        return false;
      }
      await delay(waitMs);
    }
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
