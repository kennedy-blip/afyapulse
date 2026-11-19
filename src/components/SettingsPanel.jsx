import React, { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Activity,
  BadgeCheck,
  Check,
  CircleUserRound,
  CloudOff,
  Database,
  Download,
  HardDriveDownload,
  HardDriveUpload,
  Info,
  Lock,
  Minus,
  MonitorSmartphone,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  UserRound,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { db, tableCounts } from '../db/db'
import { clearOperationalData, exportBackup, getPref, importBackup, setPref, storageReport } from '../db/repo'
import { seedDemoData } from '../db/seed'
import { THEMES, useApp } from '../context/AppProvider'
import { bytesLabel } from '../lib/format'
import { deliverExport } from '../lib/share'
import { formatDateTime, todayISO } from '../lib/dates'
import { Badge, ProgressBar, SectionHeading, TrustNote } from './ui/Primitives'
import { Field, TextInput } from './ui/Fields'
import { Toggle } from './ui/Fields'
import ConfirmDialog from './ui/ConfirmDialog'
import RoleSwitcher from './RoleSwitcher'
import ThemeToggle from './ThemeToggle'
import DownloadAPKModal from './DownloadAPKModal'

const PRIVILEGE_ROWS = [
  { label: 'Register patients & capture vitals', admin: true, chp: true },
  { label: 'Work scheduled home visits', admin: true, chp: true },
  { label: 'View triage risk flags', admin: true, chp: true },
  { label: 'View clinic stock availability', admin: true, chp: true },
  { label: 'Edit identity details & clinical histories', admin: true, chp: false },
  { label: 'Archive or delete patient records', admin: true, chp: false },
  { label: 'Dispense, restock & adjust inventory', admin: true, chp: false },
  { label: 'Override batch expiry dates', admin: true, chp: false },
  { label: 'Approve urgent referrals', admin: true, chp: false },
  { label: 'Export anonymised epidemiological data', admin: true, chp: false },
  { label: 'Backup / restore the device database', admin: true, chp: false },
]

const TABLE_LABELS = {
  patients: 'Patients',
  vitals: 'Visits',
  schedules: 'Follow-ups',
  medications: 'Stock lines',
  dispensings: 'Dispensing',
  adjustments: 'Ledger',
  referrals: 'Referrals',
  activity: 'Audit log',
}

const ACTIVITY_ICONS = { patient: UserRound, vitals: Activity, schedule: RefreshCw, stock: Database, referral: ShieldCheck }

export default function SettingsPanel() {
  const {
    role,
    isAdmin,
    profile,
    updateProfile,
    toast,
    online,
    isNative,
    isStandalone,
    canInstall,
    promptInstall,
    haptics,
    setHaptics,
    buzz,
    theme,
  } = useApp()

  const [apkOpen, setApkOpen] = useState(false)
  const [form, setForm] = useState(profile)
  const [storage, setStorage] = useState({ usage: 0, quota: 0 })
  const [persisted, setPersisted] = useState(true)
  const [lastBackup, setLastBackup] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)

  const counts = useLiveQuery(() => tableCounts(), [])
  const activity = useLiveQuery(() => db.activity.orderBy('at').reverse().limit(8).toArray(), [])

  useEffect(() => setForm(profile), [profile])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const report = await storageReport()
      if (cancelled) return
      setStorage({ usage: report.usage, quota: report.quota })
      if (navigator.storage?.persisted) {
        try {
          setPersisted(await navigator.storage.persisted())
        } catch {
          setPersisted(false)
        }
      }
      setLastBackup(await getPref('lastBackupAt', null))
    }
    load()
    return () => {
      cancelled = true
    }
  }, [counts])

  const saveProfile = async (event) => {
    event.preventDefault()
    if (!form.name?.trim()) {
      toast({ title: 'Name required', message: 'The audit trail needs the name of the acting worker.', tone: 'warning' })
      return
    }
    await updateProfile(form)
    toast({ title: 'Profile saved', message: `${form.name} · ${form.facility}`, tone: 'success' })
    buzz(12)
  }

  const handleExport = async () => {
    try {
      const backup = await exportBackup()
      const stamp = new Date().toISOString()
      await deliverExport({
        filename: `afyapulse-backup-${todayISO()}.json`,
        content: JSON.stringify(backup, null, 2),
        mime: 'application/json',
        isNative,
        title: 'AfyaPulse backup',
      })
      await setPref('lastBackupAt', stamp)
      setLastBackup(stamp)
      toast({ title: 'Backup exported', message: 'Store the JSON on an encrypted drive, not a shared phone.', tone: 'success' })
    } catch (error) {
      toast({ title: 'Backup failed', message: error.message, tone: 'error' })
    }
  }

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      await importBackup(payload, profile)
      toast({ title: 'Backup restored', message: `${file.name} loaded into this device.`, tone: 'success' })
      buzz(20)
    } catch (error) {
      toast({ title: 'Restore failed', message: error.message || 'Invalid backup file.', tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const runConfirmed = async () => {
    setBusy(true)
    try {
      if (confirmAction === 'seed') {
        const result = await seedDemoData({ reset: true })
        toast({
          title: 'Demo clinic restored',
          message: `${result.patients} patients and ${result.medications} stock lines reloaded.`,
          tone: 'success',
        })
      } else if (confirmAction === 'clear') {
        await clearOperationalData()
        await setPref('seeded', true)
        toast({ title: 'All clinical data erased', message: 'The register, schedule and dispensary are now empty.', tone: 'warning' })
      }
      setConfirmAction(null)
    } catch (error) {
      toast({ title: 'Action failed', message: error.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const requestPersist = async () => {
    if (!navigator.storage?.persist) {
      toast({ title: 'Not supported', message: 'This browser cannot request persistent storage.', tone: 'info' })
      return
    }
    const granted = await navigator.storage.persist()
    setPersisted(granted)
    toast({
      title: granted ? 'Storage protected' : 'Storage not guaranteed',
      message: granted
        ? 'The browser will not evict AfyaPulse records under storage pressure.'
        : 'Install the app or free device space to protect the database.',
      tone: granted ? 'success' : 'warning',
    })
  }

  const installWeb = async () => {
    if (!canInstall) {
      toast({
        title: 'Install from the browser menu',
        message: 'Chrome: menu → Add to Home screen. Safari: Share → Add to Home Screen.',
        tone: 'info',
      })
      return
    }
    const installed = await promptInstall()
    if (installed) toast({ title: 'AfyaPulse installed', message: 'Launch it from the home screen — offline ready.', tone: 'success' })
  }

  const usagePercent = storage.quota ? Math.min(100, (storage.usage / storage.quota) * 100) : 0
  const totalRecords = counts ? Object.values(counts).reduce((total, value) => total + value, 0) : 0

  return (
    <div className="space-y-4 sm:space-y-5">
      <SectionHeading
        eyebrow="Device & access"
        title="Clinic settings"
        description="Roles, ward lighting, offline storage and the Android package centre — everything stays on this device."
        icon={Settings2}
        action={
          <>
            <span className="chip !border-brand/30 !text-brand">
              <ShieldCheck size={11} /> {isAdmin ? 'Administrator' : 'Field staff'}
            </span>
            <span className={`chip ${online ? '!border-ok/30 !text-ok' : '!border-warn/30 !text-warn'}`}>
              {online ? <Wifi size={11} /> : <WifiOff size={11} />} {online ? 'Online' : 'Offline'}
            </span>
          </>
        }
      />

      <div className="grid gap-3.5 xl:grid-cols-2">
        <div className="space-y-3.5">
          <RoleSwitcher />

          <section className="glass rounded-2xl p-3.5 sm:p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-brand/25 bg-brand/10 text-brand">
                <CircleUserRound size={17} />
              </span>
              <div>
                <p className="label-clinical">Operator profile</p>
                <h2 className="text-sm font-semibold text-content">{isAdmin ? 'Clinical officer' : 'Community health promoter'}</h2>
              </div>
              <Badge tone={isAdmin ? 'brand' : 'accent'} className="ml-auto">
                {role === 'admin' ? 'Admin' : 'CHP'}
              </Badge>
            </div>
            <form onSubmit={saveProfile} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Field label="Full name" htmlFor="profile-name" required>
                <TextInput id="profile-name" value={form.name || ''} onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))} />
              </Field>
              <Field label="Facility" htmlFor="profile-facility">
                <TextInput id="profile-facility" value={form.facility || ''} onChange={(event) => setForm((c) => ({ ...c, facility: event.target.value }))} />
              </Field>
              <Field label="County / unit" htmlFor="profile-unit">
                <TextInput id="profile-unit" value={form.unit || ''} onChange={(event) => setForm((c) => ({ ...c, unit: event.target.value }))} />
              </Field>
              <Field label="Phone" htmlFor="profile-phone">
                <TextInput id="profile-phone" value={form.phone || ''} onChange={(event) => setForm((c) => ({ ...c, phone: event.target.value }))} inputMode="tel" />
              </Field>
              <div className="sm:col-span-2">
                <button type="submit" className="btn btn-secondary w-full !py-2 !text-[11px]">
                  <Save size={13} /> Save operator profile
                </button>
              </div>
            </form>
          </section>

          <ThemeToggle />

          <section className="glass-outline relative overflow-hidden rounded-2xl border border-brand/30 p-3.5 sm:p-4">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{ background: 'radial-gradient(circle at 85% 0%, rgb(var(--c-brand) / 0.18) 0%, transparent 55%)' }}
            />
            <div className="relative flex items-start gap-2.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand/35 bg-brand/15 text-brand shadow-glow-sm">
                <Smartphone size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="label-clinical">Mobile packaging</p>
                <h2 className="text-sm font-semibold text-content">APK centre</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  Ship AfyaPulse as an installable Android app for outreach phones. Works fully offline after install.
                </p>
              </div>
            </div>
            <button type="button" className="btn btn-primary relative mt-3 w-full !py-3" onClick={() => setApkOpen(true)}>
              <Download size={18} /> Download Android APK
            </button>
            <div className="relative mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="btn btn-secondary !py-2 !text-[11px]"
                onClick={installWeb}
              >
                <MonitorSmartphone size={13} /> Install web app
              </button>
              <button
                type="button"
                className="btn btn-secondary !py-2 !text-[11px]"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href)
                    toast({
                      title: 'Link copied',
                      message: 'Share it with the outreach team — the installed app also works offline.',
                      tone: 'success',
                    })
                  } catch {
                    toast({ title: 'Copy failed', message: 'Copy the address bar URL manually.', tone: 'warning' })
                  }
                }}
              >
                <BadgeCheck size={13} /> Share link
              </button>
            </div>
            <div className="relative mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-md border border-line/20 bg-surface/40 px-1.5 py-0.5 text-[9px] uppercase tracking-clinical text-muted">
                {isNative ? 'Running in APK shell' : isStandalone ? 'Installed PWA' : 'Browser'}
              </span>
              <span className="rounded-md border border-line/20 bg-surface/40 px-1.5 py-0.5 text-[9px] uppercase tracking-clinical text-muted">
                Capacitor 6
              </span>
              <span className="rounded-md border border-ok/25 bg-ok/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-clinical text-ok">
                v1.0.0
              </span>
            </div>
          </section>
        </div>

        <div className="space-y-3.5">
          <section className="glass rounded-2xl p-3.5 sm:p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-brand/25 bg-brand/10 text-brand">
                <Database size={17} />
              </span>
              <div>
                <p className="label-clinical">Local storage</p>
                <h2 className="text-sm font-semibold text-content">Offline database</h2>
              </div>
              <Badge tone={persisted ? 'ok' : 'warn'} className="ml-auto">
                {persisted ? 'Protected' : 'Best effort'}
              </Badge>
            </div>

            <div className="rounded-xl border border-line/15 bg-surface/30 p-2.5">
              <div className="flex items-end justify-between">
                <p className="metric text-lg font-semibold text-content">{bytesLabel(storage.usage)}</p>
                <p className="text-[10px] text-muted">
                  of {storage.quota ? bytesLabel(storage.quota) : 'device quota'} · {totalRecords} records
                </p>
              </div>
              <ProgressBar value={Math.max(usagePercent, 2)} tone={usagePercent > 85 ? 'danger' : 'brand'} className="mt-1.5" />
              <p className="mt-1 text-[10px] text-muted">IndexedDB · schema v2 · {counts?.patients ?? 0} patient files</p>
            </div>

            <div className="mt-2.5 grid grid-cols-4 gap-1.5">
              {Object.entries(TABLE_LABELS).map(([key, label]) => (
                <div key={key} className="rounded-lg border border-line/15 bg-surface/25 px-2 py-1.5">
                  <p className="metric text-[13px] font-semibold text-content">{counts?.[key] ?? 0}</p>
                  <p className="truncate text-[9px] uppercase tracking-clinical text-muted">{label}</p>
                </div>
              ))}
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-secondary !py-2 !text-[11px]" onClick={handleExport} disabled={!isAdmin}>
                <HardDriveDownload size={13} /> Export backup
              </button>
              <button
                type="button"
                className="btn btn-secondary !py-2 !text-[11px]"
                onClick={() => (isAdmin ? fileRef.current?.click() : toast({ title: 'Admin only', message: 'Restoring a backup requires Clinical Officer privileges.', tone: 'warning' }))}
                disabled={busy}
              >
                <HardDriveUpload size={13} /> Restore
              </button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />
              <button
                type="button"
                className="btn btn-secondary col-span-2 !py-2 !text-[11px]"
                onClick={requestPersist}
                disabled={persisted}
              >
                <ShieldCheck size={13} /> {persisted ? 'Storage protection active' : 'Request persistent storage'}
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between text-[10px] text-muted">
              <span>Last backup: {lastBackup ? formatDateTime(lastBackup) : 'never'}</span>
              {!isAdmin ? (
                <span className="inline-flex items-center gap-1 text-warn">
                  <Lock size={9} /> Admin only
                </span>
              ) : null}
            </div>
          </section>

          <section className="glass rounded-2xl p-3.5 sm:p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-brand/25 bg-brand/10 text-brand">
                <ShieldCheck size={17} />
              </span>
              <div>
                <p className="label-clinical">Governance</p>
                <h2 className="text-sm font-semibold text-content">Privilege matrix</h2>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-line/15">
              <div className="grid grid-cols-[1fr_54px_54px] gap-1 bg-surface/40 px-2.5 py-1.5">
                <p className="text-[9px] font-semibold uppercase tracking-clinical text-muted">Capability</p>
                <p className="text-center text-[9px] font-semibold uppercase tracking-clinical text-brand">Admin</p>
                <p className="text-center text-[9px] font-semibold uppercase tracking-clinical text-accent">CHP</p>
              </div>
              <ul className="divide-y divide-line/10">
                {PRIVILEGE_ROWS.map((row) => (
                  <li key={row.label} className="grid grid-cols-[1fr_54px_54px] items-center gap-1 px-2.5 py-1.5">
                    <p className="text-[10px] leading-snug text-muted">{row.label}</p>
                    <span className="flex justify-center">
                      {row.admin ? <Check size={12} className="text-ok" /> : <Minus size={12} className="text-muted/50" />}
                    </span>
                    <span className="flex justify-center">
                      {row.chp ? <Check size={12} className="text-ok" /> : <Minus size={12} className="text-danger/60" />}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="glass rounded-2xl p-3.5 sm:p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-brand/25 bg-brand/10 text-brand">
                <Activity size={17} />
              </span>
              <div>
                <p className="label-clinical">Device</p>
                <h2 className="text-sm font-semibold text-content">Runtime & audit</h2>
              </div>
              <span className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-clinical ${online ? 'border-ok/30 bg-ok/10 text-ok' : 'border-warn/30 bg-warn/10 text-warn'}`}>
                {online ? <Wifi size={9} /> : <CloudOff size={9} />} {online ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              {[
                ['Role', isAdmin ? 'Clinical Officer' : 'CHP'],
                ['Ward lighting', THEMES[theme].label],
                ['Shell', isNative ? 'Android APK' : isStandalone ? 'PWA' : 'Browser'],
                ['Schema', 'v2 · AfyaPulseDB'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-line/15 bg-surface/25 px-2 py-1.5">
                  <p className="text-[9px] uppercase tracking-clinical text-muted">{label}</p>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-content">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-2.5">
              <Toggle
                checked={haptics}
                onChange={(value) => {
                  setHaptics(value)
                  if (value) vibrateNow()
                }}
                label="Haptic feedback"
                description="Subtle confirmation pulses on save, dispense and triage."
              />
            </div>

            <div className="mt-2.5">
              <p className="label-clinical mb-1.5">Recent audit trail</p>
              {activity?.length ? (
                <ul className="space-y-1">
                  {activity.slice(0, 5).map((entry) => {
                    const Icon = ACTIVITY_ICONS[entry.kind] || Sparkles
                    return (
                      <li key={entry.id} className="flex items-start gap-2 rounded-lg border border-line/10 bg-surface/20 px-2 py-1.5">
                        <Icon size={11} className="mt-0.5 shrink-0 text-brand" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[10px] leading-snug text-content">{entry.message}</p>
                          <p className="text-[9px] text-muted">
                            {entry.actor} · {formatDateTime(entry.at)}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="rounded-lg border border-dashed border-line/20 px-2 py-2 text-[10px] text-muted">No activity recorded yet.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="grid gap-2.5 lg:grid-cols-[1.3fr_1fr]">
        <TrustNote>
          AfyaPulse is local-first: clinical records live in the device's IndexedDB and are never uploaded by this build. Export a
          backup before factory-resetting a phone, and keep paper registers running until the APK is signed and deployed.
        </TrustNote>
        <section className="glass rounded-2xl border-danger/20 p-3.5">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-danger/30 bg-danger/10 text-danger">
              <Trash2 size={15} />
            </span>
            <div>
              <p className="label-clinical !text-danger">Data controls</p>
              <p className="text-[11px] font-semibold text-content">{isAdmin ? 'Administrator only' : 'Restricted'}</p>
            </div>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn btn-secondary !py-2 !text-[10px]"
              disabled={!isAdmin}
              onClick={() => setConfirmAction('seed')}
            >
              <RefreshCw size={12} /> Reload demo clinic
            </button>
            <button
              type="button"
              className="btn btn-danger !py-2 !text-[10px]"
              disabled={!isAdmin}
              onClick={() => setConfirmAction('clear')}
            >
              <Trash2 size={12} /> Erase all data
            </button>
          </div>
          <p className="mt-1.5 text-[9px] leading-snug text-muted">
            Erasing is permanent on this device. Export a backup first.
          </p>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/10 pt-3 text-[10px] uppercase tracking-clinical text-muted">
        <span>AfyaPulse v1.0.0 · build {new Date().getFullYear()}.{String(new Date().getMonth() + 1).padStart(2, '0')}</span>
        <span className="flex items-center gap-1.5">
          <Info size={10} /> Demo data is fictional · Meru County network
        </span>
      </div>

      <DownloadAPKModal open={apkOpen} onClose={() => setApkOpen(false)} />
      <ConfirmDialog
        open={confirmAction === 'seed'}
        onClose={() => setConfirmAction(null)}
        onConfirm={runConfirmed}
        busy={busy}
        title="Reload the demo clinic?"
        description="This replaces the current register, follow-ups, referrals and dispensary with the seeded Meru County demo data. Your operator profile and theme are preserved."
        confirmLabel="Reload demo data"
        tone="primary"
      />
      <ConfirmDialog
        open={confirmAction === 'clear'}
        onClose={() => setConfirmAction(null)}
        onConfirm={runConfirmed}
        busy={busy}
        title="Erase all clinical data?"
        description="Every patient, vital sign, follow-up, referral and stock line on this device will be permanently deleted. Export a backup first if there is any chance the data is needed."
        confirmLabel="Erase everything"
      />
    </div>
  )
}

function vibrateNow() {
  try {
    navigator.vibrate?.([12, 40, 12])
  } catch {
    /* unsupported */
  }
}
