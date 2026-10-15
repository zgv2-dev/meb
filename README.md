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
  - Automatic webhook registration on startup.

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
deno task dev
```

---

## 🌐 Deploying to Deno Deploy

1. Push your repository to GitHub or deploy via [Deno Deploy Dashboard](https://dash.deno.com/).
2. Set the Environment Variables in Deno Deploy:
   - `BOT_TOKEN`: `your_telegram_bot_token`
   - `PUBLIC_DOMAIN`: `https://<your-project>.deno.dev` (or your custom domain)
   - `WEBHOOK_SECRET` (optional): a secure random string
3. On startup, the bot will host the server, automatically configure the Telegram webhook to `https://<your-project>.deno.dev/webhook`, and begin handling updates immediately. Root `GET /` returns `"hi!"`.

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
| `/cancel` | Cancel awaiting input state |

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
