import express from 'express';
import cors from 'cors';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, watchFile, unwatchFile } from 'fs';
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
    const name = content.match(/\*\*Name:\*\*\s*(.+)/)?.[1]?.trim() || agentId;
    const emoji = content.match(/\*\*Emoji:\*\*\s*(.+)/)?.[1]?.trim() || '🤖';
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
  const agentIds = discoverAgents();
  const agents = agentIds.map(id => {
    const { name, emoji } = parseIdentity(id);
    try {
      const sessFile = join(AGENTS_DIR, id, 'sessions', 'sessions.json');
      const data = JSON.parse(readFileSync(sessFile, 'utf-8'));
      const key = `agent:${id}:main`;
      const sess = data[key] || {};
      return {
        id,
        name,
        emoji,
        model: sess.model || '—',
        online: !!sess.model,
        tokens: sess.totalTokens || 0,
        updatedAt: sess.updatedAt || null,
      };
    } catch {
      return { id, name, emoji, online: false, model: '—' };
    }
  });
  res.json({ ok: true, agents });
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
