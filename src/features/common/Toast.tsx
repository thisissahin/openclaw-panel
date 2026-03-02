import { useEffect } from 'react'

type ToastProps = {
  msg: string
  onDone: () => void
}

export default function Toast({ msg, onDone }: ToastProps) {
  useEffect(() => {
    const timeout = setTimeout(onDone, 3500)
    return () => clearTimeout(timeout)
  }, [onDone])

  return <div className="toast">{msg}</div>
}
