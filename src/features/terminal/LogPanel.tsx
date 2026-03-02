import { useEffect, useRef, useState } from 'react'
import { PauseCircle, PlayCircle, Trash2 } from 'lucide-react'
import { apiBase } from '../../api'

type LogEntry = {
  type: 'user' | 'assistant' | 'tool' | 'result' | 'system' | 'error'
  time: string
  text: string
}

export default function LogPanel() {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [paused, setPaused] = useState(false)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const bottomRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)
  const urlParams = new URLSearchParams(window.location.search)
  const agentId = urlParams.get('agent') || 'main'

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    const base = apiBase().replace(/^http/, 'ws').replace(/\/$/, '')
    const token = localStorage.getItem('token') || ''
    const socket = new WebSocket(`${base}/ws/logs?token=${token}&agent=${agentId}`)

    socket.onopen = () => setStatus('connected')
    socket.onclose = () => setStatus('disconnected')
    socket.onerror = () => setStatus('disconnected')

    socket.onmessage = event => {
      if (pausedRef.current) {
        return
      }

      try {
        setEntries(previous => [...previous.slice(-500), JSON.parse(event.data)])
      } catch {
        // Ignore malformed log payloads
      }
    }

    return () => socket.close()
  }, [agentId])

  useEffect(() => {
    if (!paused) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [entries, paused])

  const colorClass = (type: LogEntry['type']) => {
    switch (type) {
      case 'user':
        return 'log-user'
      case 'assistant':
        return 'log-assistant'
      case 'tool':
        return 'log-tool'
      case 'result':
        return 'log-result'
      case 'system':
        return 'log-system'
      case 'error':
        return 'log-error'
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <div className="logs-toolbar" style={{ flexShrink: 0 }}>
        <span className={`log-status log-status--${status}`}>
          {status === 'connected' ? '● Live' : status === 'connecting' ? '○ Connecting…' : '✕ Off'}
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="icon-btn" title={paused ? 'Resume' : 'Pause'} onClick={() => setPaused(value => !value)}>
            {paused ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
          </button>
          <button className="icon-btn" title="Clear" onClick={() => setEntries([])}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="logs-body" style={{ flex: 1, overflowY: 'auto' }}>
        {entries.length === 0 && <div className="logs-empty">Waiting for activity…</div>}
        {entries.map((entry, index) => (
          <div key={index} className={`log-line ${colorClass(entry.type)}`}>
            <span className="log-time">{entry.time}</span>
            <span className="log-text">{entry.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
