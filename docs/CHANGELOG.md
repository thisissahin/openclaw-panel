# CHANGELOG.md - ClawBots Platform

## [0.2.0] - 2026-02-20
### Vision Locked
- **Product Reframe**: ClawBots is an **AgentHub**, not just an AI hosting platform.
- **Main Agent**: Every user gets a platform-aware concierge agent on signup. It onboards them, teaches the system, and acts as their primary assistant. No tutorial UI needed.
- **Pre-Built Agents**: Platform ships with curated agent templates for specific use cases. Users install one tap.
- **Skill Store**: Skills are plugins — free or paid, official or community-built. Extend any agent.
- **MVP Scope**: Telegram Mini App only. Architecture stays interface-agnostic for web/iOS/Android later.
- **Build Order Confirmed**: Infrastructure (Phase 1) first. No user-facing work until Docker Spawner + Gateway + DB are solid.
- **Docs Updated**: README and VISION.md rewritten to reflect the above.


## [0.1.0] - 2026-02-20
### Added
- **Unified Platform Repo**: Consolidated all docs and source code into `clawbots-platform`.
- **Docker Provisioning Core**: Implemented `Provisioning` class for isolated user workspaces.
- **Agent Lifecycle API**: Added `/api/agent/start`, `/api/agent/stop`, and `/api/agent/status` endpoints.
- **Workspace Linking**: Set up `dolores` workspace to track `clawbots-platform` as a submodule.

### Infrastructure
- **Panel V2**: Custom Express/Vite/React panel live at `https://openclaw-panel.trycloudflare.com` (Example).
- **SQLite Schema**: Initialized `platform.db` for users, ledger, and crons.
- **Websocket Logs**: Real-time log streaming from agent containers to the Panel.

## [Initial] - 2026-02-19
### Defined
- **Project Vision**: "ClawBots" Platform (Decentralized AI OS on Telegram/TON).
- **Architecture**: Two-axis abstraction model (Runtime-agnostic, Interface-agnostic).
- **Project Renaming**: Rebranded from "Clawd" to "ClawBots" to avoid conflicts.
