import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { getAgents } from '../../api'

type DashboardTabProps = {
  onSelectAgent: (agent: any) => void
}

export default function DashboardTab({ onSelectAgent }: DashboardTabProps) {
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  return (
    <div className="tab-content">
      <div className={`status-bar ${error ? 'error' : !loading ? 'ok' : 'pending'}`}>
        {error ? `⚠️ ${error}` : !loading ? '✅ Connected' : '⏳ Loading...'}
        <button className="icon-btn" onClick={load}>
          <RefreshCw size={14} />
        </button>
      </div>

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
