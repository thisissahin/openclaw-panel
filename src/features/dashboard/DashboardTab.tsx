import { useCallback, useEffect, useState } from 'react'
import { Plus, RefreshCw, X } from 'lucide-react'
import { createAgent, getAgents } from '../../api'

type DashboardTabProps = {
  onSelectAgent: (agent: any) => void
  toast: (message: string) => void
}

export default function DashboardTab({ onSelectAgent, toast }: DashboardTabProps) {
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', id: '', botToken: '', model: '' })

  const load = useCallback(async () => {
    try {
      setError('')
      const response = await getAgents()
      setAgents(response.agents || [])
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  const suggestId = (name: string) =>
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

  const submitCreate = async () => {
    if (!form.name.trim()) return toast('Agent name is required')
    if (!form.botToken.trim()) return toast('Telegram bot token is required')

    setCreating(true)
    try {
      const payload = {
        name: form.name.trim(),
        id: (form.id.trim() || suggestId(form.name)).trim(),
        botToken: form.botToken.trim(),
        model: form.model.trim() || undefined,
      }

      const response = await createAgent(payload)
      if (!response.ok) throw new Error(response.error || 'Failed to create agent')

      toast(`Agent ${response.agent?.id || payload.id} created ✅`)
      setShowCreate(false)
      setForm({ name: '', id: '', botToken: '', model: '' })
      await load()
    } catch (error: any) {
      toast(`Create failed: ${error.message}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="tab-content">
      <div className={`status-bar ${error ? 'error' : !loading ? 'ok' : 'pending'}`}>
        {error ? `⚠️ ${error}` : !loading ? '✅ Connected' : '⏳ Loading...'}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="icon-btn" onClick={() => setShowCreate(true)} title="Create Agent">
            <Plus size={14} />
          </button>
          <button className="icon-btn" onClick={load}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {showCreate && (
        <div
          style={{
            margin: '10px 0 14px',
            background: 'var(--secondary-bg)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '12px',
            display: 'grid',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '13px' }}>Create Agent</strong>
            <button className="icon-btn" onClick={() => setShowCreate(false)}>
              <X size={14} />
            </button>
          </div>

          <input
            placeholder="Name (e.g. Atlas)"
            value={form.name}
            onChange={event =>
              setForm(previous => {
                const name = event.target.value
                const next = { ...previous, name }
                if (!previous.id) next.id = suggestId(name)
                return next
              })
            }
            style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px' }}
          />

          <input
            placeholder="Agent ID (slug)"
            value={form.id}
            onChange={event => setForm(previous => ({ ...previous, id: event.target.value }))}
            style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px' }}
          />

          <input
            placeholder="Telegram Bot Token"
            value={form.botToken}
            onChange={event => setForm(previous => ({ ...previous, botToken: event.target.value }))}
            style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px' }}
          />

          <input
            placeholder="Model (optional)"
            value={form.model}
            onChange={event => setForm(previous => ({ ...previous, model: event.target.value }))}
            style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px' }}
          />

          <button
            onClick={submitCreate}
            disabled={creating}
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--btn, #4c8bf5)',
              color: 'var(--btn-text, #fff)',
              fontWeight: 600,
              cursor: creating ? 'not-allowed' : 'pointer',
              opacity: creating ? 0.7 : 1,
            }}
          >
            {creating ? 'Creating…' : 'Create Agent'}
          </button>
        </div>
      )}

      <div className="agent-grid">
        {agents.map(agent => (
          <div key={agent.id} className="agent-card" onClick={() => onSelectAgent(agent)} style={{ cursor: 'pointer' }}>
            <div className="agent-emoji">{agent.emoji}</div>
            <div className="agent-name">{agent.name}</div>
            <div className={`agent-status ${agent.online ? 'online' : 'offline'}`}>
              {agent.online ? '● Online' : '○ Offline'}
            </div>
            <div className="agent-model">{agent.model}</div>
            {agent.tokens > 0 && <div className="agent-tokens">{(agent.tokens / 1000).toFixed(0)}k tokens</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
