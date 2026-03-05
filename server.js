import express from 'express';
import cors from 'cors';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, watchFile, unwatchFile, rmSync } from 'fs';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { randomBytes } from 'crypto';
import os from 'os';
import pty from 'node-pty';
import { SkillManager } from './core/skill-manager.js';
import { tabs as dbTabs, logs as dbLogs, buffers as dbBuffers, MAX_BUFFER } from './core/db.js';
import { WebSocket } from 'ws';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PANEL_PORT || 3001;

// ── OpenClaw home detection ───────────────────────────────────
const OPENCLAW_HOME = process.env.OPENCLAW_HOME ||
  join(os.homedir(), '.openclaw');

// ── Token management ─────────────────────────────────────────
// Use PANEL_TOKEN env var, or auto-generate and persist on first run.
const TOKEN_FILE = join(OPENCLAW_HOME, 'panel', '.token');
function loadOrCreateToken() {
  if (process.env.PANEL_TOKEN) return process.env.PANEL_TOKEN;
  try {
    if (existsSync(TOKEN_FILE)) {
      return readFileSync(TOKEN_FILE, 'utf-8').trim();
    }
  } catch {}
  const token = randomBytes(24).toString('hex');
  try {
    mkdirSync(join(OPENCLAW_HOME, 'panel'), { recursive: true });
    writeFileSync(TOKEN_FILE, token, 'utf-8');
    console.log(`\n🔑 Panel token generated. Add to your app:\n   Token: ${token}\n   Or set PANEL_TOKEN env var.\n`);
  } catch (e) {
    console.warn('Could not persist token:', e.message);
  }
  return token;
}
const TOKEN = loadOrCreateToken();

// ── Agent discovery ───────────────────────────────────────────
const AGENTS_DIR = join(OPENCLAW_HOME, 'agents');

function discoverAgents() {
  try {
    return readdirSync(AGENTS_DIR).filter(name => {
      try { return statSync(join(AGENTS_DIR, name)).isDirectory(); } catch { return false; }
    });
  } catch { return []; }
}

function parseIdentity(agentId) {
  // Try to read IDENTITY.md from the agent's workspace
  const ws = getAgentWorkspace(agentId);
  try {
    const content = readFileSync(join(ws, 'IDENTITY.md'), 'utf-8');
    const nameRaw = content.match(/\*\*Name:\*\*\s*(.+)/)?.[1]?.trim() || '';
    const emojiRaw = content.match(/\*\*Emoji:\*\*\s*(.+)/)?.[1]?.trim() || '';

    const cleanedName = nameRaw
      .replace(/[\*_`]/g, '')
      .replace(/^[\[(]+|[\])]+$/g, '')
      .trim();

    let name = cleanedName || agentId;
    if (/^(not set|your name|name)$/i.test(name)) name = agentId;

    // IDENTITY placeholders like "_(your emoji)_" should not leak into UI.
    let emoji = emojiRaw
      .replace(/[\*_`]/g, '')
      .trim()
      .split(/\s+/)[0] || '🤖';

    if (!emoji || emoji.startsWith('(') || /^(your|not)$/i.test(emoji)) emoji = '🤖';

    return { name, emoji };
  } catch {}
  return { name: agentId, emoji: '🤖' };
}

function getAgentWorkspace(agentId) {
  // Convention: main agent → ~/.openclaw/workspace
  //             others     → ~/.openclaw/workspace-<agentId>
  if (agentId === 'main') return join(OPENCLAW_HOME, 'workspace');
  return join(OPENCLAW_HOME, `workspace-${agentId}`);
}

// ── Express app ───────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// Workspace for a request (from X-Agent-Id header)
function getWorkspace(req) {
  const agentId = req.headers['x-agent-id'] || 'main';
  return getAgentWorkspace(agentId);
}

// Serve static panel files
app.use(express.static(join(__dirname, 'dist')));

// Public endpoint: lets the frontend check reachability and version
app.get('/api/ping', (_, res) => res.json({ ok: true, version: '1.0.0' }));

