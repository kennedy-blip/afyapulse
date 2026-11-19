import { ageLabel } from './dates'

export function fullName(patient) {
  if (!patient) return 'Unknown patient'
  return [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim() || 'Unnamed patient'
}

export function initials(patient) {
  if (!patient) return '??'
  const a = (patient.firstName || '').trim()[0] || ''
  const b = (patient.lastName || '').trim()[0] || ''
  return `${a}${b}`.toUpperCase() || '??'
}

export function patientAge(patient) {
  if (!patient) return '—'
  return ageLabel(patient.ageYears, patient.ageMonths)
}

export function sexLabel(sex) {
  if (sex === 'F') return 'Female'
  if (sex === 'M') return 'Male'
  return 'Unspecified'
}

export function sexInitial(sex) {
  if (sex === 'F') return 'F'
  if (sex === 'M') return 'M'
  return '—'
}

export function maskPhone(phone) {
  if (!phone) return 'No phone'
  const str = String(phone)
  if (str.length < 6) return str
  return `${str.slice(0, 4)}•••${str.slice(-2)}`
}

export function maskedRef(code) {
  if (!code) return 'ANON'
  let hash = 2166136261
  for (let i = 0; i < code.length; i += 1) {
    hash ^= code.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `ANON-${(hash >>> 0).toString(36).toUpperCase().padStart(5, '0').slice(-5)}`
}

export function ageBand(patient) {
  const months = (Number(patient?.ageYears) || 0) * 12 + (Number(patient?.ageMonths) || 0)
  if (months < 1) return '<1 month'
  if (months < 12) return '1-11 months'
  if (months < 60) return '1-4 years'
  if (months < 180) return '5-14 years'
  if (months < 300) return '15-24 years'
  if (months < 540) return '25-44 years'
  if (months < 780) return '45-64 years'
  return '65+ years'
}

export function compactNumber(value) {
  const n = Number(value) || 0
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`
  return `${n}`
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

export function titleCase(value) {
  if (!value) return ''
  return String(value).charAt(0).toUpperCase() + String(value).slice(1)
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function bytesLabel(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** exp).toFixed(exp === 0 ? 0 : 1)} ${units[exp]}`
}
