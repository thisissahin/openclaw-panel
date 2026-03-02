# Patch Notes

---

## [dev] 2026-03-02

### UI Overhaul
- Full design system rewrite — CSS variables (`--surface`, `--text-2`, `--accent`, `--danger`, etc.) replace hardcoded hex values throughout
- Defined `.btn`, `.btn-primary`, `.btn-danger`, `.btn-ghost` button classes — previously undefined, causing broken/invisible buttons
- Defined `.input` form class with focus ring and consistent styling
- `.section-card` / `.section-header` classes for collapsible panels
- Consistent dark palette: `#0d0d0d` bg → `#161616` surface → `#1e1e1e` elevated
- Smooth toast animation (`toastIn` keyframe)

### Agent Detail — Full Redesign
- Sticky header with agent emoji, name, ID, online dot, and model badge
- Three collapsible sections: Session, Usage & Cost, Cron Jobs
- **Session panel:** context bar shows `used / max` with color-coded fill (blue → amber → red), last-active timestamp, model badge, Compact/Reset actions
- **Usage panel:** 2×2 stat grid (all-time + today tokens/cost), 7-day bar chart, per-provider rate-limit gauges
- **Cron panel:** cleaned up layout, prompt preview on each card separated by subtle divider

### Cron Jobs — Unified Create/Edit Form
- Removed separate inline card editing — pencil button now opens the full create form pre-filled with job data
- Schedule parsed back from stored job (interval ms → unit/value, cron expr → hour/min/weekdays)
- Form title and submit button update based on create vs. edit mode ("New Job" / "Save Changes")
- Removed run history button (Clock) and all associated state
- Disabled jobs dim to 55% opacity instead of disappearing

### File Browser — Delete
- Trash icon added to every file row and the file viewer header
- Confirm dialog shows file path before deleting
- File list refreshes live after delete (no manual reload needed)
- Auto-closes viewer if the currently open file is deleted
- Backend: `DELETE /api/files/delete?path=...` endpoint with path traversal guard

### Bug Fixes
- `deleteFile` API call was using wrong localStorage key (`panel_token` → `token`), causing HTML 401 responses parsed as JSON
- `getCronJobs` now passes `includeDisabled: true` — disabled jobs were disappearing from the list

---

## [dev] 2026-03-01

### Cron Schedule Builder
- Replaced preset/daily/advanced tabs with two-mode picker: "Every X" (interval) and "At a time" (time picker)
- "Every X" mode: number input + minutes/hours/days dropdown
- "At a time" mode: HH:MM selects (5-min steps) + weekday toggles (empty = every day)
- Live schedule preview below picker
- Advanced cron expression hidden under a `<details>` collapse — overrides picker when filled

### Run Context Selector
- Replaced `isolated`/`main` toggle buttons with descriptive option cards
- 🔄 Fresh session — clean context each run
- 💬 Agent session — runs inside the agent's live context

### Compact Button
- Loading state: button switches to accent border/color + spinning icon while compacting
- Polls session tokens after compact and auto-confirms when context shrinks

---

## [dev] 2026-02-xx — Initial Panel Build

### T1 — Agent Detail Page
- Dashboard agent cards are clickable
- Opens Agent Detail view with `selectedAgent` state in App.tsx

### T2 — Session Panel
- Session key, last active, token breakdown
- Compact (`POST /api/sessions/:key/compact`) and Reset (`POST /api/sessions/:key/reset`) actions

### T3 — Usage & Cost Analytics
- Per-agent token/cost stats
- Usage snapshots in SQLite `usage_snapshots` table
- `GET /api/usage/:agentId`

### T4 — Cron Jobs
- Full cron CRUD via `cron.*` gateway calls
- Run history via `cron.runs`
- Per-agent cron only — no global Cron tab

---
