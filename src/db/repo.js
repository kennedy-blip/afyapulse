import { db, TABLES, tableCounts } from './db'
import { assessVitals } from '../lib/triage'
import { buildCarePlan } from '../lib/careplan'
import { nowISOString, todayISO } from '../lib/dates'

const ADMIN_ONLY = 'Clinical Officer / Admin privileges are required for this action.'

function assertAdmin(actor) {
  if (actor?.role !== 'admin') {
    const error = new Error(ADMIN_ONLY)
    error.code = 'FORBIDDEN'
    throw error
  }
}

function actorName(actor) {
  return actor?.name || 'Unnamed worker'
}

function cleanNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/* ------------------------------------------------------------------ prefs */

export async function getPref(key, fallback = null) {
  const row = await db.prefs.get(key)
  return row ? row.value : fallback
}

export async function setPref(key, value) {
  await db.prefs.put({ key, value })
  return value
}

/* --------------------------------------------------------------- activity */

export function logActivity(kind, message, actor, extra = {}) {
  return db.activity.add({
    kind,
    message,
    actor: actor?.name || 'System',
    actorRole: actor?.role || 'system',
    at: nowISOString(),
    ...extra,
  })
}

/* --------------------------------------------------------------- patients */

function normalisePatient(input) {
  const ageYears = Math.max(0, Math.floor(cleanNumber(input.ageYears) ?? 0))
  const ageMonths = Math.max(0, Math.floor(cleanNumber(input.ageMonths) ?? 0))
  return {
    firstName: String(input.firstName || '').trim(),
    lastName: String(input.lastName || '').trim(),
    sex: input.sex === 'M' || input.sex === 'F' ? input.sex : 'U',
    ageYears,
    ageMonths: ageMonths % 12,
    birthDate: input.birthDate || null,
    phone: String(input.phone || '').trim(),
    ward: String(input.ward || '').trim(),
    village: String(input.village || '').trim(),
    category: ['general', 'anc', 'child', 'chronic'].includes(input.category) ? input.category : 'general',
    symptoms: Array.isArray(input.symptoms) ? input.symptoms : [],
    notes: String(input.notes || '').trim(),
    gestationWeeks: cleanNumber(input.gestationWeeks),
    edd: input.edd || null,
    gravida: cleanNumber(input.gravida),
    para: cleanNumber(input.para),
    allergies: String(input.allergies || '').trim(),
    archived: false,
  }
}

export async function createPatient(input, actor, vitals = null) {
  if (!input.firstName?.trim() && !input.lastName?.trim()) {
    throw new Error('A patient needs at least a name.')
  }

  return db.transaction(
    'rw',
    [db.patients, db.vitals, db.schedules, db.prefs, db.activity, db.referrals],
    async () => {
      const seqRow = await db.prefs.get('patientSeq')
      const seq = (Number(seqRow?.value) || 0) + 1
      await db.prefs.put({ key: 'patientSeq', value: seq })

      const patient = normalisePatient(input)
      const code = `AFY-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`
      const now = nowISOString()
      const id = await db.patients.add({
        ...patient,
        code,
        createdAt: now,
        updatedAt: now,
        createdBy: actorName(actor),
        createdByRole: actor?.role || 'chp',
        riskLevel: 'normal',
        lastVisitAt: null,
        lastTriageSummary: 'No vitals recorded yet',
        archived: false,
      })

      const saved = await db.patients.get(id)
      let assessment = null
      let vitalId = null

      if (vitals && Object.values(vitals).some((v) => v !== '' && v !== null && v !== undefined)) {
        const result = await recordVitalsTx(id, vitals, actor)
        assessment = result.assessment
        vitalId = result.id
      }

      const plan = buildCarePlan(saved)
      if (plan.length) {
        await db.schedules.bulkAdd(plan)
      }

      await db.activity.add({
        kind: 'patient',
        message: `${code} registered · ${patient.firstName} ${patient.lastName}`.trim(),
        actor: actorName(actor),
        actorRole: actor?.role || 'chp',
        at: now,
        patientId: id,
      })

      return { id, code, planCount: plan.length, assessment, vitalId }
    },
  )
}

