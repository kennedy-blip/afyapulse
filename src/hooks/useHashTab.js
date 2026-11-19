import { useCallback, useEffect, useState } from 'react'
import { NAV_ITEMS } from '../lib/navigation'

const IDS = NAV_ITEMS.map((item) => item.id)

function readHash() {
  if (typeof window === 'undefined') return 'triage'
  const raw = window.location.hash.replace('#', '').split('?')[0]
  return IDS.includes(raw) ? raw : 'triage'
}

export function useHashTab() {
  const [tab, setTab] = useState(readHash)

  useEffect(() => {
    const handler = () => setTab(readHash())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  const change = useCallback((next) => {
    if (!IDS.includes(next)) return
    setTab(next)
    if (typeof window !== 'undefined') {
      const target = `#${next}`
      if (window.location.hash !== target) {
        window.history.replaceState(null, '', target)
      }
    }
  }, [])

  return [tab, change]
}
