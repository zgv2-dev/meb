import { assert, assertEquals } from "@std/assert";
import { type Api, GrammyError } from "grammy";
import { saveChannel } from "../src/db/kv.ts";
import type { AudioQueueItem } from "../src/db/types.ts";

// config is read at import time, so set env before importing the queue
Deno.env.set("POST_PACING_MS", "0");
Deno.env.set("UPDATE_BUDGET_MS", "1000");
const { publishAudioItem } = await import("../src/queue/queue.ts");

const channelId = -100555444333;
await saveChannel({
  id: channelId,
  ownerId: 1,
  title: "Queue Test",
  username: "queue_test",
  description: "Desc",
  lastPostId: 10,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const item: AudioQueueItem = {
  id: "t1",
  userId: 1,
  channelId,
  fileId: "file",
  sourceChatId: 1,
  sourceMessageId: 77,
  queuedAt: Date.now(),
};

Deno.test("publishAudioItem publishes and deletes the forwarded source message", async () => {
  const deleted: number[] = [];
  const api = {
    sendAudio: () => Promise.resolve({ message_id: 11 }),
    deleteMessage: (_chat: number, msgId: number) => {
      deleted.push(msgId);
      return Promise.resolve(true);
    },
  } as unknown as Api;

  assertEquals(await publishAudioItem(api, item), true);
  assertEquals(deleted, [77]);
});

Deno.test("publishAudioItem gives up instead of waiting past the update budget", async () => {
  let calls = 0;
  const api = {
    sendAudio: () => {
      calls++;
      return Promise.reject(
        new GrammyError(
          "429",
          { ok: false, error_code: 429, description: "Too Many Requests", parameters: { retry_after: 30 } },
          "sendAudio",
          {},
        ),
      );
    },
  } as unknown as Api;

  const t0 = Date.now();
  assertEquals(await publishAudioItem(api, item), false);
  assertEquals(calls, 1);
  assert(Date.now() - t0 < 1000);
});
