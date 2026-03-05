import { useEffect, useState } from 'react'
import { Boxes, FolderOpen, LayoutDashboard, Settings, Terminal } from 'lucide-react'
import AgentDetail from './AgentDetail'
import Files from './Files'
import { isAuthenticated, logout } from './api'
import LoginScreen from './features/auth/LoginScreen'
import Toast from './features/common/Toast'
import DashboardTab from './features/dashboard/DashboardTab'
import SettingsTab from './features/settings/SettingsTab'
import SkillsTab from './features/skills/SkillsTab'
import TerminalTabs from './features/terminal/TerminalTabs'
import './App.css'

type Tab = 'dashboard' | 'files' | 'skills' | 'terminal' | 'settings'

function readLastCrash(): string | null {
  try {
    const raw = localStorage.getItem('lastCrash')
    if (!raw) return null
    const data = JSON.parse(raw)
    const msg = data?.message || ''
    const where = data?.filename ? ` @ ${data.filename}:${data.lineno ?? ''}` : ''
    return `${data.type || 'crash'}: ${msg}${where}`
  } catch {
    return null
  }
}

export default function App() {  
  const [authed, setAuthed] = useState(isAuthenticated())
  const [tab, setTab] = useState<Tab>('dashboard')
  const [selectedAgent, setSelectedAgent] = useState<any>(null)
  const [dashboardVersion, setDashboardVersion] = useState(0)
  const [toastMsg, setToastMsg] = useState('')

  const toast = (message: string) => setToastMsg(message)

  useEffect(() => {
    const telegramApp = (window as any).Telegram?.WebApp
    if (!telegramApp) return

    // Telegram WebView can be sensitive to fullscreen requests on some devices.
    // Keep init minimal to avoid black-screen crashes.
    try { telegramApp.ready?.() } catch {}
    try { telegramApp.expand?.() } catch {}

    // If we ever want fullscreen again, gate it behind an explicit flag.
    // if (localStorage.getItem('enableFullscreen') === '1') {
    //   try { telegramApp.requestFullscreen?.() } catch {}
    // }
  }, [])

  if (!authed) {
    return <LoginScreen onLogin={() => setAuthed(true)} />
  }

  const lastCrash = readLastCrash()

  return (
    <div className="app">
      {lastCrash && (
        <div style={{ padding: '8px 10px', background: '#3b1d1d', color: '#ffd7d7', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: '12px' }}>
          <div style={{ fontWeight: 700, marginBottom: '4px' }}>Last crash detected</div>
          <div style={{ opacity: 0.95, wordBreak: 'break-word' }}>{lastCrash}</div>
          <button
            className="btn"
            style={{ marginTop: '6px', padding: '6px 10px', fontSize: '12px' }}
            onClick={() => {
              try { localStorage.removeItem('lastCrash') } catch {}
              // hard reload
              location.reload()
            }}
          >
            Clear + Reload
          </button>
        </div>
      )}

      <main className="app-main no-scroll" style={{ position: 'relative' }}>
        <div
          style={{
            display: tab === 'dashboard' ? 'flex' : 'none',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div style={{ display: selectedAgent ? 'none' : 'block', height: '100%', overflowY: 'auto' }}>
            <DashboardTab key={dashboardVersion} onSelectAgent={setSelectedAgent} toast={toast} />
          </div>
          {selectedAgent && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
              <AgentDetail
                agent={selectedAgent}
                onBack={() => setSelectedAgent(null)}
                onDeleted={() => {
                  setSelectedAgent(null)
                  setDashboardVersion(v => v + 1)
                }}
                toast={toast}
              />
            </div>
          )}
        </div>

        {tab === 'files' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Files toast={toast} isActive={tab === 'files'} />
          </div>
        )}

        {tab === 'skills' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <SkillsTab toast={toast} />
          </div>
        )}

        {tab === 'terminal' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <TerminalTabs />
          </div>
        )}

        {tab === 'settings' && (
          <div style={{ display: 'block', height: '100%' }}>
            <SettingsTab
              toast={toast}
              onLogout={() => {
                logout()
                setAuthed(false)
              }}
            />
          </div>
        )}
      </main>

      <nav className="bottom-nav">
        {([
          { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
          { id: 'files', icon: <FolderOpen size={20} />, label: 'Files' },
          { id: 'skills', icon: <Boxes size={20} />, label: 'Skills' },
          { id: 'terminal', icon: <Terminal size={20} />, label: 'Terminal' },
          { id: 'settings', icon: <Settings size={20} />, label: 'Settings' },
        ] as const).map(item => (
          <button key={item.id} className={`nav-btn ${tab === item.id ? 'active' : ''}`} onClick={() => setTab(item.id)}>
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {toastMsg && <Toast msg={toastMsg} onDone={() => setToastMsg('')} />}
    </div>
  )
}
