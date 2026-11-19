import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, AlertTriangle, Check, HeartPulse, Thermometer } from 'lucide-react'
import { assessVitals, DANGER_SIGNS, readingHint, TRIAGE } from '../../lib/triage'
import { recordVitals } from '../../db/repo'
import { useApp } from '../../context/AppProvider'
import { fullName, patientAge } from '../../lib/format'
import Modal from '../ui/Modal'
import { Field, NumberInput, TextArea, SubmitRow } from '../ui/Fields'
import { TriageBadge } from '../ui/Primitives'

const FIELDS = [
  { key: 'systolic', label: 'Systolic', unit: 'mmHg', placeholder: '120', min: 40, max: 300 },
  { key: 'diastolic', label: 'Diastolic', unit: 'mmHg', placeholder: '80', min: 20, max: 200 },
  { key: 'temperature', label: 'Temperature', unit: '°C', placeholder: '36.8', step: '0.1', min: 30, max: 45 },
  { key: 'pulse', label: 'Pulse', unit: 'bpm', placeholder: '78', min: 20, max: 240 },
  { key: 'spo2', label: 'SpO₂', unit: '%', placeholder: '98', min: 50, max: 100 },
  { key: 'respRate', label: 'Respiratory rate', unit: '/min', placeholder: '18', min: 5, max: 90 },
  { key: 'weight', label: 'Weight', unit: 'kg', placeholder: '62', step: '0.1', min: 1, max: 300 },
  { key: 'height', label: 'Height', unit: 'cm', placeholder: '165', min: 30, max: 230 },
  { key: 'muac', label: 'MUAC', unit: 'cm', placeholder: '24.5', step: '0.1', min: 5, max: 40 },
]

const EMPTY = {
  systolic: '',
  diastolic: '',
  temperature: '',
  pulse: '',
  spo2: '',
  respRate: '',
  weight: '',
  height: '',
  muac: '',
  dangerSigns: [],
  notes: '',
}

