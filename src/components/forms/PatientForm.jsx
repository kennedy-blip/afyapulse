import React, { useEffect, useMemo, useState } from 'react'
import { Activity, Baby, HeartPulse, Info, Sparkles, UserPlus } from 'lucide-react'
import { SYMPTOMS, DANGER_SIGNS } from '../../lib/triage'
import { createPatient, updatePatient } from '../../db/repo'
import { useApp } from '../../context/AppProvider'
import { addDays, formatDate, todayISO } from '../../lib/dates'
import { fullName } from '../../lib/format'
import Modal from '../ui/Modal'
import { Field, NumberInput, OptionChips, Select, SubmitRow, TextInput } from '../ui/Fields'
import { Toggle } from '../ui/Fields'

const WARDS = [
  'Nkubu',
  'Kanyakine',
  'Igoji',
  'Maua',
  'Timau',
  'Mitunguu',
  'Kibirichia',
  'Kianjai',
  'Mikumbune',
  'Giaki',
  'Kaaga',
  'Nkubu Market',
]

const CATEGORIES = [
  { value: 'general', label: 'General', icon: HeartPulse },
  { value: 'anc', label: 'ANC', icon: Activity },
  { value: 'child', label: 'Under-5', icon: Baby },
  { value: 'chronic', label: 'Chronic', icon: Info },
]

const EMPTY_VITALS = {
  systolic: '',
  diastolic: '',
  temperature: '',
  pulse: '',
  weight: '',
  height: '',
  spo2: '',
  respRate: '',
  muac: '',
}

const EMPTY = {
  firstName: '',
  lastName: '',
  sex: 'F',
  ageYears: '',
  ageMonths: '',
  birthDate: '',
  phone: '',
  ward: '',
  village: '',
  category: 'general',
  gestationWeeks: '',
  edd: '',
  gravida: '',
  para: '',
  allergies: '',
  symptoms: [],
  notes: '',
}

