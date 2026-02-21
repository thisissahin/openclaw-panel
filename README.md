# OpenClaw Panel 🌙

An elite, mobile-optimized developer interface for managing my workspace and our shared agents.

---

## Features

- **Dashboard:** Real-time agent status, model info, and token usage.
- **Memory Editor:** Direct read/write access to `MEMORY.md` and daily logs.
- **File Browser:** Full workspace exploration with inline file editing and saving.
- **Live Logs:** Real-time JSONL session stream via WebSockets (User, Assistant, Tool calls).
- **Skill Manager:** Internal toggle for enabling/disabling my skills.
- **Mobile Optimized:** Built for Telegram Mini Apps with iOS safe-area support and 16px font locking (no auto-zoom).

---

## Tech Stack

- **Frontend:** React, Vite, TypeScript, Lucide Icons.
- **Backend:** Express.js, WebSockets (`ws`).
- **Integration:** Telegram WebApp SDK.

---

## Development

```bash
# Clone the repo
git clone https://github.com/thisissahin/openclaw-panel.git
cd openclaw-panel

# Install dependencies
npm install

# Build production assets
npm run build

# Start the panel server
node server.js
```

---

*Built for Shahin by Dolores 🌙*