export async function updatePatient(id, patch, actor) {
  assertAdmin(actor)
  const allowed = [
    'firstName',
    'lastName',
    'sex',
    'ageYears',
    'ageMonths',
    'birthDate',
    'phone',
    'ward',
    'village',
    'category',
    'symptoms',
    'notes',
    'gestationWeeks',
    'edd',
    'gravida',
    'para',
    'allergies',
  ]
  const clean = Object.fromEntries(Object.entries(patch).filter(([key]) => allowed.includes(key)))
  await db.patients.update(id, { ...clean, updatedAt: nowISOString() })
  await logActivity('patient', `Patient record updated · ${clean.firstName || ''} ${clean.lastName || ''}`.trim(), actor, {
    patientId: id,
  })
  return id
}

export async function archivePatient(id, actor, archived = true) {
  assertAdmin(actor)
  const patient = await db.patients.get(id)
  await db.patients.update(id, { archived, updatedAt: nowISOString() })
  await logActivity('patient', `${archived ? 'Archived' : 'Restored'} ${patient?.code || 'record'}`, actor, {
    patientId: id,
  })
}

export async function deletePatient(id, actor) {
  assertAdmin(actor)
  const patient = await db.patients.get(id)
  if (!patient) return
  await db.transaction(
    'rw',
    [db.patients, db.vitals, db.schedules, db.referrals, db.activity],
    async () => {
      await db.vitals.where('patientId').equals(id).delete()
      await db.schedules.where('patientId').equals(id).delete()
      await db.referrals.where('patientId').equals(id).delete()
      await db.patients.delete(id)
      await db.activity.add({
        kind: 'patient',
        message: `Record permanently deleted · ${patient.code}`,
        actor: actorName(actor),
        actorRole: actor?.role || 'admin',
        at: nowISOString(),
        patientId: id,
      })
    },
  )
}

/* ----------------------------------------------------------------- vitals */

async function recordVitalsTx(patientId, input, actor) {
  const patient = await db.patients.get(patientId)
  if (!patient) throw new Error('Patient not found in the local register.')

  const vitals = {
    systolic: cleanNumber(input.systolic),
    diastolic: cleanNumber(input.diastolic),
    temperature: cleanNumber(input.temperature),
    pulse: cleanNumber(input.pulse),
    weight: cleanNumber(input.weight),
    height: cleanNumber(input.height),
    spo2: cleanNumber(input.spo2),
    respRate: cleanNumber(input.respRate),
    muac: cleanNumber(input.muac),
    dangerSigns: Array.isArray(input.dangerSigns) ? input.dangerSigns : [],
    notes: String(input.notes || '').trim(),
  }

  const assessment = assessVitals(vitals, patient)
  const recordedAt = nowISOString()
  const vitalId = await db.vitals.add({
    patientId,
    ...vitals,
    recordedAt,
    recordedBy: actorName(actor),
    recordedByRole: actor?.role || 'chp',
    triageLevel: assessment.level,
    flags: assessment.flags,
    summary: assessment.summary,
    bmi: assessment.bmi,
  })

  await db.patients.update(patientId, {
    riskLevel: assessment.level,
    lastVisitAt: recordedAt,
    lastVitalAt: recordedAt,
    lastVitalsId: vitalId,
    lastTriageSummary: assessment.summary,
    updatedAt: recordedAt,
  })

  if (assessment.level === 'urgent') {
    const open = await db.referrals
      .where('patientId')
      .equals(patientId)
      .filter((r) => ['pending_approval', 'approved'].includes(r.status))
      .first()
    if (!open) {
      await db.referrals.add({
        patientId,
        vitalId,
        urgency: 'urgent',
        reason: assessment.summary,
        flags: assessment.flags,
        notes: vitals.notes,
        status: 'pending_approval',
        createdAt: recordedAt,
        createdBy: actorName(actor),
        createdByRole: actor?.role || 'chp',
      })
    }
  }

  await db.activity.add({
    kind: 'vitals',
    message: `${patient.code} vitals · ${assessment.level.toUpperCase()}`,
    actor: actorName(actor),
    actorRole: actor?.role || 'chp',
    at: recordedAt,
    patientId,
  })

  return { id: vitalId, assessment, patient }
}

export async function recordVitals(patientId, input, actor) {
  return db.transaction(
    'rw',
    [db.patients, db.vitals, db.referrals, db.activity],
    async () => recordVitalsTx(patientId, input, actor),
  )
}

/* -------------------------------------------------------------- schedules */

