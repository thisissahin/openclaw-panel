# Contributing to OpenClaw Panel

Thanks for contributing — this project moves fast, and high-signal PRs are welcome.

## Quick Start

```bash
git clone https://github.com/thisissahin/openclaw-panel.git
cd openclaw-panel
npm install
npm run build
node server.js
```

Panel default URL: `http://localhost:3001`

## Branch & Commit Conventions

- Branch from `dev`
- Branch naming:
  - `feat/<short-topic>`
  - `fix/<short-topic>`
  - `docs/<short-topic>`
- Commit style:
  - `feat: ...`
  - `fix: ...`
  - `docs: ...`
  - `chore: ...`

## Pull Request Guidelines

Before opening a PR:

- [ ] Rebase on latest `dev`
- [ ] Keep scope focused (one concern per PR)
- [ ] Include screenshots/GIFs for UI changes
- [ ] Add clear test steps in PR description
- [ ] Update docs when behavior changes

PR title format: `<type>: <short summary>`

## Project Areas (where to contribute)

- `src/features/dashboard/*` — dashboard UI and agent creation flow
- `src/features/terminal/*` + `src/TerminalView.tsx` — terminal UX
- `src/AgentDetail.tsx` — session/usage/cron controls
- `src/api.ts` — frontend API client
- `server.js` — backend routes, OpenClaw CLI integration
- `README.md` — docs and onboarding

## Reporting Bugs

Please include:

- Environment (OS, browser, mobile/desktop)
- Steps to reproduce
- Expected vs actual behavior
- Console/network errors
- Screenshots if relevant

## Security

Do not open public issues for sensitive vulnerabilities.
Use private disclosure via repository security contact/path.

## Review & Merge Flow

- Default integration branch: `dev`
- `main` is for stable/release-ready changes
- Maintainers may squash commits on merge
