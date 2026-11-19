import React, { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { Activity, CloudOff, Database, Moon, ShieldCheck, Sparkles, Sun, Waves } from 'lucide-react'
import { useApp, THEMES } from '../context/AppProvider'
import { NAV_ITEMS, navItem } from '../lib/navigation'
import { db } from '../db/db'
import { needsAttention } from '../lib/pharmacy'
import { todayISO } from '../lib/dates'
import { initials } from '../lib/format'
import { Avatar, Badge } from './ui/Primitives'
import MeshBackdrop from './MeshBackdrop'
import PatientTriage from './PatientTriage'
import FollowUpScheduler from './FollowUpScheduler'
import PharmacyTracker from './PharmacyTracker'
import SettingsPanel from './SettingsPanel'

function useRiskCounts() {
  const counts = useLiveQuery(async () => {
    const today = todayISO()
    const urgent = await db.patients
      .where('riskLevel')
      .equals('urgent')
      .filter((p) => !p.archived)
      .count()
    const overdue = await db.schedules
      .where('status')
      .equals('pending')
      .filter((row) => row.dueDate < today)
      .count()
    const meds = await db.medications.toArray()
    const stockAlerts = meds.filter(needsAttention).length
    const referrals = await db.referrals.where('status').equals('pending_approval').count()
    return { urgent, overdue, stockAlerts, referrals }
  }, [])
  return counts || { urgent: 0, overdue: 0, stockAlerts: 0, referrals: 0 }
}

function BrandMark({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand/35 bg-gradient-to-br from-brand/25 to-accent/10 text-brand shadow-glow-sm">
        <Activity size={19} strokeWidth={2.4} />
        <span className="absolute inset-0 rounded-xl border border-brand/20 animate-pulse-ring" aria-hidden="true" />
      </span>
      <div className={compact ? 'block' : 'hidden sm:block'}>
        <p className="text-sm font-semibold leading-none tracking-tight text-content">
          Afya<span className="text-brand">Pulse</span>
        </p>
        <p className="mt-1 text-[9px] font-semibold uppercase tracking-clinical text-muted">Clinic triage OS</p>
      </div>
    </div>
  )
}

function ThemeCycleButton() {
  const { theme, setTheme } = useApp()
  const order = ['clinical', 'sterile', 'amber']
  const next = order[(order.indexOf(theme) + 1) % order.length]
  const Icon = theme === 'sterile' ? Sun : theme === 'amber' ? Waves : Moon
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={() => setTheme(next)}
      className="focus-ring grid h-9 w-9 place-items-center rounded-xl border border-line/25 bg-surface/40 text-muted transition-colors hover:border-brand/40 hover:text-brand"
      title={`Ward lighting: ${THEMES[theme].label} — switch to ${THEMES[next].label}`}
      aria-label="Cycle ward lighting"
    >
      <Icon size={16} strokeWidth={2} />
    </motion.button>
  )
}

