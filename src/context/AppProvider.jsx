import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, WifiOff, X } from 'lucide-react'
import { getPref, setPref } from '../db/repo'
import { seedDemoData } from '../db/seed'
import db from '../db/db'

const AppContext = createContext(null)

export const THEMES = {
  clinical: {
    id: 'clinical',
    label: 'Clinical Teal',
    hint: 'Default dark diagnostic terminal',
    meta: '#070d10',
    swatch: ['#0b1a1f', '#2dd4bf', '#22d3ee'],
  },
  sterile: {
    id: 'sterile',
    label: 'Sterile Glass',
    hint: 'High-readability frosted daylight',
    meta: '#eaf4f9',
    swatch: ['#f4fbff', '#0d7490', '#7dd3fc'],
  },
  amber: {
    id: 'amber',
    label: 'Night Ward Amber',
    hint: 'Low blue light for night shifts',
    meta: '#140e09',
    swatch: ['#20160e', '#f5b042', '#fb923c'],
  },
}

export const ROLES = {
  admin: {
    id: 'admin',
    label: 'Clinical Officer / Admin',
    short: 'Clinical Officer',
    description: 'Full clinical history, inventory control, referral approval and epidemiological exports.',
    initials: 'FM',
    accent: 'brand',
  },
  chp: {
    id: 'chp',
    label: 'Community Health Promoter',
    short: 'CHP · Field',
    description: 'Register patients, log vitals, close home visits and view clinic stock. Inventory stays read-only.',
    initials: 'JK',
    accent: 'accent',
  },
}

const DEFAULT_PROFILES = {
  admin: {
    name: 'Dr. Faith Makena',
    title: 'Clinical Officer / Admin',
    facility: 'Nkubu Level 4 Hospital',
    unit: 'Meru County · Imenti South',
    phone: '+254 722 145 903',
  },
  chp: {
    name: 'James Kimathi',
    title: 'Community Health Promoter',
    facility: 'Kanyakine Community Unit',
    unit: 'Meru County · Imenti South',
    phone: '+254 711 882 604',
  },
}

function readStoredTheme() {
  try {
    const saved = localStorage.getItem('afyapulse.theme')
    return THEMES[saved] ? saved : 'clinical'
  } catch {
    return 'clinical'
  }
}

