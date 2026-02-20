# DEVELOPER-GUIDE.md - ClawBots Platform

## Getting Started
The platform is built with a decoupled architecture to ensure scalability.

### Project Structure
- **/source**: The core code (Express, Vite, React, TypeScript).
  - **/core**: Business logic (Provisioning, Lifecycle).
  - **/models**: Database models (User, Ledger).
  - **/adapters**: External service wrappers (Telegram, TON).
- **/docs**: Architecture, Vision, and Blueprints.

### Development Workflow
1. **Work in the Source Folder**: All code changes go in `/source`.
2. **Commit Often**: Push to the `clawbots-platform` repository for version control.
3. **Use the Panel**: The panel is the primary interface for managing agents.

### Environment Variables
- `PANEL_TOKEN`: Secret key for API authentication.
- `WORKSPACE_ROOT`: Path where user workspaces are stored (`/root/.openclaw/workspaces`).

### Local Development
1. `cd source`
2. `npm install`
3. `npm run dev` (for frontend)
4. `node server.js` (for backend)
