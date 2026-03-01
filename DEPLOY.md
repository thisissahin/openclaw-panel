# Deploying the Panel

The panel runs on port 3001 and is exposed to the internet via a free Cloudflare tunnel — no account needed.

## 1. Build

```bash
npm install
npm run build
```

## 2. Start the server

```bash
node server.js
```

## 3. Open a Cloudflare tunnel

```bash
cloudflared tunnel --url http://localhost:3001
```

Cloudflare prints a URL like `https://something-random.trycloudflare.com`. Open that in Telegram or a browser — that's your panel.

## 4. Set it as the Telegram menu button

```bash
curl -s -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d '{"menu_button":{"type":"web_app","text":"🌙 Panel","web_app":{"url":"https://something-random.trycloudflare.com"}}}'
```

## Notes

- The tunnel URL changes every restart. Update the menu button each time.
- `cloudflared` binary: download from [cloudflare.com/downloads](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
- Default panel token is in `server.js` — change it via `PANEL_TOKEN` env var.
