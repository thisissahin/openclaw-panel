# Task: Build OpenClaw Control Panel Mini App

Build a Telegram Mini App control panel for OpenClaw. React + Vite + TypeScript.

## Setup
- Run: npm create vite@latest . -- --template react-ts (press y to overwrite)
- Install: npm install @twa-dev/sdk lucide-react
- Use vanilla CSS only

## App: 4-Tab Bottom Navigation

### Tab 1: Dashboard (default)
- Two agent cards: Dolores 🌙 and Dwight 🏦
- Each shows: name, emoji, model, online/offline status
- Gateway connection indicator at top
- Auto-refresh every 30s

### Tab 2: Memory
- List files: MEMORY.md and memory/*.md
- Tap to view content in fullscreen
- Edit mode with textarea + save button
- File read/write via POST /api/exec

### Tab 3: Files
- Browse /root/.openclaw/workspace/
- Tap to view (read-only)
- Via POST /api/exec {"command":"ls ..."}

### Tab 4: Actions
- Buttons: Restart Gateway | Update OpenClaw | Session Status | Tunnel Status
- Each calls gateway API
- Show result in a toast notification

### Settings (gear icon top-right)
- Gateway URL field (default: https://integrating-comedy-collectors-rating.trycloudflare.com)
- Token field (default: decd6097769042335d4a219057655758f5a9f9d2ff16cfae)
- Save to localStorage

## API
- All requests: Authorization: Bearer {token}
- Status: GET {gatewayUrl}/api/status
- Sessions: GET {gatewayUrl}/api/sessions  
- File ops: POST {gatewayUrl}/api/exec body: {"command":"cat /path"}
- Degrade gracefully on errors

## Styling
- Use Telegram CSS vars: var(--tg-theme-bg-color), var(--tg-theme-text-color), var(--tg-theme-button-color), var(--tg-theme-hint-color)
- Mobile-first, full height, clean and minimal
- Bottom nav bar fixed to bottom

## After Building

### Step 1: Build
npm run build

### Step 2: Serve service
Write to /etc/systemd/system/openclaw-panel.service:
```
[Unit]
Description=OpenClaw Panel Static Server
After=network.target

[Service]
ExecStart=/usr/local/bin/serve /root/openclaw-panel/dist -p 3001 -s
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
Then: npm install -g serve && systemctl daemon-reload && systemctl enable --now openclaw-panel.service

### Step 3: Tunnel service
Write to /etc/systemd/system/openclaw-panel-tunnel.service:
```
[Unit]
Description=Cloudflare Tunnel for OpenClaw Panel
After=network.target

[Service]
ExecStart=/usr/local/bin/cloudflared tunnel --url http://localhost:3001 --no-autoupdate
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
Then: systemctl daemon-reload && systemctl enable --now openclaw-panel-tunnel.service

### Step 4: Get tunnel URL
Sleep 8 seconds then run:
journalctl -u openclaw-panel-tunnel.service | grep trycloudflare.com

### Step 5: Register Mini App
Replace PANEL_URL with the actual trycloudflare URL from step 4:
curl -s -X POST "https://api.telegram.org/bot8528846316:AAEEDZ730e32EUDJuwbLXZDQ-mj75FRPZEA/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d '{"menu_button":{"type":"web_app","text":"Panel","web_app":{"url":"PANEL_URL"}}}'

### Step 6: Notify completion
openclaw system event --text "Done: OpenClaw Panel live at PANEL_URL - Panel button added to Telegram" --mode now

Print the final URL clearly at the end.