// Auth middleware
app.use('/api', (req, res, next) => {
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${TOKEN}`) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

// ── Agent/Session status ──────────────────────────────────────
app.get('/api/agents', (req, res) => {
  const configured = readConfig()?.agents?.list || [];
  const discovered = discoverAgents();
  const ids = [...new Set([...configured.map(a => a.id), ...discovered])].filter(Boolean);

  const agents = ids.map(id => {
    const configuredAgent = configured.find(a => a.id === id) || {};
    const { name, emoji } = parseIdentity(id);
    try {
      const sessFile = join(AGENTS_DIR, id, 'sessions', 'sessions.json');
      const data = JSON.parse(readFileSync(sessFile, 'utf-8'));
      const key = `agent:${id}:main`;
      const sess = data[key] || {};
      return {
        id,
        name: configuredAgent.name || name,
        emoji,
        model: sess.model || configuredAgent.model || '—',
        online: !!sess.model,
        tokens: sess.totalTokens || 0,
        updatedAt: sess.updatedAt || null,
      };
    } catch {
      return { id, name: configuredAgent.name || name, emoji, online: false, model: configuredAgent.model || '—' };
    }
  });
  res.json({ ok: true, agents });
});

app.post('/api/agents/create', async (req, res) => {
  try {
    const { id: rawId, name, botToken, model } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ ok: false, error: 'name required' });
    if (!botToken?.trim()) return res.status(400).json({ ok: false, error: 'botToken required' });

    const id = (rawId || name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!id) return res.status(400).json({ ok: false, error: 'invalid id' });
    if (id === 'main') return res.status(400).json({ ok: false, error: 'id "main" is reserved' });

    // Validate Telegram token early.
    const verify = await fetch(`https://api.telegram.org/bot${botToken.trim()}/getMe`);
    const verifyJson = await verify.json();
    if (!verifyJson?.ok) return res.status(400).json({ ok: false, error: 'Invalid Telegram bot token' });

    const newBotToken = botToken.trim();

    const cfg = readConfig();
    cfg.agents = cfg.agents || {};
    cfg.agents.list = cfg.agents.list || [];
    cfg.channels = cfg.channels || {};
    cfg.channels.telegram = cfg.channels.telegram || { enabled: true };
    cfg.channels.telegram.accounts = cfg.channels.telegram.accounts || {};
    cfg.bindings = cfg.bindings || [];

    if (cfg.agents.list.some(agent => agent.id === id)) {
      return res.status(400).json({ ok: false, error: `Agent "${id}" already exists` });
    }
    if (cfg.channels.telegram.accounts[id]) {
      return res.status(400).json({ ok: false, error: `Telegram account "${id}" already exists` });
    }

    const baseAccount = cfg.channels.telegram.accounts?.default || {};

    cfg.agents.list.push({
      id,
      name: name.trim(),
      workspace: join(OPENCLAW_HOME, `workspace-${id}`),
      agentDir: join(OPENCLAW_HOME, 'agents', id, 'agent'),
      ...(model?.trim() ? { model: model.trim() } : {}),
    });

    cfg.channels.telegram.accounts[id] = {
      dmPolicy: baseAccount.dmPolicy || cfg.channels.telegram.dmPolicy || 'allowlist',
      botToken: newBotToken,
      allowFrom: baseAccount.allowFrom || cfg.channels.telegram.allowFrom || [],
      groupPolicy: baseAccount.groupPolicy || cfg.channels.telegram.groupPolicy || 'allowlist',
      streaming: baseAccount.streaming || cfg.channels.telegram.streaming || 'partial',
    };

    cfg.bindings.push({
      agentId: id,
      match: { channel: 'telegram', accountId: id }
    });

    mkdirSync(join(AGENTS_DIR, id), { recursive: true });
    const workspacePath = join(OPENCLAW_HOME, `workspace-${id}`);
    mkdirSync(workspacePath, { recursive: true });

    const identityPath = join(workspacePath, 'IDENTITY.md');
    if (!existsSync(identityPath)) {
      writeFileSync(identityPath, `# IDENTITY.md - Who Am I?\n\n- **Name:** ${name.trim()}\n- **Creature:** AI Assistant\n- **Vibe:** Helpful and focused\n- **Emoji:** 🤖\n- **Avatar:** _(not set)_\n`, 'utf-8');
    }

    // Copy the existing default bot's menu button to the new bot so Panel appears out of the box.
    let menuButtonSynced = false;
    let menuButtonWarning = '';
    try {
      const templateBotToken = cfg.channels?.telegram?.accounts?.default?.botToken || cfg.channels?.telegram?.botToken;
      if (templateBotToken) {
        const menuRes = await fetch(`https://api.telegram.org/bot${templateBotToken}/getChatMenuButton`);
        const menuJson = await menuRes.json();
        const menuButton = menuJson?.result?.menu_button;

        if (menuJson?.ok && menuButton && menuButton.type !== 'default') {
          const setRes = await fetch(`https://api.telegram.org/bot${newBotToken}/setChatMenuButton`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ menu_button: menuButton })
          });
          const setJson = await setRes.json();
          if (setJson?.ok) menuButtonSynced = true;
          else menuButtonWarning = setJson?.description || 'Failed to apply menu button';
        } else {
          menuButtonWarning = 'Template bot has no custom menu button configured';
        }
      } else {
        menuButtonWarning = 'No template bot token found to copy menu button from';
      }
    } catch (error) {
      menuButtonWarning = String(error);
    }

    writeConfig(cfg);

    const proc = spawn('openclaw', ['gateway', 'restart'], {
      detached: true, stdio: 'ignore',
      env: { ...process.env, HOME: os.homedir() }
    });
    proc.unref();

    res.json({
      ok: true,
      agent: { id, name: name.trim(), botUsername: verifyJson?.result?.username || '' },
      menuButtonSynced,
      ...(menuButtonWarning ? { warning: menuButtonWarning } : {})
    });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});

