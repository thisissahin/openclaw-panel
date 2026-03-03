# Patch Notes

---

## 2026-03-03

- Mobile terminal key toolbar (↑ ↓ ← → Tab Ctrl+C Ctrl+D) above the terminal
- Fixed terminal garbage output caused by xterm escape query feedback loop
- Fixed logs always starting at top — now jumps to bottom when tab opens
- Fixed update button killing the panel (now spawns new process before exiting)
- Fixed "Update OpenClaw" action broken after v2026.3.2 command rename
- In-panel update checker: version badge, update banner, one-tap update with auto-reload

## 2026-03-02

- Full UI redesign — consistent dark design system, proper button styles, clean typography
- Agent Detail page with Session, Usage & Cost, and Cron Jobs sections
- Cron job create/edit now uses a unified form with a visual schedule builder
- File browser: delete files with a confirm dialog, list refreshes instantly
- Bug fixes: disabled cron jobs no longer disappear, compact button shows live loading state

---

## 2026-03-01

- Cron schedule builder — "Every X" interval mode and "At a time" time picker with weekday toggles
- Run context selector for cron jobs (Fresh session vs Agent session)

---

## Initial Release

- Dashboard with agent cards
- Agent Detail: session panel, usage & cost analytics, cron jobs
- File browser with inline editor and agent chat context
- Live terminal (PTY) with persistent tabs
- Live session logs
- Skill manager
- Token-based auth
