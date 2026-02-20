import { useState, useEffect, useCallback, useRef } from 'react'
import { LayoutDashboard, Brain, FolderOpen, Zap, Settings, X, RefreshCw, Save, Edit3, Terminal, Trash2, PauseCircle, PlayCircle, Paperclip, Send } from 'lucide-react'
import { getAgents, listMemory, readMemory, writeMemory, listFiles, readFile, writeFile, sendChat, runAction, getSettings, saveSettings, apiBase, authUser } from './api'
import './App.css'

type Tab = 'dashboard' | 'memory' | 'files' | 'actions' | 'logs'

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

// ─── Files ───────────────────────────────────────────────────
type CtxFile = { name: string; content: string }

function Files({ toast }: { toast: (m: string) => void }) {
  const [entries, setEntries] = useState<{ name: string; isDir: boolean }[]>([])
  const [currentPath, setCurrentPath] = useState('')
  const [viewing, setViewing] = useState<{ name: string; content: string } | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [context, setContext] = useState<CtxFile[]>([])
  const [chatInput, setChatInput] = useState('')
  const [sending, setSending] = useState(false);

  const loadDir = useCallback(async (p: string) => {
    setLoading(true)
    try {
      const r = await listFiles(p)
      setEntries(r.entries || [])
      setCurrentPath(p)
    } catch (e: any) { toast(`Error: ${e.message}`) }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { loadDir('') }, [])

  const open = async (entry: { name: string; isDir: boolean }) => {
    const full = currentPath ? `${currentPath}/${entry.name}` : entry.name
    if (entry.isDir) { loadDir(full); return }
    try {
      const r = await readFile(full)
      setViewing({ name: full, content: r.content || '' })
      setDraft(r.content || '')
      setEditing(false)
    } catch (e: any) { toast(`Error: ${e.message}`) }
  }

  const save = async () => {
    if (!viewing) return
    try {
      await writeFile(viewing.name, draft)
      toast('Saved ✅')
      setViewing({ ...viewing, content: draft })
      setEditing(false)
    } catch (e: any) { toast(`Save failed: ${e.message}`) }
  }

  const addToContext = async (name: string, content?: string) => {
    if (context.find(c => c.name === name)) { toast('Already in context'); return }
    try {
      const text = content ?? (await readFile(name)).content ?? ''
      setContext(prev => [...prev, { name, content: text }])
      toast(`📎 ${name.split('/').pop()}`)
    } catch (e: any) { toast(`Error: ${e.message}`) }
  }

  const removeFromContext = (name: string) => setContext(prev => prev.filter(c => c.name !== name))

  const handleSend = async () => {
    if (!chatInput.trim() && context.length === 0) return
    setSending(true)
    try {
      await sendChat(chatInput, context)
      setChatInput('')
      toast('Sent ✅')
    } catch (e: any) { toast(`Failed: ${e.message}`) }
    finally { setSending(false) }
  }

  const inContext = (name: string) => !!context.find(c => c.name === name)

  const fileViewer = viewing && (
    <div className="file-view" style={{ flex: 1, overflow: 'hidden' }}>
      <div className="file-view-header">
        <button className="icon-btn" onClick={() => { setViewing(null); setEditing(false) }}><X size={18} /></button>
        <span className="file-view-title" style={{ fontSize: '11px' }}>{viewing.name}</span>
        <button
          className={`icon-btn ${inContext(viewing.name) ? 'ok' : ''}`}
          title="Add to context"
          onClick={() => addToContext(viewing.name, viewing.content)}
        ><Paperclip size={18} /></button>
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

  const dirListing = !viewing && (
    <div className="files-body">
      <div className="path-bar">
        <span>/{currentPath}</span>
        {currentPath && (
          <button className="icon-btn" onClick={() => loadDir(currentPath.split('/').slice(0, -1).join('/'))}>↑</button>
        )}
      </div>
      {loading && <div className="center-msg">Loading...</div>}
      {entries.map(e => {
        const full = currentPath ? `${currentPath}/${e.name}` : e.name
        return (
          <div key={e.name} className="list-item-row">
            <button className="list-item-main" onClick={() => open(e)}>
              <span>{e.isDir ? '📁' : '📄'}</span>
              <span>{e.name}</span>
            </button>
            {!e.isDir && (
              <button
                className={`context-add-btn ${inContext(full) ? 'active' : ''}`}
                onClick={() => addToContext(full)}
                title="Add to context"
              ><Paperclip size={14} /></button>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="files-wrapper">
      {context.length > 0 && (
        <div className="context-tray">
          <span className="context-tray-label">📎</span>
          {context.map(f => (
            <div key={f.name} className="context-chip">
              <span>{f.name.split('/').pop()}</span>
              <button onClick={() => removeFromContext(f.name)}><X size={11} /></button>
            </div>
          ))}
        </div>
      )}
      {fileViewer}
      {dirListing}
      <div className="chat-input-bar">
        <textarea
          className="chat-textarea"
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder={context.length > 0 ? `Ask about ${context.length} file${context.length > 1 ? 's' : ''}…` : 'Add files to context, then ask…'}
          rows={1}
        />
        <button className="chat-send-btn" onClick={handleSend} disabled={sending || (!chatInput.trim() && context.length === 0)}>
          <Send size={16} />
        </button>
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

// ─── Logs ────────────────────────────────────────────────────
type LogEntry = { type: 'user' | 'assistant' | 'tool' | 'result' | 'system' | 'error'; time: string; text: string }

function Logs() {
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
    <div className="logs-container">
      <div className="logs-toolbar">
        <span className={`log-status log-status--${status}`}>
          {status === 'connected' ? '● Live' : status === 'connecting' ? '○ Connecting…' : '✕ Disconnected'}
        </span>
        <div className="logs-toolbar-actions">
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
  const [tab, setTab] = useState<Tab>('dashboard')
  const [showSettings, setShowSettings] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  const toast = (m: string) => setToastMsg(m)

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp
    if (tg) { 
      tg.ready(); 
      tg.expand();
      
      if (tg.initDataUnsafe?.user) {
        authUser(tg.initDataUnsafe.user)
          .then(r => {
            if (r.ok) localStorage.setItem('userId', r.user.telegram_id);
          })
          .catch(console.error);
      }
    }
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">🌙 OpenClaw Panel</span>
        <button className="icon-btn" onClick={() => setShowSettings(true)}><Settings size={18} /></button>
      </header>
      <main className={`app-main ${(tab === 'logs' || tab === 'files') ? 'no-scroll' : ''}`}>
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'memory' && <Memory toast={toast} />}
        {tab === 'files' && <Files toast={toast} />}
        {tab === 'actions' && <Actions toast={toast} />}
        {tab === 'logs' && <Logs />}
      </main>
      <nav className="bottom-nav">
        {([
          { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
          { id: 'memory', icon: <Brain size={20} />, label: 'Memory' },
          { id: 'files', icon: <FolderOpen size={20} />, label: 'Files' },
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
