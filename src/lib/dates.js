/**
 * Date helpers. All calendar dates are stored as local `YYYY-MM-DD` strings so
 * that a health worker in Meru and a report generated in Nairobi agree on the day.
 */

const MS_DAY = 86400000

export function todayISO() {
  return toISODate(new Date())
}

export function toISODate(date) {
  const d = date instanceof Date ? date : new Date(date)
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISODate(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function nowISOString() {
  return new Date().toISOString()
}

export function addDays(iso, days) {
  const base = parseISODate(iso) ?? new Date()
  base.setDate(base.getDate() + days)
  return toISODate(base)
}

export function addMonths(iso, months) {
  const base = parseISODate(iso) ?? new Date()
  const targetDay = base.getDate()
  base.setDate(1)
  base.setMonth(base.getMonth() + months)
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
  base.setDate(Math.min(targetDay, lastDay))
  return toISODate(base)
}

export function startOfDay(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Whole days from today -> `iso`. Negative means the date has passed. */
export function daysUntil(iso, from = new Date()) {
  const target = parseISODate(iso)
  if (!target) return NaN
  const a = startOfDay(target).getTime()
  const b = startOfDay(from).getTime()
  return Math.round((a - b) / MS_DAY)
}

export function isOverdue(iso) {
  return daysUntil(iso) < 0
}

export function isToday(iso) {
  return daysUntil(iso) === 0
}

export function relativeDue(iso) {
  const days = daysUntil(iso)
  if (Number.isNaN(days)) return 'No date'
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  if (days ===-1) return '1 day overdue'
  if (days > 1 && days <= 14) return `Due in ${days} days`
  if (days > 14 && days <= 60) return `Due in ${Math.round(days / 7)} weeks`
  if (days > 60) return `Due in ${Math.round(days / 30)} months`
  if (days < -1 && days >= -14) return `${Math.abs(days)} days overdue`
  if (days < -14) return `${Math.abs(Math.round(days / 7))} weeks overdue`
  return iso
}

export function formatDate(iso, opts = {}) {
  const d = parseISODate(iso) ?? (iso ? new Date(iso) : null)
  if (!d || Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: opts.year === false ? undefined : 'numeric',
  })
}

export function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function ageFromBirthDate(birthISO) {
  const birth = parseISODate(birthISO)
  if (!birth) return { years: 0, months: 0 }
  const now = new Date()
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (now.getDate() < birth.getDate()) months -= 1
  months = Math.max(0, months)
  return { years: Math.floor(months / 12), months }
}

export function ageLabel(years, months) {
  const y = Number(years) || 0
  const m = Number(months) || 0
  if (y === 0 && m === 0) return 'Newborn'
  if (y === 0) return m === 1 ? '4 weeks' : `${m} months`
  if (m === 0) return `${y} yr${y === 1 ? '' : 's'}`
  return `${y}y ${m}m`
}

export function ageInMonths(years, months) {
  return (Number(years) || 0) * 12 + (Number(months) || 0)
}

export function isoWeekStamp(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - week1.getTime()) / MS_DAY - 3 + ((week1.getDay() + 6) % 7)) / 7)
}
