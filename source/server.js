import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, readdirSync, statSync, watchFile, unwatchFile } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import db from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN = process.env.PANEL_TOKEN || 'decd6097769042335d4a219057655758f5a9f9d2ff16cfae';
const PORT = 3001;
const WORKSPACE = '/root/.openclaw/workspace';

const app = express();
app.use(cors());
app.use(express.json());

// Dynamic workspace based on agent ID header
function getWorkspace(req) {
  const agentId = req.headers['x-agent-id'] || 'main';
  return agentId === 'office' ? '/root/.openclaw/workspace-office' : '/root/.openclaw/workspace';
}

// Serve static panel files
app.use(express.static(join(__dirname, 'dist')));

// Auth
app.use('/api', (req, res, next) => {
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${TOKEN}`) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

// ── Agent/Session status ──────────────────────────────────────
app.get('/api/agents', (req, res) => {
  const agents = ['main', 'office'].map(id => {
    try {
      const sessFile = `/root/.openclaw/agents/${id}/sessions/sessions.json`;
      const data = JSON.parse(readFileSync(sessFile, 'utf-8'));
      const key = `agent:${id}:main`;
      const sess = data[key] || {};
      return {
        id,
        name: id === 'main' ? 'Dolores' : 'Dwight',
        emoji: id === 'main' ? '🌙' : '🏦',
        model: sess.model || '—',
        online: !!sess.model,
        tokens: sess.totalTokens || 0,
        updatedAt: sess.updatedAt || null,
      };
    } catch {
      return { id, name: id === 'main' ? 'Dolores' : 'Dwight', emoji: id === 'main' ? '🌙' : '🏦', online: false, model: '—' };
    }
  });
  res.json({ ok: true, agents });
});

// ── Memory files ──────────────────────────────────────────────
app.get('/api/memory/list', (req, res) => {
  try {
    const WORKSPACE = getWorkspace(req);
    const files = ['MEMORY.md'];
    try {
      const daily = readdirSync(`${WORKSPACE}/memory`).filter(f => f.endsWith('.md'));
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
    const content = readFileSync(`${WORKSPACE}/${file}`, 'utf-8');
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
    writeFileSync(`${WORKSPACE}/${file}`, content, 'utf-8');
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
    const dir = rel ? `${WORKSPACE}/${rel}` : WORKSPACE;
    const entries = readdirSync(dir).map(name => {
      try {
        const isDir = statSync(`${dir}/${name}`).isDirectory();
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
    const content = readFileSync(`${WORKSPACE}/${rel}`, 'utf-8');
    res.json({ ok: true, content: content.slice(0, 50000) });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});

import { UserModel } from './models/User.js';
import { Provisioning } from './core/provisioning.js';

// ─── User Management / Auth ───────────────────────────────────
app.post('/api/auth', (req, res) => {
  const { userData } = req.body;
  if (!userData?.id) return res.status(400).json({ error: 'Invalid userData' });

  const userId = String(userData.id);
  const username = userData.username || 'unknown';

  let user = UserModel.get(userId);
  if (!user) {
    user = UserModel.create(userId, username);
    
    // Auto-provision workspace and soul
    Provisioning.setupWorkspace(userId, username);
  }

  res.json({ ok: true, user });
});

app.get('/api/user/profile', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(400).json({ error: 'Missing userId header' });
  const user = UserModel.get(userId);
  res.json({ ok: true, user });
});

// ── Actions ───────────────────────────────────────────────────
const SAFE_ACTIONS = {
  restart: () => execSync('openclaw gateway restart', { timeout: 10000 }).toString(),
  update: () => execSync('openclaw gateway update', { timeout: 120000 }).toString(),
  df: () => execSync('df -h /', { timeout: 5000 }).toString(),
  free: () => execSync('free -h', { timeout: 5000 }).toString(),
  status: () => execSync('openclaw gateway status', { timeout: 10000 }).toString(),
  tunnel: () => execSync('systemctl is-active openclaw-tunnel.service openclaw-panel-tunnel.service', { timeout: 5000 }).toString(),
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

// SPA fallback
app.get('/{*path}', (_, res) => res.sendFile(join(__dirname, 'dist', 'index.html')));

// ── HTTP + WebSocket server ───────────────────────────────────
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/logs' });

// Find the most recent active session JSONL for an agent
function getActiveSessionFile(agentId) {
  const dir = `/root/.openclaw/agents/${agentId}/sessions`;
  try {
    const files = readdirSync(dir)
      .filter(f => f.endsWith('.jsonl') && !f.includes('.reset.'))
      .map(f => ({ f, mtime: statSync(`${dir}/${f}`).mtime.getTime() }))
      .sort((a, b) => b.mtime - a.mtime);
    return files.length ? `${dir}/${files[0].f}` : null;
  } catch { return null; }
}

// Format a JSONL log entry into a human-readable line
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
        if (c.type === 'text' && c.text?.trim()) {
          lines.push({ type: 'assistant', time, text: `🌙 ${c.text.slice(0, 300)}` });
        }
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

wss.on('connection', (ws, req) => {
  const params = new URLSearchParams(req.url.replace('/ws/logs?', ''));
  const token = params.get('token');
  const agentId = params.get('agent') || 'main';

  if (token !== TOKEN) { ws.close(4001, 'Unauthorized'); return; }

  const send = (entry) => {
    if (ws.readyState !== 1) return;
    const entries = Array.isArray(entry) ? entry : [entry];
    for (const e of entries) {
      if (e) ws.send(JSON.stringify(e));
    }
  };

  send({ type: 'system', time: new Date().toLocaleTimeString('en', { hour12: false }), text: `📡 Connected — watching agent:${agentId}` });

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
        if (formatted) send(formatted);
      }
    } catch {}
  };

  const watchSession = (filePath) => {
    if (watchedFile === filePath) return;
    if (watchedFile) unwatchFile(watchedFile);
    watchedFile = filePath;
    fileOffset = 0;
    readNewLines(filePath); // send existing lines on connect
    watchFile(filePath, { interval: 500 }, () => readNewLines(filePath));
    send({ type: 'system', time: new Date().toLocaleTimeString('en', { hour12: false }), text: `📂 ${filePath.split('/').pop()}` });
  };

  // Start watching — poll for new session files every 5s
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

server.listen(PORT, '0.0.0.0', () => console.log(`OpenClaw Panel on :${PORT}`));
