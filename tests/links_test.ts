import { assertEquals } from "@std/assert";
import { buildPostUrl } from "../src/utils/links.ts";

Deno.test("buildPostUrl for public channel with username", () => {
  const url = buildPostUrl(-1001234567890, "my_public_channel", 42);
  assertEquals(url, "https://t.me/my_public_channel/42");
});

Deno.test("buildPostUrl for public channel with @ username prefix", () => {
  const url = buildPostUrl(-1001234567890, "@prefixed_channel", 99);
  assertEquals(url, "https://t.me/prefixed_channel/99");
});

Deno.test("buildPostUrl for private channel without username", () => {
  const url = buildPostUrl(-1001234567890, null, 105);
  assertEquals(url, "https://t.me/c/1234567890/105");
});

Deno.test("buildPostUrl for private channel with numeric ID not starting with -100", () => {
  const url = buildPostUrl(-987654321, "", 15);
  assertEquals(url, "https://t.me/c/987654321/15");
});
