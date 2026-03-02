# OpenClaw Panel

A mobile-optimized developer control panel for [OpenClaw](https://github.com/openclaw/openclaw) agents. Designed to run as a **Telegram Mini App** — giving you a full agent dashboard, file browser, live logs, and interactive terminal from your phone.

---

## Features

- **Dashboard** — Real-time agent status, model info, and token usage across all auto-discovered agents.
- **File Browser** — Browse and edit any workspace file inline. Your `memory/` folder is accessible here too.
- **Terminal (PTY)** — Full interactive bash terminal streamed via `node-pty`. Supports multiple persistent tabs — tabs survive page refresh, app close, and tab switches. Terminal state is never lost when navigating between panel sections.
- **Live Logs** — Real-time JSONL session stream (user messages, AI replies, tool calls) accessible via the log icon inside the Terminal tab. Last 200 entries are replayed from DB on reconnect so you never miss context.
- **Skill Manager** — Toggle OpenClaw skills on/off without touching config files.
- **Actions** — One-tap buttons for gateway restart, update, disk/memory stats, and tunnel status.
- **Login Screen** — Token-based auth with a clean setup screen on first visit. No hardcoded credentials.
- **SQLite state** — Terminal tabs and log history are persisted to `~/.openclaw/panel/panel.db`.

---

## Tech Stack

- **Frontend:** React, Vite, TypeScript, Xterm.js, Lucide Icons
- **Backend:** Node.js, Express, WebSockets (`ws`), `node-pty`, `better-sqlite3`
- **Integration:** Telegram WebApp SDK

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/thisissahin/openclaw-panel.git
cd openclaw-panel
npm install
```

### 2. Build the frontend

```bash
npm run build
```

### 3. Start the server

```bash
node server.js
```

The panel runs on port `3001` by default. Override with:

```bash
PANEL_PORT=8080 node server.js
```

On first run, a random token is auto-generated and saved to:

```
~/.openclaw/panel/.token
```

You'll see it printed in the server logs. Paste it into the login screen when you first open the panel.

To use a fixed token instead:

```bash
PANEL_TOKEN=your-secret-token node server.js
```

### 4. Expose it to the internet (Cloudflare Tunnel)

Telegram Mini Apps require HTTPS. The easiest option is a free Cloudflare tunnel — no account needed:

```bash
# Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:3001
```

Cloudflare prints a URL like:

```
https://something-random.trycloudflare.com
```

That's your panel URL. Open it in a browser and log in with your token.

> **Note:** The free tunnel URL changes on every restart. For a permanent URL, set up a named tunnel with a custom domain.

---

## Running as a system service

To keep the panel alive in the background:

```bash
# /etc/systemd/system/openclaw-panel.service
[Unit]
Description=OpenClaw Panel
After=network.target

[Service]
WorkingDirectory=/path/to/openclaw-panel
ExecStart=/usr/bin/node /path/to/openclaw-panel/server.js
Restart=always
Environment=PANEL_TOKEN=your-secret-token

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
systemctl daemon-reload
systemctl enable --now openclaw-panel.service
```

---

## Connecting to your Telegram Bot (Menu Button)

Set the panel as the **menu button** on your Telegram bot so it opens in one tap.

### For a specific chat (your DM with the bot)

```bash
curl -s -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "<YOUR_CHAT_ID>",
    "menu_button": {
      "type": "web_app",
      "text": "Panel",
      "web_app": { "url": "https://your-panel-url.trycloudflare.com" }
    }
  }'
```

### As the default for all chats

```bash
curl -s -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d '{
    "menu_button": {
      "type": "web_app",
      "text": "Panel",
      "web_app": { "url": "https://your-panel-url.trycloudflare.com" }
    }
  }'
```

A button appears next to the message input in your bot chat. Tapping it opens the panel as a Mini App inside Telegram.

> Find your Chat ID by messaging [@userinfobot](https://t.me/userinfobot) on Telegram.

---

## Agent discovery

The panel auto-discovers agents by scanning `~/.openclaw/agents/`. Each subdirectory is an agent. Names and emojis are read from the agent's `IDENTITY.md` (if present), with `🤖` and the directory name as fallbacks.

```bash
OPENCLAW_HOME=/custom/path node server.js
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PANEL_PORT` | `3001` | Port the server listens on |
| `PANEL_TOKEN` | *(auto-generated)* | Auth token — auto-generated and saved to `~/.openclaw/panel/.token` on first run |
| `OPENCLAW_HOME` | `~/.openclaw` | Path to OpenClaw home directory |

---

## License

MIT
