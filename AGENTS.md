# AGENTS.md — Self-Install Guide for AI Agents

This document tells an AI agent exactly how to deploy the OpenClaw Panel for itself on a fresh Linux server. Follow it top to bottom.

---

## What you're installing

Four always-on systemd services:

| Service | Role |
|---|---|
| `openclaw-panel` | Node.js server on port 3001 (API + static UI) |
| `openclaw-panel-tunnel` | Cloudflare tunnel → exposes port 3001 to the internet |
| `openclaw-panel-url-watcher` | Watches tunnel logs, updates Telegram menu button when URL changes |
| `openclaw-tunnel` | Cloudflare tunnel → exposes OpenClaw Gateway (port 18789) |

---

## Prerequisites

- Linux (Ubuntu/Debian)
- Node.js ≥ 20 (`node --version`)
- `cloudflared` installed at `/usr/local/bin/cloudflared`
- OpenClaw gateway running on port 18789
- Two Telegram bot tokens (one per agent, e.g. Dolores + Dwight)
- Your Telegram `chat_id` (numeric user ID)

### Install cloudflared (if missing)

```bash
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 \
  -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
cloudflared --version
```

> Use `cloudflared-linux-amd64` for x86_64 servers.

---

## Step 1 — Clone and build

```bash
git clone https://github.com/thisissahin/openclaw-panel.git /root/.openclaw/workspace/openclaw-panel
cd /root/.openclaw/workspace/openclaw-panel
npm install
npm run build
```

Verify `dist/index.html` exists after the build.

---

## Step 2 — Create the URL watcher script

Create `/usr/local/bin/panel-url-notify.sh`:

```bash
cat > /usr/local/bin/panel-url-notify.sh << 'EOF'
#!/bin/bash
# Watches openclaw-panel-tunnel journal.
# Every time a new trycloudflare URL appears, updates the Telegram menu button.

BOT_DOLORES="<DOLORES_BOT_TOKEN>"
BOT_DWIGHT="<DWIGHT_BOT_TOKEN>"
CHAT_ID="<YOUR_TELEGRAM_CHAT_ID>"

journalctl -u openclaw-panel-tunnel.service -f --no-pager 2>/dev/null | \
while IFS= read -r line; do
  URL=$(echo "$line" | grep -oP 'https://[a-z0-9\-]+\.trycloudflare\.com')
  if [ -n "$URL" ]; then
    PAYLOAD="{\"chat_id\": ${CHAT_ID}, \"menu_button\": {\"type\": \"web_app\", \"text\": \"🌙 Panel\", \"web_app\": {\"url\": \"${URL}\"}}}"
    curl -s -X POST "https://api.telegram.org/bot${BOT_DOLORES}/setChatMenuButton" \
      -H "Content-Type: application/json" -d "$PAYLOAD" > /dev/null
    curl -s -X POST "https://api.telegram.org/bot${BOT_DWIGHT}/setChatMenuButton" \
      -H "Content-Type: application/json" -d "$PAYLOAD" > /dev/null
    echo "[panel-url-notify] Menu button updated → $URL"
  fi
done
EOF

chmod +x /usr/local/bin/panel-url-notify.sh
```

Replace the three placeholder values before continuing.

---

## Step 3 — Install systemd services

### 3a. Panel server

```bash
cat > /etc/systemd/system/openclaw-panel.service << 'EOF'
[Unit]
Description=OpenClaw Panel API + Static Server
After=network.target

[Service]
WorkingDirectory=/root/.openclaw/workspace/openclaw-panel
ExecStart=/usr/bin/node /root/.openclaw/workspace/openclaw-panel/server.js
Restart=always
RestartSec=5
Environment=PANEL_TOKEN=<YOUR_PANEL_TOKEN>

[Install]
WantedBy=multi-user.target
EOF
```

> Generate a token: `openssl rand -hex 24`

### 3b. Panel Cloudflare tunnel

```bash
cat > /etc/systemd/system/openclaw-panel-tunnel.service << 'EOF'
[Unit]
Description=Cloudflare Tunnel for OpenClaw Panel
After=network.target

[Service]
ExecStart=/usr/local/bin/cloudflared tunnel --url http://localhost:3001 --no-autoupdate
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
```

### 3c. URL watcher

```bash
cat > /etc/systemd/system/openclaw-panel-url-watcher.service << 'EOF'
[Unit]
Description=OpenClaw Panel URL Watcher - updates Telegram menu button on tunnel restart
After=openclaw-panel-tunnel.service
BindsTo=openclaw-panel-tunnel.service

[Service]
ExecStart=/bin/bash /usr/local/bin/panel-url-notify.sh
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
```

### 3d. OpenClaw Gateway tunnel

```bash
cat > /etc/systemd/system/openclaw-tunnel.service << 'EOF'
[Unit]
Description=Cloudflare Tunnel for OpenClaw Gateway
After=network.target

[Service]
ExecStart=/usr/local/bin/cloudflared tunnel --url http://localhost:18789 --no-autoupdate
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
```

---

## Step 4 — Enable and start everything

```bash
systemctl daemon-reload

systemctl enable openclaw-panel
systemctl enable openclaw-panel-tunnel
systemctl enable openclaw-panel-url-watcher
systemctl enable openclaw-tunnel

systemctl start openclaw-panel
systemctl start openclaw-panel-tunnel
systemctl start openclaw-panel-url-watcher
systemctl start openclaw-tunnel
```

---

## Step 5 — Verify

```bash
# All four should show "active (running)"
systemctl status openclaw-panel openclaw-panel-tunnel openclaw-panel-url-watcher openclaw-tunnel

# Panel server is up
curl http://localhost:3001

# Tunnel URL was picked up (give it 10-15 seconds)
journalctl -u openclaw-panel-tunnel.service --no-pager | grep trycloudflare

# URL watcher pushed it to Telegram
journalctl -u openclaw-panel-url-watcher.service --no-pager | grep "Menu button updated"
```

After the last check passes, the Telegram menu button on both bots points to the live panel URL automatically — and will keep updating whenever the tunnel restarts.

---

## How it works (URL flow)

```
cloudflared starts → assigns random trycloudflare.com URL
        ↓
panel-url-notify.sh greps the journal for the URL
        ↓
calls setChatMenuButton on both bot tokens
        ↓
Menu button in Telegram → opens panel as Mini App
```

`trycloudflare.com` is free and requires no account. The URL changes on every tunnel restart, which is why the watcher exists.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Panel 404 | Run `npm run build` — `dist/` must exist |
| Tunnel not starting | Check `cloudflared --version`; re-download binary if missing |
| Menu button not updating | Check `journalctl -u openclaw-panel-url-watcher -f` for errors; verify bot tokens in the script |
| Port 3001 already in use | `fuser -k 3001/tcp` then `systemctl restart openclaw-panel` |
| `PANEL_TOKEN` mismatch | Must match the token hardcoded in `src/api.ts` at build time, or set via `localStorage` in Settings |