function SyncChip() {
  const { online } = useApp()
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-clinical ${
        online ? 'border-ok/30 bg-ok/10 text-ok' : 'border-warn/30 bg-warn/10 text-warn'
      }`}
      title={online ? 'Connected — records stored locally first' : 'Offline — everything saved to IndexedDB'}
    >
      {online ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : <CloudOff size={11} />}
      {online ? 'Online · local-first' : 'Offline ready'}
    </span>
  )
}

export default function Shell({ tab, onTabChange }) {
  const { role, profile, isAdmin, online } = useApp()
  const counts = useRiskCounts()
  const current = navItem(tab)

  const badgeFor = (badge) => {
    if (badge === 'urgent') return counts.urgent
    if (badge === 'overdue') return counts.overdue
    if (badge === 'stock') return counts.stockAlerts
    return 0
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [tab])

  const screens = useMemo(
    () => ({
      triage: <PatientTriage />,
      schedules: <FollowUpScheduler />,
      pharmacy: <PharmacyTracker />,
      settings: <SettingsPanel />,
    }),
    [],
  )

  return (
    <div className="relative min-h-screen">
      <MeshBackdrop />
      <div className="mx-auto flex w-full max-w-[1700px]">
        {/* ------------------------------------------------------ desktop rail */}
        <aside className="sticky top-0 hidden h-dvh w-[272px] shrink-0 flex-col border-r border-line/10 px-5 pb-5 pt-6 lg:flex xl:w-[292px]">
          <BrandMark />
          <div className="mt-7 flex-1">
            <p className="label-clinical mb-2 px-2">Workspace</p>
            <nav className="space-y-1.5" aria-label="Primary">
              {NAV_ITEMS.map((item) => {
                const active = item.id === tab
                const count = badgeFor(item.badge)
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onTabChange(item.id)}
                    aria-current={active ? 'page' : undefined}
                    aria-label={item.label}
                    className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      active ? 'text-content' : 'text-muted hover:bg-surface/40 hover:text-content'
                    }`}
                  >
                    {active ? (
                      <motion.span
                        layoutId="sidebar-active"
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="absolute inset-0 rounded-xl border border-brand/30 bg-gradient-to-r from-brand/15 to-transparent"
                      />
                    ) : null}
                    <span
                      className={`relative z-10 grid h-8 w-8 place-items-center rounded-lg border transition-colors ${
                        active
                          ? 'border-brand/40 bg-brand/15 text-brand'
                          : 'border-line/20 bg-surface/30 text-muted group-hover:text-content'
                      }`}
                    >
                      <Icon size={15} strokeWidth={2.2} />
                    </span>
                    <span className="relative z-10 flex-1">
                      <span className="block text-[13px] font-semibold leading-none">{item.label}</span>
                      <span className="mt-1 block text-[10px] leading-none text-muted">{item.subtitle.split(',')[0]}</span>
                    </span>
                    {count ? (
                      <span
                        className={`relative z-10 grid min-w-5 place-items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                          item.badge === 'urgent'
                            ? 'bg-danger/20 text-danger'
                            : item.badge === 'stock'
                              ? 'bg-warn/20 text-warn'
                              : 'bg-brand/20 text-brand'
                        }`}
                      >
                        {count}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </nav>

            <div className="glass mt-6 rounded-2xl p-3.5">
              <div className="flex items-center justify-between">
                <p className="label-clinical">Ward status</p>
                <Badge tone={online ? 'ok' : 'warn'} dot>
                  {online ? 'Syncable' : 'Offline'}
                </Badge>
              </div>
              <div className="mt-3 space-y-2 text-[11px] text-muted">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck size={12} className="text-brand" /> Pending referrals
                  </span>
                  <span className="metric font-semibold text-content">{counts.referrals}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Database size={12} className="text-brand" /> Overdue visits
                  </span>
                  <span className="metric font-semibold text-content">{counts.overdue}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles size={12} className="text-brand" /> Stock alerts
                  </span>
                  <span className="metric font-semibold text-content">{counts.stockAlerts}</span>
                </div>
              </div>
              <div className="divider my-3" />
              <button
                type="button"
                onClick={() => onTabChange('settings')}
                className="flex w-full items-center gap-2.5 rounded-lg text-left transition-opacity hover:opacity-90"
              >
                <Avatar initials={initials({ firstName: profile.name.split(' ')[0], lastName: profile.name.split(' ')[1] })} tone={isAdmin ? 'brand' : 'accent'} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold leading-tight text-content">{profile.name}</span>
                  <span className="block truncate text-[10px] text-muted">{isAdmin ? 'Clinical Officer / Admin' : 'Community Health Promoter'}</span>
                </span>
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between px-1 text-[10px] uppercase tracking-clinical text-muted">
            <span>v1.0.0 · offline-first</span>
            <span className="flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-ok' : 'bg-warn'}`} />
              {role === 'admin' ? 'Admin' : 'Field'}
            </span>
          </div>
        </aside>

        {/* -------------------------------------------------------------- main */}
        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          <header className="safe-top sticky top-0 z-40">
            <div className="glass rounded-none border-x-0 border-t-0 border-line/15 px-4 py-2.5 lg:px-8">
              <div className="flex items-center gap-3">
                <div className="lg:hidden">
                  <BrandMark compact />
                </div>
                <div className="hidden min-w-0 flex-col lg:flex">
                  <p className="label-clinical">{isAdmin ? 'Clinical console' : 'Field console'}</p>
                  <p className="truncate text-[13px] font-semibold text-content">{current.title}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="hidden sm:inline-flex">
                    <SyncChip />
                  </span>
                  <span className="chip hidden md:inline-flex">
                    {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                  <ThemeCycleButton />
                  <button
                    type="button"
                    onClick={() => onTabChange('settings')}
                    className="focus-ring flex items-center gap-2 rounded-xl border border-line/25 bg-surface/40 py-1 pl-1 pr-2.5 transition-colors hover:border-brand/40"
                    aria-label="Open clinic settings"
                  >
                    <Avatar
                      initials={initials({ firstName: profile.name.split(' ')[0], lastName: profile.name.split(' ')[1] })}
                      tone={isAdmin ? 'brand' : 'accent'}
                      size="sm"
                    />
                    <span className="hidden text-left sm:block">
                      <span className="block max-w-[120px] truncate text-[11px] font-semibold leading-none text-content">
                        {profile.name}
                      </span>
                      <span className="mt-0.5 block text-[9px] uppercase tracking-clinical text-muted">
                        {isAdmin ? 'Administrator' : 'CHP field'}
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 pb-nav pt-4 sm:px-5 sm:pt-5 lg:px-8 lg:pb-10 lg:pt-7">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 18, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              {screens[tab] || screens.triage}
            </motion.div>
            <footer className="mt-10 hidden items-center justify-between border-t border-line/10 pt-4 text-[10px] uppercase tracking-clinical text-muted lg:flex">
              <span>AfyaPulse · Meru County community health network</span>
              <span className="flex items-center gap-2">
                <ShieldCheck size={11} /> Encrypted at rest by the device OS · local-first
              </span>
            </footer>
          </main>
        </div>
      </div>

      {/* ----------------------------------------------------------- mobile nav */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-50 px-3 pb-3 lg:hidden" aria-label="Primary">
        <div className="glass-strong mx-auto flex max-w-md items-stretch gap-1 rounded-2xl border border-line/25 p-1.5 shadow-glass">
          {NAV_ITEMS.map((item) => {
            const active = item.id === tab
            const count = badgeFor(item.badge)
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                className={`relative flex flex-1 flex-col items-center gap-1 rounded-xl py-2 transition-colors ${
                  active ? 'text-brand' : 'text-muted active:text-content'
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="bottom-active"
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="absolute inset-0 rounded-xl border border-brand/25 bg-brand/10"
                  />
                ) : null}
                <span className="relative">
                  <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                  {count ? (
                    <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white shadow">
                      {count > 9 ? '9+' : count}
                    </span>
                  ) : null}
                </span>
                <span className="relative text-[9px] font-semibold uppercase tracking-clinical">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
