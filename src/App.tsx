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

export default function App() {
  const [authed, setAuthed] = useState(isAuthenticated())
  const [tab, setTab] = useState<Tab>('dashboard')
  const [selectedAgent, setSelectedAgent] = useState<any>(null)
  const [toastMsg, setToastMsg] = useState('')

  const toast = (message: string) => setToastMsg(message)

  useEffect(() => {
    const telegramApp = (window as any).Telegram?.WebApp
    if (telegramApp) {
      telegramApp.ready()
      telegramApp.expand()
      if (telegramApp.requestFullscreen) {
        telegramApp.requestFullscreen()
      }
    }
  }, [])

  if (!authed) {
    return <LoginScreen onLogin={() => setAuthed(true)} />
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">🤖 OpenClaw Panel</span>
      </header>

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
            <DashboardTab onSelectAgent={setSelectedAgent} toast={toast} />
          </div>
          {selectedAgent && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
              <AgentDetail agent={selectedAgent} onBack={() => setSelectedAgent(null)} toast={toast} />
            </div>
          )}
        </div>

        <div style={{ display: tab === 'files' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <Files toast={toast} isActive={tab === 'files'} />
        </div>

        <div style={{ display: tab === 'skills' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <SkillsTab toast={toast} />
        </div>

        <div style={{ display: tab === 'terminal' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <TerminalTabs />
        </div>

        <div style={{ display: tab === 'settings' ? 'block' : 'none', height: '100%' }}>
          <SettingsTab
            toast={toast}
            onLogout={() => {
              logout()
              setAuthed(false)
            }}
          />
        </div>
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
