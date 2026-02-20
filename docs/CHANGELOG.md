# CHANGELOG.md - ClawBots Platform

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
