# OpenClaw Panel

A mobile-optimized developer control panel for [OpenClaw](https://github.com/openclaw/openclaw) agents. Designed to run as a **Telegram Mini App** — giving you a full agent dashboard, memory editor, file browser, live logs, and interactive terminal from your phone.

---

## Features

- **Dashboard** — Real-time agent status, model info, and token usage across all discovered agents.
- **Memory Editor** — Read/write `MEMORY.md` and daily memory logs directly from the panel.
- **File Browser** — Browse and edit workspace files inline with full save support.
- **Live Logs** — Real-time JSONL session stream via WebSockets showing user messages, AI replies, and tool calls.
- **Skill Manager** — Toggle OpenClaw skills on/off without touching config files.
- **Terminal (PTY)** — Full interactive bash terminal streamed to the browser via `node-pty`. Supports multiple tabs, persistent sessions, and mobile keyboard input.
- **Actions** — One-tap buttons for gateway restart, update, disk/memory stats, and tunnel status.
- **Login Screen** — Token-based auth with a clean setup screen on first visit. No hardcoded credentials.

---

## Tech Stack

- **Frontend:** React, Vite, TypeScript, Xterm.js, Lucide Icons
- **Backend:** Node.js, Express, WebSockets (`ws`), `node-pty`
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

You'll see it printed in the server logs. This is the token you'll paste into the login screen.

To use a fixed token instead:

```bash
PANEL_TOKEN=your-secret-token node server.js
```

### 4. Expose it to the internet (Cloudflare Tunnel)

Telegram Mini Apps require HTTPS. The easiest way is a free Cloudflare tunnel — no account needed:

```bash
# Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:3001
```

Cloudflare will print a URL like:

```
https://something-random.trycloudflare.com
```

That's your panel URL. Open it in a browser and log in with your token.

> **Note:** The free tunnel URL changes on every restart. If you want a permanent URL, set up a named tunnel with a custom domain.

---

## Running as a system service

To keep the panel running in the background, create a systemd service:

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

Then enable and start it:

```bash
systemctl daemon-reload
systemctl enable --now openclaw-panel.service
```

---

## Connecting to your Telegram Bot (Menu Button)

You can set the panel as the **menu button** on your Telegram bot so it opens in one tap — no link needed.

### Set the menu button for a specific chat (DM with your bot)

Replace `<BOT_TOKEN>`, `<YOUR_CHAT_ID>`, and the URL with your panel's public HTTPS URL:

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

### Set as the default menu button for all chats

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

After running this, a button will appear next to the message input in the chat with your bot. Tapping it opens the panel as a Mini App inside Telegram.

> To find your Chat ID, message [@userinfobot](https://t.me/userinfobot) on Telegram.

---

## Agent discovery

The panel automatically discovers agents by scanning `~/.openclaw/agents/`. Each subdirectory is treated as an agent. Agent names and emojis are read from the agent's `IDENTITY.md` file (if present), with sensible fallbacks.

To use a different OpenClaw home directory:

```bash
OPENCLAW_HOME=/custom/path node server.js
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PANEL_PORT` | `3001` | Port the server listens on |
| `PANEL_TOKEN` | *(auto-generated)* | Auth token. Auto-generated and saved on first run if not set |
| `OPENCLAW_HOME` | `~/.openclaw` | Path to OpenClaw home directory |

---

## License

MIT
