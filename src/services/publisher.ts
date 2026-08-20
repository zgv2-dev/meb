import type { Api } from "grammy";
import type { AudioQueueItem, Channel } from "../db/types.ts";
import { getChannel, updateChannelLastPostId } from "../db/kv.ts";
import { buildPostUrl } from "../utils/links.ts";
import { formatAudioCaption } from "../utils/markdown.ts";

export interface PublishResult {
  success: boolean;
  predictedPostId: number;
  actualPostId: number;
  neededCorrection: boolean;
  error?: string;
}

/**
 * Publishes an audio item to the target channel with optimistic post ID caption,
 * and verifies/corrects the caption if the real post ID differed.
 */
export async function publishAudioToChannel(
  api: Api,
  item: AudioQueueItem,
): Promise<PublishResult> {
  const channel = await getChannel(item.channelId);
  if (!channel) {
    throw new Error(`Channel ${item.channelId} not found in database.`);
  }

  // 1. Determine optimistic post ID
  const predictedPostId = channel.lastPostId > 0 ? channel.lastPostId + 1 : 1;
  const predictedUrl = buildPostUrl(channel.id, channel.username, predictedPostId);
  const optimisticCaption = formatAudioCaption(channel.description, predictedUrl);

  // 2. Send audio to the channel (stripping previous forwarded headers and captions)
  let sentMessage;
  if (item.isVoice) {
    sentMessage = await api.sendVoice(channel.id, item.fileId, {
      caption: optimisticCaption,
      parse_mode: "MarkdownV2",
      duration: item.duration,
    });
  } else {
    sentMessage = await api.sendAudio(channel.id, item.fileId, {
      caption: optimisticCaption,
      parse_mode: "MarkdownV2",
      title: item.title,
      performer: item.performer,
      duration: item.duration,
    });
  }

  const actualPostId = sentMessage.message_id;

  // 3. Update the channel's lastPostId counter
  await updateChannelLastPostId(channel.id, actualPostId);

  // 4. Verify optimistic post ID against real message_id
  let neededCorrection = false;
  if (actualPostId !== predictedPostId) {
    neededCorrection = true;
    const correctedUrl = buildPostUrl(channel.id, channel.username, actualPostId);
    const correctedCaption = formatAudioCaption(channel.description, correctedUrl);

    try {
      await api.editMessageCaption(channel.id, actualPostId, {
        caption: correctedCaption,
        parse_mode: "MarkdownV2",
      });
    } catch (editErr) {
      console.error(
        `Failed to correct caption for channel ${channel.id} post ${actualPostId}:`,
        editErr,
      );
    }
  }

  return {
    success: true,
    predictedPostId,
    actualPostId,
    neededCorrection,
  };
}
