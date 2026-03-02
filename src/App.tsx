import { useState, useEffect, useCallback, useRef } from 'react'
import { LayoutDashboard, FolderOpen, Settings, X, RefreshCw, Save, Edit3, Terminal, Trash2, PauseCircle, PlayCircle, Boxes, LogOut, ScrollText, Plus, ChevronDown, RotateCcw, Zap } from 'lucide-react'
import Files from './Files'
import { getAgents, listFiles, readFile, writeFile, runAction, getSettings, saveSettings, apiBase, getSkills, toggleSkill, isAuthenticated, logout, ping, getTabs, saveTab, deleteTab, getConfig, patchConfig, restartGateway } from './api'
import './App.css'

type Tab = 'dashboard' | 'files' | 'skills' | 'terminal' | 'settings'

// ─── Login ───────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [url, setUrl] = useState(localStorage.getItem('gatewayUrl') || '')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!token.trim()) { setError('Enter your panel token'); return }
    setLoading(true)
    setError('')
    try {
      if (url) localStorage.setItem('gatewayUrl', url)
      else localStorage.removeItem('gatewayUrl')
      localStorage.setItem('token', token.trim())
      // Verify token works
      const r = await fetch(`${url || ''}/api/agents`, {
        headers: { 'Authorization': `Bearer ${token.trim()}` }
      })
      if (r.status === 401) throw new Error('Invalid token')
      onLogin()
    } catch (e: any) {
      localStorage.removeItem('token')
      setError(e.message === 'Invalid token' ? 'Invalid token — check and try again' : 'Cannot reach panel server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', padding: '32px 24px', background: 'var(--bg)', gap: '24px' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🤖</div>
        <div style={{ fontSize: '20px', fontWeight: 700 }}>OpenClaw Panel</div>
        <div style={{ fontSize: '13px', color: 'var(--hint)', marginTop: '6px' }}>Enter your panel token to continue</div>
      </div>
      <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label style={{ fontSize: '12px', color: 'var(--hint)', display: 'block', marginBottom: '4px' }}>Server URL (optional, leave blank if same origin)</label>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://your-server.com"
            style={{ width: '100%', padding: '10px 12px', background: 'var(--secondary-bg)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '16px', outline: 'none' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: 'var(--hint)', display: 'block', marginBottom: '4px' }}>Panel Token</label>
          <input
            value={token}
            onChange={e => setToken(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Paste your token here"
            type="password"
            style={{ width: '100%', padding: '10px 12px', background: 'var(--secondary-bg)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '16px', outline: 'none' }}
          />
          <div style={{ fontSize: '11px', color: 'var(--hint)', marginTop: '4px' }}>
            Find your token in <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: '3px' }}>~/.openclaw/panel/.token</code>
          </div>
        </div>
        {error && <div style={{ fontSize: '13px', color: '#f87171', padding: '8px 12px', background: 'rgba(248,113,113,0.1)', borderRadius: '8px' }}>{error}</div>}
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{ padding: '12px', background: 'var(--btn)', color: 'var(--btn-text)', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: '4px' }}
        >
          {loading ? 'Connecting…' : 'Connect'}
        </button>
      </div>
    </div>
  )
}

// ─── Toast ───────────────────────────────────────────────────
function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t) }, [onDone])
  return <div className="toast">{msg}</div>
}

// ─── Dashboard ───────────────────────────────────────────────
function Dashboard() {
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setError('')
      const r = await getAgents()
      setAgents(r.agents || [])
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [load])

  return (
    <div className="tab-content">
      <div className={`status-bar ${error ? 'error' : !loading ? 'ok' : 'pending'}`}>
        {error ? `⚠️ ${error}` : !loading ? '✅ Connected' : '⏳ Loading...'}
        <button className="icon-btn" onClick={load}><RefreshCw size={14} /></button>
      </div>

      <div className="agent-grid">
        {agents.map(a => (
          <div key={a.id} className="agent-card">
            <div className="agent-emoji">{a.emoji}</div>
            <div className="agent-name">{a.name}</div>
            <div className={`agent-status ${a.online ? 'online' : 'offline'}`}>
              {a.online ? '● Online' : '○ Offline'}
            </div>
            <div className="agent-model">{a.model}</div>
            {a.tokens > 0 && <div className="agent-tokens">{(a.tokens / 1000).toFixed(0)}k tokens</div>}
          </div>
        ))}
      </div>
    </div>
  )
}