export function AppProvider({ children }) {
  const [booting, setBooting] = useState(true)
  const [bootError, setBootError] = useState(null)
  const [role, setRoleState] = useState('admin')
  const [theme, setThemeState] = useState(readStoredTheme)
  const [profiles, setProfiles] = useState(DEFAULT_PROFILES)
  const [haptics, setHapticsState] = useState(true)
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [toasts, setToasts] = useState([])
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [nativePlatform, setNativePlatform] = useState(false)
  const timers = useRef(new Map())

  const isNative =
    nativePlatform ||
    (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true) ||
    /AfyaPulseAndroid/i.test(typeof navigator === 'undefined' ? '' : navigator.userAgent)

  /* ------------------------------------------------------------- bootstrap */
  useEffect(() => {
    let cancelled = false
    async function boot() {
      try {
        await db.open()
        const seeded = await getPref('seeded', false)
        if (!seeded) {
          await seedDemoData({ reset: false })
        }
        const [savedRole, savedTheme, savedHaptics, adminProfile, chpProfile] = await Promise.all([
          getPref('role', 'admin'),
          getPref('theme', readStoredTheme()),
          getPref('haptics', true),
          getPref('profile.admin', DEFAULT_PROFILES.admin),
          getPref('profile.chp', DEFAULT_PROFILES.chp),
        ])
        if (cancelled) return
        setRoleState(ROLES[savedRole] ? savedRole : 'admin')
        setThemeState(THEMES[savedTheme] ? savedTheme : 'clinical')
        setHapticsState(savedHaptics !== false)
        setProfiles({ admin: adminProfile || DEFAULT_PROFILES.admin, chp: chpProfile || DEFAULT_PROFILES.chp })
      } catch (error) {
        if (!cancelled) setBootError(error?.message || 'The offline database could not be opened.')
      } finally {
        if (!cancelled) setBooting(false)
      }
    }
    boot()
    return () => {
      cancelled = true
    }
  }, [])

  /* --------------------------------------------------------------- theming */
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme === 'sterile' ? 'light' : 'dark'
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', THEMES[theme].meta)
    try {
      localStorage.setItem('afyapulse.theme', theme)
    } catch {
      /* private mode — in-session theme still applies */
    }
  }, [theme])

  /* ------------------------------------------------------------ connectivity */
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true)
      pushToast({ title: 'Back online', message: 'Local records are ready to sync when your link returns.', tone: 'success' })
    }
    const handleOffline = () => {
      setOnline(false)
      pushToast({ title: 'Offline mode', message: 'Recording locally to IndexedDB. Nothing is lost.', tone: 'warning' })
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------------------------------------------------------------- install */
  useEffect(() => {
    const promptHandler = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }
    const installed = () => {
      setInstallPrompt(null)
      pushToast({ title: 'AfyaPulse installed', message: 'Launch it from your home screen — it runs offline.', tone: 'success' })
    }
    window.addEventListener('beforeinstallprompt', promptHandler)
    window.addEventListener('appinstalled', installed)
    if (typeof window !== 'undefined') {
      setIsStandalone(
        window.matchMedia?.('(display-mode: standalone)')?.matches ||
          window.navigator.standalone === true ||
          window.Capacitor?.isNativePlatform?.() === true,
      )
      setNativePlatform(window.Capacitor?.isNativePlatform?.() === true)
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', promptHandler)
      window.removeEventListener('appinstalled', installed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(
    () => () => {
      timers.current.forEach((id) => clearTimeout(id))
      timers.current.clear()
    },
    [],
  )

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const pushToast = useCallback(
    ({ title, message = '', tone = 'info', duration = 4200 }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setToasts((current) => [...current.slice(-2), { id, title, message, tone }])
      const timer = setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id))
        timers.current.delete(id)
      }, duration)
      timers.current.set(id, timer)
      return id
    },
    [],
  )

  const buzz = useCallback(
    (pattern = 12) => {
      if (!haptics) return
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(pattern)
        } catch {
          /* vibration unsupported */
        }
      }
    },
    [haptics],
  )

  const setRole = useCallback(
    async (nextRole) => {
      if (!ROLES[nextRole]) return
      setRoleState(nextRole)
      await setPref('role', nextRole)
      buzz(14)
      pushToast({
        title: `Signed in as ${ROLES[nextRole].short}`,
        message: ROLES[nextRole].description,
        tone: nextRole === 'admin' ? 'info' : 'success',
      })
    },
    [buzz, pushToast],
  )

  const setTheme = useCallback(
    (nextTheme) => {
      if (!THEMES[nextTheme]) return
      setThemeState(nextTheme)
      setPref('theme', nextTheme)
      buzz(8)
    },
    [buzz],
  )

  const setHaptics = useCallback((enabled) => {
    setHapticsState(enabled)
    setPref('haptics', enabled)
  }, [])

  const updateProfile = useCallback(
    async (patch) => {
      const next = { ...profiles[role], ...patch }
      setProfiles((current) => ({ ...current, [role]: next }))
      await setPref(`profile.${role}`, next)
    },
    [profiles, role],
  )

  const promptInstall = useCallback(async () => {
    if (!installPrompt) return false
    try {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      setInstallPrompt(null)
      return choice?.outcome === 'accepted'
    } catch {
      setInstallPrompt(null)
      return false
    }
  }, [installPrompt])

  const value = useMemo(
    () => ({
      booting,
      bootError,
      role,
      setRole,
      isAdmin: role === 'admin',
      isChp: role === 'chp',
      theme,
      setTheme,
      profiles,
      profile: profiles[role],
      updateProfile,
      haptics,
      setHaptics,
      buzz,
      toast: pushToast,
      online,
      isNative,
      isStandalone,
      installPrompt,
      promptInstall,
      canInstall: Boolean(installPrompt),
    }),
    [
      booting,
      bootError,
      role,
      setRole,
      theme,
      setTheme,
      profiles,
      updateProfile,
      haptics,
      setHaptics,
      buzz,
      pushToast,
      online,
      isNative,
      isStandalone,
      installPrompt,
      promptInstall,
    ],
  )

  return (
    <AppContext.Provider value={value}>
      {children}
      <ToastHub toasts={toasts} onDismiss={dismissToast} />
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}

const TONE_STYLES = {
  success: { border: 'border-ok/35', icon: CheckCircle2, tint: 'text-ok', bar: 'bg-ok' },
  warning: { border: 'border-warn/35', icon: AlertTriangle, tint: 'text-warn', bar: 'bg-warn' },
  error: { border: 'border-danger/35', icon: AlertTriangle, tint: 'text-danger', bar: 'bg-danger' },
  info: { border: 'border-brand/35', icon: Info, tint: 'text-brand', bar: 'bg-brand' },
  offline: { border: 'border-muted/35', icon: WifiOff, tint: 'text-muted', bar: 'bg-muted' },
}

function ToastHub({ toasts, onDismiss }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[120] flex flex-col items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:items-end sm:px-6"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const tone = TONE_STYLES[toast.tone] || TONE_STYLES.info
          const Icon = tone.icon
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={`glass-strong pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl border ${tone.border} p-3.5 pr-10 shadow-glass`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 rounded-lg bg-surface/50 p-1.5 ${tone.tint}`}>
                  <Icon size={16} strokeWidth={2.2} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight text-content">{toast.title}</p>
                  {toast.message ? <p className="mt-1 text-xs leading-relaxed text-muted">{toast.message}</p> : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="absolute right-2.5 top-2.5 rounded-md p-1 text-muted transition-colors hover:bg-surface/60 hover:text-content"
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
              <motion.span
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 4.2, ease: 'linear' }}
                className={`absolute bottom-0 left-0 h-0.5 w-full origin-left ${tone.bar} opacity-60`}
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
