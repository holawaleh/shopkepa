import { useState, useEffect } from 'react'
import { healthAPI } from '../api/client'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    let interval

    const check = async () => {
      if (!navigator.onLine) { setIsOnline(false); return }
      try {
        await healthAPI.ping()
        setIsOnline(true)
      } catch {
        // If navigator.onLine is still true, the failure is likely a browser
        // extension (e.g. Brave Shields) blocking the request — don't show offline.
        if (!navigator.onLine) setIsOnline(false)
      }
    }

    const handleOnline  = () => check()
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    // Poll every 30s
    interval = setInterval(check, 30_000)
    check()

    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  return isOnline
}