export default function PatientForm({ open, onClose, patient = null }) {
  const { profile, toast, buzz, isAdmin } = useApp()
  const editing = Boolean(patient?.id)
  const [form, setForm] = useState(EMPTY)
  const [vitals, setVitals] = useState(EMPTY_VITALS)
  const [dangerSigns, setDangerSigns] = useState([])
  const [captureVitals, setCaptureVitals] = useState(false)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setVitals(EMPTY_VITALS)
    setDangerSigns([])
    setCaptureVitals(false)
    if (patient) {
      setForm({
        ...EMPTY,
        firstName: patient.firstName || '',
        lastName: patient.lastName || '',
        sex: patient.sex || 'F',
        ageYears: patient.ageYears ?? '',
        ageMonths: patient.ageMonths ?? '',
        birthDate: patient.birthDate || '',
        phone: patient.phone || '',
        ward: patient.ward || '',
        village: patient.village || '',
        category: patient.category || 'general',
        gestationWeeks: patient.gestationWeeks ?? '',
        edd: patient.edd || '',
        gravida: patient.gravida ?? '',
        para: patient.para ?? '',
        allergies: patient.allergies || '',
        symptoms: patient.symptoms || [],
        notes: patient.notes || '',
      })
    } else {
      setForm(EMPTY)
    }
  }, [open, patient])

  const update = (key) => (event) => {
    const value = event.target.value
    setForm((current) => ({ ...current, [key]: value }))
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const updateVital = (key) => (event) => setVitals((current) => ({ ...current, [key]: event.target.value }))

  const handleBirthDate = (event) => {
    const iso = event.target.value
    if (!iso) {
      setForm((current) => ({ ...current, birthDate: '' }))
      return
    }
    const birth = new Date(`${iso}T00:00:00`)
    const now = new Date()
    let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
    if (now.getDate() < birth.getDate()) months -= 1
    months = Math.max(0, months)
    setForm((current) => ({
      ...current,
      birthDate: iso,
      ageYears: Math.floor(months / 12),
      ageMonths: months % 12,
      category: months < 60 ? 'child' : current.category,
    }))
  }

  const handleGestation = (event) => {
    const weeks = event.target.value
    const numeric = Number(weeks)
    setForm((current) => ({
      ...current,
      gestationWeeks: weeks,
      edd: numeric >= 4 && numeric <= 42 ? addDays(todayISO(), Math.round((40 - numeric) * 7)) : current.edd,
    }))
  }

  const toggleSymptom = (symptom) => {
    setForm((current) => ({
      ...current,
      symptoms: current.symptoms.includes(symptom)
        ? current.symptoms.filter((item) => item !== symptom)
        : [...current.symptoms, symptom],
    }))
  }

  const toggleDanger = (id) => {
    setDangerSigns((current) => (current.includes(id) ? current.filter((sign) => sign !== id) : [...current, id]))
  }

  const planHint = useMemo(() => {
    if (form.category === 'child') return 'The full Kenya EPI schedule will be generated from the birth date.'
    if (form.category === 'anc') return 'WHO ANC contacts 1–8 will be generated from the estimated delivery date.'
    if (form.category === 'chronic') return 'Monthly chronic-care reviews will be added to the outreach queue.'
    return 'No automatic follow-ups for general visits — schedule one manually if needed.'
  }, [form.category])

  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!form.firstName.trim()) nextErrors.firstName = 'First name is required.'
    if (!form.lastName.trim()) nextErrors.lastName = 'Surname is required.'
    if (!form.ward.trim()) nextErrors.ward = 'Select the ward or outreach site.'
    const years = Number(form.ageYears) || 0
    const months = Number(form.ageMonths) || 0
    if (!form.birthDate && years === 0 && months === 0) {
      nextErrors.ageYears = 'Enter an age (0 years + months for infants).'
    }
    if (form.category === 'anc') {
      const weeks = Number(form.gestationWeeks)
      if (!weeks && !form.edd) nextErrors.gestationWeeks = 'Record gestation or the expected delivery date.'
      else if (weeks && (weeks < 4 || weeks > 42)) nextErrors.gestationWeeks = 'Gestation must be 4–42 weeks.'
    }
    if (form.phone && !/^[+0-9 ()-]{7,16}$/.test(form.phone)) nextErrors.phone = 'Use digits, spaces or +254 format.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setBusy(true)
    try {
      if (editing) {
        await updatePatient(patient.id, form, profile)
        toast({ title: 'Record updated', message: `${fullName(form)} saved offline.`, tone: 'success' })
        buzz(16)
      } else {
        const hasVitals = captureVitals && Object.values(vitals).some((value) => value !== '')
        const result = await createPatient(
          form,
          profile,
          hasVitals || dangerSigns.length ? { ...vitals, dangerSigns } : null,
        )
        toast({
          title: `${result.code} registered`,
          message:
            result.planCount > 0
              ? `${fullName(form)} added · ${result.planCount} follow-up${result.planCount === 1 ? '' : 's'} auto-scheduled.`
              : `${fullName(form)} added to the local register.`,
          tone: 'success',
        })
        buzz([12, 40, 12])
      }
      onClose?.()
    } catch (error) {
      toast({ title: editing ? 'Could not update' : 'Could not register', message: error.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const isMinor = form.category === 'child' || Number(form.ageYears) < 5

  return (
    <Modal
      onSubmit={submit}
      open={open}
      onClose={onClose}
      title={editing ? 'Edit patient record' : 'Register patient'}
      subtitle={
        editing
          ? `${fullName(patient)} · ${patient.code} — changes stay on this device.`
          : 'Intake works fully offline. A unique clinic number is issued on save.'
      }
      icon={editing ? Activity : UserPlus}
      size="lg"
      footer={
        <SubmitRow
          onCancel={onClose}
          submitLabel={editing ? 'Save changes' : 'Register & triage'}
          busy={busy}
          hint={planHint}
        />
      }
    >
      <div className="space-y-5">
        <Section title="Identity" icon={UserPlus}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="First name" htmlFor="firstName" error={errors.firstName} required>
              <TextInput id="firstName" value={form.firstName} onChange={update('firstName')} placeholder="Amina" autoFocus />
            </Field>
            <Field label="Surname" htmlFor="lastName" error={errors.lastName} required>
              <TextInput id="lastName" value={form.lastName} onChange={update('lastName')} placeholder="Mwende" />
            </Field>
            <Field label="Sex" htmlFor="sex" required>
              <Select id="sex" value={form.sex} onChange={update('sex')}>
                <option value="F">Female</option>
                <option value="M">Male</option>
                <option value="U">Unspecified</option>
              </Select>
            </Field>
            <Field label="Phone" htmlFor="phone" error={errors.phone} hint="Used for follow-up SMS when available.">
              <TextInput id="phone" value={form.phone} onChange={update('phone')} placeholder="07XX XXX XXX" inputMode="tel" />
            </Field>
          </div>
        </Section>

        <Section title="Age & location" icon={Info}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Years" htmlFor="ageYears" error={errors.ageYears}>
              <NumberInput id="ageYears" value={form.ageYears} onChange={update('ageYears')} placeholder="24" min={0} max={120} suffix="yrs" />
            </Field>
            <Field label="Months" htmlFor="ageMonths" hint="For infants">
              <NumberInput id="ageMonths" value={form.ageMonths} onChange={update('ageMonths')} placeholder="0" min={0} max={11} suffix="mo" />
            </Field>
            <Field label="Birth date" htmlFor="birthDate" hint="Improves EPI accuracy" className="col-span-2">
              <TextInput id="birthDate" type="date" value={form.birthDate} onChange={handleBirthDate} max={todayISO()} />
            </Field>
            <Field label="Ward / site" htmlFor="ward" error={errors.ward} required className="col-span-2">
              <TextInput id="ward" list="ward-options" value={form.ward} onChange={update('ward')} placeholder="Nkubu" />
              <datalist id="ward-options">
                {WARDS.map((ward) => (
                  <option key={ward} value={ward} />
                ))}
              </datalist>
            </Field>
            <Field label="Village / household" htmlFor="village" className="col-span-2">
              <TextInput id="village" value={form.village} onChange={update('village')} placeholder="Kithure" />
            </Field>
          </div>
        </Section>

        <Section title="Care pathway" icon={Sparkles}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CATEGORIES.map((category) => {
              const active = form.category === category.value
              const Icon = category.icon
              return (
                <button
                  key={category.value}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, category: category.value }))}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-all ${
                    active
                      ? 'border-brand/50 bg-brand/15 text-brand shadow-glow-sm'
                      : 'border-line/20 bg-surface/30 text-muted hover:border-brand/30 hover:text-content'
                  }`}
                >
                  <Icon size={14} />
                  {category.label}
                </button>
              )
            })}
          </div>
          <div className="mt-3 rounded-xl border border-line/15 bg-surface/25 px-3 py-2">
            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted">
              <Sparkles size={13} className="mt-0.5 shrink-0 text-brand" />
              {planHint}
            </p>
          </div>

          {form.category === 'anc' ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Gestation" htmlFor="gestationWeeks" error={errors.gestationWeeks}>
                <NumberInput id="gestationWeeks" value={form.gestationWeeks} onChange={handleGestation} placeholder="28" min={4} max={42} suffix="wks" />
              </Field>
              <Field label="EDD" htmlFor="edd" hint={form.edd ? formatDate(form.edd) : 'Auto from gestation'}>
                <TextInput id="edd" type="date" value={form.edd} onChange={update('edd')} />
              </Field>
              <Field label="Gravida" htmlFor="gravida">
                <NumberInput id="gravida" value={form.gravida} onChange={update('gravida')} placeholder="2" min={0} max={20} suffix="G" />
              </Field>
              <Field label="Para" htmlFor="para">
                <NumberInput id="para" value={form.para} onChange={update('para')} placeholder="1" min={0} max={20} suffix="P" />
              </Field>
            </div>
          ) : null}
        </Section>

        <Section title="Presentation" icon={Activity}>
          <Field label="Symptoms" hint="Tap all that apply — these travel with the triage record.">
            <OptionChips options={SYMPTOMS} values={form.symptoms} onToggle={toggleSymptom} />
          </Field>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Allergies" htmlFor="allergies">
              <TextInput id="allergies" value={form.allergies} onChange={update('allergies')} placeholder="e.g. penicillin" />
            </Field>
            <Field label="Notes" htmlFor="notes">
              <TextInput id="notes" value={form.notes} onChange={update('notes')} placeholder="Household context, prior treatment…" />
            </Field>
          </div>
        </Section>

        {!editing ? (
          <Section title="Baseline vitals (optional)" icon={HeartPulse}>
            <Toggle
              checked={captureVitals}
              onChange={setCaptureVitals}
              label="Capture vitals during intake"
              description="Triage bands are calculated immediately; urgent cases raise a referral."
            />
            {captureVitals ? (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    ['systolic', 'Systolic', 'mmHg', '120'],
                    ['diastolic', 'Diastolic', 'mmHg', '80'],
                    ['temperature', 'Temp', '°C', '36.8'],
                    ['pulse', 'Pulse', 'bpm', '78'],
                    ['weight', 'Weight', 'kg', '62'],
                    ['height', 'Height', 'cm', '165'],
                    ['spo2', 'SpO₂', '%', '98'],
                    ['respRate', 'Resp rate', '/min', '18'],
                    ['muac', 'MUAC', 'cm', '24.5'],
                  ].map(([key, label, unit, placeholder]) => (
                    <Field key={key} label={label} htmlFor={`intake-${key}`}>
                      <NumberInput
                        id={`intake-${key}`}
                        value={vitals[key]}
                        onChange={updateVital(key)}
                        placeholder={placeholder}
                        suffix={unit}
                      />
                    </Field>
                  ))}
                </div>
                {isMinor ? (
                  <Field label="Danger signs">
                    <div className="flex flex-wrap gap-1.5">
                      {DANGER_SIGNS.filter((sign) => sign.scope === 'any' || sign.scope === 'under5').map((sign) => {
                        const active = dangerSigns.includes(sign.id)
                        return (
                          <button
                            key={sign.id}
                            type="button"
                            onClick={() => toggleDanger(sign.id)}
                            className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                              active
                                ? 'border-danger/50 bg-danger/15 text-danger'
                                : 'border-line/20 bg-surface/30 text-muted hover:text-content'
                            }`}
                          >
                            {sign.label}
                          </button>
                        )
                      })}
                    </div>
                  </Field>
                ) : null}
              </div>
            ) : null}
          </Section>
        ) : (
          <p className="flex items-center gap-2 rounded-xl border border-line/15 bg-surface/25 px-3 py-2 text-[11px] text-muted">
            <Info size={13} className="text-brand" />
            {isAdmin
              ? 'Vitals are recorded from the patient card so the clinical history stays append-only.'
              : 'Vitals are recorded from the patient card. Only the clinical officer can edit identity details after intake.'}
          </p>
        )}
      </div>
    </Modal>
  )
}

function Section({ title, icon: Icon, children }) {
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        <Icon size={13} className="text-brand" />
        <p className="label-clinical">{title}</p>
        <span className="h-px flex-1 bg-line/15" />
      </div>
      {children}
    </section>
  )
}
