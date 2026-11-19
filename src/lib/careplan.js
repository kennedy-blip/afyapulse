/**
 * Kenya EPI / WHO ANC care-plan generation.
 * Turns a newly registered patient into dated follow-up obligations so nothing
 * is lost between outreach visits.
 */
import { addDays, ageInMonths, daysUntil, parseISODate, toISODate, todayISO } from './dates'

/** Kenya Expanded Programme on Immunization — standard visit bundles. */
export const EPI_VISITS = [
  { key: 'birth', ageWeeks: 0, label: 'Birth doses', vaccines: ['BCG', 'OPV 0'] },
  { key: '6w', ageWeeks: 6, label: '6-week doses', vaccines: ['Penta 1', 'OPV 1', 'PCV 1', 'Rota 1'] },
  { key: '10w', ageWeeks: 10, label: '10-week doses', vaccines: ['Penta 2', 'OPV 2', 'PCV 2', 'Rota 2'] },
  { key: '14w', ageWeeks: 14, label: '14-week doses', vaccines: ['Penta 3', 'OPV 3', 'IPV', 'PCV 3'] },
  { key: '6m', ageWeeks: 26, label: '6-month review', vaccines: ['Vitamin A', 'Growth monitoring'] },
  { key: '9m', ageWeeks: 39, label: '9-month doses', vaccines: ['Measles-Rubella 1', 'Yellow Fever'] },
  { key: '18m', ageWeeks: 78, label: '18-month doses', vaccines: ['Measles-Rubella 2', 'Vitamin A'] },
  { key: '24m', ageWeeks: 104, label: '24-month review', vaccines: ['Vitamin A', 'Deworming'] },
]

/** WHO 2016 ANC contact schedule, expressed as completed gestational weeks. */
export const ANC_CONTACTS = [
  { contact: 1, week: 12 },
  { contact: 2, week: 20 },
  { contact: 3, week: 26 },
  { contact: 4, week: 30 },
  { contact: 5, week: 34 },
  { contact: 6, week: 36 },
  { contact: 7, week: 38 },
  { contact: 8, week: 40 },
]

/**
 * Estimate a birth date when the parent does not know it exactly.
 * Uses the recorded age, which is what community registers actually capture.
 */
export function estimatedBirthDate(patient) {
  if (patient?.birthDate) return patient.birthDate
  const months = ageInMonths(patient?.ageYears, patient?.ageMonths)
  const today = new Date()
  const birth = new Date(today)
  birth.setDate(birth.getDate() - Math.round(months * 30.4375))
  return toISODate(birth)
}

export function estimatedEdd(patient) {
  if (patient?.edd) return patient.edd
  const weeks = Number(patient?.gestationWeeks)
  if (!weeks) return null
  return addDays(todayISO(), Math.round((40 - weeks) * 7))
}

function visitDueDate(birthISO, ageWeeks) {
  const birth = parseISODate(birthISO)
  if (!birth) return todayISO()
  birth.setDate(birth.getDate() + ageWeeks * 7)
  return toISODate(birth)
}

/**
 * Build the follow-up obligations for a patient.
 * `horizon` keeps the schedule useful rather than dumping 8 future visits at once.
 */
export function buildCarePlan(patient, { horizonDays = 240, includeMissedDays = 21, immunizationLookbackDays = 180 } = {}) {
  if (!patient) return []
  const rows = []
  const today = todayISO()

  if (patient.category === 'child') {
    const birthISO = estimatedBirthDate(patient)
    const months = ageInMonths(patient.ageYears, patient.ageMonths)
    if (months > 60) return []
    EPI_VISITS.forEach((visit) => {
      const dueDate = visitDueDate(birthISO, visit.ageWeeks)
      const delta = daysUntil(dueDate)
      if (delta > horizonDays) return
      // EPI keeps a catch-up window: doses missed months ago are still owed.
      if (delta < -immunizationLookbackDays) return
      rows.push({
        patientId: patient.id,
        type: 'immunization',
        title: visit.label,
        detail: visit.vaccines.join(' · '),
        vaccines: visit.vaccines,
        dueDate,
        status: 'pending',
        source: 'epi',
        createdAt: new Date().toISOString(),
      })
    })
  }

  if (patient.category === 'anc') {
    const edd = estimatedEdd(patient)
    if (edd) {
      ANC_CONTACTS.forEach(({ contact, week }) => {
        const dueDate = addDays(edd, -Math.round((40 - week) * 7))
        const delta = daysUntil(dueDate)
        if (delta > horizonDays) return
        if (delta < -includeMissedDays) return
        rows.push({
          patientId: patient.id,
          type: 'anc',
          title: `ANC contact ${contact}`,
          detail: `Gestational week ${week} · ${contact === 1 ? 'booking visit' : 'follow-up'}`,
          dueDate,
          status: 'pending',
          source: 'anc',
          contactNo: contact,
          createdAt: new Date().toISOString(),
        })
      })
    }
  }

  if (patient.category === 'chronic') {
    const base = patient.createdAt ? patient.createdAt.slice(0, 10) : today
    for (let i = 1; i <= 4; i += 1) {
      const dueDate = addDays(base, i * 30)
      if (daysUntil(dueDate) < -includeMissedDays) continue
      rows.push({
        patientId: patient.id,
        type: 'chronic',
        title: `Monthly chronic-care review #${i}`,
        detail: 'Blood pressure, adherence and refill check',
        dueDate,
        status: 'pending',
        source: 'chronic',
        createdAt: new Date().toISOString(),
      })
    }
  }

  return rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

export function immunizationProgress(patient, schedules = []) {
  const birthISO = estimatedBirthDate(patient)
  const dueVisits = EPI_VISITS.filter((visit) => daysUntil(visitDueDate(birthISO, visit.ageWeeks)) <= 0)
  if (!dueVisits.length) return { done: 0, total: 0, percent: 0 }
  const done = dueVisits.filter((visit) =>
    schedules.some(
      (row) =>
        row.patientId === patient.id &&
        row.type === 'immunization' &&
        row.title === visit.label &&
        row.status === 'completed',
    ),
  ).length
  return {
    done,
    total: dueVisits.length,
    percent: Math.round((done / dueVisits.length) * 100),
  }
}