export async function createSchedule(input, actor) {
  const row = {
    patientId: Number(input.patientId),
    type: ['immunization', 'anc', 'chronic', 'nutrition', 'referral'].includes(input.type) ? input.type : 'immunization',
    title: String(input.title || '').trim() || 'Follow-up visit',
    detail: String(input.detail || '').trim(),
    dueDate: input.dueDate || todayISO(),
    status: 'pending',
    source: 'manual',
    notes: String(input.notes || '').trim(),
    createdAt: nowISOString(),
    createdBy: actorName(actor),
  }
  const id = await db.schedules.add(row)
  await logActivity('schedule', `Follow-up scheduled · ${row.title}`, actor, { patientId: row.patientId })
  return id
}

export async function completeSchedule(id, actor, note = '') {
  const row = await db.schedules.get(id)
  if (!row) return
  await db.schedules.update(id, {
    status: 'completed',
    completedAt: nowISOString(),
    completedBy: actorName(actor),
    completionNote: note,
  })
  const patient = await db.patients.get(row.patientId)
  await logActivity('schedule', `${patient?.code || 'Patient'} · ${row.title} completed`, actor, {
    patientId: row.patientId,
  })
}

export async function reopenSchedule(id, actor) {
  const row = await db.schedules.get(id)
  if (!row) return
  await db.schedules.update(id, {
    status: 'pending',
    completedAt: null,
    completedBy: null,
    completionNote: '',
  })
  await logActivity('schedule', `${row.title} reopened`, actor, { patientId: row.patientId })
}

export async function rescheduleSchedule(id, dueDate, actor) {
  const row = await db.schedules.get(id)
  if (!row) return
  await db.schedules.update(id, {
    dueDate,
    status: 'pending',
    completedAt: null,
    completedBy: null,
    rescheduledAt: nowISOString(),
    rescheduledBy: actorName(actor),
  })
  await logActivity('schedule', `${row.title} moved to ${dueDate}`, actor, { patientId: row.patientId })
}

export async function deleteSchedule(id, actor) {
  assertAdmin(actor)
  const row = await db.schedules.get(id)
  if (!row) return
  await db.schedules.delete(id)
  await logActivity('schedule', `Follow-up removed · ${row.title}`, actor, { patientId: row.patientId })
}

/* -------------------------------------------------------------- inventory */

function normaliseMedication(input) {
  const quantity = Math.max(0, Math.floor(cleanNumber(input.quantity) ?? 0))
  const reorderLevel = Math.max(0, Math.floor(cleanNumber(input.reorderLevel) ?? 0))
  return {
    name: String(input.name || '').trim(),
    category: ['medicine', 'vaccine', 'consumable'].includes(input.category) ? input.category : 'medicine',
    batch: String(input.batch || '').trim().toUpperCase(),
    expiryDate: input.expiryDate || null,
    quantity,
    unit: String(input.unit || 'tabs').trim(),
    reorderLevel,
    baselineStock: Math.max(0, Math.floor(cleanNumber(input.baselineStock) ?? (quantity || reorderLevel * 2 || 1))),
    coldChain: ['ambient', 'cold', 'frozen'].includes(input.coldChain) ? input.coldChain : 'ambient',
    supplier: String(input.supplier || '').trim(),
    notes: String(input.notes || '').trim(),
  }
}

export async function createMedication(input, actor) {
  assertAdmin(actor)
  const med = normaliseMedication(input)
  if (!med.name) throw new Error('A drug or vaccine name is required.')
  const now = nowISOString()
  const id = await db.medications.add({ ...med, createdAt: now, updatedAt: now, updatedBy: actorName(actor) })
  await logActivity('stock', `New stock line · ${med.name} (${med.quantity} ${med.unit})`, actor)
  return id
}

export async function updateMedication(id, patch, actor) {
  assertAdmin(actor)
  const med = await db.medications.get(id)
  if (!med) return
  const merged = normaliseMedication({ ...med, ...patch })
  await db.medications.update(id, { ...merged, updatedAt: nowISOString(), updatedBy: actorName(actor) })
  await logActivity('stock', `Stock line updated · ${merged.name}`, actor)
}

