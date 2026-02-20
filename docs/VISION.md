# VISION.md: ClawBots Platform

> Last updated: 2026-02-20 — Vision locked in conversation with Shahin.

---

## 1. What We're Building

**ClawBots is an AgentHub.**

Not "here's your chatbot." Not "here's your OpenClaw instance." Those are backend details users don't care about.

ClawBots is the place where:
- You **discover and install pre-built agents** for real use cases
- You **extend any agent** with skills and plugins (free or paid, official or community-made)
- You **build and publish** your own agents and skills
- You **talk to, observe, and manage** your agents from one place

Think: **App Store meets Hugging Face meets personal AI** — but fully inside Telegram, with TON-native payments.

---

## 2. The Core Product Loop

```
Discover Agent → Install → Talk to It → Extend with Skills → Automate
```

Every step is one tap or one message. No docs, no setup, no config files.

---

## 3. The Main Agent (MVP Foundation)

Every new user gets **The Main Agent** automatically on signup.

This is not a generic assistant. It is the **platform concierge** — it:
- Knows the entire ClawBots system
- Onboards the user through natural conversation
- Suggests and installs skills based on user needs
- Teaches the user how everything works
- Acts as their primary daily assistant

**The agent is the onboarding UI.** No tutorial screens. No docs. You just talk.

The Main Agent is the first pre-built agent. More will follow.

---

## 4. Pre-Built Agents (The "Store")

Agents are templates for specific use cases. Users install them with one tap. They can also create their own.

**Launch agents (to be defined):**
- 🤖 **Main Agent** — Personal assistant + platform guide (default for all users)
- More to be defined based on market research

Agents are distinct from skills:
- **Agent** = a full persona with a purpose (e.g., "Trading Assistant")
- **Skill** = a capability plugin installed into an agent (e.g., "Crypto Price Alerts")

---

## 5. The Skill Store

Skills extend agents. Free or paid. Official or community-built.

Examples:
- Web search
- Crypto price alerts
- Daily news briefing
- WhatsApp integration
- Calendar sync
- Custom cron automations

One-tap install from the Panel or via conversation with the agent.

---

## 6. Competitive Position

| Feature | ChatGPT / Claude | **ClawBots** |
|---|---|---|
| Ownership | They own your data | You own your memory files |
| Customization | System prompt at best | Full Soul + Skills + Agents |
| Automation | None | Cron, webhooks, multi-channel |
| Economy | Fiat subscription | TON-native, pay-per-use |
| Ecosystem | Closed | Open skill marketplace |
| Entry | Web app | Telegram (native to where people already are) |

---

## 7. Interface Strategy

**MVP: Telegram Mini App only.**

The UI is a Telegram Mini App. Auth via `initData`. Payments via TON Connect. Delivery via Telegram Bot API.

**Future interfaces (architecture supports all of these):**
- Web / PWA
- iOS native app
- Android native app

The Core never changes when we add interfaces. Only adapters are added.

---

## 8. Technical Foundation

The platform runs on two abstraction axes:
1. **Runtime-agnostic** — NanoBot (Starter), OpenClaw (Pro), more in future
2. **Interface-agnostic** — Telegram today, web/iOS/Android tomorrow

Users never see the words "NanoBot" or "OpenClaw." They see their agent.

See `ARCHITECTURE.md` for full technical detail.

---

## 9. Roadmap

### Phase 1 — Infrastructure (Current Priority)
**Goal:** One server → 1,000 users. Nothing user-facing yet.

- [ ] Docker Spawner — spawn/destroy agent containers per user
- [ ] Master Gateway — route Telegram messages to correct user container
- [ ] User Registry — SQLite: users, credits, runtime, workspace
- [ ] Credit Engine — debit tokens per turn, check balance before allowing turn
- [ ] Provisioning System — auto-spawn on signup, auto-generate Soul

### Phase 2 — The Main Agent & Panel MVP
**Goal:** First user can sign up, get their Main Agent, talk to it, see it in the Panel.

- [ ] Main Agent template (Soul + onboarding instructions + platform knowledge)
- [ ] Telegram Mini App Panel v1: My Agents, Memory, Logs tabs
- [ ] **Skill Manager (Dynamic Context Toggle)** — UI to enable/disable skills to save tokens/cost
- [ ] Free trial (50k tokens auto-granted on signup)

### Phase 3 — TON Economic Layer
**Goal:** Monetization live.

- [ ] TON Connect in Panel
- [ ] Credit top-up flow (Pay TON → credits added)
- [ ] Subscription gating (check balance before each turn)

### Phase 4 — Skill Store
**Goal:** Platform becomes a marketplace.

- [ ] Skill Store UI in Panel
- [ ] First 5 curated skills (official)
- [ ] One-tap install from Panel and via agent conversation
- [ ] Community skill submission pipeline

### Phase 5 — Beta Launch
**Goal:** First 100 paying users.

- [ ] Referral system ("invite a friend → 100k tokens")
- [ ] Agent marketplace (browse + install pre-built agents)
- [ ] Public launch

---

## 10. What We Have Today

| Component | Status |
|---|---|
| Architecture docs | ✅ Done |
| ARCHITECTURE.md (adapter interfaces) | ✅ Done |
| Panel v2 UI (React, basic) | ✅ Exists but not real |
| Docker Spawner | 🔄 In progress |
| Master Gateway | ⬜ Not started |
| User Registry / DB | ⬜ Not started |
| Main Agent template | ⬜ Not started |
| TON integration | ⬜ Not started |
| Skill Store | ⬜ Not started |

**Honest assessment: infrastructure is Phase 1 and it's not done. That's where we build next.**
