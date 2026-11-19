import React from 'react'
import { AlertCircle, Check } from 'lucide-react'

export function Field({ label, htmlFor, error, hint, required, className = '', children, trailing }) {
  return (
    <div className={className}>
      {label ? (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label htmlFor={htmlFor} className="label-clinical flex items-center gap-1">
            {label}
            {required ? <span className="text-danger">*</span> : null}
          </label>
          {trailing}
        </div>
      ) : null}
      {children}
      {error ? (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-danger">
          <AlertCircle size={11} /> {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-[11px] leading-snug text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

export function TextInput({ className = '', invalid = false, ...props }) {
  return <input className={`field ${invalid ? '!border-danger/60' : ''} ${className}`} {...props} />
}

export function NumberInput({ unit, hintTone, className = '', suffix, ...props }) {
  const toneClass =
    hintTone === 'danger' ? 'text-danger' : hintTone === 'warn' ? 'text-warn' : hintTone === 'ok' ? 'text-ok' : 'text-muted'
  return (
    <div className="relative">
      <input
        type="number"
        inputMode="decimal"
        className={`field pr-16 ${className}`}
        {...props}
      />
      {(suffix || unit) && (
        <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-clinical ${toneClass}`}>
          {suffix || unit}
        </span>
      )}
    </div>
  )
}

export function Select({ className = '', children, ...props }) {
  return (
    <div className="relative">
      <select className={`field appearance-none pr-9 ${className}`} {...props}>
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
      >
        <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  )
}

export function TextArea({ className = '', rows = 3, ...props }) {
  return <textarea rows={rows} className={`field resize-none ${className}`} {...props} />
}

export function Toggle({ checked, onChange, label, description, disabled = false }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      aria-pressed={checked}
      className={`flex w-full items-center justify-between gap-4 rounded-xl border border-line/20 bg-surface/40 px-3.5 py-3 text-left transition-colors ${
        disabled ? 'opacity-50' : 'hover:border-brand/35'
      }`}
    >
      <span>
        <span className="block text-xs font-semibold text-content">{label}</span>
        {description ? <span className="mt-0.5 block text-[11px] leading-snug text-muted">{description}</span> : null}
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-300 ${
          checked ? 'border-brand/50 bg-brand/70' : 'border-line/30 bg-surface/80'
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-300 ${
            checked ? 'translate-x-[1.15rem]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}

export function OptionChips({ options, values = [], onToggle, multi = true, className = '' }) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {options.map((option) => {
        const value = typeof option === 'string' ? option : option.value
        const label = typeof option === 'string' ? option : option.label
        const active = multi ? values.includes(value) : values === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => onToggle(value)}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all duration-200 ${
              active
                ? 'border-brand/50 bg-brand/15 text-brand'
                : 'border-line/20 bg-surface/30 text-muted hover:border-brand/30 hover:text-content'
            }`}
          >
            {active ? <Check size={10} strokeWidth={3} /> : null}
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function SubmitRow({ onCancel, submitLabel = 'Save', busy = false, disabled = false, hint, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-xs text-[11px] leading-snug text-muted">{hint}</p>
      <div className="flex items-center gap-2">
        {children}
        {onCancel ? (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="btn btn-primary" disabled={busy || disabled}>
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </div>
  )
}
