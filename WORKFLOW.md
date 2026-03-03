# OpenClaw Panel — Workflow

## Branching
- Always branch from **main**.
  - `fix/<short>` for bug fixes
  - `feat/<short>` for features
  - `docs/<short>` for docs

## PR target
- Open PRs **into `dev`**.
- Shahin reviews and merges.
- Shahin releases by merging `dev → main` and tagging.

## Local server integration branch (NOT pushed)
Purpose: combine multiple pending fixes for Telegram testing on Hetzner without polluting upstream.

- Branch name: `integrate/farid`
- Rules:
  - Exists only on the server (do not push).
  - Merge local fix/feat branches into it for staging.
  - Production-ish Telegram test deploy builds from this branch.

## Deploy (Hetzner)
- Repo path: `/home/jarvis/Projects/openclaw-panel`
- Build:
  - `npm install`
  - `npm run build`
- Restart:
  - `systemctl --user restart openclaw-panel.service`

## Mobile safety checklist (Telegram WebView)
- Avoid calling `Telegram.WebApp.requestFullscreen()` by default.
- Lazy-mount heavy tabs (Terminal/PTY/WS) so hidden tabs don't initialize.

