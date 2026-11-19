import React from 'react'
import { motion } from 'framer-motion'
import { Activity, HeartPulse, RotateCcw, ShieldAlert } from 'lucide-react'
import { useApp } from './context/AppProvider'
import Shell from './components/Shell'
import { useHashTab } from './hooks/useHashTab'

export default function App() {
  const { booting, bootError } = useApp()
  const [tab, setTab] = useHashTab()

  if (booting) return <BootSplash />
  if (bootError) return <BootError message={bootError} />
  return <Shell tab={tab} onTabChange={setTab} />
}

function BootSplash() {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-canvas px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 40%, rgb(45 212 191 / 0.16) 0%, transparent 55%), radial-gradient(circle at 80% 80%, rgb(34 211 238 / 0.1) 0%, transparent 45%)',
        }}
      />
      <div className="relative flex flex-col items-center text-center">
        <div className="relative mb-6 grid h-20 w-20 place-items-center">
          <span className="absolute inset-0 rounded-3xl border border-brand/25" />
          <motion.span
            animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
            className="absolute inset-0 rounded-3xl border border-brand/40"
          />
          <motion.span
            animate={{ scale: [1, 1.35], opacity: [0.4, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut', delay: 0.6 }}
            className="absolute inset-0 rounded-3xl border border-accent/40"
          />
          <motion.div
            animate={{ scale: [0.94, 1.04, 0.94] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            className="grid h-16 w-16 place-items-center rounded-2xl border border-brand/40 bg-gradient-to-br from-brand/25 to-accent/10 text-brand shadow-glow"
          >
            <HeartPulse size={28} strokeWidth={2.2} />
          </motion.div>
        </div>
        <p className="text-2xl font-semibold tracking-tight text-content">
          Afya<span className="text-brand">Pulse</span>
        </p>
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-muted">Clinic triage OS</p>
        <div className="mt-8 flex items-center gap-2 rounded-full border border-line/20 bg-surface/40 px-4 py-2 text-[11px] text-muted">
          <Activity size={13} className="text-brand" />
          <motion.span animate={{ opacity: [0.45, 1, 0.45] }} transition={{ duration: 1.6, repeat: Infinity }}>
            Opening offline clinical register…
          </motion.span>
        </div>
      </div>
    </div>
  )
}

function BootError({ message }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-6">
      <div className="glass w-full max-w-md rounded-2xl p-6 text-center">
        <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-danger/30 bg-danger/10 text-danger">
          <ShieldAlert size={22} />
        </span>
        <h1 className="text-lg font-semibold text-content">Offline store unavailable</h1>
        <p className="mt-2 text-xs leading-relaxed text-muted">{message}</p>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          AfyaPulse needs IndexedDB. Check that private browsing is off and the device has free storage, then retry.
        </p>
        <button type="button" onClick={() => window.location.reload()} className="btn btn-primary mt-5 w-full">
          <RotateCcw size={15} /> Retry
        </button>
      </div>
    </div>
  )
}