export async function restockMedication({ id, quantity, batch, expiryDate, reason }, actor) {
  assertAdmin(actor)
  const qty = Math.floor(cleanNumber(quantity) ?? 0)
  if (qty <= 0) throw new Error('Restock quantity must be greater than zero.')
  const med = await db.medications.get(id)
  if (!med) throw new Error('Stock line not found.')

  await db.transaction('rw', [db.medications, db.adjustments, db.activity], async () => {
    const nextQuantity = (Number(med.quantity) || 0) + qty
    await db.medications.update(id, {
      quantity: nextQuantity,
      batch: batch ? String(batch).trim().toUpperCase() : med.batch,
      expiryDate: expiryDate || med.expiryDate,
      baselineStock: Math.max(Number(med.baselineStock) || 0, nextQuantity),
      lastRestockedAt: nowISOString(),
      updatedAt: nowISOString(),
      updatedBy: actorName(actor),
    })
    await db.adjustments.add({
      medicationId: id,
      delta: qty,
      type: 'restock',
      balanceAfter: nextQuantity,
      reason: reason || 'Stock received',
      at: nowISOString(),
      by: actorName(actor),
    })
    await db.activity.add({
      kind: 'stock',
      message: `${med.name} restocked +${qty} ${med.unit}`,
      actor: actorName(actor),
      actorRole: actor?.role || 'admin',
      at: nowISOString(),
    })
  })
}

export async function dispenseMedication({ medicationId, patientId, quantity, notes }, actor) {
  assertAdmin(actor)
  const qty = Math.floor(cleanNumber(quantity) ?? 0)
  if (qty <= 0) throw new Error('Dispense quantity must be greater than zero.')
  const med = await db.medications.get(medicationId)
  if (!med) throw new Error('Stock line not found.')
  if ((Number(med.quantity) || 0) < qty) {
    throw new Error(`Only ${med.quantity} ${med.unit} of ${med.name} remain in the dispensary.`)
  }

  await db.transaction(
    'rw',
    [db.medications, db.dispensings, db.adjustments, db.activity],
    async () => {
      const nextQuantity = (Number(med.quantity) || 0) - qty
      await db.medications.update(medicationId, {
        quantity: nextQuantity,
        updatedAt: nowISOString(),
        updatedBy: actorName(actor),
      })
      await db.dispensings.add({
        medicationId,
        patientId: patientId ? Number(patientId) : null,
        quantity: qty,
        notes: String(notes || '').trim(),
        dispensedAt: nowISOString(),
        dispensedBy: actorName(actor),
        medicationName: med.name,
        unit: med.unit,
        batch: med.batch,
      })
      await db.adjustments.add({
        medicationId,
        delta: -qty,
        type: 'dispense',
        balanceAfter: nextQuantity,
        reason: 'Dispensed to patient',
        at: nowISOString(),
        by: actorName(actor),
      })
      await db.activity.add({
        kind: 'stock',
        message: `${med.name} dispensed −${qty} ${med.unit}`,
        actor: actorName(actor),
        actorRole: actor?.role || 'admin',
        at: nowISOString(),
        patientId: patientId ? Number(patientId) : null,
      })
    },
  )
  return { remaining: (Number(med.quantity) || 0) - qty, unit: med.unit }
}

export async function adjustStock({ id, delta, reason }, actor) {
  assertAdmin(actor)
  const change = Math.floor(cleanNumber(delta) ?? 0)
  if (!change) throw new Error('Adjustment cannot be zero.')
  const med = await db.medications.get(id)
  if (!med) throw new Error('Stock line not found.')
  const nextQuantity = Math.max(0, (Number(med.quantity) || 0) + change)
  await db.transaction('rw', [db.medications, db.adjustments, db.activity], async () => {
    await db.medications.update(id, { quantity: nextQuantity, updatedAt: nowISOString(), updatedBy: actorName(actor) })
    await db.adjustments.add({
      medicationId: id,
      delta: nextQuantity - (Number(med.quantity) || 0),
      type: 'adjustment',
      balanceAfter: nextQuantity,
      reason: reason || 'Manual stock correction',
      at: nowISOString(),
      by: actorName(actor),
    })
    await db.activity.add({
      kind: 'stock',
      message: `${med.name} adjusted to ${nextQuantity} ${med.unit}`,
      actor: actorName(actor),
      actorRole: actor?.role || 'admin',
      at: nowISOString(),
    })
  })
}

