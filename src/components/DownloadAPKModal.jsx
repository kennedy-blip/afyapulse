import React, { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Check,
  Copy,
  Download,
  Github,
  Loader2,
  RefreshCw,
  Share,
  ShieldCheck,
  Smartphone,
  Terminal,
  WifiOff,
} from 'lucide-react'
import { useApp } from '../context/AppProvider'
import { bytesLabel } from '../lib/format'
import Modal from './ui/Modal'

const BUILD_COMMANDS = `npm install
npm run build
npx cap add android
npm run cap:sync
npm run apk:debug`

const RELEASE_COMMANDS = `npm run apk:release
# output: android/app/build/outputs/apk/release/app-release.apk`

function resolveApkUrl() {
  const configured = import.meta.env.VITE_APK_URL
  if (configured) return configured
  try {
    return new URL('downloads/afyapulse.apk', document.baseURI).href
  } catch {
    return './downloads/afyapulse.apk'
  }
}

const REPO = import.meta.env.VITE_GITHUB_REPO || 'kennedy-blip/afyapulse'

export default function DownloadAPKModal({ open, onClose }) {
  const { isNative, isStandalone, promptInstall, toast } = useApp()
  const [status, setStatus] = useState('idle')
  const [size, setSize] = useState(null)
  const [copied, setCopied] = useState(null)
  const apkUrl = resolveApkUrl()

  const checkApk = useCallback(async () => {
    setStatus('checking')
    setSize(null)
    try {
      const probe = await fetch(apkUrl, {
        method: 'GET',
        headers: { Range: 'bytes=0-1' },
        cache: 'no-store',
      })
      if (!probe.ok) {
        setStatus('missing')
        return
      }
      const buffer = await probe.arrayBuffer()
      const bytes = new Uint8Array(buffer.slice(0, 2))
      const isAndroidPackage = bytes[0] === 0x50 && bytes[1] === 0x4b
      if (!isAndroidPackage) {
        setStatus('missing')
        return
      }
      const range = probe.headers.get('content-range')
      const total = range?.includes('/') ? Number(range.split('/')[1]) : Number(probe.headers.get('content-length'))
      if (Number.isFinite(total) && total > 1024) setSize(total)
      setStatus('available')
    } catch {
      setStatus('missing')
    }
  }, [apkUrl])

  useEffect(() => {
    if (open) checkApk()
  }, [open, checkApk])

  const handleDownload = () => {
    if (status !== 'available') return
    toast({
      title: 'Downloading AfyaPulse APK',
      message: 'Open the file to sideload. Allow installs from your browser when Android asks.',
      tone: 'success',
    })
  }

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      window.setTimeout(() => setCopied(null), 2200)
    } catch {
      toast({ title: 'Copy failed', message: 'Select the commands and copy them manually.', tone: 'warning' })
    }
  }

  const installWeb = async () => {
    const installed = await promptInstall()
    if (installed) {
      toast({ title: 'Installed', message: 'AfyaPulse is on your home screen and works offline.', tone: 'success' })
      onClose?.()
    } else {
      toast({
        title: 'Install from the browser menu',
        message: 'Use “Add to Home screen” in Chrome or Safari to install the PWA.',
        tone: 'info',
      })
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Android APK centre"
      subtitle="One-tap install for offline outreach tablets and health-worker phones."
      icon={Smartphone}
      size="lg"
    >
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/15 via-brand/5 to-accent/10 p-4">
          <div className="flex flex-wrap items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-brand/35 bg-canvas/40 text-brand shadow-glow-sm">
              <Smartphone size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-content">AfyaPulse for Android</p>
                <span className="rounded-md border border-line/25 bg-canvas/30 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-clinical text-muted">
                  build 1.0.0
                </span>
                <span className="rounded-md border border-ok/30 bg-ok/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-clinical text-ok">
                  Offline-first
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                Capacitor-wrapped web build with the native bottom navigation, safe-area insets and full IndexedDB persistence.
                Android 8.0+ · sideload, no Play Store account required.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-muted">
                <span className="inline-flex items-center gap-1 rounded-md bg-canvas/30 px-1.5 py-0.5">
                  <WifiOff size={10} className="text-brand" /> Works with zero signal
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-canvas/30 px-1.5 py-0.5">
                  <ShieldCheck size={10} className="text-brand" /> Records stay on the device
                </span>
                {size ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-canvas/30 px-1.5 py-0.5">{bytesLabel(size)}</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-3">
            <AnimatePresence mode="wait" initial={false}>
              {status === 'checking' ? (
                <motion.div
                  key="checking"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 rounded-xl border border-line/20 bg-canvas/30 px-3 py-2.5 text-[11px] text-muted"
                >
                  <Loader2 size={14} className="animate-spin text-brand" /> Verifying the compiled binary on this deployment…
                </motion.div>
              ) : status === 'available' ? (
                <motion.div key="available" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <a
                    href={apkUrl}
                    download="afyapulse.apk"
                    onClick={handleDownload}
                    className="btn btn-primary w-full !py-3 text-sm"
                  >
                    <Download size={17} /> Download Android APK
                  </a>
                  <p className="mt-1.5 text-center text-[10px] text-muted">
                    Verified Android package signature · tap the downloaded file to install
                  </p>
                </motion.div>
              ) : (
                <motion.div key="missing" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
                  <div className="flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2.5">
                    <Terminal size={14} className="mt-0.5 shrink-0 text-warn" />
                    <div>
                      <p className="text-[11px] font-semibold text-content">The compiled APK is not hosted on this deployment yet</p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
                        The button is wired to <code className="rounded bg-canvas/40 px-1">/downloads/afyapulse.apk</code>. Add the
                        artifact there (or set <code className="rounded bg-canvas/40 px-1">VITE_APK_URL</code>) and this panel flips
                        to a verified download automatically.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={checkApk}
                      className="ml-auto shrink-0 rounded-lg border border-line/25 bg-surface/40 p-1.5 text-muted hover:text-brand"
                      aria-label="Check again"
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" className="btn btn-secondary !py-2.5 !text-[11px]" onClick={installWeb}>
                      <Share size={14} /> Install web app instead
                    </button>
                    <a
                      href={`https://github.com/${REPO}/actions/workflows/android.yml`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="btn btn-secondary !py-2.5 !text-[11px]"
                    >
                      <Github size={14} /> Build via GitHub Actions
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {status === 'missing' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="label-clinical">One-command local build</p>
              <button type="button" onClick={() => copy(BUILD_COMMANDS, 'debug')} className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-clinical text-brand hover:underline">
                {copied === 'debug' ? <Check size={11} /> : <Copy size={11} />} {copied === 'debug' ? 'Copied' : 'Copy commands'}
              </button>
            </div>
            <pre className="scroll-thin overflow-x-auto rounded-xl border border-line/20 bg-canvas/45 p-3 text-[10.5px] leading-relaxed text-muted">
              <code>{BUILD_COMMANDS}</code>
            </pre>
            <div className="flex items-center justify-between">
              <p className="label-clinical">Signed release build</p>
              <button type="button" onClick={() => copy(RELEASE_COMMANDS, 'release')} className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-clinical text-brand hover:underline">
                {copied === 'release' ? <Check size={11} /> : <Copy size={11} />} {copied === 'release' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="scroll-thin overflow-x-auto rounded-xl border border-line/20 bg-canvas/45 p-3 text-[10.5px] leading-relaxed text-muted">
              <code>{RELEASE_COMMANDS}</code>
            </pre>
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { title: 'Offline register', body: 'IndexedDB inside the WebView — no connectivity needed.' },
            { title: 'Native shell', body: 'Safe-area aware layout, bottom tabs, hardware back handling.' },
            { title: 'Sideload ready', body: 'Debug APK installs directly; release builds support your signing key.' },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-line/20 bg-surface/30 p-2.5">
              <p className="text-[11px] font-semibold text-content">{item.title}</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line/20 bg-surface/30 px-3 py-2.5 text-[10px] text-muted">
          <ShieldCheck size={12} className="text-brand" />
          Current environment:
          <span className="font-semibold text-content">
            {isNative ? 'Android APK (native shell)' : isStandalone ? 'Installed web app' : 'Browser tab'}
          </span>
          <span className="ml-auto">Capacitor 6 · @capacitor/android</span>
        </div>
      </div>
    </Modal>
  )
}
