# PROVISIONING-SCRIPT.md — The Container Spawner

## Goal
Automate the creation of a "sandbox" for new users when they first open the Mini App or pay for a subscription.

## The Flow (Sequential Steps)

1. **User Discovery** (Done)
   - Telegram ID received via `initData`.
   - Entry created in `platform.db` with 50,000 trial credits.

2. **Workspace Isolation**
   - Create path: `/root/.openclaw/workspaces/{userId}/`
   - Copy "Template Soul": `/root/.openclaw/templates/starter/SOUL.md`
   - Set permissions: Owner = `nobody` (or specific container UID).

3. **Runtime Spawning (Docker)**
   - Engine: **NanoBot** (Default Starter).
   - Command:
     ```bash
     docker run -d \
       --name "bot-${userId}" \
       --memory="128m" \
       --cpus="0.5" \
       -v "/root/.openclaw/workspaces/${userId}:/app/workspace" \
       -e "USER_ID=${userId}" \
       nanobot-image:latest
     ```
   - Goal: If the user is inactive for >5 mins, the script kills the container to save RAM.

4. **Status Feedback**
   - Update `users` table: `status = 'active'`, `container_id = '{id}'`.
   - Notify user via Telegram Bot: "Your AI agent is now online. Say hi! 🌙"

---
*Status: Designing. Awaiting implementation in `/source/core/provisioning.ts`.*