// ─── Skills ──────────────────────────────────────────────────
function Skills({ toast }: { toast: (m: string) => void }) {
  const [skills, setSkills] = useState<{ name: string; enabled: boolean }[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const r = await getSkills()
      const list = [
        ...(r.skills.active || []),
        ...(r.skills.disabled || [])
      ].sort((a, b) => a.name.localeCompare(b.name))
      setSkills(list)
    } catch (e: any) { toast(`Error: ${e.message}`) }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  const toggle = async (name: string, current: boolean) => {
    try {
      toast(`Updating ${name}...`)
      await toggleSkill(name, !current)
      setSkills(prev => prev.map(s => s.name === name ? { ...s, enabled: !current } : s))
      toast(`${name} ${!current ? 'enabled' : 'disabled'} ✅`)
    } catch (e: any) { toast(`Error: ${e.message}`) }
  }

  return (
    <div className="tab-content" style={{ overflowY: 'auto' }}>
      <div className="status-bar ok" style={{ marginBottom: '4px', flexShrink: 0 }}>
        <span>Toggle skills to save tokens</span>
        <button className="icon-btn" onClick={load}><RefreshCw size={14} /></button>
      </div>
      {loading && <div className="center-msg">Loading...</div>}
      <div className="skill-list">
        {skills.map(s => (
          <div key={s.name} className="skill-item">
            <div className="skill-info">
              <span className="skill-name">{s.name}</span>
            </div>
            <label className="switch">
              <input type="checkbox" checked={s.enabled} onChange={() => toggle(s.name, s.enabled)} />
              <span className="slider"></span>
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}
// ─── Settings ─────────────────────────────────────────────────
const KNOWN_MODELS = [
  'google-gemini-cli/gemini-3-flash-preview',
  'google-gemini-cli/gemini-3.1-pro-preview',
  'anthropic/claude-sonnet-4-6',
  'anthropic/claude-opus-4-5',
  'kimi-coding/k2p5',
  'openai/gpt-4o',
  'openai/gpt-5.3-codex',
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--hint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px', padding: '0 16px' }}>{title}</div>
      <div style={{ background: 'var(--secondary-bg)', borderRadius: '12px', overflow: 'hidden', margin: '0 12px' }}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, hint, children, last }: { label: string; hint?: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: last ? 'none' : '1px solid var(--border)', gap: '12px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', color: 'var(--text)' }}>{label}</div>
        {hint && <div style={{ fontSize: '11px', color: 'var(--hint)', marginTop: '2px' }}>{hint}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!value)} style={{ width: '44px', height: '26px', borderRadius: '13px', background: value ? 'var(--btn, #4c8bf5)' : 'var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: '3px', left: value ? '21px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </div>
  )
}

function ModelSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ background: 'var(--secondary-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 10px', fontSize: '13px', maxWidth: '180px' }}>
      {KNOWN_MODELS.map(m => <option key={m} value={m}>{m.split('/')[1]}</option>)}
      {!KNOWN_MODELS.includes(value) && <option value={value}>{value.split('/')[1]}</option>}
    </select>
  )
}

