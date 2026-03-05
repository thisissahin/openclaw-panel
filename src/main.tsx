import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './App.css'
import App from './App.tsx'

// Capture hard crashes in embedded webviews (e.g., Telegram Mini App on older iOS)
// and persist them so we can surface the last crash on next launch.
window.addEventListener('error', (event: any) => {
  try {
    const payload = {
      type: 'error',
      message: event?.message,
      filename: event?.filename,
      lineno: event?.lineno,
      colno: event?.colno,
      stack: event?.error?.stack,
      time: new Date().toISOString(),
      ua: navigator.userAgent,
    }
    localStorage.setItem('lastCrash', JSON.stringify(payload))
  } catch {
    // ignore
  }
})

window.addEventListener('unhandledrejection', (event: any) => {
  try {
    const reason = event?.reason
    const payload = {
      type: 'unhandledrejection',
      message: reason?.message || String(reason),
      stack: reason?.stack,
      time: new Date().toISOString(),
      ua: navigator.userAgent,
    }
    localStorage.setItem('lastCrash', JSON.stringify(payload))
  } catch {
    // ignore
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
