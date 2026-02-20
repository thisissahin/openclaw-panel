# ARCHITECTURE.md — ClawBots Platform Design

## The Core Principle: Full Abstraction on Both Axes

The platform is agnostic on TWO axes:
1. **Runtime Agnostic** — doesn't care what AI engine runs the agent (NanoBot, OpenClaw, anything)
2. **Interface Agnostic** — doesn't care how the user accesses the platform (Telegram, iOS, Android, Web)

Telegram is our first interface. NanoBot is our first runtime.
Neither is hardcoded. Both are adapters.

Think of it like:
- **USB-C:** Your laptop doesn't care if you plug in a monitor, charger, or phone — same port, different devices.
- **Android:** Runs on Samsung, Pixel, OnePlus — same OS, different hardware.
- **Our Platform:** Telegram today, iOS tomorrow, web the day after — same Core, different interface.

---

## The Full Architecture (Two-Axis Abstraction)

```
╔═══════════════════════════════════════════════════════════╗
║                    INTERFACE LAYER                        ║
║         (How users access — all equal, all swappable)     ║
║                                                           ║
║  ┌──────────┐  ┌────────────┐  ┌────────┐  ┌─────────┐  ║
║  │ Telegram │  │    iOS     │  │Android │  │  Web /  │  ║
║  │ Mini App │  │ Native App │  │  App   │  │   PWA   │  ║
║  └────┬─────┘  └─────┬──────┘  └───┬────┘  └────┬────┘  ║
║       │              │             │              │       ║
║  ┌────▼──────────────▼─────────────▼──────────────▼────┐ ║
║  │              Interface Adapter Layer                 │ ║
║  │  - Auth (Telegram initData / JWT / Apple / Google)  │ ║
║  │  - Push (Telegram Bot API / APNs / FCM / WebSocket) │ ║
║  │  - Pay  (TON Connect / Stripe / Apple Pay)          │ ║
║  └─────────────────────────┬────────────────────────────┘ ║
╚═════════════════════════════════════════════════════════════╝
                              │
╔═════════════════════════════▼═══════════════════════════════╗
║                    CLAWBOTS CORE                            ║
║              (The platform — our IP)                        ║
║                                                             ║
║  ┌───────────┐  ┌───────────┐  ┌──────────┐  ┌─────────┐  ║
║  │   User    │  │  Credit   │  │  Skill   │  │  Cron   │  ║
║  │ Registry  │  │  Engine   │  │  Store   │  │ Daemon  │  ║
║  └───────────┘  └───────────┘  └──────────┘  └─────────┘  ║
║                                                             ║
║  ┌─────────────────────────────────────────────────────┐   ║
║  │              Runtime Manager                         │   ║
║  │  Reads user's chosen runtime → routes to adapter    │   ║
║  └─────────────────────────┬───────────────────────────┘   ║
╚═════════════════════════════════════════════════════════════╝
                              │
╔═════════════════════════════▼═══════════════════════════════╗
║                  RUNTIME ADAPTER LAYER                      ║
║         (What executes — all equal, all swappable)          ║
║                                                             ║
║  ┌──────────┐   ┌──────────┐   ┌──────────────────────┐   ║
║  │ NanoBot  │   │OpenClaw  │   │    Future Runtime     │   ║
║  │ Adapter  │   │ Adapter  │   │  (plug in, ship it)   │   ║
║  │          │   │          │   │                       │   ║
║  │ ~80MB    │   │ ~500MB   │   │  ???                  │   ║
║  │ $3/mo    │   │ $15/mo   │   │  Custom               │   ║
║  └──────────┘   └──────────┘   └──────────────────────┘   ║
╚═════════════════════════════════════════════════════════════╝
```

---

## The Interface Adapter (The Contract — Top Layer)

Every interface (Telegram, iOS, Web) must implement:

```typescript
interface ClawBotsInterface {
  // Identity — who is the user?
  authenticate(payload: unknown): Promise<{ userId: string; name: string }>

  // Push — how do we reach the user?
  sendMessage(userId: string, text: string): Promise<void>
  sendCard(userId: string, card: AgentCard): Promise<void>

  // Payments — how do they pay?
  requestPayment(userId: string, amount: TON, reason: string): Promise<TxHash>
}
```

**Telegram Adapter** implements this using:
- `initData` verification for auth
- Bot API (`sendMessage`) for push
- TON Connect for payments

**iOS Adapter** (future) implements this using:
- Apple Sign-In / JWT for auth
- APNs for push notifications
- Apple Pay / TON wallet for payments

**Web Adapter** (future) implements this using:
- Email/Google OAuth for auth
- WebSocket / browser push for notifications
- Stripe or TON for payments

---

## The Runtime Adapter Interface (The Contract — Bottom Layer)

Every runtime that plugs into ClawBots must implement these methods.
We write one adapter per runtime. The rest of the platform never changes.

```typescript
interface ClawBotsRuntime {
  // Lifecycle
  spawn(userId: string, config: BotConfig): Promise<void>
  destroy(userId: string): Promise<void>
  getStatus(userId: string): Promise<BotStatus>

  // Messaging
  send(userId: string, message: string): Promise<string>

  // Memory & Soul
  getMemory(userId: string, file: string): Promise<string>
  setMemory(userId: string, file: string, content: string): Promise<void>
  getSoul(userId: string): Promise<string>
  setSoul(userId: string, content: string): Promise<void>

  // Skills
  installSkill(userId: string, skillName: string): Promise<void>
  listSkills(userId: string): Promise<string[]>

  // Cron / Automations
  getCrons(userId: string): Promise<CronJob[]>
  addCron(userId: string, job: CronJob): Promise<string>
  removeCron(userId: string, jobId: string): Promise<void>

  // Debug
  getLogs(userId: string, lines?: number): Promise<string>
}
```