function SettingsTab({ toast, onLogout }: { toast: (m: string) => void; onLogout: () => void }) {
  const [cfg, setCfg] = useState<any>(null)
  const [output, setOutput] = useState<{ label: string; text: string } | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [panelUrl, setPanelUrl] = useState(localStorage.getItem('gatewayUrl') || '')
  const [panelToken, setPanelToken] = useState(localStorage.getItem('token') || '')

  useEffect(() => {
    getConfig().then(r => { if (r.ok) setCfg(r.config) }).catch(() => {})
  }, [])

  const patch = async (path: string, value: unknown, label?: string) => {
    try {
      const r = await patchConfig(path, value)
      if (r.ok) {
        setCfg((prev: any) => {
          const next = JSON.parse(JSON.stringify(prev))
          const keys = path.split('.')
          let obj = next
          for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]]
          obj[keys[keys.length - 1]] = value
          return next
        })
        toast(`${label || path} updated ✅`)
      } else toast(`Failed: ${r.error}`)
    } catch (e: any) { toast(`Error: ${e.message}`) }
  }

  const runAction = async (label: string, action: string) => {
    setRunning(label)
    try {
      const r = await import('./api').then(m => m.runAction(action))
      if (r.output) setOutput({ label, text: r.output })
      else toast(`${label}: ${r.ok ? 'Done ✅' : r.error}`)
    } catch (e: any) { toast(`${label} failed: ${e.message}`) }
    finally { setRunning(null) }
  }

  if (output) return (
    <div className="file-view">
      <div className="file-view-header">
        <button className="icon-btn" onClick={() => setOutput(null)}><X size={18} /></button>
        <span className="file-view-title">{output.label}</span>
      </div>
      <pre className="file-pre">{output.text}</pre>
    </div>
  )

  const defaults = cfg?.agents?.defaults
  const tg = cfg?.channels?.telegram

  return (
    <div style={{ overflowY: 'auto', height: '100%', paddingTop: '12px', paddingBottom: '32px' }}>

      {/* Models */}
      {defaults && (
        <Section title="Model">
          <Row label="Primary Model" hint="Default model for all agents">
            <ModelSelect value={defaults.model?.primary || ''} onChange={v => patch('agents.defaults.model.primary', v, 'Primary model')} />
          </Row>
          <Row label="Context Pruning" hint="How to manage context window" last>
            <select value={defaults.contextPruning?.mode || 'cache-ttl'}
              onChange={e => patch('agents.defaults.contextPruning.mode', e.target.value, 'Context pruning')}
              style={{ background: 'var(--secondary-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 10px', fontSize: '13px' }}>
              <option value="cache-ttl">Cache TTL</option>
              <option value="aggressive">Aggressive</option>
              <option value="none">None</option>
            </select>
          </Row>
        </Section>
      )}

      {/* Memory */}
      {defaults?.memorySearch && (
        <Section title="Memory">
          <Row label="Memory Search" hint="Semantic search across memory files">
            <Toggle value={defaults.memorySearch.enabled} onChange={v => patch('agents.defaults.memorySearch.enabled', v, 'Memory search')} />
          </Row>
          <Row label="Sync on Start" hint="Index memory when session begins">
            <Toggle value={defaults.memorySearch.sync?.onSessionStart ?? true} onChange={v => patch('agents.defaults.memorySearch.sync.onSessionStart', v, 'Sync on start')} />
          </Row>
          <Row label="Heartbeat" hint="Periodic check interval" last>
            <select value={defaults.heartbeat?.every || '1h'}
              onChange={e => patch('agents.defaults.heartbeat.every', e.target.value, 'Heartbeat')}
              style={{ background: 'var(--secondary-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 10px', fontSize: '13px' }}>
              <option value="30m">30 minutes</option>
              <option value="1h">1 hour</option>
              <option value="2h">2 hours</option>
              <option value="6h">6 hours</option>
              <option value="24h">24 hours</option>
            </select>
          </Row>
        </Section>
      )}

      {/* Telegram */}
      {tg && (
        <Section title="Telegram">
          <Row label="Streaming" hint="How messages are sent">
            <select value={tg.streaming || 'partial'}
              onChange={e => patch('channels.telegram.streaming', e.target.value, 'Streaming')}
              style={{ background: 'var(--secondary-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 10px', fontSize: '13px' }}>
              <option value="partial">Partial (live updates)</option>
              <option value="full">Full (send when done)</option>
              <option value="off">Off</option>
            </select>
          </Row>
          <Row label="DM Policy" hint="Who can send direct messages" last>
            <select value={tg.dmPolicy || 'allowlist'}
              onChange={e => patch('channels.telegram.dmPolicy', e.target.value, 'DM policy')}
              style={{ background: 'var(--secondary-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 10px', fontSize: '13px' }}>
              <option value="allowlist">Allowlist only</option>
              <option value="open">Open</option>
            </select>
          </Row>
        </Section>
      )}

      {/* System */}
      <Section title="System">
        {[
          { label: 'Restart Gateway', emoji: '🔄', action: 'restart' },
          { label: 'Update OpenClaw', emoji: '⬆️', action: 'update' },
          { label: 'Gateway Status', emoji: '🔌', action: 'status' },
          { label: 'Disk Usage', emoji: '💾', action: 'df' },
          { label: 'Memory Usage', emoji: '🧠', action: 'free' },
        ].map((a, i, arr) => (
          <Row key={a.action} label={a.label} last={i === arr.length - 1}>
            <button onClick={() => runAction(a.label, a.action)} disabled={!!running}
              style={{ padding: '6px 14px', fontSize: '13px', background: 'var(--btn, #4c8bf5)', color: 'var(--btn-text, #fff)', border: 'none', borderRadius: '8px', cursor: running ? 'not-allowed' : 'pointer', opacity: running === a.label ? 0.6 : 1 }}>
              {running === a.label ? '⏳' : a.emoji}
            </button>
          </Row>
        ))}
      </Section>

      {/* Panel connection */}
      <Section title="Panel Connection">
        <Row label="Server URL" hint="Leave blank for same origin">
          <input value={panelUrl} onChange={e => setPanelUrl(e.target.value)} placeholder="https://..."
            style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 10px', fontSize: '13px', width: '160px' }} />
        </Row>
        <Row label="Token" last>
          <input value={panelToken} onChange={e => setPanelToken(e.target.value)} type="password" placeholder="Token"
            style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 10px', fontSize: '13px', width: '160px' }} />
        </Row>
        <div style={{ padding: '10px 16px' }}>
          <button onClick={() => { saveSettings(panelUrl, panelToken); toast('Saved ✅') }}
            style={{ width: '100%', padding: '10px', background: 'var(--btn, #4c8bf5)', color: 'var(--btn-text, #fff)', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
            Save Connection
          </button>
        </div>
      </Section>

      {/* Account */}
      <Section title="Account">
        <Row label="Sign Out" hint="Clears saved token from this device" last>
          <button onClick={onLogout}
            style={{ padding: '6px 14px', fontSize: '13px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', cursor: 'pointer' }}>
            Sign Out
          </button>
        </Row>
      </Section>

    </div>
  )
}

import TerminalView from './TerminalView'

// ─── Log Panel (embedded) ─────────────────────────────────────
type LogEntry = { type: 'user' | 'assistant' | 'tool' | 'result' | 'system' | 'error'; time: string; text: string }

function LogPanel() {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [paused, setPaused] = useState(false)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const bottomRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)
  const urlParams = new URLSearchParams(window.location.search)
  const agentId = urlParams.get('agent') || 'main'

  useEffect(() => { pausedRef.current = paused }, [paused])

  useEffect(() => {
    const base = apiBase().replace(/^http/, 'ws').replace(/\/$/, '')
    const token = localStorage.getItem('token') || ''
    const ws = new WebSocket(`${base}/ws/logs?token=${token}&agent=${agentId}`)
    ws.onopen = () => setStatus('connected')
    ws.onclose = () => setStatus('disconnected')
    ws.onerror = () => setStatus('disconnected')
    ws.onmessage = (e) => {
      if (pausedRef.current) return
      try { setEntries(prev => [...prev.slice(-500), JSON.parse(e.data)]) } catch {}
    }
    return () => ws.close()
  }, [agentId])

  useEffect(() => {
    if (!paused) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries, paused])

  const colorClass = (type: LogEntry['type']) => {
    switch (type) {
      case 'user': return 'log-user'
      case 'assistant': return 'log-assistant'
      case 'tool': return 'log-tool'
      case 'result': return 'log-result'
      case 'system': return 'log-system'
      case 'error': return 'log-error'
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <div className="logs-toolbar" style={{ flexShrink: 0 }}>
        <span className={`log-status log-status--${status}`}>
          {status === 'connected' ? '● Live' : status === 'connecting' ? '○ Connecting…' : '✕ Off'}
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="icon-btn" title={paused ? 'Resume' : 'Pause'} onClick={() => setPaused(p => !p)}>
            {paused ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
          </button>
          <button className="icon-btn" title="Clear" onClick={() => setEntries([])}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="logs-body" style={{ flex: 1, overflowY: 'auto' }}>
        {entries.length === 0 && <div className="logs-empty">Waiting for activity…</div>}
        {entries.map((e, i) => (
          <div key={i} className={`log-line ${colorClass(e.type)}`}>
            <span className="log-time">{e.time}</span>
            <span className="log-text">{e.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ─── Terminal Tabs ───────────────────────────────────────────
function TerminalTabs() {
  const [tabs, setTabs] = useState<{id: string, name: string}[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');
  const [loaded, setLoaded] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  // Load tabs from DB on mount
  useEffect(() => {
    getTabs().then((res: any) => {
      if (res.tabs && res.tabs.length > 0) {
        setTabs(res.tabs);
        const saved = localStorage.getItem('activeTermTab');
        setActiveTab(saved && res.tabs.find((t: any) => t.id === saved) ? saved : res.tabs[0].id);
      } else {
        const id = Date.now().toString();
        saveTab(id, 'Terminal 1').then(() => {
          setTabs([{ id, name: 'Terminal 1' }]);
          setActiveTab(id);
        });
      }
      setLoaded(true);
    }).catch(() => {
      const id = Date.now().toString();
      setTabs([{ id, name: 'Terminal 1' }]);
      setActiveTab(id);
      setLoaded(true);
    });
  }, []);

  // Persist active tab to localStorage
  useEffect(() => {
    if (activeTab) localStorage.setItem('activeTermTab', activeTab);
  }, [activeTab]);

  const nextTabName = (current: {id: string, name: string}[]) => {
    const nums = current.map(t => parseInt(t.name.replace(/\D/g, '')) || 0);
    return `Terminal ${(nums.length ? Math.max(...nums) : 0) + 1}`;
  };

  const addTab = () => {
    const id = Date.now().toString();
    const name = nextTabName(tabs);
    saveTab(id, name).then(() => {
      setTabs(prev => [...prev, { id, name }]);
      setActiveTab(id);
    });
  };

  const closeTab = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    deleteTab(id).then(() => {
      const newTabs = tabs.filter(t => t.id !== id);
      if (newTabs.length === 0) {
        const newId = Date.now().toString();
        saveTab(newId, 'Terminal 1').then(() => {
          setTabs([{ id: newId, name: 'Terminal 1' }]);
          setActiveTab(newId);
        });
        return;
      }
      setTabs(newTabs);
      if (activeTab === id) setActiveTab(newTabs[newTabs.length - 1].id);
    });
  };

  if (!loaded) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--hint)' }}>
      Loading terminals…
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', alignItems: 'flex-end', background: '#222', borderBottom: '1px solid #333', paddingTop: '4px', flexShrink: 0 }}>
        <div style={{ display: 'flex', flex: 1, overflowX: 'auto', alignItems: 'flex-end' }}>
          {tabs.map(t => (
            <div key={t.id} onClick={() => { setActiveTab(t.id); setShowLogs(false); }} style={{
              padding: '6px 10px',
              background: activeTab === t.id && !showLogs ? '#1e1e1e' : '#2a2a2a',
              color: activeTab === t.id && !showLogs ? '#fff' : '#888',
              borderTopLeftRadius: '6px',
              borderTopRightRadius: '6px',
              border: '1px solid #444',
              borderBottom: activeTab === t.id && !showLogs ? 'none' : '1px solid #444',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              marginRight: '2px',
              marginBottom: '-1px',
              whiteSpace: 'nowrap',
              zIndex: activeTab === t.id && !showLogs ? 1 : 0,
              position: 'relative'
            }}>
              {t.name}
              <button className="icon-btn" onClick={(e) => closeTab(t.id, e)} style={{ padding: '1px', color: 'inherit', lineHeight: 1 }}>
                <X size={11} />
              </button>
            </div>
          ))}
          <button className="icon-btn" onClick={addTab} style={{ padding: '4px 8px', margin: '0 2px', fontSize: '16px', lineHeight: 1 }}>+</button>
        </div>
        {/* Logs toggle */}
        <button
          className="icon-btn"
          onClick={() => setShowLogs(l => !l)}
          title="Logs"
          style={{ padding: '6px 10px', marginBottom: '0', color: showLogs ? 'var(--accent, #7c9ef8)' : 'var(--hint)', borderBottom: showLogs ? '2px solid var(--accent, #7c9ef8)' : '2px solid transparent', borderRadius: 0, flexShrink: 0 }}
        >
          <ScrollText size={16} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, position: 'relative', background: '#1e1e1e', overflow: 'hidden' }}>
        {/* Terminals — always mounted, hidden when logs visible */}
        <div style={{ display: showLogs ? 'none' : 'block', height: '100%' }}>
          {tabs.map(t => (
            <div key={t.id} style={{ display: activeTab === t.id ? 'block' : 'none', height: '100%' }}>
              <TerminalView tabId={t.id} />
            </div>
          ))}
        </div>
        {/* Log panel — always mounted, hidden when terminal visible */}
        <div style={{ display: showLogs ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <LogPanel />
        </div>
      </div>
    </div>
  );
}





// ─── App ─────────────────────────────────────────────────────
export default function App() {
  const [authed, setAuthed] = useState(isAuthenticated())
  const [tab, setTab] = useState<Tab>('dashboard')
  const [toastMsg, setToastMsg] = useState('')

  const toast = (m: string) => setToastMsg(m)

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp
    if (tg) { tg.ready(); tg.expand(); if (tg.requestFullscreen) tg.requestFullscreen(); }
  }, [])

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">🤖 OpenClaw Panel</span>
      </header>
      <main className="app-main no-scroll" style={{ position: 'relative' }}>
        <div style={{ display: tab === 'dashboard' ? 'block' : 'none', height: '100%', overflowY: 'auto' }}>
          <Dashboard />
        </div>
        <div style={{ display: tab === 'files' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <Files toast={toast} />
        </div>
        <div style={{ display: tab === 'skills' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <Skills toast={toast} />
        </div>
        <div style={{ display: tab === 'terminal' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <TerminalTabs />
        </div>
        <div style={{ display: tab === 'settings' ? 'block' : 'none', height: '100%' }}>
          <SettingsTab toast={toast} onLogout={() => { logout(); setAuthed(false) }} />
        </div>
      </main>
      <nav className="bottom-nav">
        {([
          { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
          { id: 'files', icon: <FolderOpen size={20} />, label: 'Files' },
          { id: 'skills', icon: <Boxes size={20} />, label: 'Skills' },
          { id: 'terminal', icon: <Terminal size={20} />, label: 'Terminal' },
          { id: 'settings', icon: <Settings size={20} />, label: 'Settings' },
        ] as const).map(t => (
          <button key={t.id} className={`nav-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.icon}<span>{t.label}</span>
          </button>
        ))}
      </nav>
      {toastMsg && <Toast msg={toastMsg} onDone={() => setToastMsg('')} />}
    </div>
  )
}
