import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, ArrowUpCircle } from 'lucide-react'
import { getAgents, getVersion, triggerUpdate, ping } from '../../api'

type DashboardTabProps = {
  onSelectAgent: (agent: any) => void
  toast: (m: string) => void
}

export default function DashboardTab({ onSelectAgent, toast }: DashboardTabProps) {
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [versionInfo, setVersionInfo] = useState<{ current: string; latest: string | null; updateAvailable: boolean } | null>(null)
  const [updating, setUpdating] = useState(false)

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

  useEffect(() => {
    getVersion().then(setVersionInfo).catch(() => {})
  }, [])

  const doUpdate = async () => {
    setUpdating(true)
    try {
      await triggerUpdate()
    } catch { /* server exits mid-request — that's fine */ }
    // Poll /api/ping until server is back
    const pollUntilBack = async () => {
      try {
        await ping()
        // Back up — reload the page
        window.location.reload()
      } catch {
        setTimeout(pollUntilBack, 2000)
      }
    }
    setTimeout(pollUntilBack, 3000)
  }

  return (
    <div className="tab-content">
      {/* Update banner */}
      {versionInfo?.updateAvailable && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(91,141,238,0.1)', border: '1px solid rgba(91,141,238,0.25)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
          <div>
            <div style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 600 }}>Update available</div>
            <div style={{ color: 'var(--text-3)', fontSize: '11px' }}>v{versionInfo.current} → v{versionInfo.latest}</div>
          </div>
          <button className="btn btn-primary" style={{ padding: '7px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={doUpdate} disabled={updating}>
            <ArrowUpCircle size={13} style={updating ? { animation: 'spin 1s linear infinite' } : {}} />
            {updating ? 'Restarting…' : 'Update'}
          </button>
        </div>
      )}

      <div className={`status-bar ${error ? 'error' : !loading ? 'ok' : 'pending'}`}>
        <span>{error ? `⚠️ ${error}` : !loading ? '✅ Connected' : '⏳ Loading...'}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {versionInfo && <span style={{ color: 'var(--text-3)', fontSize: '11px' }}>v{versionInfo.current}</span>}
          <button className="icon-btn" onClick={load}><RefreshCw size={14} /></button>
        </div>
      </div>

      <div className="agent-grid">
        {agents.map(agent => (
          <div key={agent.id} className="agent-card" onClick={() => onSelectAgent(agent)}>
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
