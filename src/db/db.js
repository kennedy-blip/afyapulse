import Dexie from 'dexie'

/**
 * AfyaPulse local clinical store.
 *
 * Every table lives in IndexedDB so a health worker can register patients,
 * record vitals, close follow-ups and dispense drugs with zero connectivity.
 * The schema is versioned — adding a version block (never editing an old one)
 * lets devices upgrade without losing field data.
 */
export const db = new Dexie('AfyaPulseDB')

db.version(1).stores({
  patients:
    '++id, &code, firstName, lastName, ward, village, category, riskLevel, createdAt, lastVisitAt, archived, *symptoms',
  vitals: '++id, patientId, recordedAt, triageLevel, [patientId+recordedAt]',
  schedules: '++id, patientId, dueDate, status, type, [status+dueDate], [patientId+type]',
  medications: '++id, name, category, batch, expiryDate, quantity, coldChain',
  dispensings: '++id, medicationId, patientId, dispensedAt, [patientId+dispensedAt]',
  adjustments: '++id, medicationId, at',
  referrals: '++id, patientId, status, urgency, createdAt',
  prefs: '&key',
  activity: '++id, at, kind, actor',
})

db.version(2).stores({
  // Compound index for the pharmacy "recent movements" feed.
  adjustments: '++id, medicationId, at, [medicationId+at]',
})

export const TABLES = [
  'patients',
  'vitals',
  'schedules',
  'medications',
  'dispensings',
  'adjustments',
  'referrals',
  'prefs',
  'activity',
]

export async function tableCounts() {
  const entries = await Promise.all(
    TABLES.map(async (name) => {
      try {
        return [name, await db.table(name).count()]
      } catch {
        return [name, 0]
      }
    }),
  )
  return Object.fromEntries(entries)
}

export default db
