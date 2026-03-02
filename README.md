# OpenClaw Panel

A mobile-optimized developer control panel for [OpenClaw](https://github.com/openclaw/openclaw) agents. Designed to run as a **Telegram Mini App** — giving you a full agent dashboard, file browser, live logs, and interactive terminal from your phone.

---

## Features

- **Dashboard** — Real-time agent status, model info, and token usage. Click any agent card to open its detail view.
- **Agent Detail** — Per-agent deep-dive with three panels:
  - **Session** — Context window usage bar, model info, Compact and Reset actions
  - **Usage & Cost** — Token/cost stats with a 7-day bar chart and per-provider rate-limit gauges
  - **Cron Jobs** — Full CRUD for scheduled agent tasks. Schedule builder with "Every X" interval mode or "At a time" time picker with weekday toggles. Edit opens the full form pre-filled.
- **File Browser** — Browse, read, edit, and delete workspace files inline. Add files to context and chat with the agent about them.
- **Terminal (PTY)** — Full interactive bash terminal streamed via `node-pty`. Multiple persistent tabs that survive page refresh and app close.
- **Live Logs** — Real-time JSONL session stream (user messages, AI replies, tool calls, system events). Last 200 entries replayed from DB on reconnect.
- **Skill Manager** — Toggle OpenClaw skills on/off without touching config files.
- **Actions** — One-tap buttons for gateway restart, update, disk/memory stats, and tunnel status.
- **Token-based auth** — Auto-generated token on first run, clean login screen.
- **SQLite state** — Terminal tabs and log history persisted to `~/.openclaw/panel/panel.db`.

---

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React, Vite, TypeScript, Lucide Icons |
| Terminal | Xterm.js, node-pty |
| Backend | Node.js, Express, WebSockets (`ws`) |
| Storage | better-sqlite3 |
| Integration | Telegram WebApp SDK |

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

Panel runs on port `3001` by default. Override with `PANEL_PORT=8080`.

On first run a random token is auto-generated and saved to `~/.openclaw/panel/.token`. It's printed in the server logs — paste it into the login screen.

To use a fixed token:

```bash
PANEL_TOKEN=your-secret-token node server.js
```

### 4. Expose via HTTPS (Cloudflare Tunnel)

Telegram Mini Apps require HTTPS. The simplest option:

```bash
cloudflared tunnel --url http://localhost:3001
```

Cloudflare prints a URL like `https://something.trycloudflare.com` — that's your panel URL.

> The free tunnel URL changes on every restart. For a permanent URL, use a named tunnel with a custom domain.

---

## Running as a system service

```ini
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

```bash
systemctl daemon-reload
systemctl enable --now openclaw-panel.service
```

---

## Telegram Menu Button

Set the panel as your bot's menu button so it opens in one tap.

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setChatMenuButton" \
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

Omit `chat_id` to set it as the default for all chats.

> Find your Chat ID: message [@userinfobot](https://t.me/userinfobot) on Telegram.

---

## Agent discovery

The panel auto-discovers agents by scanning `~/.openclaw/agents/`. Names and emojis are read from each agent's `IDENTITY.md`, with `🤖` and the directory name as fallbacks.

```bash
OPENCLAW_HOME=/custom/path node server.js
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PANEL_PORT` | `3001` | Port the server listens on |
| `PANEL_TOKEN` | *(auto-generated)* | Auth token, saved to `~/.openclaw/panel/.token` on first run |
| `OPENCLAW_HOME` | `~/.openclaw` | Path to OpenClaw home directory |

---

## Patch Notes

See [PATCH_NOTES.md](./PATCH_NOTES.md) for full changelog.

---

## License

MIT