app.delete('/api/agents/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });
    if (id === 'main') return res.status(400).json({ ok: false, error: 'main agent cannot be deleted' });

    const cfg = readConfig();
    const existing = cfg?.agents?.list?.some(agent => agent.id === id);
    if (!existing) return res.status(404).json({ ok: false, error: `Agent "${id}" not found` });

    // Best-effort: remove cron jobs related to this agent.
    try {
      const cronList = await gatewayCall('cron.list', { includeDisabled: true });
      const jobs = cronList?.jobs || cronList || [];
      const related = jobs.filter(job =>
        job?.sessionTarget === id ||
        job?.payload?.agentId === id ||
        String(job?.name || '').toLowerCase().includes(id.toLowerCase())
      );
      for (const job of related) {
        const jobId = job.jobId || job.id;
        if (jobId) {
          try { await gatewayCall('cron.remove', { jobId }); } catch {}
        }
      }
    } catch {}

    cfg.agents.list = (cfg.agents.list || []).filter(agent => agent.id !== id);

    if (cfg.channels?.telegram?.accounts?.[id]) {
      delete cfg.channels.telegram.accounts[id];
    }

    cfg.bindings = (cfg.bindings || []).filter(binding => {
      const match = binding?.match || {};
      return !(binding.agentId === id || (match.channel === 'telegram' && match.accountId === id));
    });

    writeConfig(cfg);

    rmSync(join(AGENTS_DIR, id), { recursive: true, force: true });
    rmSync(join(OPENCLAW_HOME, `workspace-${id}`), { recursive: true, force: true });

    const proc = spawn('openclaw', ['gateway', 'restart'], {
      detached: true, stdio: 'ignore',
      env: { ...process.env, HOME: os.homedir() }
    });
    proc.unref();

    res.json({ ok: true, deleted: id });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});

// ── Terminal tabs (DB-backed) ─────────────────────────────────
app.get('/api/tabs', (req, res) => {
  const agentId = req.headers['x-agent-id'] || 'main';
  res.json({ ok: true, tabs: dbTabs.list(agentId) });
});

