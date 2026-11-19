import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import { seedDemoData } from '../db/seed'
import {
  archivePatient,
  completeSchedule,
  dispenseMedication,
  exportBackup,
  importBackup,
  overrideExpiry,
  restockMedication,
} from '../db/repo'
import { todayISO } from '../lib/dates'

const ADMIN = { role: 'admin', name: 'Dr. Faith Makena' }
const CHP = { role: 'chp', name: 'James Kimathi' }

describe('repository privileges & stock ledger', () => {
  beforeEach(async () => {
    await db.open()
    await seedDemoData({ reset: true })
  })

  it('blocks field staff from dispensing and inventory mutations', async () => {
    const med = await db.medications.toCollection().first()
    await expect(
      dispenseMedication({ medicationId: med.id, quantity: 1 }, CHP),
    ).rejects.toThrow(/privileges/i)
    await expect(overrideExpiry({ id: med.id, expiryDate: todayISO(), reason: 'test' }, CHP)).rejects.toThrow(/privileges/i)
    await expect(archivePatient(1, CHP)).rejects.toThrow(/privileges/i)
  })

  it('archives and restores a record without losing history', async () => {
    const patient = await db.patients.toCollection().first()
    const vitalsBefore = await db.vitals.where('patientId').equals(patient.id).count()

    await archivePatient(patient.id, ADMIN, true)
    let stored = await db.patients.get(patient.id)
    expect(stored.archived).toBe(true)
    expect(await db.vitals.where('patientId').equals(patient.id).count()).toBe(vitalsBefore)

    await archivePatient(patient.id, ADMIN, false)
    stored = await db.patients.get(patient.id)
    expect(stored.archived).toBe(false)
  })

  it('dispenses atomically, deducts stock and writes the ledger', async () => {
    const med = await db.medications.where('name').equals('Paracetamol 500 mg').first()
    const before = med.quantity
    const patient = await db.patients.toCollection().first()

    await dispenseMedication({ medicationId: med.id, patientId: patient.id, quantity: 12, notes: 'Fever' }, ADMIN)

    const after = await db.medications.get(med.id)
    expect(after.quantity).toBe(before - 12)

    const dispensed = await db.dispensings.where('medicationId').equals(med.id).toArray()
    expect(dispensed.some((row) => row.quantity === 12 && row.patientId === patient.id)).toBe(true)

    const ledger = await db.adjustments.where('medicationId').equals(med.id).toArray()
    expect(ledger.some((row) => row.type === 'dispense' && row.delta === -12 && row.balanceAfter === after.quantity)).toBe(true)
  })

  it('refuses to dispense more than the shelf holds', async () => {
    const med = await db.medications.where('name').equals('Oxytocin 10 IU').first()
    await expect(
      dispenseMedication({ medicationId: med.id, quantity: med.quantity + 5 }, ADMIN),
    ).rejects.toThrow(/remain in the dispensary/i)
  })

  it('restocks and updates the batch metadata', async () => {
    const med = await db.medications.where('name').equals('BCG vaccine').first()
    const before = med.quantity
    await restockMedication(
      { id: med.id, quantity: 25, batch: 'BCG-NEW1', expiryDate: '2027-12-31', reason: 'KEMSA delivery' },
      ADMIN,
    )
    const after = await db.medications.get(med.id)
    expect(after.quantity).toBe(before + 25)
    expect(after.batch).toBe('BCG-NEW1')
    expect(after.expiryDate).toBe('2027-12-31')
  })

  it('closes a follow-up with an audit stamp', async () => {
    const pending = await db.schedules.where('status').equals('pending').first()
    await completeSchedule(pending.id, CHP, 'Seen at household')
    const closed = await db.schedules.get(pending.id)
    expect(closed.status).toBe('completed')
    expect(closed.completedBy).toBe(CHP.name)
    expect(closed.completedAt).toBeTruthy()
  })

  it('round-trips a full device backup', async () => {
    const before = await db.patients.count()
    const backup = await exportBackup()
    await db.patients.clear()
    expect(await db.patients.count()).toBe(0)

    await importBackup(backup, ADMIN)
    expect(await db.patients.count()).toBe(before)
    expect(backup.app).toBe('AfyaPulse')
  })
})
