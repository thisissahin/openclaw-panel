# ClawBots Platform

> The AgentHub. Discover, install, and extend AI agents — fully inside Telegram.

---

## What Is This?

ClawBots is not "here's your chatbot."

It's a platform where users:
- **Install pre-built agents** for real use cases (personal assistant, trading, support, etc.)
- **Extend agents with skills** — free or paid, official or community-built
- **Talk to and observe** their agents from a Telegram Mini App
- **Automate** their life via cron jobs, webhooks, and multi-channel actions

The runtime (NanoBot/OpenClaw) is the engine under the hood. Users never see it.

---

## Project Structure

```
/source        → Backend code (API, Gateway, Core, Models)
/panel         → Telegram Mini App (React + Vite + TypeScript)
/docs          → All technical documentation
/backups       → DB and config snapshots
```

---

## Key Docs

| Doc | What it covers |
|---|---|
| [VISION.md](./docs/VISION.md) | What we're building and why |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Two-axis abstraction model (runtime + interface agnostic) |
| [DEVELOPER-GUIDE.md](./docs/DEVELOPER-GUIDE.md) | How to build and contribute |
| [CHANGELOG.md](./docs/CHANGELOG.md) | Progress log |

---

## Current Status

**Phase 1 — Infrastructure** (in progress)

| Component | Status |
|---|---|
| Architecture + Docs | ✅ Done |
| Docker Spawner | 🔄 In progress |
| Master Gateway | ⬜ Not started |
| User Registry / DB | ⬜ Not started |
| Credit Engine | ⬜ Not started |
| Panel MVP | ⬜ Not started |
| Main Agent template | ⬜ Not started |

Nothing is user-facing yet. Infrastructure comes first.

---

## MVP Scope (Telegram only)

1. User signs up via Telegram bot
2. Main Agent is auto-spawned in Docker
3. User talks to it — it onboards them, knows the platform, suggests skills
4. User manages it via Telegram Mini App panel
5. Free trial → credit-based → TON payments

---

*Built by Shahin & Dolores 🌙*
