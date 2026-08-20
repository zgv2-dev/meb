/**
 * Escapes characters for Telegram MarkdownV2 format.
 * In Telegram MarkdownV2, the following characters must be escaped:
 * _ * [ ] ( ) ~ ` > # + - = | { } . !
 */
export function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

/**
 * Escapes URL inside MarkdownV2 inline link [text](url).
 * Inside (...) of inline link, '(', ')' and '\' must be escaped.
 */
export function escapeMarkdownV2Url(url: string): string {
  return url.replace(/([()\\])/g, "\\$1");
}

/**
 * Formats a description and post URL into a MarkdownV2 link.
 * Result: [description](postUrl)
 */
export function formatAudioCaption(description: string, postUrl: string): string {
  const safeDesc = escapeMarkdownV2(description.trim() || "Audio Post");
  const safeUrl = escapeMarkdownV2Url(postUrl);
  return `[${safeDesc}](${safeUrl})`;
}
