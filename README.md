# Telegram Audio Channel Publisher Bot

A Telegram bot built with **Deno 2** and **grammY** framework. It strips existing forward headers and captions from forwarded audio tracks, formats the caption as a link with your custom channel description (`[description](https://t.me/channel/post_id)`), maintains optimistic post IDs, automatically verifies and corrects post links if counters shifted, and queues batch forwards to prevent rate limits.

---

## ✨ Features

- **Channel Management**:
  - Auto-discovery when adding the bot to a channel as an Administrator with post rights.
  - Auto-discovery by simply forwarding any post from your channel to the bot in PM.
  - Interactive `/channels` inline menu to view, switch active channel (marked with ✅), edit descriptions, and remove channels.
- **Custom Link Descriptions**:
  - Each channel has its own customizable description text.
  - Captions are formatted as `[Description Text](https://t.me/channel/post_id)` using MarkdownV2 with full character escaping.
- **Optimistic Post ID & Verification**:
  - Predicts the next post ID (`last_post_id + 1`) and creates the link immediately.
  - Upon sending, verifies the real `message_id` returned by Telegram servers.
  - If the real post ID differed (e.g. human posted or ID jumped), immediately edits the caption with the correct link.
- **Batch Queue & Rate Limit Protection**:
  - Easily handles forwarding bursts (up to 100+ audio files at once).
  - Paced sending queue (~1.5s interval per post).
  - Automatic `429 Too Many Requests` handling: pauses according to `retry_after` parameter with exponential backoff.
- **Audio Message Filter**:
  - Processes audio files, voice messages, and audio document attachments.
  - Rejects/ignores non-audio, non-command messages in private chat.
- **Deployment Ready**:
  - Runs with **Long Polling** for local development.
  - Runs with **Webhooks** natively on **Deno Deploy** with built-in **Deno KV** persistence.
  - Webhook registered once per deploy by a pre-deploy command.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- [Deno 2+](https://deno.land/) installed.
- A Telegram Bot Token from [@BotFather](https://t.me/BotFather).

### 2. Setup Environment
Create a `.env` file in the project root:

```sh
cp .env.example .env
```

Edit `.env` and insert your `BOT_TOKEN`:
```env
BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
```

### 3. Run Locally (Long Polling)
```sh
deno install
deno task dev
```

The app is built with [Fresh](https://usefresh.dev/) (Vite). `deno task dev` serves the dashboard on `PORT` (default 8000) and starts long polling. To run the production build locally: `deno task build && deno task start`.

---

## 🌐 Deploying to Deno Deploy

1. Push your repository to GitHub or deploy via [Deno Deploy Dashboard](https://dash.deno.com/).
2. Set the Environment Variables in Deno Deploy:
   - `BOT_TOKEN`: `your_telegram_bot_token`
   - `PUBLIC_DOMAIN`: `https://<your-project>.deno.dev` (or your custom domain)
   - `WEBHOOK_SECRET` (optional): a secure random string
3. Build settings come from the `deploy` key in `deno.json` (it overrides the dashboard): Fresh preset, `deno task build`, served from `_fresh/server.js`. The pre-deploy command `deno task set-webhook` registers the Telegram webhook at `https://<your-project>.deno.dev/webhook` once per production deploy (other timelines are skipped). Root `GET /` returns `"hi!"`.
4. Running the bot locally in long polling mode deletes the webhook. Afterwards, restore it with `deno run --env -A scripts/set_webhook.ts` (with `PUBLIC_DOMAIN` set) or redeploy.

---

## 🤖 Bot Commands

| Command | Description |
|---|---|
| `/start` | Welcome message and quick start guide |
| `/help` | Detailed guide and instructions |
| `/channels` | Interactive channel management menu |
| `/active` | View currently active channel |
| `/setdesc <text>` | Set link description for active channel |
| `/setpostid <id> <num>` | Manually set/sync last post ID counter |
| `/addchannel <@user or id>` | Manually add a channel |
| `/queue` | View status of the audio processing queue |
| `/dashboard` | Get a login link to your music library dashboard |
| `/cancel` | Cancel awaiting input state |

---

## 🎵 Dashboard

Every published track is saved to your library: title, artist, album, release year, cover art and a link to the channel post. Album, year and cover come from the public Deezer API (Telegram audio has only title and performer); the track's embedded Telegram thumbnail is the fallback cover. Tracks published before the dashboard existed are not in the library.

- Send `/dashboard` to the bot for a login link (valid 10 minutes; the session lasts 30 days). Locally it is `http://localhost:8000/dashboard/...`.
- **Songs / Artists / Albums**: browse and search; edit a track's title, artist, album or year (dashboard only, the channel post is unchanged).
- **Duplicates**: tracks posted more than once to the same channel (same artist + title, or the same file). Nothing is deleted automatically. Per track, choose **Delete channel post** (deletes the post and the entry) or **Remove from library only** (for posts you already deleted in Telegram).

---

## 🧪 Testing & Verification

Run the test suite:

```sh
deno task test
```

Check TypeScript types:

```sh
deno task check
```
