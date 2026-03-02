import { useState } from 'react'

type LoginScreenProps = {
  onLogin: () => void
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [url, setUrl] = useState(localStorage.getItem('gatewayUrl') || '')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!token.trim()) {
      setError('Enter your panel token')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (url) {
        localStorage.setItem('gatewayUrl', url)
      } else {
        localStorage.removeItem('gatewayUrl')
      }

      localStorage.setItem('token', token.trim())

      const response = await fetch(`${url || ''}/api/agents`, {
        headers: { Authorization: `Bearer ${token.trim()}` },
      })

      if (response.status === 401) {
        throw new Error('Invalid token')
      }

      onLogin()
    } catch (error: any) {
      localStorage.removeItem('token')
      setError(error.message === 'Invalid token' ? 'Invalid token — check and try again' : 'Cannot reach panel server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100dvh',
        padding: '32px 24px',
        background: 'var(--bg)',
        gap: '24px',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🤖</div>
        <div style={{ fontSize: '20px', fontWeight: 700 }}>OpenClaw Panel</div>
        <div style={{ fontSize: '13px', color: 'var(--hint)', marginTop: '6px' }}>Enter your panel token to continue</div>
      </div>

      <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label style={{ fontSize: '12px', color: 'var(--hint)', display: 'block', marginBottom: '4px' }}>
            Server URL (optional, leave blank if same origin)
          </label>
          <input
            value={url}
            onChange={event => setUrl(event.target.value)}
            placeholder="https://your-server.com"
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'var(--secondary-bg)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              color: 'var(--text)',
              fontSize: '16px',
              outline: 'none',
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: '12px', color: 'var(--hint)', display: 'block', marginBottom: '4px' }}>Panel Token</label>
          <input
            value={token}
            onChange={event => setToken(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && handleLogin()}
            placeholder="Paste your token here"
            type="password"
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'var(--secondary-bg)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              color: 'var(--text)',
              fontSize: '16px',
              outline: 'none',
            }}
          />
          <div style={{ fontSize: '11px', color: 'var(--hint)', marginTop: '4px' }}>
            Find your token in{' '}
            <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: '3px' }}>
              ~/.openclaw/panel/.token
            </code>
          </div>
        </div>

        {error && (
          <div
            style={{
              fontSize: '13px',
              color: '#f87171',
              padding: '8px 12px',
              background: 'rgba(248,113,113,0.1)',
              borderRadius: '8px',
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            padding: '12px',
            background: 'var(--btn)',
            color: 'var(--btn-text)',
            border: 'none',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            marginTop: '4px',
          }}
        >
          {loading ? 'Connecting…' : 'Connect'}
        </button>
      </div>
    </div>
  )
}
