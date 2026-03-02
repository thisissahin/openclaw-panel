import type { ReactNode } from 'react'
import { KNOWN_MODELS } from './settings-constants'

type SectionProps = {
  title: string
  children: ReactNode
}

export function Section({ title, children }: SectionProps) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--hint)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: '10px',
          padding: '0 16px',
        }}
      >
        {title}
      </div>
      <div style={{ background: 'var(--secondary-bg)', borderRadius: '12px', overflow: 'hidden', margin: '0 12px' }}>{children}</div>
    </div>
  )
}

type RowProps = {
  label: string
  hint?: string
  children: ReactNode
  last?: boolean
}

export function Row({ label, hint, children, last }: RowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: last ? 'none' : '1px solid var(--border)',
        gap: '12px',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', color: 'var(--text)' }}>{label}</div>
        {hint && <div style={{ fontSize: '11px', color: 'var(--hint)', marginTop: '2px' }}>{hint}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

type ToggleProps = {
  value: boolean
  onChange: (value: boolean) => void
}

export function Toggle({ value, onChange }: ToggleProps) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: '44px',
        height: '26px',
        borderRadius: '13px',
        background: value ? 'var(--btn, #4c8bf5)' : 'var(--border)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '3px',
          left: value ? '21px' : '3px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />
    </div>
  )
}

type ModelSelectProps = {
  value: string
  onChange: (value: string) => void
}

export function ModelSelect({ value, onChange }: ModelSelectProps) {
  return (
    <select
      value={value}
      onChange={event => onChange(event.target.value)}
      style={{
        background: 'var(--secondary-bg)',
        color: 'var(--text)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '6px 10px',
        fontSize: '13px',
        maxWidth: '180px',
      }}
    >
      {KNOWN_MODELS.map(model => (
        <option key={model} value={model}>
          {model.split('/')[1]}
        </option>
      ))}
      {!KNOWN_MODELS.includes(value) && <option value={value}>{value.split('/')[1]}</option>}
    </select>
  )
}
