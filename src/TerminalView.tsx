import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';
import { apiBase } from './api';

export type TerminalViewHandle = {
  sendData: (data: string) => void;
};

const KEYS = [
  { label: '↑', data: '\x1b[A' },
  { label: '↓', data: '\x1b[B' },
  { label: '←', data: '\x1b[D' },
  { label: '→', data: '\x1b[C' },
  { label: 'Tab', data: '\t' },
  { label: 'Ctrl+C', data: '\x03' },
  { label: 'Ctrl+D', data: '\x04' },
];

const TerminalView = forwardRef<TerminalViewHandle, { tabId: string }>(({ tabId }, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [debug, setDebug] = useState<string>('');
  const [initError, setInitError] = useState<string | null>(null);

  const sendData = (data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'write', data }));
    }
    xtermRef.current?.focus();
  };

  useImperativeHandle(ref, () => ({ sendData }));

  const connect = () => {
    try {
      if (wsRef.current) wsRef.current.close();
      setStatus('connecting');
      const base = apiBase().replace(/^http/, 'ws').replace(/\/$/, '');
      const rawToken = localStorage.getItem('token') || '';
      const token = rawToken.trim().toLowerCase().startsWith('bearer ') ? rawToken.trim().slice(7).trim() : rawToken.trim();
      const safeToken = encodeURIComponent(token)
      const url = `${base}/ws/terminal?token=${safeToken}&tabId=${encodeURIComponent(tabId)}`;
      setDebug(`ws=${url}`);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        if (xtermRef.current && fitAddonRef.current) {
          const dims = fitAddonRef.current.proposeDimensions();
          if (dims) ws.send(JSON.stringify({ action: 'resize', cols: dims.cols, rows: dims.rows }));
        }
      };

      ws.onclose = (ev) => {
        setStatus('disconnected');
        setDebug(prev => `${prev}\nclose code=${ev.code} reason=${ev.reason || '(none)'}`);
      };
      ws.onerror = () => {
        setStatus('disconnected');
        setDebug(prev => `${prev}\nerror=ws`);
      };

      ws.onmessage = (e) => {
        if (typeof e.data === 'string') {
          try {
            const payload = JSON.parse(e.data);
            if (payload.data) xtermRef.current?.write(payload.data);
          } catch {
            xtermRef.current?.write(e.data);
          }
        }
      };
    } catch (e: any) {
      setInitError(e?.message || String(e));
    }
  };


  useEffect(() => {
    if (!terminalRef.current) return;

    try {
      const isMobile = window.innerWidth < 600;
      const ua = navigator.userAgent || '';
      const isIOS = /iPad|iPhone|iPod/.test(ua);
      const term = new XTerm({
      cursorBlink: true,
      theme: { background: '#1e1e1e', foreground: '#d4d4d4' },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: isMobile ? 12 : 14,
      scrollback: 2000,
      scrollSensitivity: isMobile ? 2 : 1,
      fastScrollSensitivity: 5,
      smoothScrollDuration: 0,
      // Older iOS webviews can be sensitive to early resize/fit calls.
      // Keep options conservative.
      customGlyphs: !isIOS,
    });
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    // On mobile / embedded webviews, the container often reports 0x0 on first paint.
    // Defer the initial fit to the next tick to avoid a blank terminal.
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch {
        // ignore
      }
    });
    xtermRef.current = term;

    term.onData((data) => {
      // Filter out xterm's auto-responses to terminal queries — these should
      // NOT be forwarded to the PTY or they cause a garbage feedback loop.
      // Cursor position reports: ESC [ <row> ; <col> R
      if (/^\x1b\[\d+;\d+R$/.test(data)) return;
      // Device attribute responses: ESC [ ... c
      if (/^\x1b\[\?[\d;]*c$/.test(data) || /^\x1b\[[\d;]*c$/.test(data)) return;
      // OSC color responses: ESC ] <n> ; rgb:... ST/BEL
      if (/^\x1b\]\d+;/.test(data)) return;

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'write', data }));
      }
    });

    let rafPending = false
    const safeFit = () => {
      try {
        const el = terminalRef.current
        if (!el || !el.isConnected) return
        const rect = el.getBoundingClientRect()
        if (rect.width < 10 || rect.height < 10) return

        fitAddon.fit()
        const dims = fitAddon.proposeDimensions()
        if (dims && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ action: 'resize', cols: dims.cols, rows: dims.rows }))
        }
      } catch (e: any) {
        setDebug(prev => `${prev}\nfitError=${e?.message || String(e)}`)
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      if (rafPending) return
      rafPending = true
      requestAnimationFrame(() => {
        rafPending = false
        safeFit()
      })
    })

    // Delay observation until after the initial paint/fit
    requestAnimationFrame(() => {
      try {
        resizeObserver.observe(terminalRef.current!)
      } catch {}
      safeFit()
    })

    // Do not auto-connect on mount. On some older iOS Telegram webviews,
    // websocket initialization can hard-crash the mini app. User can tap Connect.

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      if (wsRef.current) wsRef.current.close();
    };
    } catch (e: any) {
      setInitError(e?.message || String(e));
      return;
    }
  }, [tabId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden', touchAction: 'none' } as React.CSSProperties}>
      {/* Status bar */}
      <div style={{ display: 'flex', gap: '6px', padding: '6px 8px', borderBottom: '1px solid #333', alignItems: 'center', flexShrink: 0 }}>
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

      {(initError || debug) && (
        <div style={{ padding: '6px 8px', borderBottom: '1px solid #222', background: '#111', color: '#cbd5e1', fontSize: '11px', whiteSpace: 'pre-wrap' }}>
          {initError ? `initError: ${initError}\n` : ''}{debug}
        </div>
      )}

      {/* Mobile key toolbar */}
      <div style={{ display: 'flex', gap: '4px', padding: '5px 6px', background: '#161616', borderBottom: '1px solid #2a2a2a', flexShrink: 0, overflowX: 'auto' }}>
        {KEYS.map(({ label, data }) => (
          <button
            key={label}
            onPointerDown={(e) => { e.preventDefault(); sendData(data); }}
            style={{
              padding: '5px 10px',
              fontSize: '12px',
              fontFamily: 'monospace',
              background: '#2a2a2a',
              color: '#ccc',
              border: '1px solid #3a3a3a',
              borderRadius: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              userSelect: 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Terminal */}
      <div
        ref={terminalRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          padding: 0,
          background: '#1e1e1e',
          touchAction: 'none',
          WebkitOverflowScrolling: 'auto',
          overscrollBehavior: 'none',
        } as React.CSSProperties}
        onClick={() => xtermRef.current?.focus()}
      />
    </div>
  );
});

export default TerminalView;