---

## The Three Adapters We Build First

### 1. NanoBot Adapter (Starter Tier)
- Runs NanoBot in Docker with `restrictToWorkspace: true`
- Maps our interface to NanoBot's CLI and config file format
- Handles cron via `nanobot cron add/remove/list`
- Skills via ClawHub (`clawhub install <skill>`)
- **RAM:** ~80MB per active instance
- **Price to user:** $3-5/month in TON

### 2. OpenClaw Adapter (Pro Tier)
- Runs OpenClaw gateway in Docker
- Maps our interface to OpenClaw's workspace file structure
- Handles cron via OpenClaw's built-in cron system
- Full shell access, advanced tools
- **RAM:** ~500MB per active instance
- **Price to user:** $12-20/month in TON

### 3. Custom/BYO Adapter (Enterprise Tier)
- User brings their own OpenAI-compatible endpoint or self-hosted model
- We just manage the workspace, memory, and UI
- **RAM:** Minimal (we don't run the model)
- **Price to user:** Custom contract

---

## How Adding a New Runtime Works (Future-Proof)

When a new AI runtime launches (let's call it "FutureBot 2027"):
1. We write a `FutureBot` adapter that implements the interface above
2. We add it to the Runtime Manager's registry
3. It appears in the Panel's "Choose Runtime" dropdown
4. Users can upgrade/switch to it with one tap

**Zero changes to the Core. Zero changes to the Panel. Zero changes to the billing.**
Just one new adapter file.

---

## The ClawBots Core (What We Build — Our IP)

This is the valuable part we own entirely:

| Component | What it does |
|---|---|
| **User Registry** | Maps Telegram ID → Wallet → Runtime → Workspace |
| **Runtime Manager** | Routes all requests to correct adapter |
| **Credit Engine** | Tracks token usage per user, debits balance |
| **TON Payment Gateway** | Accepts TON/USDT, tops up credit balance |
| **Skill Store** | Browse, install, and manage skills via ClawHub |
| **Panel (Mini App)** | The UI — Memory, Soul, Files, Actions, Store tabs |
| **Master Cron Daemon** | Aggregates all user cron jobs, fires them on schedule |
| **Provisioning System** | Auto-spawns Docker containers on user signup |

---

## Data Model (The Database)

```sql
-- Users
users (
  telegram_id    TEXT PRIMARY KEY,
  ton_wallet     TEXT,
  runtime        TEXT,   -- 'nanobot' | 'openclaw' | 'custom'
  workspace_path TEXT,
  credits        INTEGER DEFAULT 50000,  -- free trial tokens
  plan           TEXT DEFAULT 'starter',
  created_at     TIMESTAMP
)

-- Cron Jobs
cron_jobs (
  id          TEXT PRIMARY KEY,
  telegram_id TEXT,
  schedule    TEXT,   -- cron expression or interval
  message     TEXT,   -- what to send the bot
  enabled     BOOLEAN DEFAULT true
)

-- Token Ledger
token_ledger (
  id          TEXT PRIMARY KEY,
  telegram_id TEXT,
  amount      INTEGER,  -- positive = credit, negative = debit
  reason      TEXT,     -- 'turn' | 'topup' | 'trial'
  created_at  TIMESTAMP
)

-- Skill Installs
installed_skills (
  telegram_id TEXT,
  skill_name  TEXT,
  installed_at TIMESTAMP
)
```

---

## Development Order (What We Build First)

### Phase 1 — Core Contracts & First Adapters (Week 1-2)
1. **Define both Adapter Interfaces** in TypeScript (1 day)
2. **Telegram Interface Adapter** — auth via initData, push via Bot API (2 days)
3. **NanoBot Runtime Adapter** — first runtime, Docker, cron (3 days)
4. **User Registry + DB** — SQLite: users, credits, crons (2 days)
5. **Provisioning System** — spawn Docker container on signup (2 days)

### Phase 2 — Economics (Week 2-3)
6. **Credit Engine** — debit tokens per turn, check balance (2 days)
7. **TON Payment Adapter** — connect wallet → top up balance (3 days)
8. **Free Trial Flow** — auto-grant 50k tokens on signup (1 day)

### Phase 3 — Marketplace (Week 3-4)
9. **Skill Store UI** — browse, install, manage skills in Panel (3 days)
10. **OpenClaw Runtime Adapter** — second runtime, Pro tier (2 days)
11. **Runtime Selector in Panel** — user picks their engine (1 day)

### Phase 4 — Expand Interfaces (Post-Beta)
12. **Web/PWA** — remove Telegram-specific auth, add JWT (2 days)
13. **iOS/Android** — React Native wrapper or native (2-4 weeks)

**Beta launch target: end of Week 4.**

---

## Key Rule: Telegram Is Not The Product

Telegram is the first delivery channel.
The product is the Core + the Adapters.
Every decision must ask: "Will this work on iOS too?"
If yes → build it. If no → abstract it first.
