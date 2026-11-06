'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return

    let cancelled = false

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })
        if (!cancelled) await registration.update()
      } catch (error) {
        // PWA is an enhancement; a registration failure must never block the app.
        console.error('CDPC service worker registration failed:', error)
      }
    }

    void register()
    return () => {
      cancelled = true
    }
  }, [])

  return null
}
