import { assertEquals } from "@std/assert";
import { escapeMarkdownV2, escapeMarkdownV2Url, formatAudioCaption } from "../src/utils/markdown.ts";

Deno.test("escapeMarkdownV2 escapes reserved characters correctly", () => {
  const input = "Hello_World *bold* [link] (test) ~strike~ `code` >quote #tag +plus -minus =eq |pipe {brace} .dot !excl \\slash";
  const escaped = escapeMarkdownV2(input);
  assertEquals(
    escaped,
    "Hello\\_World \\*bold\\* \\[link\\] \\(test\\) \\~strike\\~ \\`code\\` \\>quote \\#tag \\+plus \\-minus \\=eq \\|pipe \\{brace\\} \\.dot \\!excl \\\\slash",
  );
});

Deno.test("escapeMarkdownV2Url escapes parentheses and backslashes in URL", () => {
  const url = "https://t.me/my_channel/123?param=(test)\\val";
  const escaped = escapeMarkdownV2Url(url);
  assertEquals(escaped, "https://t.me/my_channel/123?param=\\(test\\)\\\\val");
});

Deno.test("formatAudioCaption creates MarkdownV2 formatted link", () => {
  const caption = formatAudioCaption("Listen on our channel!", "https://t.me/my_channel/42");
  assertEquals(caption, "[Listen on our channel\\!](https://t.me/my_channel/42)");
});
