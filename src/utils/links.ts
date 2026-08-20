/**
 * Generates the Telegram web link to a specific channel post.
 *
 * For public channels with a username:
 *   https://t.me/channel_username/123
 *
 * For private channels with chat_id (e.g. -1001234567890):
 *   https://t.me/c/1234567890/123
 */
export function buildPostUrl(channelId: number, username: string | null | undefined, postId: number): string {
  if (username && username.trim().length > 0) {
    const cleanUsername = username.replace(/^@/, "").trim();
    return `https://t.me/${cleanUsername}/${postId}`;
  }

  // Private channel: strip -100 prefix
  const rawIdStr = String(channelId);
  const cleanId = rawIdStr.startsWith("-100")
    ? rawIdStr.slice(4)
    : rawIdStr.startsWith("-")
    ? rawIdStr.slice(1)
    : rawIdStr;

  return `https://t.me/c/${cleanId}/${postId}`;
}