export default function VitalsForm({ open, onClose, patient }) {
  const { profile, toast, buzz } = useApp()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(EMPTY)
      setErrors({})
      setSaved(false)
    }
  }, [open, patient?.id])

  const patientAgeMonths = (Number(patient?.ageYears) || 0) * 12 + (Number(patient?.ageMonths) || 0)
  const isChild = patientAgeMonths < 60 && (patientAgeMonths > 0 || patient?.category === 'child')

  const preview = useMemo(() => assessVitals(form, patient || {}), [form, patient])
  const hasAnyReading = FIELDS.some((field) => form[field.key] !== '')
  const meta = TRIAGE[preview.level]

  const update = (key) => (event) => {
    const value = event.target.value
    setForm((current) => ({ ...current, [key]: value }))
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const toggleDanger = (id) => {
    setForm((current) => ({
      ...current,
      dangerSigns: current.dangerSigns.includes(id)
        ? current.dangerSigns.filter((sign) => sign !== id)
        : [...current.dangerSigns, id],
    }))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!patient) return
    if (!hasAnyReading && form.dangerSigns.length === 0) {
      setErrors({ form: 'Record at least one vital sign or mark a danger sign.' })
      return
    }
    const badRange = FIELDS.find((field) => {
      const raw = form[field.key]
      if (raw === '') return false
      const n = Number(raw)
      return !Number.isFinite(n) || n < field.min || n > field.max
    })
    if (badRange) {
      setErrors({ [badRange.key]: `Enter a value between ${badRange.min} and ${badRange.max} ${badRange.unit}.` })
      return
    }

    setBusy(true)
    try {
      const result = await recordVitals(patient.id, form, profile)
      const level = result.assessment.level
      toast({
        title: level === 'urgent' ? 'Urgent referral raised' : 'Vitals saved',
        message:
          level === 'urgent'
            ? `${fullName(patient)} is flagged URGENT. A referral is waiting for clinical approval.`
            : `${fullName(patient)} · ${result.assessment.summary}`,
        tone: level === 'urgent' ? 'error' : level === 'caution' ? 'warning' : 'success',
      })
      buzz(level === 'urgent' ? [40, 60, 40] : 18)
      setSaved(true)
      window.setTimeout(() => onClose?.(), 950)
    } catch (error) {
      toast({ title: 'Could not save vitals', message: error.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      onSubmit={submit}
      open={open}
      onClose={onClose}
      title="Record vitals"
      subtitle={patient ? `${fullName(patient)} · ${patient.code} · ${patientAge(patient)} · ${patient.ward || 'No ward'}` : ''}
      icon={HeartPulse}
      size="lg"
      footer={
        <SubmitRow
          onCancel={onClose}
          submitLabel="Save vitals & triage"
          busy={busy}
          hint="Bands are calculated on-device against age-specific thresholds."
        />
      }
    >
      <div className="space-y-5">
        <div
          className={`relative overflow-hidden rounded-2xl border px-4 py-3.5 ${
            preview.level === 'urgent'
              ? 'border-danger/40 bg-danger/10'
              : preview.level === 'caution'
                ? 'border-warn/40 bg-warn/10'
                : 'border-brand/30 bg-brand/5'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line/25 bg-surface/50">
                <span
                  className={`absolute inset-0 rounded-xl ${
                    preview.level === 'urgent'
                      ? 'bg-danger/15 text-danger'
                      : preview.level === 'caution'
                        ? 'bg-warn/15 text-warn'
                        : 'bg-brand/15 text-brand'
                  }`}
                />
                <HeartPulse
                  size={16}
                  className={`relative ${
                    preview.level === 'urgent' ? 'text-danger' : preview.level === 'caution' ? 'text-warn' : 'text-brand'
                  }`}
                />
              </span>
              <div>
                <p className="label-clinical">Live triage preview</p>
                <p className="mt-0.5 text-sm font-semibold text-content">
                  {hasAnyReading || form.dangerSigns.length ? meta.label : 'Waiting for readings'}
                </p>
              </div>
            </div>
            <TriageBadge level={preview.level} size="lg" />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            {hasAnyReading || form.dangerSigns.length
              ? preview.summary
              : 'Enter BP, temperature, pulse, SpO₂ or MUAC — the badge updates as you type.'}
          </p>
          {preview.flags.length ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {preview.flags.map((flag) => (
                <span
                  key={`${flag.label}-${flag.detail}`}
                  className={`rounded-md border px-2 py-1 text-[10px] font-medium ${
                    flag.severity === 'urgent'
                      ? 'border-danger/35 bg-danger/10 text-danger'
                      : 'border-warn/35 bg-warn/10 text-warn'
                  }`}
                >
                  {flag.label} · {flag.detail}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <Activity size={14} className="text-brand" />
            <p className="label-clinical">Vital signs</p>
            <span className="ml-auto text-[10px] text-muted">{isChild ? 'Under-5 thresholds active' : 'Adult thresholds'}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {FIELDS.map((field) => {
              const hint = readingHint(field.key, form[field.key], patient || {})
              return (
                <Field key={field.key} label={field.label} htmlFor={`vital-${field.key}`} error={errors[field.key]}>
                  <NumberInput
                    id={`vital-${field.key}`}
                    value={form[field.key] ?? ''}
                    onChange={update(field.key)}
                    placeholder={field.placeholder}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    suffix={field.unit}
                    hintTone={hint?.tone}
                  />
                  {hint ? (
                    <p
                      className={`mt-1 text-[10px] font-semibold uppercase tracking-clinical ${
                        hint.tone === 'danger' ? 'text-danger' : hint.tone === 'warn' ? 'text-warn' : 'text-ok'
                      }`}
                    >
                      {hint.text}
                    </p>
                  ) : null}
                </Field>
              )
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle size={14} className="text-warn" />
            <p className="label-clinical">Danger signs (IMCI)</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DANGER_SIGNS.filter((sign) => sign.scope === 'any' || isChild).map((sign) => {
              const active = form.dangerSigns.includes(sign.id)
              return (
                <button
                  key={sign.id}
                  type="button"
                  onClick={() => toggleDanger(sign.id)}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                    active
                      ? 'border-danger/50 bg-danger/15 text-danger'
                      : 'border-line/20 bg-surface/30 text-muted hover:border-danger/30 hover:text-content'
                  }`}
                >
                  {sign.label}
                </button>
              )
            })}
          </div>
        </div>

        <Field label="Clinical notes" htmlFor="vitals-notes" error={errors.form}>
          <TextArea
            id="vitals-notes"
            rows={2}
            value={form.notes}
            onChange={update('notes')}
            placeholder="Symptoms, treatment given or referral rationale…"
          />
        </Field>

        {preview.level === 'urgent' ? (
          <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5">
            <Thermometer size={15} className="mt-0.5 shrink-0 text-danger" />
            <p className="text-[11px] leading-relaxed text-danger/90">
              Saving will raise an urgent referral for clinical approval and flag this patient red across the register.
            </p>
          </div>
        ) : null}
      </div>

        <AnimatePresence>
          {saved ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-3xl bg-canvas/60 backdrop-blur-md"
            >
              <div className="flex flex-col items-center">
                <div className="relative grid place-items-center">
                  <motion.span
                    initial={{ scale: 0.7, opacity: 0.8 }}
                    animate={{ scale: 2.4, opacity: 0 }}
                    transition={{ duration: 1.1, ease: 'easeOut' }}
                    className="absolute h-20 w-20 rounded-full border-2 border-brand"
                  />
                  <motion.span
                    initial={{ scale: 0.7, opacity: 0.8 }}
                    animate={{ scale: 1.9, opacity: 0 }}
                    transition={{ duration: 1.1, ease: 'easeOut', delay: 0.15 }}
                    className="absolute h-20 w-20 rounded-full border border-accent"
                  />
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="grid h-20 w-20 place-items-center rounded-2xl border border-brand/40 bg-brand/15 text-brand shadow-glow"
                  >
                    <Check size={34} strokeWidth={2.6} />
                  </motion.div>
                </div>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mt-5 text-[11px] font-semibold uppercase tracking-clinical text-brand"
                >
                  Vitals saved offline
                </motion.p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
    </Modal>
  )
}
