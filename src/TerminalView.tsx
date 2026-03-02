import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';
import { apiBase } from './api';

export default function TerminalView({ tabId }: { tabId: string }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  const connect = () => {
    if (wsRef.current) wsRef.current.close();
    
    setStatus('connecting');
    const base = apiBase().replace(/^http/, 'ws').replace(/\/$/, '');
    const token = localStorage.getItem('token') || '';
    const url = `${base}/ws/terminal?token=${token}&tabId=${encodeURIComponent(tabId)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      if (xtermRef.current && fitAddonRef.current) {
        // Send initial size
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims) {
          ws.send(JSON.stringify({ action: 'resize', cols: dims.cols, rows: dims.rows }));
        }
      }
    };
    
    ws.onclose = () => setStatus('disconnected');
    ws.onerror = () => setStatus('disconnected');

    ws.onmessage = (e) => {
      if (typeof e.data === 'string') {
        try {
          const payload = JSON.parse(e.data);
          if (payload.data) {
            xtermRef.current?.write(payload.data);
          }
        } catch {
          xtermRef.current?.write(e.data);
        }
      }
    };
  };

  const disconnect = () => {
    if (wsRef.current) wsRef.current.close();
  };

  useEffect(() => {
    if (!terminalRef.current) return;
    
    const isMobile = window.innerWidth < 600;
    const term = new XTerm({
      cursorBlink: true,
      theme: { background: '#1e1e1e', foreground: '#d4d4d4' },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: isMobile ? 12 : 14,
      scrollback: 2000,
      scrollSensitivity: isMobile ? 2 : 1,
      fastScrollSensitivity: 5,
      smoothScrollDuration: 0,   // disable smooth scroll — causes jank on mobile
    });
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();
    xtermRef.current = term;

    term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'write', data }));
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'resize', cols: dims.cols, rows: dims.rows }));
      }
    });
    resizeObserver.observe(terminalRef.current);

    connect(); // auto connect on load

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      if (wsRef.current) wsRef.current.close();
    };
  }, [tabId]);

  return (
    <div className="terminal-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', touchAction: 'none' } as React.CSSProperties}>
      <div className="terminal-toolbar" style={{ display: 'flex', gap: '6px', padding: '6px 8px', borderBottom: '1px solid #333', alignItems: 'center' }}>
        {status !== 'connected' && (
          <button onClick={connect} style={{ padding: '4px 12px', fontSize: '12px', background: '#333', color: '#fff', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}>
            Connect
          </button>
        )}
        <span style={{ fontSize: '12px', color: status === 'connected' ? '#4caf50' : '#888', flex: 1 }}>
          {status === 'connected' ? '● Live' : status === 'connecting' ? '○ Connecting...' : '✕ Offline'}
        </span>
        <button className="icon-btn" onClick={() => xtermRef.current?.focus()} title="Focus Keyboard" style={{ padding: '2px 4px' }}>
          ⌨️
        </button>
      </div>
      <div
        ref={terminalRef}
        style={{
          flex: 1,
          overflow: 'hidden',
          padding: 0,
          background: '#1e1e1e',
          // Give xterm full touch control — prevents browser scroll fighting xterm scroll
          touchAction: 'none',
          WebkitOverflowScrolling: 'auto',
          overscrollBehavior: 'none',
        } as React.CSSProperties}
        onClick={() => xtermRef.current?.focus()}
      />
    </div>
  );
}
