import type { Api } from "grammy";
import { GrammyError } from "grammy";
import type { AudioQueueItem } from "../db/types.ts";
import { publishAudioToChannel, type PublishResult } from "../services/publisher.ts";
import { config } from "../config.ts";

export interface QueueStatus {
  pendingCount: number;
  isProcessing: boolean;
  channelQueues: Map<number, number>;
}

class AudioQueue {
  private queue: AudioQueueItem[] = [];
  private isProcessing = false;
  private api: Api | null = null;
  private onCompleteCallback?: (item: AudioQueueItem, result: PublishResult) => void;
  private onErrorCallback?: (item: AudioQueueItem, error: Error) => void;

  public init(
    api: Api,
    callbacks?: {
      onComplete?: (item: AudioQueueItem, result: PublishResult) => void;
      onError?: (item: AudioQueueItem, error: Error) => void;
    },
  ) {
    this.api = api;
    this.onCompleteCallback = callbacks?.onComplete;
    this.onErrorCallback = callbacks?.onError;
  }

  public enqueue(item: AudioQueueItem): number {
    this.queue.push(item);
    this.processNext();
    return this.queue.length;
  }

  public getStatus(): QueueStatus {
    const channelQueues = new Map<number, number>();
    for (const item of this.queue) {
      channelQueues.set(item.channelId, (channelQueues.get(item.channelId) || 0) + 1);
    }
    return {
      pendingCount: this.queue.length,
      isProcessing: this.isProcessing,
      channelQueues,
    };
  }

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0 || !this.api) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue[0];
      let attempts = 0;
      let sentSuccessfully = false;

      while (attempts < config.maxRetries && !sentSuccessfully) {
        attempts++;
        try {
          const result = await publishAudioToChannel(this.api, item);
          sentSuccessfully = true;
          this.queue.shift(); // Remove from queue only after successful publish

          // Delete the original forwarded audio message from the user's private chat
          if (item.sourceChatId && item.sourceMessageId) {
            try {
              await this.api.deleteMessage(item.sourceChatId, item.sourceMessageId);
            } catch (delErr) {
              console.warn(
                `[Queue] Could not delete forwarded message ${item.sourceMessageId} in chat ${item.sourceChatId}:`,
                delErr,
              );
            }
          }

          if (this.onCompleteCallback) {
            this.onCompleteCallback(item, result);
          }
        } catch (err: unknown) {
          const isGrammy = err instanceof GrammyError;
          let retryAfterSec = 0;

          if (isGrammy && err.error_code === 429) {
            // Telegram rate limit hit
            retryAfterSec = err.parameters?.retry_after ?? (Math.pow(2, attempts) * 2);
            console.warn(
              `[Queue] 429 Rate limited by Telegram. Waiting ${retryAfterSec}s before retry (attempt ${attempts}/${config.maxRetries})...`,
            );
          } else {
            // Other error - use exponential progression
            retryAfterSec = Math.pow(2, attempts);
            console.error(
              `[Queue] Error publishing audio (attempt ${attempts}/${config.maxRetries}):`,
              err,
            );
          }

          if (attempts >= config.maxRetries) {
            console.error(`[Queue] Dropping item after ${config.maxRetries} failed attempts:`, item.fileId);
            this.queue.shift();
            if (this.onErrorCallback) {
              this.onErrorCallback(item, err instanceof Error ? err : new Error(String(err)));
            }
            break;
          }

          // Wait out the rate limit or backoff
          await this.delay((retryAfterSec + 0.5) * 1000);
        }
      }

      // Inter-message pacing between successful posts
      if (this.queue.length > 0) {
        await this.delay(config.postPacingMs);
      }
    }

    this.isProcessing = false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const audioQueue = new AudioQueue();
