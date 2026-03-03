import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { ScrollText, X } from 'lucide-react'
import { deleteTab, getTabs, saveTab } from '../../api'
import TerminalView from '../../TerminalView'
import LogPanel from './LogPanel'

type TerminalTab = {
  id: string
  name: string
}

export default function TerminalTabs() {
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTab, setActiveTab] = useState<string>('')
  const [loaded, setLoaded] = useState(false)
  const [showLogs, setShowLogs] = useState(false)

  useEffect(() => {
    getTabs()
      .then((response: any) => {
        if (response.tabs && response.tabs.length > 0) {
          setTabs(response.tabs)
          const saved = localStorage.getItem('activeTermTab')
          setActiveTab(saved && response.tabs.find((tab: TerminalTab) => tab.id === saved) ? saved : response.tabs[0].id)
        } else {
          const id = Date.now().toString()
          saveTab(id, 'Terminal 1').then(() => {
            setTabs([{ id, name: 'Terminal 1' }])
            setActiveTab(id)
          })
        }
        setLoaded(true)
      })
      .catch(() => {
        const id = Date.now().toString()
        setTabs([{ id, name: 'Terminal 1' }])
        setActiveTab(id)
        setLoaded(true)
      })
  }, [])

  useEffect(() => {
    if (activeTab) {
      localStorage.setItem('activeTermTab', activeTab)
    }
  }, [activeTab])

  const nextTabName = (current: TerminalTab[]) => {
    const numbers = current.map(tab => parseInt(tab.name.replace(/\D/g, '')) || 0)
    return `Terminal ${(numbers.length ? Math.max(...numbers) : 0) + 1}`
  }

  const addTab = () => {
    const id = Date.now().toString()
    const name = nextTabName(tabs)

    saveTab(id, name).then(() => {
      setTabs(previous => [...previous, { id, name }])
      setActiveTab(id)
    })
  }

  const closeTab = (id: string, event?: MouseEvent) => {
    if (event) {
      event.stopPropagation()
    }

    deleteTab(id).then(() => {
      const newTabs = tabs.filter(tab => tab.id !== id)

      if (newTabs.length === 0) {
        const newId = Date.now().toString()
        saveTab(newId, 'Terminal 1').then(() => {
          setTabs([{ id: newId, name: 'Terminal 1' }])
          setActiveTab(newId)
        })
        return
      }

      setTabs(newTabs)
      if (activeTab === id) {
        setActiveTab(newTabs[newTabs.length - 1].id)
      }
    })
  }

  if (!loaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--hint)' }}>
        Loading terminals…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          background: '#222',
          borderBottom: '1px solid #333',
          paddingTop: '4px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', flex: 1, overflowX: 'auto', alignItems: 'flex-end' }}>
          {tabs.map(tab => (
            <div
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setShowLogs(false)
              }}
              style={{
                padding: '6px 10px',
                background: activeTab === tab.id && !showLogs ? '#1e1e1e' : '#2a2a2a',
                color: activeTab === tab.id && !showLogs ? '#fff' : '#888',
                borderTopLeftRadius: '6px',
                borderTopRightRadius: '6px',
                border: '1px solid #444',
                borderBottom: activeTab === tab.id && !showLogs ? 'none' : '1px solid #444',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                marginRight: '2px',
                marginBottom: '-1px',
                whiteSpace: 'nowrap',
                zIndex: activeTab === tab.id && !showLogs ? 1 : 0,
                position: 'relative',
              }}
            >
              {tab.name}
              <button className="icon-btn" onClick={event => closeTab(tab.id, event)} style={{ padding: '1px', color: 'inherit', lineHeight: 1 }}>
                <X size={11} />
              </button>
            </div>
          ))}
          <button className="icon-btn" onClick={addTab} style={{ padding: '4px 8px', margin: '0 2px', fontSize: '16px', lineHeight: 1 }}>
            +
          </button>
        </div>

        <button
          className="icon-btn"
          onClick={() => setShowLogs(value => !value)}
          title="Logs"
          style={{
            padding: '6px 10px',
            marginBottom: '0',
            color: showLogs ? 'var(--accent, #7c9ef8)' : 'var(--hint)',
            borderBottom: showLogs ? '2px solid var(--accent, #7c9ef8)' : '2px solid transparent',
            borderRadius: 0,
            flexShrink: 0,
          }}
        >
          <ScrollText size={16} />
        </button>
      </div>

      <div style={{ flex: 1, position: 'relative', background: '#1e1e1e', overflow: 'hidden' }}>
        <div style={{ display: showLogs ? 'none' : 'block', height: '100%' }}>
          {tabs.map(tab => (
            <div key={tab.id} style={{ display: activeTab === tab.id ? 'block' : 'none', height: '100%' }}>
              <TerminalView tabId={tab.id} />
            </div>
          ))}
        </div>

        <div style={{ display: showLogs ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <LogPanel visible={showLogs} />
        </div>
      </div>
    </div>
  )
}
