import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, RefreshCw, Minimize2, RotateCcw, Play, Trash2, ChevronDown, ChevronUp, Plus, X, Pencil } from 'lucide-react'
import { getSessions, compactSession, resetSession, getUsage, getCronJobs, runCronJob, updateCronJob, deleteCronJob, createCronJob } from './api'

// ── Helpers ───────────────────────────────────────────────────
function fmt(n: number) { return n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n) }
function fmtDate(ts: number | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtCost(n: number) { return n > 0 ? `$${n.toFixed(3)}` : '$0.00' }
function fmtSchedule(job: any) {
  const s = job.schedule
  if (!s) return '—'
  if (s.kind === 'every') {
    const ms = s.everyMs
    if (ms < 60000) return `Every ${ms/1000}s`
    if (ms < 3600000) return `Every ${ms/60000}m`
    if (ms < 86400000) return `Every ${ms/3600000}h`
    return `Every ${ms/86400000}d`
  }
  if (s.kind === 'cron') return s.expr
  if (s.kind === 'at') return `At ${fmtDate(new Date(s.at).getTime())}`
  return '—'
}

// ── Shared sub-components ─────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>{children}</div>
}

function ConfirmDialog({ msg, onConfirm, onCancel }: { msg: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '24px' }}>
      <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius)', padding: '24px', maxWidth: '320px', width: '100%' }}>
        <p style={{ margin: '0 0 20px', color: 'var(--text)', lineHeight: 1.6, fontSize: '14px' }}>{msg}</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-danger" style={{ flex: 1 }} onClick={onConfirm}>Confirm</button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="section-card">
      <button className="section-header" onClick={() => setOpen(o => !o)}>
        <span>{title}</span>
        {open ? <ChevronUp size={15} color="var(--text-3)" /> : <ChevronDown size={15} color="var(--text-3)" />}
      </button>
      {open && <div className="section-body">{children}</div>}
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
      setCompacting(true)
      const tokensBefore = session?.totalTokens || 0
      const deadline = Date.now() + 90_000
      const poll = async () => {
        if (Date.now() > deadline) {
          setCompacting(false); setBusy(false)
          toast('Compaction timed out')
          return
        }
        await new Promise(r => setTimeout(r, 3000))
        try {
          const r = await getSessions()
          const sess = (r.sessions || []).find((s: any) => s.key === `agent:${agentId}:main`)
          if (sess) setSession(sess)
          const tokensAfter = sess?.totalTokens || 0
          if (tokensAfter < tokensBefore * 0.8 || tokensAfter === 0) {
            setCompacting(false); setBusy(false)
            toast(`Compacted ✅  ${Math.round(tokensBefore/1000)}k → ${Math.round(tokensAfter/1000)}k tokens`)
            return
          }
        } catch { }
        poll()
      }
      poll()
    } catch (e: any) { setBusy(false); toast(`Error: ${e.message}`) }
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

  if (loading) return <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>Loading…</p>
  if (!session) return <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>No active session found.</p>

  const used = session.totalTokens || 0
  const ctx = session.contextTokens || 200000
  const pct = Math.min(100, Math.round((used / ctx) * 100))
  const barColor = pct > 80 ? 'var(--danger)' : pct > 50 ? 'var(--warning)' : 'var(--accent)'

  return (
    <>
      {confirm && (
        <ConfirmDialog
          msg={confirm === 'compact'
            ? 'Compact this session? The AI will summarise the history to free context.'
            : 'Reset this session? All context history will be cleared permanently.'}
          onConfirm={confirm === 'compact' ? doCompact : doReset}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Context usage */}
      <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
          <span style={{ color: 'var(--text-2)', fontSize: '12px' }}>Context</span>
          <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '22px', letterSpacing: '-0.5px' }}>
            {fmt(used)} <span style={{ color: 'var(--text-3)', fontSize: '13px', fontWeight: 400 }}>/ {fmt(ctx)}</span>
          </span>
        </div>
        <div style={{ height: '5px', background: 'var(--surface-3)', borderRadius: '3px' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '3px', transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
          <span style={{ color: 'var(--text-3)', fontSize: '11px' }}>Last active {fmtDate(session.updatedAt)}</span>
          <span style={{ color: barColor, fontSize: '11px', fontWeight: 600 }}>{pct}%</span>
        </div>
      </div>

      {/* Model badge */}
      <div style={{ marginBottom: '14px' }}>
        <span style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', color: 'var(--text-2)', fontFamily: 'monospace' }}>
          {session.modelProvider}/{session.model}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn" style={{ flex: 1, ...(compacting ? { background: 'var(--accent-dim)', borderColor: 'rgba(91,141,238,0.3)', color: 'var(--accent)' } : {}) }}
          onClick={() => setConfirm('compact')} disabled={busy}>
          {compacting
            ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Compacting…</>
            : <><Minimize2 size={13} /> Compact</>}
        </button>
        <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => setConfirm('reset')} disabled={busy}>
          <RotateCcw size={13} /> Reset
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

  if (loading) return <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>Loading…</p>
  if (!data) return <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>Usage data unavailable.</p>

  const totals = data.cost?.totals || {}
  const daily: any[] = data.cost?.daily || []
  const today = daily[daily.length - 1] || {}
  const providers: any[] = data.status?.providers || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {[
          { label: 'All-time tokens', value: fmt(totals.totalTokens || 0) },
          { label: 'All-time cost',   value: fmtCost(totals.totalCost || 0) },
          { label: "Today's tokens",  value: fmt(today.totalTokens || 0) },
          { label: "Today's cost",    value: fmtCost(today.totalCost || 0) },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
            <div style={{ color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{label}</div>
            <div style={{ color: 'var(--text)', fontSize: '18px', fontWeight: 700, letterSpacing: '-0.3px' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      {daily.length > 1 && (() => {
        const slice = daily.slice(-7)
        const maxCost = Math.max(...slice.map((x: any) => x.totalCost || 0), 0.001)
        return (
          <div>
            <Label>Last {slice.length} days</Label>
            <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: '12px 12px 8px' }}>
              <div style={{ display: 'flex', gap: '5px', alignItems: 'flex-end', height: '52px', marginBottom: '6px' }}>
                {slice.map((d: any, i: number) => {
                  const pct = (d.totalCost || 0) / maxCost
                  const isToday = d.date === today.date
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '52px' }}>
                      <div style={{ width: '100%', height: `${Math.max(pct > 0 ? 5 : 2, pct * 52)}px`, background: isToday ? 'var(--accent)' : pct > 0 ? 'rgba(91,141,238,0.4)' : 'var(--surface-3)', borderRadius: '3px 3px 0 0', transition: 'height 0.3s' }} />
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                {slice.map((d: any, i: number) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center', color: d.date === today.date ? 'var(--accent)' : 'var(--text-3)', fontSize: '9px' }}>
                    {d.date?.slice(5).replace('-', '/')}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Providers */}
      {providers.length > 0 && (
        <div>
          <Label>Providers</Label>
          {providers.map((p: any) => (
            <div key={p.provider} style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: p.windows?.length > 0 ? '10px' : 0 }}>
                <span style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600 }}>{p.displayName}</span>
                {p.error
                  ? <span style={{ color: 'var(--warning)', fontSize: '10px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '4px', padding: '2px 7px' }}>⚠ Auth error</span>
                  : p.windows?.length === 0 ? <span style={{ color: 'var(--success)', fontSize: '11px' }}>✓ OK</span> : null}
              </div>
              {p.windows?.map((w: any, i: number) => (
                <div key={i} style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-2)', fontSize: '11px' }}>{w.label}</span>
                    <span style={{ color: w.usedPercent > 80 ? 'var(--danger)' : w.usedPercent > 50 ? 'var(--warning)' : 'var(--text-2)', fontSize: '11px', fontWeight: 600 }}>{w.usedPercent}%</span>
                  </div>
                  <div style={{ height: '4px', background: 'var(--surface-3)', borderRadius: '2px' }}>
                    <div style={{ height: '100%', width: `${w.usedPercent}%`, background: w.usedPercent > 80 ? 'var(--danger)' : w.usedPercent > 50 ? 'var(--warning)' : 'var(--accent)', borderRadius: '2px', transition: 'width 0.3s' }} />
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

  const [newName, setNewName] = useState('')
  const [newRepeatType, setNewRepeatType] = useState<'interval' | 'time'>('interval')
  const [newIntervalVal, setNewIntervalVal] = useState(1)
  const [newIntervalUnit, setNewIntervalUnit] = useState<'minutes' | 'hours' | 'days'>('hours')
  const [newTimeHour, setNewTimeHour] = useState(9)
  const [newTimeMin, setNewTimeMin] = useState(0)
  const [newWeekdays, setNewWeekdays] = useState<number[]>([])
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
    try { await updateCronJob(job.jobId || job.id, { enabled: !job.enabled }); toast(`Job ${job.enabled ? 'disabled' : 'enabled'} ✅`); load() }
    catch (e: any) { toast(`Error: ${e.message}`) }
  }

  const runNow = async (job: any) => {
    try { await runCronJob(job.jobId || job.id); toast('Job triggered ✅') }
    catch (e: any) { toast(`Error: ${e.message}`) }
  }

  const remove = async (id: string) => {
    try { await deleteCronJob(id); toast('Job deleted ✅'); setConfirm(null); load() }
    catch (e: any) { toast(`Error: ${e.message}`) }
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
          setNewWeekdays(dayPart.split(',').map((d: string) => { const n = Number(d); return n === 0 ? 6 : n - 1 }))
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
        await updateCronJob(editingJobId, { name: newName || undefined, schedule: resolveSchedule(), sessionTarget: newTarget, payload: { kind: 'agentTurn', message: newPayload } })
        toast('Job updated ✅')
      } else {
        await createCronJob({ name: newName || undefined, schedule: resolveSchedule(), sessionTarget: newTarget, payload: { kind: 'agentTurn', message: newPayload }, enabled: true })
        toast('Cron job created ✅')
      }
      setShowForm(false); setEditingJobId(null); setNewName(''); setNewPayload(''); load()
    } catch (e: any) { toast(`Error: ${e.message}`) }
    finally { setBusy(false) }
  }

  const selectStyle = { background: 'var(--surface-3)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '9px 10px', fontSize: '13px', cursor: 'pointer', flex: 1 as const }

  return (
    <>
      {confirm && <ConfirmDialog msg="Delete this cron job permanently?" onConfirm={() => remove(confirm)} onCancel={() => setConfirm(null)} />}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>{jobs.length} job{jobs.length !== 1 ? 's' : ''}</span>
        <button className="btn" style={{ padding: '7px 12px', fontSize: '12px' }} onClick={() => showForm && !editingJobId ? setShowForm(false) : openCreate()}>
          {showForm && !editingJobId ? <><X size={12} /> Cancel</> : <><Plus size={12} /> New Job</>}
        </button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: '14px' }}>
          {/* Form title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ color: 'var(--text)', fontSize: '14px', fontWeight: 700 }}>{editingJobId ? 'Edit Job' : 'New Job'}</span>
            <button className="icon-btn" onClick={() => { setShowForm(false); setEditingJobId(null) }}><X size={15} /></button>
          </div>

          {/* Name */}
          <div style={{ marginBottom: '14px' }}>
            <Label>Name (optional)</Label>
            <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Morning briefing" />
          </div>

          {/* Repeat */}
          <div style={{ marginBottom: '14px' }}>
            <Label>Repeat</Label>
            <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-3)', borderRadius: 'var(--radius-sm)', padding: '3px', marginBottom: '10px' }}>
              {([['interval', 'Every X'], ['time', 'At a time']] as const).map(([mode, label]) => (
                <button key={mode} onClick={() => setNewRepeatType(mode)}
                  style={{ flex: 1, background: newRepeatType === mode ? 'var(--surface)' : 'transparent', color: newRepeatType === mode ? 'var(--text)' : 'var(--text-2)', border: newRepeatType === mode ? '1px solid var(--border-2)' : '1px solid transparent', borderRadius: '6px', padding: '6px', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s', fontWeight: newRepeatType === mode ? 600 : 400 }}>
                  {label}
                </button>
              ))}
            </div>

            {newRepeatType === 'interval' && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-2)', fontSize: '13px', flexShrink: 0 }}>Every</span>
                <input type="number" min={1} value={newIntervalVal} onChange={e => setNewIntervalVal(Math.max(1, Number(e.target.value)))}
                  className="input" style={{ width: '72px', textAlign: 'center' }} />
                <select value={newIntervalUnit} onChange={e => setNewIntervalUnit(e.target.value as any)} style={selectStyle}>
                  <option value="minutes">minutes</option>
                  <option value="hours">hours</option>
                  <option value="days">days</option>
                </select>
              </div>
            )}

            {newRepeatType === 'time' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-2)', fontSize: '13px', flexShrink: 0 }}>At</span>
                  <select value={newTimeHour} onChange={e => setNewTimeHour(Number(e.target.value))} style={selectStyle}>
                    {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2,'0')}</option>)}
                  </select>
                  <span style={{ color: 'var(--text-3)' }}>:</span>
                  <select value={newTimeMin} onChange={e => setNewTimeMin(Number(e.target.value))} style={selectStyle}>
                    {[0,5,10,15,20,25,30,35,40,45,50,55].map(m => <option key={m} value={m}>{String(m).padStart(2,'0')}</option>)}
                  </select>
                  <span style={{ color: 'var(--text-3)', fontSize: '12px', flexShrink: 0 }}>UTC</span>
                </div>
                <div>
                  <div style={{ color: 'var(--text-3)', fontSize: '11px', marginBottom: '6px' }}>Days (empty = every day)</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {WEEKDAYS.map((d, i) => (
                      <button key={i} onClick={() => setNewWeekdays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                        style={{ flex: 1, background: newWeekdays.includes(i) ? 'var(--accent)' : 'var(--surface-3)', color: newWeekdays.includes(i) ? '#fff' : 'var(--text-3)', border: '1px solid ' + (newWeekdays.includes(i) ? 'transparent' : 'var(--border)'), borderRadius: '6px', padding: '5px 2px', fontSize: '10px', cursor: 'pointer', transition: 'all 0.15s', fontWeight: newWeekdays.includes(i) ? 600 : 400 }}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Preview */}
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontSize: '12px' }}>
              <span style={{ opacity: 0.6 }}>🕐</span> {schedulePreview()}
            </div>

            {/* Advanced */}
            <details style={{ marginTop: '8px' }}>
              <summary style={{ color: 'var(--text-3)', fontSize: '11px', cursor: 'pointer', userSelect: 'none', listStyle: 'none' }}>▸ Custom cron expression</summary>
              <input className="input" style={{ marginTop: '6px' }} value={newCron} onChange={e => setNewCron(e.target.value)} placeholder="e.g. 15 10 * * 1-5" />
              <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '3px' }}>Overrides picker when filled · min hour day month weekday</div>
            </details>
          </div>

          {/* Run context */}
          <div style={{ marginBottom: '14px' }}>
            <Label>Run context</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {([
                ['isolated', '🔄 Fresh session', 'Clean context each run. Best for most tasks.'],
                ['main',     '💬 Agent session',  "Runs inside the agent's live context. For reminders & nudges."],
              ] as const).map(([val, title, desc]) => (
                <button key={val} onClick={() => setNewTarget(val)}
                  style={{ textAlign: 'left', background: newTarget === val ? 'var(--accent-dim)' : 'var(--surface-3)', border: `1px solid ${newTarget === val ? 'rgba(91,141,238,0.3)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', padding: '10px 12px', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ color: newTarget === val ? 'var(--text)' : 'var(--text-2)', fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>{title}</div>
                  <div style={{ color: 'var(--text-3)', fontSize: '11px', lineHeight: 1.4 }}>{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div style={{ marginBottom: '16px' }}>
            <Label>What should the agent do?</Label>
            <textarea className="input" style={{ minHeight: '72px', resize: 'vertical' }} value={newPayload} onChange={e => setNewPayload(e.target.value)} placeholder="e.g. Summarise the latest news and send me a briefing" />
          </div>

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={submitForm} disabled={busy}>
            {busy ? (editingJobId ? 'Saving…' : 'Creating…') : (editingJobId ? 'Save Changes' : 'Create Job')}
          </button>
        </div>
      )}

      {/* Job list */}
      {loading ? (
        <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>Loading…</p>
      ) : jobs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-3)', fontSize: '13px' }}>
          No cron jobs yet.<br />
          <span style={{ fontSize: '11px' }}>Tap New Job to schedule one.</span>
        </div>
      ) : jobs.map(job => {
        const id = job.jobId || job.id
        return (
          <div key={id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: '8px', opacity: job.enabled ? 1 : 0.55 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>
                  {job.name || <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>{id.slice(0, 10)}</span>}
                </div>
                <div style={{ color: 'var(--text-3)', fontSize: '11px', fontFamily: 'monospace' }}>{fmtSchedule(job)}</div>
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                <button onClick={() => toggle(job)}
                  style={{ background: job.enabled ? 'var(--success-dim)' : 'var(--surface-3)', color: job.enabled ? 'var(--success)' : 'var(--text-3)', border: `1px solid ${job.enabled ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`, borderRadius: '6px', padding: '3px 9px', fontSize: '11px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}>
                  {job.enabled ? 'ON' : 'OFF'}
                </button>
                <button className="icon-btn" onClick={() => openEdit(job)} title="Edit"><Pencil size={13} /></button>
                <button className="icon-btn" onClick={() => runNow(job)} title="Run now"><Play size={13} /></button>
                <button className="icon-btn" onClick={() => setConfirm(id)} title="Delete" style={{ color: 'var(--danger)' }}><Trash2 size={13} /></button>
              </div>
            </div>
            {job.payload?.kind === 'agentTurn' && (
              <div style={{ marginTop: '8px', color: 'var(--text-3)', fontSize: '11px', lineHeight: 1.4, borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                {(job.payload.message || '').slice(0, 100)}{(job.payload.message || '').length > 100 ? '…' : ''}
              </div>
            )}
          </div>
        )
      })}
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
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10, borderBottom: '1px solid var(--border)' }}>
        <button className="icon-btn" style={{ padding: '8px' }} onClick={onBack}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: '16px', letterSpacing: '-0.2px' }}>{agent.emoji} {agent.name}</div>
          <div style={{ color: 'var(--text-3)', fontSize: '11px', marginTop: '1px' }}>
            {agent.id} · <span style={{ color: agent.online ? 'var(--success)' : 'var(--text-3)' }}>{agent.online ? '● Online' : '○ Offline'}</span>
          </div>
        </div>
        <span style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 9px', fontSize: '10px', color: 'var(--text-2)', fontFamily: 'monospace', flexShrink: 0 }}>{agent.model}</span>
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