export async function overrideExpiry({ id, expiryDate, reason }, actor) {
  assertAdmin(actor)
  const med = await db.medications.get(id)
  if (!med) throw new Error('Stock line not found.')
  await db.medications.update(id, {
    expiryDate,
    expiryOverriddenAt: nowISOString(),
    expiryOverriddenBy: actorName(actor),
    expiryOverrideReason: reason || '',
    updatedAt: nowISOString(),
  })
  await db.activity.add({
    kind: 'stock',
    message: `Expiry override · ${med.name} → ${expiryDate}`,
    actor: actorName(actor),
    actorRole: actor?.role || 'admin',
    at: nowISOString(),
  })
}

export async function deleteMedication(id, actor) {
  assertAdmin(actor)
  const med = await db.medications.get(id)
  if (!med) return
  await db.transaction('rw', [db.medications, db.dispensings, db.adjustments, db.activity], async () => {
    await db.dispensings.where('medicationId').equals(id).delete()
    await db.adjustments.where('medicationId').equals(id).delete()
    await db.medications.delete(id)
    await db.activity.add({
      kind: 'stock',
      message: `Stock line removed · ${med.name}`,
      actor: actorName(actor),
      actorRole: actor?.role || 'admin',
      at: nowISOString(),
    })
  })
}

/* -------------------------------------------------------------- referrals */

export async function createReferral({ patientId, reason, urgency = 'caution', notes }, actor) {
  const patient = await db.patients.get(patientId)
  if (!patient) throw new Error('Patient not found.')
  const autoApprove = actor?.role === 'admin'
  const id = await db.referrals.add({
    patientId,
    reason: reason || 'Clinical review requested',
    urgency,
    notes: String(notes || '').trim(),
    status: autoApprove ? 'approved' : 'pending_approval',
    createdAt: nowISOString(),
    createdBy: actorName(actor),
    createdByRole: actor?.role || 'chp',
    ...(autoApprove ? { decidedAt: nowISOString(), decidedBy: actorName(actor), decisionNote: 'Approved at point of care' } : {}),
  })
  await logActivity('referral', `Referral raised for ${patient.code}`, actor, { patientId })
  return id
}

export async function decideReferral(id, status, actor, note = '') {
  assertAdmin(actor)
  const referral = await db.referrals.get(id)
  if (!referral) return
  await db.referrals.update(id, {
    status,
    decidedAt: nowISOString(),
    decidedBy: actorName(actor),
    decisionNote: note,
  })
  await logActivity('referral', `Referral ${status}`, actor, { patientId: referral.patientId })
}

export async function completeReferral(id, actor) {
  const referral = await db.referrals.get(id)
  if (!referral) return
  await db.referrals.update(id, {
    status: 'completed',
    completedAt: nowISOString(),
    completedBy: actorName(actor),
  })
  await logActivity('referral', 'Referral closed as completed', actor, { patientId: referral.patientId })
}

/* ------------------------------------------------------------ data tools */

export async function exportBackup() {
  const data = { app: 'AfyaPulse', version: 2, exportedAt: nowISOString(), tables: {} }
  for (const name of TABLES) {
    data.tables[name] = await db.table(name).toArray()
  }
  return data
}

export async function importBackup(payload, actor) {
  assertAdmin(actor)
  if (!payload || payload.app !== 'AfyaPulse' || typeof payload.tables !== 'object') {
    throw new Error('That file is not an AfyaPulse backup.')
  }
  await db.transaction('rw', db.tables, async () => {
    for (const name of TABLES) {
      const rows = payload.tables[name]
      if (!Array.isArray(rows)) continue
      await db.table(name).clear()
      if (rows.length) await db.table(name).bulkPut(rows)
    }
  })
}

export async function clearOperationalData() {
  await db.transaction(
    'rw',
    [
      db.patients,
      db.vitals,
      db.schedules,
      db.medications,
      db.dispensings,
      db.adjustments,
      db.referrals,
      db.activity,
      db.prefs,
    ],
    async () => {
      await db.vitals.clear()
      await db.schedules.clear()
      await db.dispensings.clear()
      await db.adjustments.clear()
      await db.referrals.clear()
      await db.activity.clear()
      await db.patients.clear()
      await db.medications.clear()
      await db.prefs.delete('patientSeq')
    },
  )
}

export async function storageReport() {
  const counts = await tableCounts()
  let estimate = { usage: 0, quota: 0 }
  if (navigator.storage?.estimate) {
    try {
      estimate = await navigator.storage.estimate()
    } catch {
      estimate = { usage: 0, quota: 0 }
    }
  }
  return { counts, usage: estimate.usage || 0, quota: estimate.quota || 0 }
}
