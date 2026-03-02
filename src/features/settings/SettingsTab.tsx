import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { getConfig, getSessions, patchConfig, patchSessionModel, runAction as runServerAction, saveSettings } from '../../api'
import { ModelSelect, Row, Section, Toggle } from './SettingsUi'

type SettingsTabProps = {
  toast: (message: string) => void
  onLogout: () => void
}

export default function SettingsTab({ toast, onLogout }: SettingsTabProps) {
  const [cfg, setCfg] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [output, setOutput] = useState<{ label: string; text: string } | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [panelUrl, setPanelUrl] = useState(localStorage.getItem('gatewayUrl') || '')
  const [panelToken, setPanelToken] = useState(localStorage.getItem('token') || '')

  useEffect(() => {
    getConfig()
      .then(response => {
        if (response.ok) {
          setCfg(response.config)
        }
      })
      .catch(() => {})

    getSessions()
      .then(response => {
        if (response.ok) {
          setSessions(response.sessions || [])
        }
      })
      .catch(() => {})
  }, [])

  const patch = async (path: string, value: unknown, label?: string) => {
    try {
      const response = await patchConfig(path, value)
      if (response.ok) {
        if (response.config) {
          setCfg(response.config)
        } else {
          setCfg((previous: any) => {
            const next = JSON.parse(JSON.stringify(previous))
            const keys = path.split('.')
            let current = next
            for (let index = 0; index < keys.length - 1; index++) {
              current = current[keys[index]]
            }
            current[keys[keys.length - 1]] = value
            return next
          })
        }
        toast(`${label || path} updated ✅`)
      } else {
        toast(`Failed: ${response.error}`)
      }
    } catch (error: any) {
      toast(`Error: ${error.message}`)
    }
  }

  const runAction = async (label: string, action: string) => {
    setRunning(label)
    try {
      const response = await runServerAction(action)
      if (response.output) {
        setOutput({ label, text: response.output })
      } else {
        toast(`${label}: ${response.ok ? 'Done ✅' : response.error}`)
      }
    } catch (error: any) {
      toast(`${label} failed: ${error.message}`)
    } finally {
      setRunning(null)
    }
  }

  if (output) {
    return (
      <div className="file-view">
        <div className="file-view-header">
          <button className="icon-btn" onClick={() => setOutput(null)}>
            <X size={18} />
          </button>
          <span className="file-view-title">{output.label}</span>
        </div>
        <pre className="file-pre">{output.text}</pre>
      </div>
    )
  }

  const defaults = cfg?.agents?.defaults
  const agentList: any[] = cfg?.agents?.list || []
  const telegram = cfg?.channels?.telegram
  const defaultModel = defaults?.model?.primary || ''

  const sessionForAgent = (agentId: string) =>
    sessions.find((session: any) => session.key?.startsWith(`agent:${agentId}:`) && session.kind === 'direct' && !session.key?.includes('slash'))

  const setAgentModel = async (agentId: string, index: number, model: string) => {
    await patch(`agents.list.${index}.model`, model, `${agentId} model`)
    const session = sessionForAgent(agentId)

    if (session) {
      try {
        await patchSessionModel(session.key, model)
        const sessionResponse = await getSessions()
        if (sessionResponse.ok) {
          setSessions(sessionResponse.sessions || [])
        }
        toast(`${agentId} switched to ${model.split('/')[1]} live ✅`)
      } catch {
        toast('Config saved, session update failed — restart to apply')
      }
    }
  }

  return (
    <div style={{ overflowY: 'auto', height: '100%', paddingTop: '12px', paddingBottom: '32px' }}>
      {agentList.length > 0 && (
        <Section title="Agents — Active Model">
          {agentList.map((agent: any, index: number) => {
            const hasOverride = !!agent.model
            const liveSession = sessionForAgent(agent.id)
            const liveModel = liveSession ? `${liveSession.modelProvider}/${liveSession.model}` : null
            const activeModel = agent.model || defaultModel

            return (
              <Row
                key={agent.id}
                label={agent.name || agent.id}
                hint={liveModel ? `● Live: ${liveModel.split('/')[1]}` : hasOverride ? '⚡ Override set' : '↩ Using default'}
                last={index === agentList.length - 1}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <ModelSelect value={liveModel || activeModel} onChange={value => setAgentModel(agent.id, index, value)} />
                  {hasOverride && (
                    <button
                      onClick={() => {
                        const overrideIndex = agentList.findIndex((candidate: any) => candidate.id === agent.id)
                        const next = JSON.parse(JSON.stringify(cfg))
                        delete next.agents.list[overrideIndex].model
                        patchConfig(`agents.list.${overrideIndex}.model`, null).then(() => {
                          setCfg(next)
                          toast(`${agent.id}: override removed, using default`)
                        })
                      }}
                      style={{
                        fontSize: '11px',
                        color: 'var(--hint)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      ✕ Remove override
                    </button>
                  )}
                </div>
              </Row>
            )
          })}
        </Section>
      )}

      {defaults && (
        <Section title="Default Model (fallback)">
          <Row label="Default" hint="Used for agents with no override set">
            <ModelSelect value={defaultModel} onChange={value => patch('agents.defaults.model.primary', value, 'Default model')} />
          </Row>
          <Row label="Context Pruning" hint="How to manage context window" last>
            <select
              value={defaults.contextPruning?.mode || 'cache-ttl'}
              onChange={event => patch('agents.defaults.contextPruning.mode', event.target.value, 'Context pruning')}
              style={{
                background: 'var(--secondary-bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '13px',
              }}
            >
              <option value="cache-ttl">Cache TTL</option>
              <option value="aggressive">Aggressive</option>
              <option value="none">None</option>
            </select>
          </Row>
        </Section>
      )}

      {defaults?.memorySearch && (
        <Section title="Memory">
          <Row label="Memory Search" hint="Semantic search across memory files">
            <Toggle value={defaults.memorySearch.enabled} onChange={value => patch('agents.defaults.memorySearch.enabled', value, 'Memory search')} />
          </Row>
          <Row label="Sync on Start" hint="Index memory when session begins">
            <Toggle
              value={defaults.memorySearch.sync?.onSessionStart ?? true}
              onChange={value => patch('agents.defaults.memorySearch.sync.onSessionStart', value, 'Sync on start')}
            />
          </Row>
          <Row label="Heartbeat" hint="Periodic check interval" last>
            <select
              value={defaults.heartbeat?.every || '1h'}
              onChange={event => patch('agents.defaults.heartbeat.every', event.target.value, 'Heartbeat')}
              style={{
                background: 'var(--secondary-bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '13px',
              }}
            >
              <option value="30m">30 minutes</option>
              <option value="1h">1 hour</option>
              <option value="2h">2 hours</option>
              <option value="6h">6 hours</option>
              <option value="24h">24 hours</option>
            </select>
          </Row>
        </Section>
      )}

      {telegram && (
        <Section title="Telegram">
          <Row label="Streaming" hint="How messages are sent">
            <select
              value={telegram.streaming || 'partial'}
              onChange={event => patch('channels.telegram.streaming', event.target.value, 'Streaming')}
              style={{
                background: 'var(--secondary-bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '13px',
              }}
            >
              <option value="partial">Partial (live updates)</option>
              <option value="full">Full (send when done)</option>
              <option value="off">Off</option>
            </select>
          </Row>
          <Row label="DM Policy" hint="Who can send direct messages" last>
            <select
              value={telegram.dmPolicy || 'allowlist'}
              onChange={event => patch('channels.telegram.dmPolicy', event.target.value, 'DM policy')}
              style={{
                background: 'var(--secondary-bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '13px',
              }}
            >
              <option value="allowlist">Allowlist only</option>
              <option value="open">Open</option>
            </select>
          </Row>
        </Section>
      )}

      <Section title="System">
        {[
          { label: 'Restart Gateway', emoji: '🔄', action: 'restart' },
          { label: 'Update OpenClaw', emoji: '⬆️', action: 'update' },
          { label: 'Gateway Status', emoji: '🔌', action: 'status' },
          { label: 'Disk Usage', emoji: '💾', action: 'df' },
          { label: 'Memory Usage', emoji: '🧠', action: 'free' },
        ].map((item, index, collection) => (
          <Row key={item.action} label={item.label} last={index === collection.length - 1}>
            <button
              onClick={() => runAction(item.label, item.action)}
              disabled={!!running}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                background: 'var(--btn, #4c8bf5)',
                color: 'var(--btn-text, #fff)',
                border: 'none',
                borderRadius: '8px',
                cursor: running ? 'not-allowed' : 'pointer',
                opacity: running === item.label ? 0.6 : 1,
              }}
            >
              {running === item.label ? '⏳' : item.emoji}
            </button>
          </Row>
        ))}
      </Section>

      <Section title="Panel Connection">
        <Row label="Server URL" hint="Leave blank for same origin">
          <input
            value={panelUrl}
            onChange={event => setPanelUrl(event.target.value)}
            placeholder="https://..."
            style={{
              background: 'var(--bg)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '13px',
              width: '160px',
            }}
          />
        </Row>
        <Row label="Token" last>
          <input
            value={panelToken}
            onChange={event => setPanelToken(event.target.value)}
            type="password"
            placeholder="Token"
            style={{
              background: 'var(--bg)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '13px',
              width: '160px',
            }}
          />
        </Row>
        <div style={{ padding: '10px 16px' }}>
          <button
            onClick={() => {
              saveSettings(panelUrl, panelToken)
              toast('Saved ✅')
            }}
            style={{
              width: '100%',
              padding: '10px',
              background: 'var(--btn, #4c8bf5)',
              color: 'var(--btn-text, #fff)',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Save Connection
          </button>
        </div>
      </Section>

      <Section title="Account">
        <Row label="Sign Out" hint="Clears saved token from this device" last>
          <button
            onClick={onLogout}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              background: 'rgba(239,68,68,0.15)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </Row>
      </Section>
    </div>
  )
}