app.post('/api/tabs', (req, res) => {
  const agentId = req.headers['x-agent-id'] || 'main';
  const { id, name } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });
  dbTabs.upsert(id, name || 'Terminal', agentId);
  res.json({ ok: true, tab: dbTabs.get(id) });
});

app.patch('/api/tabs/:id', (req, res) => {
  const { name } = req.body;
  if (name) dbTabs.rename(req.params.id, name);
  else dbTabs.touch(req.params.id);
  res.json({ ok: true });
});

app.delete('/api/tabs/:id', (req, res) => {
  const id = req.params.id;
  dbTabs.delete(id);
  dbBuffers.delete(id);
  memBuffers.delete(id);
  clearTimeout(flushTimers.get(id));
  flushTimers.delete(id);
  const proc = ptySessions.get(id);
  if (proc) { try { proc.kill(); } catch {} ptySessions.delete(id); }
  res.json({ ok: true });
});

// ── Memory files ──────────────────────────────────────────────
app.get('/api/memory/list', (req, res) => {
  try {
    const WORKSPACE = getWorkspace(req);
    const files = ['MEMORY.md'];
    try {
      const daily = readdirSync(join(WORKSPACE, 'memory')).filter(f => f.endsWith('.md'));
      files.push(...daily.map(f => `memory/${f}`));
    } catch {}
    res.json({ ok: true, files });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});

app.get('/api/memory/read', (req, res) => {
  try {
    const WORKSPACE = getWorkspace(req);
    const file = req.query.file;
    if (!file || file.includes('..')) return res.status(400).json({ error: 'Invalid path' });
    const content = readFileSync(join(WORKSPACE, file), 'utf-8');
    res.json({ ok: true, content });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});

app.post('/api/memory/write', (req, res) => {
  try {
    const WORKSPACE = getWorkspace(req);
    const { file, content } = req.body;
    if (!file || file.includes('..')) return res.status(400).json({ error: 'Invalid path' });
    writeFileSync(join(WORKSPACE, file), content, 'utf-8');
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});

// ── File browser ──────────────────────────────────────────────
app.get('/api/files/list', (req, res) => {
  try {
    const WORKSPACE = getWorkspace(req);
    const rel = (req.query.path || '').replace(/\.\./g, '');
    const dir = rel ? join(WORKSPACE, rel) : WORKSPACE;
    const entries = readdirSync(dir).map(name => {
      try {
        const isDir = statSync(join(dir, name)).isDirectory();
        return { name, isDir };
      } catch { return { name, isDir: false }; }
    });
    res.json({ ok: true, path: rel || '/', entries });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});

app.get('/api/files/read', (req, res) => {
  try {
    const WORKSPACE = getWorkspace(req);
    const rel = (req.query.path || '').replace(/\.\./g, '');
    if (!rel) return res.status(400).json({ error: 'No path' });
    const content = readFileSync(join(WORKSPACE, rel), 'utf-8');
    res.json({ ok: true, content: content.slice(0, 50000) });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});

app.post('/api/files/write', (req, res) => {
  try {
    const WORKSPACE = getWorkspace(req);
    const { path: rel, content } = req.body;
    if (!rel || rel.includes('..')) return res.status(400).json({ error: 'Invalid path' });
    writeFileSync(join(WORKSPACE, rel), content, 'utf-8');
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});

app.delete('/api/files/delete', (req, res) => {
  try {
    const WORKSPACE = getWorkspace(req);
    const rel = req.query.path;
    if (!rel || rel.includes('..')) return res.status(400).json({ error: 'Invalid path' });
    const full = join(WORKSPACE, rel);
    rmSync(full, { recursive: true, force: true });
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});

// ── Chat / Context injection ──────────────────────────────────
app.post('/api/chat/send', (req, res) => {
  try {
    const { message, contextFiles } = req.body;
    const agentId = req.headers['x-agent-id'] || 'main';

    let fullMessage = '';
    if (contextFiles && contextFiles.length > 0) {
      for (const file of contextFiles) {
        fullMessage += `[File: ${file.name}]\n${file.content}\n\n---\n\n`;
      }
    }
    fullMessage += message || '';
    if (!fullMessage.trim()) return res.status(400).json({ error: 'Empty message' });

    const spawnArgs = ['agent', '--message', fullMessage, '--deliver', '--channel', 'telegram', '--agent', agentId];
    if (agentId !== 'main') spawnArgs.push('--account', agentId);

    const proc = spawn('openclaw', spawnArgs, {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, HOME: os.homedir(), PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' }
    });
    proc.unref();

    res.json({ ok: true, queued: true });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});

// ── Actions ───────────────────────────────────────────────────
const SAFE_ACTIONS = {
  restart: () => execSync('openclaw gateway restart', { timeout: 10000 }).toString(),
  update:  () => execSync('openclaw gateway update',  { timeout: 120000 }).toString(),
  df:      () => execSync('df -h /',                  { timeout: 5000 }).toString(),
  free:    () => execSync('free -h',                  { timeout: 5000 }).toString(),
  status:  () => execSync('openclaw gateway status',  { timeout: 10000 }).toString(),
  tunnel:  () => execSync('systemctl is-active openclaw-tunnel.service openclaw-panel-tunnel.service', { timeout: 5000 }).toString(),
};

app.post('/api/action', (req, res) => {
  const { action } = req.body;
  if (!SAFE_ACTIONS[action]) return res.status(400).json({ error: 'Unknown action' });
  try {
    const output = SAFE_ACTIONS[action]();
    res.json({ ok: true, output });
  } catch (e) {
    res.json({ ok: false, error: String(e), output: e.stdout?.toString() || '' });
  }
});

// ── Gateway WS helper ─────────────────────────────────────────
function gatewayCall(method, params) {
  return new Promise((resolve, reject) => {
    try {
      const cfg = readConfig();
      const gwPort = cfg?.gateway?.port || 18789;
      const gwToken = cfg?.gateway?.auth?.token || '';
      const ws = new WebSocket(`ws://localhost:${gwPort}/`);
      const timeout = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 6000);
      let id = 1;

      ws.on('message', (d) => {
        const m = JSON.parse(d);
        if (m.event === 'connect.challenge') {
          ws.send(JSON.stringify({
            type: 'req', id: String(id++), method: 'connect', params: {
              minProtocol: 3, maxProtocol: 3,
              client: { id: 'cli', version: '1.0.0', platform: 'linux', mode: 'cli' },
              role: 'operator',
              scopes: ['operator.read', 'operator.write', 'operator.admin'],
              caps: [], commands: [], permissions: {},
              auth: { token: gwToken }
            }
          }));
        }
        if (m.type === 'res' && m.id === '1') {
          if (!m.ok) { clearTimeout(timeout); ws.close(); return reject(new Error(m.error?.message || 'connect failed')); }
          ws.send(JSON.stringify({ type: 'req', id: '2', method, params }));
        }
        if (m.type === 'res' && m.id === '2') {
          clearTimeout(timeout);
          ws.close();
          if (m.ok) resolve(m.payload);
          else reject(new Error(m.error?.message || 'call failed'));
        }
      });
      ws.on('error', (e) => { clearTimeout(timeout); reject(e); });
    } catch (e) { reject(e); }
  });
}

// ── Sessions API ──────────────────────────────────────────────
app.get('/api/sessions', async (req, res) => {
  try {
    const result = await gatewayCall('sessions.list', {});
    res.json({ ok: true, sessions: result?.sessions || [] });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});

app.patch('/api/sessions/:key/model', async (req, res) => {
  try {
    const { model } = req.body;
    if (!model) return res.status(400).json({ error: 'model required' });
    const result = await gatewayCall('sessions.patch', {
      key: decodeURIComponent(req.params.key),
      model
    });
    res.json({ ok: true, result });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});

app.post('/api/sessions/:key/compact', async (req, res) => {
  try {
    // Use chat.send with /compact to trigger the real AI-powered compaction pipeline,
    // identical to what the /compact slash command does. sessions.compact is just a
    // dumb file truncator and does NOT summarize context.
    const sessionKey = decodeURIComponent(req.params.key);
    const idempotencyKey = `panel-compact-${Date.now()}`;
    const result = await gatewayCall('chat.send', { sessionKey, message: '/compact', idempotencyKey });
    res.json({ ok: true, result });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

app.post('/api/sessions/:key/reset', async (req, res) => {
  try {
    const result = await gatewayCall('sessions.reset', { key: decodeURIComponent(req.params.key) });
    res.json({ ok: true, result });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

// ── Usage API ─────────────────────────────────────────────────
app.get('/api/usage', async (req, res) => {
  try {
    const [status, cost] = await Promise.all([
      gatewayCall('usage.status', {}),
      gatewayCall('usage.cost', {})
    ]);
    res.json({ ok: true, status, cost });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

// ── Cron API ──────────────────────────────────────────────────
app.get('/api/cron', async (req, res) => {
  try {
    const result = await gatewayCall('cron.list', { includeDisabled: true });
    res.json({ ok: true, jobs: result?.jobs || result || [] });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

app.post('/api/cron/:id/run', async (req, res) => {
  try {
    const result = await gatewayCall('cron.run', { jobId: req.params.id });
    res.json({ ok: true, result });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

app.patch('/api/cron/:id', async (req, res) => {
  try {
    const result = await gatewayCall('cron.update', { jobId: req.params.id, patch: req.body });
    res.json({ ok: true, result });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

app.delete('/api/cron/:id', async (req, res) => {
  try {
    const result = await gatewayCall('cron.remove', { jobId: req.params.id });
    res.json({ ok: true, result });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

app.get('/api/cron/:id/runs', async (req, res) => {
  try {
    const result = await gatewayCall('cron.runs', { jobId: req.params.id });
    res.json({ ok: true, runs: result?.runs || result || [] });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

app.post('/api/cron', async (req, res) => {
  try {
    const result = await gatewayCall('cron.add', { job: req.body });
    res.json({ ok: true, result });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

// ── OpenClaw Config ───────────────────────────────────────────
const CONFIG_PATH = join(OPENCLAW_HOME, 'openclaw.json');

function readConfig() {
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
}

function writeConfig(cfg) {
  // Backup first
  writeFileSync(CONFIG_PATH + '.bak', JSON.stringify(readConfig(), null, 4), 'utf-8');
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 4), 'utf-8');
}

app.get('/api/config', (req, res) => {
  try {
    res.json({ ok: true, config: readConfig() });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});

app.patch('/api/config', (req, res) => {
  try {
    const cfg = readConfig();
    const { path: keyPath, value } = req.body;
    if (!keyPath) return res.status(400).json({ error: 'path required' });

    // Walk and set nested key e.g. "agents.defaults.model.primary"
    const keys = keyPath.split('.');
    let obj = cfg;
    for (let i = 0; i < keys.length - 1; i++) {
      if (obj[keys[i]] === undefined) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    // null = delete the key
    if (value === null) delete obj[keys[keys.length - 1]];
    else obj[keys[keys.length - 1]] = value;

    writeConfig(cfg);
    res.json({ ok: true, config: cfg }); // Return fresh config
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});

app.post('/api/config/restart', (req, res) => {
  try {
    const proc = spawn('openclaw', ['gateway', 'restart'], {
      detached: true, stdio: 'ignore',
      env: { ...process.env, HOME: os.homedir() }
    });
    proc.unref();
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});

// ── Skills Manager ────────────────────────────────────────────
app.get('/api/skills', (req, res) => {
  try {
    const skills = SkillManager.list();
    res.json({ ok: true, skills });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});

app.post('/api/skills/toggle', (req, res) => {
  try {
    const { name, enabled } = req.body;
    if (!name) return res.status(400).json({ error: 'No skill name' });
    const result = SkillManager.toggle(name, enabled);
    res.json(result);
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});

// SPA fallback
app.get('/{*path}', (_, res) => res.sendFile(join(__dirname, 'dist', 'index.html')));

// ── HTTP + WebSocket server ───────────────────────────────────
const server = createServer(app);
const wssLogs = new WebSocketServer({ noServer: true });
const wssTerminal = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (pathname === '/ws/logs') {
    wssLogs.handleUpgrade(request, socket, head, (ws) => wssLogs.emit('connection', ws, request));
  } else if (pathname === '/ws/terminal') {
    wssTerminal.handleUpgrade(request, socket, head, (ws) => wssTerminal.emit('connection', ws, request));
  } else {
    socket.destroy();
  }
});

// ── PTY Terminal WebSocket ─────────────────────────────────────
const ptySessions = new Map();      // tabId → pty process
const memBuffers  = new Map();      // tabId → string (in-memory rolling buffer)
const flushTimers = new Map();      // tabId → debounce timer

function appendBuffer(tabId, data) {
  let buf = (memBuffers.get(tabId) || '') + data;
  if (buf.length > MAX_BUFFER) buf = buf.slice(buf.length - MAX_BUFFER);
  memBuffers.set(tabId, buf);

  // Debounced DB flush every 2s
  clearTimeout(flushTimers.get(tabId));
  flushTimers.set(tabId, setTimeout(() => {
    dbBuffers.flush(tabId, memBuffers.get(tabId) || '');
  }, 2000));
}

wssTerminal.on('connection', (ws, req) => {
  const params = new URLSearchParams(req.url.replace('/ws/terminal?', ''));
  const token = params.get('token');
  const tabId = params.get('tabId') || 'default';

  if (token !== TOKEN) { ws.close(4001, 'Unauthorized'); return; }

  // ── Replay scrollback ────────────────────────────────────────
  const replay = memBuffers.get(tabId) || dbBuffers.get(tabId);
  if (replay) {
    ws.send(JSON.stringify({ data: replay }));
  }

  // ── Spawn PTY if not alive ────────────────────────────────────
  let ptyProcess = ptySessions.get(tabId);

  if (!ptyProcess) {
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: getAgentWorkspace('main'),
      env: process.env
    });
    ptySessions.set(tabId, ptyProcess);

    ptyProcess.onData((data) => {
      appendBuffer(tabId, data);
      wssTerminal.clients.forEach(client => {
        if (client.readyState === 1 && client.tabId === tabId) {
          client.send(JSON.stringify({ data }));
        }
      });
    });

    ptyProcess.onExit(() => {
      const exitMsg = '\r\n[Process Exited]\r\n';
      appendBuffer(tabId, exitMsg);
      // Final flush immediately on exit
      dbBuffers.flush(tabId, memBuffers.get(tabId) || '');
      ptySessions.delete(tabId);
      wssTerminal.clients.forEach(client => {
        if (client.readyState === 1 && client.tabId === tabId) {
          client.send(JSON.stringify({ data: exitMsg }));
        }
      });
    });
  }

  ws.tabId = tabId;

  ws.on('message', (msg) => {
    try {
      const payload = JSON.parse(msg);
      if (payload.action === 'write' && payload.data) ptyProcess.write(payload.data);
      else if (payload.action === 'resize') ptyProcess.resize(payload.cols, payload.rows);
    } catch {}
  });

  // PTY persists across reconnects — don't kill on ws close
});

// ── Logs WebSocket ────────────────────────────────────────────
function getActiveSessionFile(agentId) {
  const dir = join(AGENTS_DIR, agentId, 'sessions');
  try {
    const files = readdirSync(dir)
      .filter(f => f.endsWith('.jsonl') && !f.includes('.reset.'))
      .map(f => ({ f, mtime: statSync(join(dir, f)).mtime.getTime() }))
      .sort((a, b) => b.mtime - a.mtime);
    return files.length ? join(dir, files[0].f) : null;
  } catch { return null; }
}

function formatEntry(raw) {
  try {
    const entry = JSON.parse(raw);
    const time = new Date(entry.timestamp).toLocaleTimeString('en', { hour12: false });
    const msg = entry.message;
    if (!msg) return null;

    if (msg.role === 'user') {
      const text = Array.isArray(msg.content)
        ? msg.content.find(c => c.type === 'text')?.text || ''
        : msg.content || '';
      return { type: 'user', time, text: `💬 ${text.slice(0, 200)}` };
    }

    if (msg.role === 'assistant') {
      const lines = [];
      const content = Array.isArray(msg.content) ? msg.content : [];
      for (const c of content) {
        if (c.type === 'text' && c.text?.trim())
          lines.push({ type: 'assistant', time, text: `🤖 ${c.text.slice(0, 300)}` });
        if (c.type === 'tool_use') {
          const args = JSON.stringify(c.input || {}).slice(0, 150);
          lines.push({ type: 'tool', time, text: `🔧 ${c.name}(${args})` });
        }
      }
      return lines.length ? lines : null;
    }

    if (msg.role === 'toolResult') {
      const text = Array.isArray(msg.content)
        ? msg.content.find(c => c.type === 'text')?.text || ''
        : msg.content || '';
      return { type: 'result', time, text: `📤 ${msg.toolName}: ${text.slice(0, 200)}` };
    }
  } catch {}
  return null;
}

wssLogs.on('connection', (ws, req) => {
  const params = new URLSearchParams(req.url.replace('/ws/logs?', ''));
  const token = params.get('token');
  const agentId = params.get('agent') || 'main';

  if (token !== TOKEN) { ws.close(4001, 'Unauthorized'); return; }

  const send = (entry) => {
    if (ws.readyState !== 1) return;
    const entries = Array.isArray(entry) ? entry : [entry];
    for (const e of entries) if (e) ws.send(JSON.stringify(e));
  };

  // Replay recent log history from DB
  const history = dbLogs.recent(agentId, 200);
  if (history.length) {
    send({ type: 'system', time: new Date().toLocaleTimeString('en', { hour12: false }), text: `📜 Replaying ${history.length} recent entries…` });
    for (const e of history) send(e);
  }

  send({ type: 'system', time: new Date().toLocaleTimeString('en', { hour12: false }), text: `📡 Live — watching agent:${agentId}` });

  let watchedFile = null;
  let fileOffset = 0;

  const readNewLines = (filePath) => {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      const newLines = lines.slice(fileOffset);
      fileOffset = lines.length;
      for (const line of newLines) {
        const formatted = formatEntry(line);
        if (!formatted) continue;
        const entries = Array.isArray(formatted) ? formatted : [formatted];
        for (const e of entries) {
          dbLogs.insert(agentId, e);
          send(e);
        }
      }
      // Prune old entries periodically
      if (newLines.length > 0) dbLogs.prune(agentId);
    } catch {}
  };

  const watchSession = (filePath) => {
    if (watchedFile === filePath) return;
    if (watchedFile) unwatchFile(watchedFile);
    watchedFile = filePath;
    fileOffset = 0;
    readNewLines(filePath);
    watchFile(filePath, { interval: 500 }, () => readNewLines(filePath));
    send({ type: 'system', time: new Date().toLocaleTimeString('en', { hour12: false }), text: `📂 ${filePath.split('/').pop()}` });
  };

  const startFile = getActiveSessionFile(agentId);
  if (startFile) watchSession(startFile);

  const sessionPoller = setInterval(() => {
    const latest = getActiveSessionFile(agentId);
    if (latest && latest !== watchedFile) watchSession(latest);
  }, 5000);

  ws.on('close', () => {
    clearInterval(sessionPoller);
    if (watchedFile) unwatchFile(watchedFile);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`OpenClaw Panel running on :${PORT}`);
  console.log(`OpenClaw home: ${OPENCLAW_HOME}`);
});
