import React from 'react'
import { motion } from 'framer-motion'
import { Lock, ShieldCheck } from 'lucide-react'
import { TRIAGE } from '../../lib/triage'

const TONES = {
  ok: 'border-ok/30 bg-ok/10 text-ok',
  warn: 'border-warn/30 bg-warn/10 text-warn',
  danger: 'border-danger/30 bg-danger/10 text-danger',
  brand: 'border-brand/30 bg-brand/10 text-brand',
  accent: 'border-accent/30 bg-accent/10 text-accent',
  muted: 'border-line/25 bg-surface/40 text-muted',
}

export function GlassCard({ as = 'div', className = '', interactive = false, glow = false, children, ...props }) {
  const Component = motion[as] || motion.div
  return (
    <Component
      className={`glass rounded-2xl ${glow ? 'glass-outline' : ''} ${interactive ? 'glass-hover' : ''} ${className}`}
      {...props}
    >
      {children}
    </Component>
  )
}

export function SectionHeading({ eyebrow, title, description, icon: Icon, action, className = '' }) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="flex items-start gap-3">
        {Icon ? (
          <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand/25 bg-brand/10 text-brand shadow-glow-sm">
            <Icon size={18} strokeWidth={2.1} />
          </span>
        ) : null}
        <div>
          {eyebrow ? <p className="label-clinical mb-1">{eyebrow}</p> : null}
          <h1 className="text-xl font-semibold leading-tight text-content sm:text-2xl">{title}</h1>
          {description ? <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted sm:text-sm">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  )
}

export function Badge({ tone = 'muted', children, icon: Icon, className = '', dot = false }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-clinical ${TONES[tone] || TONES.muted} ${className}`}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" /> : null}
      {Icon ? <Icon size={11} strokeWidth={2.4} /> : null}
      {children}
    </span>
  )
}

export function TriageBadge({ level = 'normal', size = 'sm', withDot = true }) {
  const meta = TRIAGE[level] || TRIAGE.normal
  const padding = size === 'lg' ? 'px-3 py-1.5 text-[11px]' : 'px-2.5 py-1 text-[10px]'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-clinical ${padding} ${TONES[meta.tone] || TONES.muted}`}
    >
      {withDot ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      ) : null}
      {meta.label}
    </span>
  )
}

export function ProgressBar({ value = 0, tone = 'brand', height = 'h-1.5', label, className = '' }) {
  const tones = {
    brand: 'bg-brand',
    ok: 'bg-ok',
    warn: 'bg-warn',
    danger: 'bg-danger',
    accent: 'bg-accent',
  }
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className={className}>
      <div className={`w-full overflow-hidden rounded-full bg-surface/70 ${height}`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className={`h-full rounded-full ${tones[tone] || tones.brand}`}
          style={{ boxShadow: '0 0 12px -2px currentColor' }}
        />
      </div>
      {label ? <p className="mt-1.5 text-[10px] font-medium uppercase tracking-clinical text-muted">{label}</p> : null}
    </div>
  )
}

export function StatTile({ label, value, hint, icon: Icon, tone = 'brand', trend, onClick, active = false }) {
  const toneText = {
    brand: 'text-brand',
    ok: 'text-ok',
    warn: 'text-warn',
    danger: 'text-danger',
    accent: 'text-accent',
    muted: 'text-muted',
  }
  const Component = onClick ? motion.button : motion.div
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      whileTap={onClick ? { scale: 0.985 } : undefined}
      whileHover={onClick ? { y: -2 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`glass glass-hover group relative overflow-hidden rounded-2xl p-3.5 text-left sm:p-4 ${
        active ? 'border-brand/45 ring-1 ring-brand/25' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="label-clinical leading-tight">{label}</p>
        {Icon ? (
          <span className={`rounded-lg border border-line/20 bg-surface/50 p-1.5 ${toneText[tone]}`}>
            <Icon size={14} strokeWidth={2.2} />
          </span>
        ) : null}
      </div>
      <p className={`metric mt-2 text-2xl font-semibold leading-none sm:text-[28px] ${toneText[tone]}`}>{value}</p>
      {hint ? <p className="mt-1.5 text-[11px] leading-snug text-muted">{hint}</p> : null}
      {trend ? <div className="mt-2">{trend}</div> : null}
      <span className="pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full bg-brand/10 blur-2xl transition-opacity duration-500 group-hover:opacity-100 sm:opacity-0" />
    </Component>
  )
}

export function Segmented({ options, value, onChange, size = 'md', className = '' }) {
  return (
    <div
      className={`inline-flex w-full items-center gap-1 rounded-xl border border-line/20 bg-surface/40 p-1 backdrop-blur-xl sm:w-auto ${className}`}
      role="tablist"
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 font-semibold transition-colors sm:flex-none ${
              size === 'sm' ? 'py-1.5 text-[11px]' : 'py-2 text-xs'
            } ${active ? 'text-canvas' : 'text-muted hover:text-content'}`}
          >
            {active ? (
              <motion.span
                layoutId={`segment-${options.map((o) => o.value).join('-')}`}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="absolute inset-0 rounded-lg bg-gradient-to-br from-brand to-accent shadow-glow-sm"
              />
            ) : null}
            {option.icon ? <option.icon size={13} strokeWidth={2.3} className="relative z-10" /> : null}
            <span className="relative z-10">{option.label}</span>
            {option.count !== undefined ? (
              <span
                className={`relative z-10 rounded-md px-1 py-0.5 text-[10px] tabular-nums ${
                  active ? 'bg-canvas/20' : 'bg-surface/70 text-muted'
                }`}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`glass flex flex-col items-center justify-center rounded-2xl px-6 py-12 text-center ${className}`}>
      {Icon ? (
        <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-line/20 bg-surface/50 text-brand">
          <Icon size={22} strokeWidth={1.9} />
        </span>
      ) : null}
      <p className="text-sm font-semibold text-content">{title}</p>
      {description ? <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function Avatar({ initials, tone = 'brand', size = 'md', ring = false }) {
  const tones = {
    brand: 'from-brand/25 to-accent/15 text-brand border-brand/30',
    danger: 'from-danger/25 to-danger/5 text-danger border-danger/35',
    warn: 'from-warn/25 to-warn/5 text-warn border-warn/35',
    ok: 'from-ok/25 to-ok/5 text-ok border-ok/35',
    muted: 'from-surface/60 to-surface/30 text-muted border-line/25',
  }
  const sizes = {
    sm: 'h-8 w-8 text-[10px]',
    md: 'h-10 w-10 text-xs',
    lg: 'h-12 w-12 text-sm',
  }
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-xl border bg-gradient-to-br font-semibold tracking-wide ${tones[tone] || tones.brand} ${sizes[size]} ${
        ring ? 'ring-2 ring-brand/20 ring-offset-2 ring-offset-canvas' : ''
      }`}
    >
      {initials}
    </span>
  )
}

export function AdminLock({ label = 'Clinical Officer required', compact = false }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border border-line/25 bg-surface/50 text-muted ${
        compact ? 'px-1.5 py-1 text-[9px]' : 'px-2 py-1 text-[10px]'
      } font-semibold uppercase tracking-clinical`}
      title={label}
    >
      <Lock size={compact ? 10 : 11} strokeWidth={2.3} />
      {label}
    </span>
  )
}

export function TrustNote({ children, className = '' }) {
  return (
    <div className={`flex items-start gap-2 rounded-xl border border-brand/20 bg-brand/5 px-3 py-2.5 ${className}`}>
      <ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand" />
      <p className="text-[11px] leading-relaxed text-muted">{children}</p>
    </div>
  )
}
