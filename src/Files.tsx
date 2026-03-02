import { useState, useEffect, useCallback } from 'react'
import { X, Save, Edit3, Paperclip, Send, Trash2 } from 'lucide-react'
import { listFiles, readFile, writeFile, deleteFile, sendChat } from './api'

type CtxFile = { name: string; content: string }

export default function Files({ toast, isActive }: { toast: (m: string) => void; isActive?: boolean }) {
  const [entries, setEntries] = useState<{ name: string; isDir: boolean }[]>([])
  const [currentPath, setCurrentPath] = useState('')
  const [viewing, setViewing] = useState<{ name: string; content: string } | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [context, setContext] = useState<CtxFile[]>([])
  const [chatInput, setChatInput] = useState('')
  const [sending, setSending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const loadDir = useCallback(async (p: string) => {
    setLoading(true)
    try {
      const r = await listFiles(p)
      setEntries(r.entries || [])
      setCurrentPath(p)
    } catch (e: any) { toast(`Error: ${e.message}`) }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { loadDir('') }, [])

  // Refresh file list whenever the tab becomes active
  useEffect(() => {
    if (isActive && !viewing) loadDir(currentPath)
  }, [isActive])

  const open = async (entry: { name: string; isDir: boolean }) => {
    const full = currentPath ? `${currentPath}/${entry.name}` : entry.name
    if (entry.isDir) { loadDir(full); return }
    try {
      const r = await readFile(full)
      setViewing({ name: full, content: r.content || '' })
      setDraft(r.content || '')
      setEditing(false)
    } catch (e: any) { toast(`Error: ${e.message}`) }
  }

  const save = async () => {
    if (!viewing) return
    try {
      await writeFile(viewing.name, draft)
      toast('Saved ✅')
      setViewing({ ...viewing, content: draft })
      setEditing(false)
    } catch (e: any) { toast(`Save failed: ${e.message}`) }
  }

  const addToContext = async (name: string, content?: string) => {
    if (context.find(c => c.name === name)) { toast('Already in context'); return }
    try {
      const text = content ?? (await readFile(name)).content ?? ''
      setContext(prev => [...prev, { name, content: text }])
    } catch (e: any) { toast(`Error: ${e.message}`) }
  }

  const removeFromContext = (name: string) => setContext(prev => prev.filter(c => c.name !== name))

  const handleSend = async () => {
    if (context.length === 0) return
    setSending(true)
    try {
      await sendChat(chatInput, context)
      toast('Sent ✅ — reply coming in Telegram')
      setChatInput('')
      setContext([])
    } catch (e: any) { toast(`Failed: ${e.message}`) }
    finally { setSending(false) }
  }

  const doDelete = async (path: string) => {
    setConfirmDelete(null)
    try {
      const r = await deleteFile(path)
      if (r && !r.ok) throw new Error(r.error || 'Delete failed')
      if (viewing?.name === path) { setViewing(null); setEditing(false) }
      await loadDir(currentPath)
      toast(`Deleted ✅`)
    } catch (e: any) { toast(`Delete failed: ${e.message}`) }
  }

  const inContext = (name: string) => !!context.find(c => c.name === name)

  const fileViewer = viewing && (
    <div className="file-view" style={{ flex: 1, overflow: 'hidden' }}>
      <div className="file-view-header">
        <button className="icon-btn" onClick={() => { setViewing(null); setEditing(false) }}><X size={18} /></button>
        <span className="file-view-title" style={{ fontSize: '11px' }}>{viewing.name}</span>
        <button
          className={`icon-btn ${inContext(viewing.name) ? 'ok' : ''}`}
          title="Add to context"
          onClick={() => addToContext(viewing.name, viewing.content)}
        ><Paperclip size={18} /></button>
        {!editing
          ? <button className="icon-btn" onClick={() => setEditing(true)}><Edit3 size={18} /></button>
          : <button className="icon-btn ok" onClick={save}><Save size={18} /></button>
        }
        <button className="icon-btn" onClick={() => setConfirmDelete(viewing.name)} title="Delete" style={{ color: 'var(--danger)' }}><Trash2 size={18} /></button>
      </div>
      {editing
        ? <textarea className="file-editor" value={draft} onChange={e => setDraft(e.target.value)} />
        : <pre className="file-pre">{viewing.content}</pre>
      }
    </div>
  )

  const dirListing = !viewing && (
    <div className="files-body">
      <div className="path-bar">
        <span>/{currentPath}</span>
        {currentPath && (
          <button className="icon-btn" onClick={() => loadDir(currentPath.split('/').slice(0, -1).join('/'))}>↑</button>
        )}
      </div>
      {loading && <div className="center-msg">Loading...</div>}
      {entries.map(e => {
        const full = currentPath ? `${currentPath}/${e.name}` : e.name
        return (
          <div key={e.name} className="list-item-row">
            <button className="list-item-main" onClick={() => open(e)}>
              <span>{e.isDir ? '📁' : '📄'}</span>
              <span>{e.name}</span>
            </button>
            {!e.isDir && (
              <button
                className={`context-add-btn ${inContext(full) ? 'active' : ''}`}
                onClick={() => addToContext(full)}
                title="Add to context"
              ><Paperclip size={14} /></button>
            )}
            <button
              className="icon-btn"
              onClick={() => setConfirmDelete(full)}
              title="Delete"
              style={{ color: 'var(--danger)', flexShrink: 0 }}
            ><Trash2 size={14} /></button>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="files-wrapper">
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '24px' }}>
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius)', padding: '24px', maxWidth: '320px', width: '100%' }}>
            <p style={{ margin: '0 0 6px', color: 'var(--text)', fontWeight: 600 }}>Delete file?</p>
            <p style={{ margin: '0 0 20px', color: 'var(--text-2)', fontSize: '12px', wordBreak: 'break-all' }}>{confirmDelete}</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => doDelete(confirmDelete)}>Delete</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {context.length > 0 && (
        <div className="context-tray">
          <span className="context-tray-label">📎</span>
          {context.map(f => (
            <div key={f.name} className="context-chip">
              <span>{f.name.split('/').pop()}</span>
              <button onClick={() => removeFromContext(f.name)}><X size={11} /></button>
            </div>
          ))}
        </div>
      )}
      {fileViewer}
      {dirListing}
      <div className="chat-input-bar">
        <textarea
          className="chat-textarea"
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder={context.length > 0 ? `Ask about ${context.length} file${context.length > 1 ? 's' : ''}…` : 'Select files to ask about…'}
          rows={1}
        />
        <button className="chat-send-btn" onClick={handleSend} disabled={sending || context.length === 0} title="Send to Agent">
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
