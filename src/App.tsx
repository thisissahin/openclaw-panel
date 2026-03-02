import { useState, useEffect, useCallback, useRef } from 'react'
import { LayoutDashboard, Brain, FolderOpen, Zap, Settings, X, RefreshCw, Save, Edit3, Terminal, Trash2, PauseCircle, PlayCircle, Paperclip, Boxes, LogOut } from 'lucide-react'
import Files from './Files'
import { getAgents, listMemory, readMemory, writeMemory, listFiles, readFile, writeFile, runAction, getSettings, saveSettings, apiBase, getSkills, toggleSkill, isAuthenticated, logout, ping } from './api'
import './App.css'

type Tab = 'dashboard' | 'memory' | 'files' | 'skills' | 'actions' | 'logs'

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

// ─── Memory ──────────────────────────────────────────────────
function Memory({ toast }: { toast: (m: string) => void }) {
  const [files, setFiles] = useState<string[]>([])
  const [viewing, setViewing] = useState<{ name: string; content: string } | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listMemory()
      .then(r => setFiles(r.files || []))
      .catch(e => toast(`Error: ${e.message}`))
      .finally(() => setLoading(false))
  }, [])

  const open = async (name: string) => {
    try {
      const r = await readMemory(name)
      setViewing({ name, content: r.content || '' })
      setDraft(r.content || '')
      setEditing(false)
    } catch (e: any) { toast(`Error: ${e.message}`) }
  }

  const save = async () => {
    if (!viewing) return
    try {
      await writeMemory(viewing.name, draft)
      toast('Saved ✅')
      setViewing({ ...viewing, content: draft })
      setEditing(false)
    } catch (e: any) { toast(`Save failed: ${e.message}`) }
  }

  if (viewing) return (
    <div className="file-view">
      <div className="file-view-header">
        <button className="icon-btn" onClick={() => setViewing(null)}><X size={18} /></button>
        <span className="file-view-title">{viewing.name}</span>
        {!editing
          ? <button className="icon-btn" onClick={() => setEditing(true)}><Edit3 size={18} /></button>
          : <button className="icon-btn ok" onClick={save}><Save size={18} /></button>
        }
      </div>
      {editing
        ? <textarea className="file-editor" value={draft} onChange={e => setDraft(e.target.value)} />
        : <pre className="file-pre">{viewing.content}</pre>
      }
    </div>
  )

  return (
    <div className="tab-content">
      {loading && <div className="center-msg">Loading...</div>}
      {files.map(f => (
        <button key={f} className="list-item" onClick={() => open(f)}>
          <span>📄</span><span>{f}</span>
        </button>
      ))}
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
// ─── Actions ─────────────────────────────────────────────────
function Actions({ toast }: { toast: (m: string) => void }) {
  const [running, setRunning] = useState<string | null>(null)
  const [output, setOutput] = useState<{ label: string; text: string } | null>(null)

  const run = async (label: string, action: string) => {
    setRunning(label)
    try {
      const r = await runAction(action)
      if (r.output) setOutput({ label, text: r.output })
      else toast(`${label}: ${r.ok ? 'Done ✅' : r.error}`)
    } catch (e: any) { toast(`${label} failed: ${e.message}`) }
    finally { setRunning(null) }
  }

  const actions = [
    { label: 'Restart Gateway', emoji: '🔄', action: 'restart' },
    { label: 'Update OpenClaw', emoji: '⬆️', action: 'update' },
    { label: 'Gateway Status', emoji: '🔌', action: 'status' },
    { label: 'Tunnel Status', emoji: '🌐', action: 'tunnel' },
    { label: 'Disk Usage', emoji: '💾', action: 'df' },
    { label: 'Memory Usage', emoji: '🧠', action: 'free' },
  ]

  if (output) return (
    <div className="file-view">
      <div className="file-view-header">
        <button className="icon-btn" onClick={() => setOutput(null)}><X size={18} /></button>
        <span className="file-view-title">{output.label}</span>
      </div>
      <pre className="file-pre">{output.text}</pre>
    </div>
  )

  return (
    <div className="tab-content">
      <div className="actions-grid">
        {actions.map(a => (
          <button key={a.label} className={`action-btn ${running === a.label ? 'running' : ''}`}
            onClick={() => run(a.label, a.action)} disabled={!!running}>
            <span className="action-emoji">{a.emoji}</span>
            <span className="action-label">{running === a.label ? '⏳' : a.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

import TerminalView from './TerminalView'

// ─── Terminal Tabs ───────────────────────────────────────────
function TerminalTabs({ onBack }: { onBack: () => void }) {
  const [tabs, setTabs] = useState<{id: string, name: string}[]>([{ id: Date.now().toString(), name: 'Term 1' }]);
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  const addTab = () => {
    const id = Date.now().toString();
    setTabs([...tabs, { id, name: `Term ${tabs.length + 1}` }]);
    setActiveTab(id);
  };

  const closeTab = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newTabs = tabs.filter(t => t.id !== id);
    if (newTabs.length === 0) {
      onBack();
      return;
    }
    setTabs(newTabs);
    if (activeTab === id) {
      setActiveTab(newTabs[newTabs.length - 1].id);
    }
  };

  return (
    <div className="logs-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="logs-toolbar" style={{ justifyContent: 'space-between', padding: '0', borderBottom: '1px solid #333', background: '#222' }}>
        <div style={{ display: 'flex', flex: 1, overflowX: 'auto', alignItems: 'flex-end', paddingTop: '4px' }}>
          <button className="icon-btn" onClick={onBack} style={{ margin: '4px 8px', padding: '4px' }} title="Back to Logs">
            &larr;
          </button>
          
          {tabs.map(t => (
            <div key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: '6px 12px',
              background: activeTab === t.id ? '#1e1e1e' : '#333',
              color: activeTab === t.id ? '#fff' : '#aaa',
              borderTopLeftRadius: '6px',
              borderTopRightRadius: '6px',
              border: '1px solid #444',
              borderBottom: activeTab === t.id ? 'none' : '1px solid #444',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              marginRight: '2px',
              marginBottom: '-1px',
              zIndex: activeTab === t.id ? 1 : 0,
              position: 'relative'
            }}>
              {t.name}
              <button className="icon-btn" onClick={(e) => closeTab(t.id, e)} style={{ padding: '2px', color: 'inherit' }}>
                <X size={12} />
              </button>
            </div>
          ))}
          <button className="icon-btn" onClick={addTab} style={{ margin: '4px', padding: '4px' }}>+</button>
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative', background: '#1e1e1e' }}>
        {tabs.map(t => (
          <div key={t.id} style={{ display: activeTab === t.id ? 'block' : 'none', height: '100%' }}>
            <TerminalView tabId={t.id} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Logs ────────────────────────────────────────────────────
type LogEntry = { type: 'user' | 'assistant' | 'tool' | 'result' | 'system' | 'error'; time: string; text: string }

function Logs() {
  const [mode, setMode] = useState<'system' | 'terminal'>('system')
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [paused, setPaused] = useState(false)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const bottomRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)
  const wsRef = useRef<WebSocket | null>(null)
  const urlParams = new URLSearchParams(window.location.search)
  const agentId = urlParams.get('agent') || 'main'

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    if (mode === 'terminal') return;
    const base = apiBase().replace(/^http/, 'ws').replace(/\/$/, '')
    const token = localStorage.getItem('token') || 'decd6097769042335d4a219057655758f5a9f9d2ff16cfae'
    const url = `${base}/ws/logs?token=${token}&agent=${agentId}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => setStatus('connected')
    ws.onclose = () => setStatus('disconnected')
    ws.onerror = () => setStatus('disconnected')
    ws.onmessage = (e) => {
      if (pausedRef.current) return
      try {
        const entry: LogEntry = JSON.parse(e.data)
        setEntries(prev => [...prev.slice(-500), entry])
      } catch {}
    }
    return () => ws.close()
  }, [agentId, mode])

  useEffect(() => {
    if (!paused && mode === 'system') bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries, paused, mode])

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

  if (mode === 'terminal') {
    return <TerminalTabs onBack={() => setMode('system')} />;
  }

  return (
    <div className="logs-container">
      <div className="logs-toolbar">
        <span className={`log-status log-status--${status}`}>
          {status === 'connected' ? '● Live' : status === 'connecting' ? '○ Connecting…' : '✕ Disconnected'}
        </span>
        <div className="logs-toolbar-actions" style={{ display: 'flex', alignItems: 'center' }}>
          <button onClick={() => setMode('terminal')} style={{ padding: '4px 12px', fontSize: '12px', marginRight: '8px', background: '#333', color: '#fff', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}>
            Open Terminal
          </button>
          <button className="icon-btn" title={paused ? 'Resume' : 'Pause'} onClick={() => setPaused(p => !p)}>
            {paused ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
          </button>
          <button className="icon-btn" title="Clear" onClick={() => setEntries([])}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="logs-body">
        {entries.length === 0 && (
          <div className="logs-empty">Waiting for activity…</div>
        )}
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

// ─── Settings ────────────────────────────────────────────────
function SettingsPanel({ onClose, toast }: { onClose: () => void; toast: (m: string) => void }) {
  const s = getSettings()
  const [url, setUrl] = useState(s.gatewayUrl)
  const [token, setToken] = useState(s.token)

  const save = () => { saveSettings(url, token); toast('Saved ✅'); onClose() }

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        <div className="settings-header">
          <span>Settings</span>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <label>API Base URL (leave blank = same origin)</label>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
        <label>Token</label>
        <input value={token} onChange={e => setToken(e.target.value)} type="password" placeholder="Token" />
        <button className="primary-btn" onClick={save}>Save</button>
      </div>
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────
export default function App() {
  const [authed, setAuthed] = useState(isAuthenticated())
  const [tab, setTab] = useState<Tab>('dashboard')
  const [showSettings, setShowSettings] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  const toast = (m: string) => setToastMsg(m)

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp
    if (tg) { 
      tg.ready(); 
      tg.expand();
      if (tg.requestFullscreen) tg.requestFullscreen();
    }
  }, [])

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />

  const handleLogout = () => {
    logout()
    setAuthed(false)
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">🤖 OpenClaw Panel</span>
        <div className="header-right" style={{ display: 'flex', gap: '4px' }}>
          <button className="icon-btn" onClick={() => setShowSettings(true)}><Settings size={18} /></button>
          <button className="icon-btn" onClick={handleLogout} title="Logout"><LogOut size={18} /></button>
        </div>
      </header>
      <main className={`app-main ${(tab === 'logs' || tab === 'files' || tab === 'skills') ? 'no-scroll' : ''}`}>
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'memory' && <Memory toast={toast} />}
        {tab === 'files' && <Files toast={toast} />}
        {tab === 'skills' && <Skills toast={toast} />}
        {tab === 'actions' && <Actions toast={toast} />}
        {tab === 'logs' && <Logs />}
      </main>
      <nav className="bottom-nav">
        {([
          { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
          { id: 'memory', icon: <Brain size={20} />, label: 'Memory' },
          { id: 'files', icon: <FolderOpen size={20} />, label: 'Files' },
          { id: 'skills', icon: <Boxes size={20} />, label: 'Skills' },
          { id: 'actions', icon: <Zap size={20} />, label: 'Actions' },
          { id: 'logs', icon: <Terminal size={20} />, label: 'Logs' },
        ] as const).map(t => (
          <button key={t.id} className={`nav-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.icon}<span>{t.label}</span>
          </button>
        ))}
      </nav>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} toast={toast} />}
      {toastMsg && <Toast msg={toastMsg} onDone={() => setToastMsg('')} />}
    </div>
  )
}
