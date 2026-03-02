import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, RefreshCw, Minimize2, RotateCcw, Play, Trash2, Clock, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { getSessions, compactSession, resetSession, getUsage, getCronJobs, runCronJob, updateCronJob, deleteCronJob, getCronRuns, createCronJob } from './api'

// ── Helpers ───────────────────────────────────────────────────
function fmt(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n) }
function fmtDate(ts: number | null) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtSchedule(job: any) {
  const s = job.schedule
  if (!s) return '—'
  if (s.kind === 'every') {
    const ms = s.everyMs
    if (ms < 60000) return `Every ${ms / 1000}s`
    if (ms < 3600000) return `Every ${ms / 60000}m`
    return `Every ${ms / 3600000}h`
  }
  if (s.kind === 'cron') return s.expr
  if (s.kind === 'at') return `At ${fmtDate(new Date(s.at).getTime())}`
  return JSON.stringify(s)
}

// ── Confirm Dialog ────────────────────────────────────────────
function ConfirmDialog({ msg, onConfirm, onCancel }: { msg: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' }}>
      <div style={{ background: '#1e1e1e', borderRadius: '12px', padding: '24px', maxWidth: '320px', width: '100%' }}>
        <p style={{ margin: '0 0 20px', color: '#fff', lineHeight: 1.5 }}>{msg}</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-danger" style={{ flex: 1 }} onClick={onConfirm}>Confirm</button>
          <button className="btn" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────
function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: '12px', background: '#1e1e1e', borderRadius: '12px', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'none', border: 'none', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
        {title}
        {open ? <ChevronUp size={16} color="#666" /> : <ChevronDown size={16} color="#666" />}
      </button>
      {open && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  )
}

// ── Session Panel ─────────────────────────────────────────────
function SessionPanel({ agentId, toast }: { agentId: string; toast: (m: string) => void }) {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState<null | 'compact' | 'reset'>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await getSessions()
      const sess = (r.sessions || []).find((s: any) => s.key === `agent:${agentId}:main`)
      setSession(sess || null)
    } catch { } finally { setLoading(false) }
  }, [agentId])

  useEffect(() => { load() }, [load])

  const doCompact = async () => {
    setBusy(true)
    try {
      await compactSession(`agent:${agentId}:main`)
      toast('Session compacted ✅')
      load()
    } catch (e: any) { toast(`Error: ${e.message}`) }
    finally { setBusy(false); setConfirm(null) }
  }

  const doReset = async () => {
    setBusy(true)
    try {
      await resetSession(`agent:${agentId}:main`)
      toast('Session reset ✅')
      load()
    } catch (e: any) { toast(`Error: ${e.message}`) }
    finally { setBusy(false); setConfirm(null) }
  }

  if (loading) return <p style={{ color: '#666', fontSize: '13px' }}>Loading session...</p>
  if (!session) return <p style={{ color: '#666', fontSize: '13px' }}>No active session found.</p>

  return (
    <>
      {confirm && (
        <ConfirmDialog
          msg={confirm === 'compact' ? 'Compact this session? The history will be summarised to free context space.' : 'Reset this session? All context history will be cleared permanently.'}
          onConfirm={confirm === 'compact' ? doCompact : doReset}
          onCancel={() => setConfirm(null)}
        />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        {[
          { label: 'Total Tokens', value: fmt(session.totalTokens || 0) },
          { label: 'Input', value: fmt(session.inputTokens || 0) },
          { label: 'Output', value: fmt(session.outputTokens || 0) },
          { label: 'Cached', value: fmt(session.cacheRead || 0) },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#2a2a2a', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ color: '#666', fontSize: '11px', marginBottom: '4px' }}>{label}</div>
            <div style={{ color: '#fff', fontSize: '18px', fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ color: '#666', fontSize: '12px', marginBottom: '12px' }}>
        Last active: {fmtDate(session.updatedAt)} · Model: {session.modelProvider}/{session.model}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={() => setConfirm('compact')} disabled={busy}>
          <Minimize2 size={14} /> Compact
        </button>
        <button className="btn btn-danger" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={() => setConfirm('reset')} disabled={busy}>
          <RotateCcw size={14} /> Reset
        </button>
        <button className="icon-btn" onClick={load}><RefreshCw size={14} /></button>
      </div>
    </>
  )
}

// ── Usage Panel ───────────────────────────────────────────────
function UsagePanel({ agentId }: { agentId: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getUsage().then(r => { if (r.ok) setData(r) }).catch(() => {}).finally(() => setLoading(false))
  }, [agentId])

  if (loading) return <p style={{ color: '#666', fontSize: '13px' }}>Loading usage...</p>
  if (!data) return <p style={{ color: '#666', fontSize: '13px' }}>Usage data unavailable.</p>

  const totals = data.cost?.totals || {}
  const daily: any[] = data.cost?.daily || []
  const today = daily[daily.length - 1] || {}
  const providers: any[] = data.status?.providers || []

  const fmtCost = (n: number) => n > 0 ? `$${n.toFixed(3)}` : '$0.00'
  const fmtM = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : fmt(n)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Totals */}
      <div>
        <div style={{ color: '#888', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>All Time</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[
            { label: 'Total Tokens', value: fmtM(totals.totalTokens || 0) },
            { label: 'Total Cost', value: fmtCost(totals.totalCost || 0) },
            { label: 'Input Cost', value: fmtCost(totals.inputCost || 0) },
            { label: 'Output Cost', value: fmtCost(totals.outputCost || 0) },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: '#2a2a2a', borderRadius: '8px', padding: '10px 12px' }}>
              <div style={{ color: '#666', fontSize: '11px', marginBottom: '4px' }}>{label}</div>
              <div style={{ color: '#fff', fontSize: '16px', fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Today */}
      {today.date && (
        <div>
          <div style={{ color: '#888', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Today ({today.date})</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { label: 'Tokens', value: fmtM(today.totalTokens || 0) },
              { label: 'Cost', value: fmtCost(today.totalCost || 0) },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#2a2a2a', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ color: '#666', fontSize: '11px', marginBottom: '4px' }}>{label}</div>
                <div style={{ color: '#fff', fontSize: '16px', fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily bar chart (last 7 days) */}
      {daily.length > 1 && (() => {
        const slice = daily.slice(-7)
        const maxCost = Math.max(...slice.map((x: any) => x.totalCost || 0), 0.001)
        return (
          <div>
            <div style={{ color: '#888', fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Last {slice.length} Days
            </div>
            <div style={{ background: '#2a2a2a', borderRadius: '10px', padding: '12px 12px 8px' }}>
              {/* Bars */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '56px', marginBottom: '6px' }}>
                {slice.map((d: any, i: number) => {
                  const pct = (d.totalCost || 0) / maxCost
                  const barH = Math.max(pct > 0 ? 6 : 2, pct * 56)
                  const isToday = d.date === today.date
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '56px' }}>
                      <div style={{
                        width: '100%',
                        height: `${barH}px`,
                        background: isToday ? '#4a9eff' : pct > 0 ? '#2d6aad' : '#333',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease'
                      }} />
                    </div>
                  )
                })}
              </div>
              {/* Labels */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {slice.map((d: any, i: number) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center', color: d.date === today.date ? '#4a9eff' : '#555', fontSize: '10px' }}>
                    {d.date?.slice(5).replace('-', '/')}
                  </div>
                ))}
              </div>
              {/* Cost labels */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                {slice.map((d: any, i: number) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center', color: '#666', fontSize: '9px' }}>
                    {d.totalCost > 0 ? `$${d.totalCost.toFixed(2)}` : ''}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Provider rate limits */}
      {providers.length > 0 && (
        <div>
          <div style={{ color: '#888', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Providers</div>
          {providers.map((p: any) => (
            <div key={p.provider} style={{ background: '#2a2a2a', borderRadius: '8px', padding: '10px 12px', marginBottom: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: p.windows?.length > 0 ? '8px' : '0' }}>
                <div style={{ color: '#fff', fontSize: '12px', fontWeight: 600 }}>{p.displayName}</div>
                {p.error
                  ? <span style={{ color: '#f59e0b', fontSize: '10px', background: '#f59e0b11', border: '1px solid #f59e0b33', borderRadius: '4px', padding: '2px 6px' }}>⚠ Auth error</span>
                  : p.windows?.length === 0
                    ? <span style={{ color: '#22c55e', fontSize: '10px' }}>✓ OK</span>
                    : null
                }
              </div>
              {p.error && (
                <div style={{ color: '#f59e0b88', fontSize: '10px', marginBottom: p.windows?.length > 0 ? '8px' : '0', lineHeight: 1.4 }}>{p.error}</div>
              )}
              {p.windows?.map((w: any, i: number) => (
                <div key={i} style={{ marginBottom: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ color: '#888', fontSize: '11px' }}>{w.label}</span>
                    <span style={{ color: w.usedPercent > 80 ? '#ef4444' : w.usedPercent > 50 ? '#f59e0b' : '#888', fontSize: '11px' }}>{w.usedPercent}%</span>
                  </div>
                  <div style={{ height: '4px', background: '#333', borderRadius: '2px' }}>
                    <div style={{ height: '100%', width: `${w.usedPercent}%`, background: w.usedPercent > 80 ? '#ef4444' : w.usedPercent > 50 ? '#f59e0b' : '#4a9eff', borderRadius: '2px', transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Cron Jobs Panel ───────────────────────────────────────────
function CronPanel({ agentId, toast }: { agentId: string; toast: (m: string) => void }) {
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRuns, setExpandedRuns] = useState<string | null>(null)
  const [runs, setRuns] = useState<any[]>([])
  const [confirm, setConfirm] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [busy, setBusy] = useState(false)

  // Create form state
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<'every' | 'cron'>('every')
  const [newEvery, setNewEvery] = useState('3600000')
  const [newCron, setNewCron] = useState('0 9 * * *')
  const [newPayload, setNewPayload] = useState('')
  const [newTarget, setNewTarget] = useState<'main' | 'isolated'>('isolated')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await getCronJobs()
      const all: any[] = r.jobs || []
      setJobs(all.filter((j: any) => !j.payload?.agentId || j.payload?.agentId === agentId || j.sessionTarget === agentId))
    } catch { } finally { setLoading(false) }
  }, [agentId])

  useEffect(() => { load() }, [load])

  const toggle = async (job: any) => {
    try {
      await updateCronJob(job.jobId || job.id, { enabled: !job.enabled })
      toast(`Job ${job.enabled ? 'disabled' : 'enabled'} ✅`)
      load()
    } catch (e: any) { toast(`Error: ${e.message}`) }
  }

  const runNow = async (job: any) => {
    try {
      await runCronJob(job.jobId || job.id)
      toast('Job triggered ✅')
    } catch (e: any) { toast(`Error: ${e.message}`) }
  }

  const remove = async (id: string) => {
    try {
      await deleteCronJob(id)
      toast('Job deleted ✅')
      setConfirm(null)
      load()
    } catch (e: any) { toast(`Error: ${e.message}`) }
  }

  const loadRuns = async (job: any) => {
    const id = job.jobId || job.id
    if (expandedRuns === id) { setExpandedRuns(null); return }
    try {
      const r = await getCronRuns(id)
      setRuns(r.runs || [])
      setExpandedRuns(id)
    } catch { }
  }

  const create = async () => {
    if (!newPayload.trim()) { toast('Payload message required'); return }
    setBusy(true)
    try {
      const schedule = newKind === 'every'
        ? { kind: 'every', everyMs: Number(newEvery) }
        : { kind: 'cron', expr: newCron }
      await createCronJob({
        name: newName || undefined,
        schedule,
        sessionTarget: newTarget,
        payload: { kind: 'agentTurn', message: newPayload },
        enabled: true,
      })
      toast('Cron job created ✅')
      setShowCreate(false)
      setNewName(''); setNewPayload('')
      load()
    } catch (e: any) { toast(`Error: ${e.message}`) }
    finally { setBusy(false) }
  }

  const inputStyle = { width: '100%', background: '#2a2a2a', border: '1px solid #444', borderRadius: '8px', padding: '8px 10px', color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }
  const labelStyle = { color: '#888', fontSize: '12px', display: 'block', marginBottom: '4px' }

  return (
    <>
      {confirm && (
        <ConfirmDialog
          msg="Delete this cron job permanently?"
          onConfirm={() => remove(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ color: '#888', fontSize: '12px' }}>{jobs.length} job{jobs.length !== 1 ? 's' : ''}</span>
        <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', fontSize: '12px' }} onClick={() => setShowCreate(s => !s)}>
          {showCreate ? <X size={12} /> : <Plus size={12} />} {showCreate ? 'Cancel' : 'New Job'}
        </button>
      </div>

      {showCreate && (
        <div style={{ background: '#2a2a2a', borderRadius: '10px', padding: '14px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label style={labelStyle}>Name (optional)</label>
            <input style={inputStyle} value={newName} onChange={e => setNewName(e.target.value)} placeholder="My daily task" />
          </div>
          <div>
            <label style={labelStyle}>Schedule type</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['every', 'cron'] as const).map(k => (
                <button key={k} className={`btn${newKind === k ? '' : ''}`} onClick={() => setNewKind(k)} style={{ flex: 1, background: newKind === k ? '#4a9eff' : '#333', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px', fontSize: '12px', cursor: 'pointer' }}>{k}</button>
              ))}
            </div>
          </div>
          {newKind === 'every' ? (
            <div>
              <label style={labelStyle}>Interval (ms)</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[['1h', '3600000'], ['6h', '21600000'], ['12h', '43200000'], ['24h', '86400000']].map(([l, v]) => (
                  <button key={v} onClick={() => setNewEvery(v)} style={{ background: newEvery === v ? '#4a9eff' : '#333', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}>{l}</button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label style={labelStyle}>Cron expression</label>
              <input style={inputStyle} value={newCron} onChange={e => setNewCron(e.target.value)} placeholder="0 9 * * *" />
            </div>
          )}
          <div>
            <label style={labelStyle}>Session target</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['isolated', 'main'] as const).map(k => (
                <button key={k} onClick={() => setNewTarget(k)} style={{ flex: 1, background: newTarget === k ? '#4a9eff' : '#333', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px', fontSize: '12px', cursor: 'pointer' }}>{k}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Prompt / message</label>
            <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} value={newPayload} onChange={e => setNewPayload(e.target.value)} placeholder="What should the agent do?" />
          </div>
          <button className="btn" style={{ background: '#4a9eff', color: '#fff' }} onClick={create} disabled={busy}>
            {busy ? 'Creating...' : 'Create Job'}
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#666', fontSize: '13px' }}>Loading jobs...</p>
      ) : jobs.length === 0 ? (
        <p style={{ color: '#666', fontSize: '13px' }}>No cron jobs yet.</p>
      ) : (
        jobs.map(job => {
          const id = job.jobId || job.id
          return (
            <div key={id} style={{ background: '#2a2a2a', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <div>
                  <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>{job.name || id.slice(0, 8)}</div>
                  <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>{fmtSchedule(job)}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {/* Toggle */}
                  <button onClick={() => toggle(job)} style={{ background: job.enabled ? '#22c55e22' : '#ffffff11', color: job.enabled ? '#22c55e' : '#666', border: `1px solid ${job.enabled ? '#22c55e44' : '#444'}`, borderRadius: '6px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}>
                    {job.enabled ? 'ON' : 'OFF'}
                  </button>
                  {/* Run now */}
                  <button className="icon-btn" onClick={() => runNow(job)} title="Run now"><Play size={13} /></button>
                  {/* History */}
                  <button className="icon-btn" onClick={() => loadRuns(job)} title="Run history"><Clock size={13} /></button>
                  {/* Delete */}
                  <button className="icon-btn" onClick={() => setConfirm(id)} title="Delete" style={{ color: '#ef4444' }}><Trash2 size={13} /></button>
                </div>
              </div>
              <div style={{ color: '#555', fontSize: '11px' }}>
                {job.payload?.kind === 'agentTurn' ? `💬 ${(job.payload.message || '').slice(0, 60)}` : job.payload?.kind}
              </div>
              {/* Run history */}
              {expandedRuns === id && (
                <div style={{ marginTop: '10px', borderTop: '1px solid #333', paddingTop: '10px' }}>
                  {runs.length === 0 ? (
                    <p style={{ color: '#666', fontSize: '12px' }}>No runs yet.</p>
                  ) : runs.slice(0, 5).map((run: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: run.status === 'ok' ? '#22c55e' : '#ef4444', fontSize: '12px' }}>{run.status}</span>
                      <span style={{ color: '#666', fontSize: '11px' }}>{fmtDate(run.startedAt || run.ts)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })
      )}
    </>
  )
}

// ── Agent Detail Page ─────────────────────────────────────────
export default function AgentDetail({ agent, onBack, toast }: {
  agent: { id: string; name: string; emoji: string; model: string; online: boolean; tokens: number }
  onBack: () => void
  toast: (m: string) => void
}) {
  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#121212' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', position: 'sticky', top: 0, background: '#121212', zIndex: 10, borderBottom: '1px solid #1e1e1e' }}>
        <button className="icon-btn" onClick={onBack}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px' }}>{agent.emoji} {agent.name}</div>
          <div style={{ color: '#666', fontSize: '12px' }}>{agent.id} · {agent.online ? '● Online' : '○ Offline'}</div>
        </div>
        <div style={{ background: '#2a2a2a', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', color: '#4a9eff' }}>{agent.model}</div>
      </div>

      {/* Sections */}
      <div style={{ padding: '12px' }}>
        <Section title="📊 Session">
          <SessionPanel agentId={agent.id} toast={toast} />
        </Section>
        <Section title="⚡ Usage & Cost" defaultOpen={false}>
          <UsagePanel agentId={agent.id} />
        </Section>
        <Section title="🗓 Cron Jobs" defaultOpen={false}>
          <CronPanel agentId={agent.id} toast={toast} />
        </Section>
      </div>
    </div>
  )
}
