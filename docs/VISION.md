# VISION.md: The "ClawBots" Platform

## 1. The Core Vision
To build the first **Decentralized AI Agent OS** inside Telegram. 

Unlike ChatGPT (which is a centralized chatbot), "ClawBots" is a platform where users **own** their AI's memory, **install** specialized skills like apps, and **automate** their life via Telegram.

---

## 2. Competitive Advantage (The "Why")
| Feature | ChatGPT/Claude | **ClawBots (Our Platform)** |
| :--- | :--- | :--- |
| **Ownership** | They own your data. | **You** own the Memory files. |
| **Control** | Black box "brain." | **Live Dashboard** to edit the "Soul." |
| **Actions** | Mostly just chat. | **Executes tasks** (WhatsApp, Cron, Web). |
| **Economy** | Fiat subscription. | **TON-native** (Pay-per-token/Skill). |
| **Platform** | Closed ecosystem. | **Skill Store** (Open for developers). |

---

## 3. The Architecture (How it works)
- **User Entry:** Telegram Bot + Mini App (The Dashboard).
- **Payment Layer:** TON Wallet (Connect → Pay TON → Unlock Credits/Skills).
- **Execution Layer:** Runtime Marketplace — user picks their engine, we run it in Docker.
- **Plugin Layer:** "Skill Store" powered by ClawHub (One-tap install of new powers, works across all runtimes).

## 3a. The "Runtime Marketplace" (Core Differentiator)
ClawBots is **runtime-agnostic**. We don't lock users into one engine. They choose based on budget and power:

| Tier | Runtime | RAM/user | Price |
|---|---|---|---|
| **Starter** | NanoBot (Python, ~4k lines) | ~80MB | $3/mo in TON |
| **Pro** | OpenClaw (Full power) | ~500MB | $15/mo in TON |
| **Enterprise** | ClawBots Runtime (our own, future) | Optimized | Custom |

- **NanoBot** has built-in Cron, Docker sandboxing (`restrictToWorkspace: true`), ClawHub skills, and multi-channel support. Perfect for 95% of users.
- **OpenClaw** is for power users who need full shell access, advanced tools, and maximum flexibility.
- **Our Own Runtime** (Phase 4+): Built specifically for multi-tenancy, optimized for cost at scale.

---

## 4. Development Roadmap (The "Serious" Plan)

### Phase 1: Infrastructure & Multi-Tenancy (2-3 Weeks)
- **Goal:** Move from "One Server, One User" to "One Server, 1,000 Users."
- **Tasks:**
    - Build a **Provisioning Script** (Spawns a new Dockerized agent on user signup).
    - Build a **Master Gateway** to route Telegram messages to the correct user sandbox.
    - Implement **Token Tracking** per user ID.

### Phase 2: The TON Economic Layer (2 Weeks)
- **Goal:** Enable monetization and "One-Tap" payments.
- **Tasks:**
    - Add **TON Connect** to the Panel.
    - Build the **"Credit Refill"** flow (Pay TON → Update SQL database balance).
    - Implement **Subscription gating** (Check balance before allowing an AI turn).

### Phase 3: The Skill Store (2 Weeks)
- **Goal:** Turn the Panel into a marketplace.
- **Tasks:**
    - Create the **"Store" UI** in the Mini App.
    - Curate 5 **"Starter Skills"** (e.g., WhatsApp Summary, Daily News, Crypto Alert).
    - Implement **One-Tap Install** (Panel tells Agent to `clawhub install`).

### Phase 4: Beta & Viral Growth (Launch)
- **Goal:** Get the first 100 paying users.
- **Tasks:**
    - **Referral System:** "Invite a friend, get 100k tokens."
    - **Influencer Kits:** Create specialized "Souls" for famous traders/creators.
    - **Onboarding Wizard:** A 3-step setup inside the Mini App.

---

## 5. Next Immediate Steps
1. **Security Audit:** Can we truly "trap" a user in a Docker container?
2. **Database Choice:** Decide on a simple DB (SQLite/PostgreSQL) to track user balances.
3. **TON Connect Manifest:** Set up the required metadata to allow wallet connections.
