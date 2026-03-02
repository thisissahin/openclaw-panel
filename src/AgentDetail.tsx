import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, RefreshCw, Minimize2, RotateCcw, Play, Trash2, ChevronDown, ChevronUp, Plus, X, Pencil } from 'lucide-react'
import { getSessions, compactSession, resetSession, getUsage, getCronJobs, runCronJob, updateCronJob, deleteCronJob, createCronJob } from './api'

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
  const [compacting, setCompacting] = useState(false)

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
    setConfirm(null)
    try {
      await compactSession(`agent:${agentId}:main`)
      // Compaction is async — show spinner and poll until tokens drop
      setCompacting(true)
      const tokensBefore = session?.totalTokens || 0
      const deadline = Date.now() + 90_000 // 90s max
      const poll = async () => {
        if (Date.now() > deadline) {
          setCompacting(false)
          setBusy(false)
          toast('Compaction timed out (may still be running)')
          return
        }
        await new Promise(r => setTimeout(r, 3000))
        try {
          const r = await getSessions()
          const sess = (r.sessions || []).find((s: any) => s.key === `agent:${agentId}:main`)
          if (sess) setSession(sess)
          const tokensAfter = sess?.totalTokens || 0
          if (tokensAfter < tokensBefore * 0.8 || tokensAfter === 0) {
            setCompacting(false)
            setBusy(false)
            toast(`Compacted ✅  ${Math.round(tokensBefore / 1000)}k → ${Math.round(tokensAfter / 1000)}k tokens`)
            return
          }
        } catch { }
        poll()
      }
      poll()
    } catch (e: any) {
      setBusy(false)
      toast(`Error: ${e.message}`)
    }
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
      {/* Token usage */}
      {(() => {
        const used = session.totalTokens || 0
        const ctx = session.contextTokens || 200000
        const pct = Math.min(100, Math.round((used / ctx) * 100))
        const color = pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#4a9eff'
        return (
          <div style={{ background: '#2a2a2a', borderRadius: '10px', padding: '12px 14px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
              <div style={{ color: '#888', fontSize: '11px' }}>Context Used</div>
              <div style={{ color: '#fff', fontSize: '20px', fontWeight: 700 }}>{fmt(used)} <span style={{ color: '#555', fontSize: '12px', fontWeight: 400 }}>/ {fmt(ctx)}</span></div>
            </div>
            <div style={{ height: '6px', background: '#333', borderRadius: '3px' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.4s ease' }} />
            </div>
            <div style={{ textAlign: 'right', color: color, fontSize: '11px', marginTop: '4px' }}>{pct}%</div>
          </div>
        )
      })()}
      <div style={{ color: '#666', fontSize: '12px', marginBottom: '12px' }}>
        Last active: {fmtDate(session.updatedAt)} · Model: {session.modelProvider}/{session.model}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', ...(compacting ? { background: '#1a3a5c', borderColor: '#4a9eff', color: '#4a9eff' } : {}) }} onClick={() => setConfirm('compact')} disabled={busy}>
          {compacting
            ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite', color: '#4a9eff' }} /><span style={{ color: '#4a9eff' }}>Compacting…</span></>
            : <><Minimize2 size={14} /> Compact</>}
        </button>
        <button className="btn btn-danger" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={() => setConfirm('reset')} disabled={busy}>
          <RotateCcw size={14} /> Reset
        </button>
        <button className="icon-btn" onClick={load} disabled={busy}><RefreshCw size={14} /></button>
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
  const [confirm, setConfirm] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingJobId, setEditingJobId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Create form state
  const [newName, setNewName] = useState('')
  const [newRepeatType, setNewRepeatType] = useState<'interval' | 'time'>('interval')
  const [newIntervalVal, setNewIntervalVal] = useState(1)
  const [newIntervalUnit, setNewIntervalUnit] = useState<'minutes' | 'hours' | 'days'>('hours')
  const [newTimeHour, setNewTimeHour] = useState(9)
  const [newTimeMin, setNewTimeMin] = useState(0)
  const [newWeekdays, setNewWeekdays] = useState<number[]>([]) // empty = every day
  const [newCron, setNewCron] = useState('')
  const [newPayload, setNewPayload] = useState('')
  const [newTarget, setNewTarget] = useState<'main' | 'isolated'>('isolated')

  const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  function resolveSchedule() {
    if (newCron.trim()) return { kind: 'cron', expr: newCron.trim() }
    if (newRepeatType === 'interval') {
      const ms = newIntervalVal * (newIntervalUnit === 'minutes' ? 60_000 : newIntervalUnit === 'hours' ? 3_600_000 : 86_400_000)
      return { kind: 'every', everyMs: ms }
    }
    // specific time
    const days = newWeekdays.length > 0 ? newWeekdays.map(d => d === 6 ? 0 : d + 1).join(',') : '*'
    return { kind: 'cron', expr: `${newTimeMin} ${newTimeHour} * * ${days}` }
  }

  function schedulePreview() {
    if (newCron.trim()) return `cron: ${newCron.trim()}`
    if (newRepeatType === 'interval') return `Every ${newIntervalVal} ${newIntervalUnit}`
    const dayLabel = newWeekdays.length === 0 ? 'every day' : newWeekdays.map(d => WEEKDAYS[d]).join(', ')
    return `${String(newTimeHour).padStart(2,'0')}:${String(newTimeMin).padStart(2,'0')} UTC, ${dayLabel}`
  }

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

  function openCreate() {
    setEditingJobId(null)
    setNewName(''); setNewPayload(''); setNewCron('')
    setNewRepeatType('interval'); setNewIntervalVal(1); setNewIntervalUnit('hours')
    setNewTimeHour(9); setNewTimeMin(0); setNewWeekdays([]); setNewTarget('isolated')
    setShowForm(true)
  }

  function openEdit(job: any) {
    setEditingJobId(job.jobId || job.id)
    setNewName(job.name || '')
    setNewPayload(job.payload?.message || '')
    setNewCron('')
    const s = job.schedule
    if (s?.kind === 'every') {
      setNewRepeatType('interval')
      const ms = s.everyMs || 3_600_000
      if (ms % 86_400_000 === 0) { setNewIntervalVal(ms / 86_400_000); setNewIntervalUnit('days') }
      else if (ms % 3_600_000 === 0) { setNewIntervalVal(ms / 3_600_000); setNewIntervalUnit('hours') }
      else { setNewIntervalVal(Math.round(ms / 60_000)); setNewIntervalUnit('minutes') }
    } else if (s?.kind === 'cron') {
      const parts = (s.expr || '').split(' ')
      const min = Number(parts[0]), hour = Number(parts[1])
      if (!isNaN(min) && !isNaN(hour)) {
        setNewRepeatType('time'); setNewTimeHour(hour); setNewTimeMin(min)
        const dayPart = parts[4]
        if (dayPart && dayPart !== '*') {
          const mapped = dayPart.split(',').map((d: string) => { const n = Number(d); return n === 0 ? 6 : n - 1 })
          setNewWeekdays(mapped)
        } else setNewWeekdays([])
      } else { setNewCron(s.expr || ''); setNewRepeatType('interval') }
    }
    setNewTarget(job.sessionTarget === 'main' ? 'main' : 'isolated')
    setShowForm(true)
  }

  const submitForm = async () => {
    if (!newPayload.trim()) { toast('Payload message required'); return }
    setBusy(true)
    try {
      if (editingJobId) {
        await updateCronJob(editingJobId, {
          name: newName || undefined,
          schedule: resolveSchedule(),
          sessionTarget: newTarget,
          payload: { kind: 'agentTurn', message: newPayload },
        })
        toast('Job updated ✅')
      } else {
        await createCronJob({
          name: newName || undefined,
          schedule: resolveSchedule(),
          sessionTarget: newTarget,
          payload: { kind: 'agentTurn', message: newPayload },
          enabled: true,
        })
        toast('Cron job created ✅')
      }
      setShowForm(false); setEditingJobId(null)
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
        <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', fontSize: '12px' }} onClick={() => showForm ? setShowForm(false) : openCreate()}>
          {showForm && !editingJobId ? <X size={12} /> : <Plus size={12} />} {showForm && !editingJobId ? 'Cancel' : 'New Job'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#2a2a2a', borderRadius: '10px', padding: '14px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>{editingJobId ? 'Edit Job' : 'New Job'}</span>
            <button className="icon-btn" onClick={() => { setShowForm(false); setEditingJobId(null) }}><X size={14} /></button>
          </div>

          {/* Name */}
          <div>
            <label style={labelStyle}>Name (optional)</label>
            <input style={inputStyle} value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Morning briefing" />
          </div>

          {/* Schedule */}
          <div>
            <label style={labelStyle}>Repeat</label>
            <div style={{ display: 'flex', gap: '4px', background: '#1a1a1a', borderRadius: '8px', padding: '3px', marginBottom: '10px' }}>
              {([['interval', 'Every X'], ['time', 'At a time']] as const).map(([mode, label]) => (
                <button key={mode} onClick={() => setNewRepeatType(mode)} style={{ flex: 1, background: newRepeatType === mode ? '#333' : 'transparent', color: newRepeatType === mode ? '#fff' : '#666', border: 'none', borderRadius: '6px', padding: '6px', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s' }}>{label}</button>
              ))}
            </div>

            {newRepeatType === 'interval' && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: '#888', fontSize: '13px', whiteSpace: 'nowrap' }}>Every</span>
                <input type="number" min={1} value={newIntervalVal} onChange={e => setNewIntervalVal(Math.max(1, Number(e.target.value)))}
                  style={{ ...inputStyle, width: '70px', textAlign: 'center', padding: '8px 6px' }} />
                <select value={newIntervalUnit} onChange={e => setNewIntervalUnit(e.target.value as any)}
                  style={{ flex: 1, background: '#333', border: '1px solid #555', borderRadius: '8px', color: '#fff', padding: '8px 10px', fontSize: '13px', cursor: 'pointer' }}>
                  <option value="minutes">minutes</option>
                  <option value="hours">hours</option>
                  <option value="days">days</option>
                </select>
              </div>
            )}

            {newRepeatType === 'time' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ color: '#888', fontSize: '13px' }}>At</span>
                  <select value={newTimeHour} onChange={e => setNewTimeHour(Number(e.target.value))}
                    style={{ flex: 1, background: '#333', border: '1px solid #555', borderRadius: '8px', color: '#fff', padding: '8px 10px', fontSize: '13px', cursor: 'pointer' }}>
                    {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2,'0')}</option>)}
                  </select>
                  <span style={{ color: '#555' }}>:</span>
                  <select value={newTimeMin} onChange={e => setNewTimeMin(Number(e.target.value))}
                    style={{ flex: 1, background: '#333', border: '1px solid #555', borderRadius: '8px', color: '#fff', padding: '8px 10px', fontSize: '13px', cursor: 'pointer' }}>
                    {[0,5,10,15,20,25,30,35,40,45,50,55].map(m => <option key={m} value={m}>{String(m).padStart(2,'0')}</option>)}
                  </select>
                  <span style={{ color: '#555', fontSize: '12px' }}>UTC</span>
                </div>
                <div>
                  <div style={{ color: '#666', fontSize: '11px', marginBottom: '6px' }}>Repeat on (leave empty = every day)</div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {WEEKDAYS.map((d, i) => (
                      <button key={i} onClick={() => setNewWeekdays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                        style={{ flex: 1, background: newWeekdays.includes(i) ? '#4a9eff' : '#333', color: newWeekdays.includes(i) ? '#fff' : '#666', border: 'none', borderRadius: '6px', padding: '5px 2px', fontSize: '10px', cursor: 'pointer', transition: 'all 0.15s' }}>{d}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: '8px', background: '#1a1a1a', borderRadius: '6px', padding: '6px 10px', color: '#4a9eff', fontSize: '11px' }}>
              🕐 {schedulePreview()}
            </div>

            <details style={{ marginTop: '8px' }}>
              <summary style={{ color: '#555', fontSize: '11px', cursor: 'pointer', userSelect: 'none' }}>Advanced: custom cron expression</summary>
              <input style={{ ...inputStyle, marginTop: '6px' }} value={newCron} onChange={e => setNewCron(e.target.value)} placeholder="e.g. 15 10 * * 1-5" />
              <div style={{ color: '#444', fontSize: '10px', marginTop: '3px' }}>Overrides the picker above when filled. Format: min hour day month weekday</div>
            </details>
          </div>

          {/* Run context */}
          <div>
            <label style={labelStyle}>Run context</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {([
                ['isolated', '🔄 Fresh session', 'Starts clean each run — no memory of previous runs. Best for most tasks.'],
                ['main',     '💬 Agent session',  "Runs inside the agent's live context. Use for reminders or in-chat nudges."],
              ] as const).map(([val, title, desc]) => (
                <button key={val} onClick={() => setNewTarget(val)} style={{ textAlign: 'left', background: newTarget === val ? '#1a3a5c' : '#1a1a1a', border: `1px solid ${newTarget === val ? '#4a9eff' : '#333'}`, borderRadius: '8px', padding: '10px 12px', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ color: newTarget === val ? '#fff' : '#aaa', fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>{title}</div>
                  <div style={{ color: '#555', fontSize: '11px', lineHeight: 1.4 }}>{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div>
            <label style={labelStyle}>What should the agent do?</label>
            <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} value={newPayload} onChange={e => setNewPayload(e.target.value)} placeholder="e.g. Summarize the latest news and send me a briefing" />
          </div>

          <button className="btn" style={{ background: '#4a9eff', color: '#fff' }} onClick={submitForm} disabled={busy}>
            {busy ? (editingJobId ? 'Saving...' : 'Creating...') : (editingJobId ? 'Save Changes' : 'Create Job')}
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
            <div key={id} style={{ background: '#2a2a2a', borderRadius: '10px', padding: '12px', marginBottom: '8px', opacity: job.enabled ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <div style={{ flex: 1, minWidth: 0, marginRight: '8px' }}>
                  <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>{job.name || <span style={{ color: '#555' }}>{id.slice(0, 8)}</span>}</div>
                  <div style={{ color: '#666', fontSize: '11px', marginTop: '2px' }}>{fmtSchedule(job)}</div>
                </div>
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexShrink: 0 }}>
                  <button onClick={() => toggle(job)} style={{ background: job.enabled ? '#22c55e22' : '#ffffff11', color: job.enabled ? '#22c55e' : '#555', border: `1px solid ${job.enabled ? '#22c55e44' : '#444'}`, borderRadius: '6px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}>
                    {job.enabled ? 'ON' : 'OFF'}
                  </button>
                  <button className="icon-btn" onClick={() => openEdit(job)} title="Edit"><Pencil size={13} /></button>
                  <button className="icon-btn" onClick={() => runNow(job)} title="Run now"><Play size={13} /></button>
                  <button className="icon-btn" onClick={() => setConfirm(id)} title="Delete" style={{ color: '#ef4444' }}><Trash2 size={13} /></button>
                </div>
              </div>
              <div style={{ color: '#555', fontSize: '11px' }}>
                {job.payload?.kind === 'agentTurn' ? `💬 ${(job.payload.message || '').slice(0, 80)}` : job.payload?.kind}
              </div>
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
