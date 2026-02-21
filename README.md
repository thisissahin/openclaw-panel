# OpenClaw Panel IDE 🌙

The official developer control center for managing OpenClaw agents, sessions, and workspaces.

---

## Features

- **Dashboard:** Real-time agent status, model info, and token usage.
- **Memory Editor:** Direct read/write access to `MEMORY.md` and daily logs.
- **File Browser:** Full workspace exploration with inline file editing and saving.
- **Live Logs:** Real-time JSONL session stream via WebSockets (User, Assistant, Tool calls).
- **Skill Manager:** Internal toggle for enabling/disabling agent skills.
- **Mobile Optimized:** Optimized for Telegram Mini Apps with iOS safe-area support and no-zoom font locking.

---

## Tech Stack

- **Frontend:** React, Vite, TypeScript, Lucide Icons, Tailwind-like CSS.
- **Backend:** Express.js, WebSockets (`ws`), Node.js.
- **Integration:** Native Telegram WebApp SDK support.

---

## Development

```bash
cd source
npm install
npm run build   # Build production assets
node server.js  # Start the panel server
```

---

*Built by Shahin & Dolores 🌙*
