/**
 * Deterministic clinical triage engine.
 *
 * Readings are compared against age-banded thresholds (adult vs under-five) and
 * escalated by danger signs. Every rule that fires is returned as a flag so the
 * UI can explain *why* a patient is urgent — never just a colour.
 */
import { ageInMonths } from './dates'

export const TRIAGE = {
  normal: {
    id: 'normal',
    label: 'Normal',
    short: 'Normal',
    description: 'Readings within expected range. Routine care.',
    tone: 'ok',
  },
  caution: {
    id: 'caution',
    label: 'Caution',
    short: 'Caution',
    description: 'One or more readings need review within 24 hours.',
    tone: 'warn',
  },
  urgent: {
    id: 'urgent',
    label: 'Urgent Referral',
    short: 'Urgent',
    description: 'Danger sign present. Refer to facility immediately.',
    tone: 'danger',
  },
}

const SEVERITY_RANK = { normal: 0, caution: 1, urgent: 2 }

export const DANGER_SIGNS = [
  { id: 'convulsions', label: 'Convulsions', scope: 'any' },
  { id: 'unable_to_feed', label: 'Unable to feed / drink', scope: 'under5' },
  { id: 'chest_indrawing', label: 'Chest indrawing', scope: 'under5' },
  { id: 'severe_dehydration', label: 'Severe dehydration', scope: 'any' },
  { id: 'unconscious', label: 'Unconscious / lethargic', scope: 'any' },
  { id: 'severe_bleeding', label: 'Severe bleeding', scope: 'any' },
  { id: 'severe_headache', label: 'Severe headache + blurred vision', scope: 'any' },
]

export const SYMPTOMS = [
  'Fever',
  'Cough',
  'Difficulty breathing',
  'Diarrhoea',
  'Vomiting',
  'Headache',
  'Abdominal pain',
  'Rash',
  'Fatigue',
  'Swelling',
  'Pregnancy check-up',
  'Immunization visit',
]

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * @param {object} vital     latest vital record
 * @param {object} patient   patient record (ageYears / ageMonths)
 * @returns {{level:'normal'|'caution'|'urgent', flags:Array, score:number, summary:string}}
 */
