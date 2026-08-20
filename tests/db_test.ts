import { assertEquals, assertExists } from "@std/assert";
import {
  saveChannel,
  getChannel,
  getUserChannels,
  setActiveChannel,
  getActiveChannelForUser,
  updateChannelDescription,
  updateChannelLastPostId,
  deleteChannel,
} from "../src/db/kv.ts";

Deno.test("Deno KV channel and settings workflow", async () => {
  const userId = 12345;
  const channelId = -100999888777;

  // 1. Save channel
  await saveChannel({
    id: channelId,
    ownerId: userId,
    title: "Test Music Channel",
    username: "test_music_ch",
    description: "Original Description",
    lastPostId: 10,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const fetched = await getChannel(channelId);
  assertExists(fetched);
  assertEquals(fetched.title, "Test Music Channel");
  assertEquals(fetched.lastPostId, 10);

  // 2. Set active channel
  await setActiveChannel(userId, channelId);
  const active = await getActiveChannelForUser(userId);
  assertExists(active);
  assertEquals(active.id, channelId);

  // 3. Update description
  await updateChannelDescription(channelId, "New Updated Description");
  const updated = await getChannel(channelId);
  assertEquals(updated?.description, "New Updated Description");

  // 4. Update post ID
  await updateChannelLastPostId(channelId, 11);
  const updatedId = await getChannel(channelId);
  assertEquals(updatedId?.lastPostId, 11);

  // 5. List channels
  const list = await getUserChannels(userId);
  assertEquals(list.length >= 1, true);

  // 6. Delete channel
  await deleteChannel(userId, channelId);
  const deleted = await getChannel(channelId);
  assertEquals(deleted, null);

  const activeAfterDelete = await getActiveChannelForUser(userId);
  assertEquals(activeAfterDelete, null);
});