export function assessVitals(vital = {}, patient = {}) {
  const flags = []
  const months = ageInMonths(patient.ageYears, patient.ageMonths)
  const childPathway = patient.category === 'child'
  const under5 = months < 60 && (months > 0 || childPathway)
  const infant = months < 12 && (months > 0 || childPathway)

  const raise = (severity, label, detail) => {
    flags.push({ severity, label, detail })
  }

  const systolic = num(vital.systolic)
  const diastolic = num(vital.diastolic)
  if (systolic && diastolic) {
    if (systolic >= 180 || diastolic >= 110) {
      raise('urgent', 'Hypertensive crisis', `${systolic}/${diastolic} mmHg — refer now`)
    } else if (systolic >= 140 || diastolic >= 90) {
      raise('caution', 'Raised blood pressure', `${systolic}/${diastolic} mmHg`)
    } else if (systolic < 90 || diastolic < 60) {
      raise('caution', 'Low blood pressure', `${systolic}/${diastolic} mmHg`)
    }
  } else if (systolic && systolic >= 160) {
    raise('caution', 'Raised systolic pressure', `${systolic} mmHg`)
  }

  const temp = num(vital.temperature)
  if (temp) {
    if (temp >= 39.5) raise('urgent', 'High fever', `${temp.toFixed(1)} °C`)
    else if (temp >= 38) raise('caution', 'Fever', `${temp.toFixed(1)} °C`)
    else if (temp < 35.5) raise('caution', 'Hypothermia', `${temp.toFixed(1)} °C`)
  }

  const pulse = num(vital.pulse)
  if (pulse) {
    if (infant) {
      if (pulse > 180 || pulse < 90) raise('urgent', 'Severe tachycardia', `${pulse} bpm`)
      else if (pulse > 160 || pulse < 100) raise('caution', 'Abnormal infant pulse', `${pulse} bpm`)
    } else if (under5) {
      if (pulse > 160 || pulse < 70) raise('urgent', 'Severe tachycardia', `${pulse} bpm`)
      else if (pulse > 140 || pulse < 80) raise('caution', 'Abnormal child pulse', `${pulse} bpm`)
    } else if (pulse > 130 || pulse < 50) {
      raise('urgent', 'Severe tachycardia', `${pulse} bpm`)
    } else if (pulse > 110 || pulse < 60) {
      raise('caution', 'Abnormal pulse', `${pulse} bpm`)
    }
  }

  const spo2 = num(vital.spo2)
  if (spo2) {
    if (spo2 < 90) raise('urgent', 'Hypoxia', `SpO₂ ${spo2}%`)
    else if (spo2 < 94) raise('caution', 'Low oxygen saturation', `SpO₂ ${spo2}%`)
  }

  const resp = num(vital.respRate)
  if (resp) {
    const urgent = under5 ? 50 : 30
    const caution = under5 ? 40 : 22
    if (resp >= urgent) raise('urgent', 'Severe respiratory distress', `${resp} breaths/min`)
    else if (resp >= caution) raise('caution', 'Raised respiratory rate', `${resp} breaths/min`)
  }

  const muac = num(vital.muac)
  if (muac && under5 && months >= 6) {
    if (muac < 11.5) raise('urgent', 'Severe acute malnutrition', `MUAC ${muac} cm`)
    else if (muac < 12.5) raise('caution', 'Moderate acute malnutrition', `MUAC ${muac} cm`)
  }

  const weight = num(vital.weight)
  const height = num(vital.height)
  let bmi = null
  if (weight && height) {
    const metres = height > 3 ? height / 100 : height
    if (metres > 0.4) {
      bmi = weight / (metres * metres)
      if (!under5 && bmi >= 40) raise('caution', 'Severe obesity', `BMI ${bmi.toFixed(1)}`)
      else if (!under5 && bmi > 0 && bmi < 16) raise('caution', 'Underweight', `BMI ${bmi.toFixed(1)}`)
    }
  }

  const dangerSigns = Array.isArray(vital.dangerSigns) ? vital.dangerSigns : []
  const applicable = DANGER_SIGNS.filter(
    (sign) => dangerSigns.includes(sign.id) && (sign.scope === 'any' || under5),
  )
  applicable.forEach((sign) => raise('urgent', `Danger sign: ${sign.label}`, 'Escalate to facility'))

  const level = flags.reduce(
    (worst, flag) => (SEVERITY_RANK[flag.severity] > SEVERITY_RANK[worst] ? flag.severity : worst),
    'normal',
  )
  const score = flags.reduce((total, flag) => total + (flag.severity === 'urgent' ? 3 : 1), 0)

  const summary =
    level === 'normal'
      ? 'All recorded readings within expected range'
      : flags
          .slice()
          .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
          .map((flag) => flag.label)
          .slice(0, 2)
          .join(' · ')

  return { level, flags, score, summary, bmi, isChild: under5 }
}

/** Human readable clinical hint for a single input, used inline in the vitals form. */
export function readingHint(field, value, patient = {}) {
  const v = num(value)
  if (!v) return null
  const months = ageInMonths(patient.ageYears, patient.ageMonths)
  const under5 = months < 60 && (months > 0 || patient.category === 'child')
  switch (field) {
    case 'temperature':
      if (v >= 39.5) return { tone: 'danger', text: 'High fever — refer' }
      if (v >= 38) return { tone: 'warn', text: 'Fever' }
      if (v < 35.5) return { tone: 'warn', text: 'Hypothermia' }
      return { tone: 'ok', text: 'Afebrile' }
    case 'spo2':
      if (v < 90) return { tone: 'danger', text: 'Hypoxia' }
      if (v < 94) return { tone: 'warn', text: 'Low' }
      return { tone: 'ok', text: 'Normal' }
    case 'systolic':
      if (v >= 180) return { tone: 'danger', text: 'Crisis range' }
      if (v >= 140) return { tone: 'warn', text: 'Raised' }
      if (v < 90) return { tone: 'warn', text: 'Low' }
      return { tone: 'ok', text: 'Normal' }
    case 'pulse': {
      const infant = months > 0 && months < 12
      const highUrgent = infant ? 180 : under5 ? 160 : 130
      const lowUrgent = infant ? 90 : under5 ? 70 : 50
      const highCaution = infant ? 160 : under5 ? 140 : 110
      const lowCaution = infant ? 100 : under5 ? 80 : 60
      if (v > highUrgent || v < lowUrgent) return { tone: 'danger', text: 'Abnormal' }
      if (v > highCaution || v < lowCaution) return { tone: 'warn', text: 'Review' }
      return { tone: 'ok', text: 'Normal' }
    }
    case 'muac':
      if (!under5) return null
      if (v < 11.5) return { tone: 'danger', text: 'SAM' }
      if (v < 12.5) return { tone: 'warn', text: 'MAM' }
      return { tone: 'ok', text: 'Normal' }
    default:
      return null
  }
}
