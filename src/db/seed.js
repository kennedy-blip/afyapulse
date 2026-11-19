/**
 * First-run demo clinic: Meru County community unit + level-4 facility.
 * Realistic registers so triage, immunization countdowns and stock alerts are
 * immediately explorable. Everything here is fictional.
 */
import { db } from './db'
import { clearOperationalData, createPatient } from './repo'
import { assessVitals } from '../lib/triage'
import { addDays, toISODate } from '../lib/dates'
import { estimatedEdd } from '../lib/careplan'

const ADMIN = { role: 'admin', name: 'Dr. Faith Makena' }

const PROFILES = {
  'profile.admin': {
    name: 'Dr. Faith Makena',
    title: 'Clinical Officer / Admin',
    facility: 'Nkubu Level 4 Hospital',
    unit: 'Meru County · Imenti South',
    phone: '+254 722 145 903',
  },
  'profile.chp': {
    name: 'James Kimathi',
    title: 'Community Health Promoter',
    facility: 'Kanyakine Community Unit',
    unit: 'Meru County · Imenti South',
    phone: '+254 711 882 604',
  },
}

function stamp(daysAgo, hour = 9) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, Math.floor((daysAgo * 13) % 60), 0, 0)
  return d.toISOString()
}

function birthDateForYears(years, months = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() - (years * 12 + months))
  d.setDate(Math.max(1, d.getDate() - 4))
  return toISODate(d)
}

const PEOPLE = [
  {
    key: 'amina',
    firstName: 'Amina',
    lastName: 'Mwende',
    sex: 'F',
    ageYears: 24,
    ageMonths: 0,
    category: 'anc',
    ward: 'Nkubu',
    village: 'Kithure',
    phone: '0722145309',
    gestationWeeks: 32,
    gravida: 2,
    para: 1,
    symptoms: ['Pregnancy check-up', 'Swelling'],
    notes: 'Second pregnancy, mild pedal oedema. Tetanus toxoid up to date.',
    registeredDaysAgo: 96,
    actor: ADMIN,
    vitals: [
      { daysAgo: 84, systolic: 118, diastolic: 74, temperature: 36.6, pulse: 82, weight: 62, height: 162, spo2: 99, respRate: 18 },
      { daysAgo: 42, systolic: 134, diastolic: 86, temperature: 36.7, pulse: 88, weight: 65.5, height: 162, spo2: 98, respRate: 19 },
      { daysAgo: 3, systolic: 148, diastolic: 96, temperature: 36.8, pulse: 94, weight: 68, height: 162, spo2: 98, respRate: 18, notes: 'Bilateral ankle swelling, no headache.' },
    ],
    completeSchedulesBefore: true,
  },
  {
    key: 'joseph',
    firstName: 'Joseph',
    lastName: 'Mutuma',
    sex: 'M',
    ageYears: 41,
    ageMonths: 0,
    category: 'chronic',
    ward: 'Nkubu',
    village: 'Kaaga',
    phone: '0733881240',
    symptoms: ['Headache', 'Fatigue'],
    notes: 'Known hypertensive, missed two refills. Reports occipital headache.',
    registeredDaysAgo: 210,
    vitals: [
      { daysAgo: 61, systolic: 158, diastolic: 98, temperature: 36.7, pulse: 84, weight: 88, height: 174, spo2: 97, respRate: 18 },
      { daysAgo: 28, systolic: 168, diastolic: 104, temperature: 36.8, pulse: 86, weight: 87, height: 174, spo2: 97, respRate: 18 },
      { daysAgo: 1, systolic: 186, diastolic: 112, temperature: 36.9, pulse: 92, weight: 86, height: 174, spo2: 96, respRate: 20, dangerSigns: ['severe_headache'], notes: 'Blurred vision reported. Refer to Imenti South sub-county hospital.' },
    ],
    referral: { urgency: 'urgent', status: 'pending_approval', daysAgo: 1, reason: 'Hypertensive crisis 186/112 with headache and blurred vision' },
  },
  {
    key: 'faith',
    firstName: 'Faith',
    lastName: 'Kawira',
    sex: 'F',
    ageYears: 0,
    ageMonths: 2,
    birthDate: birthDateForYears(0, 2),
    category: 'child',
    ward: 'Kanyakine',
    village: 'Mwirine',
    phone: '0712998341',
    symptoms: ['Immunization visit'],
    notes: 'Mother reports good feeding. Birth weight 3.1 kg.',
    registeredDaysAgo: 44,
    vitals: [
      { daysAgo: 40, temperature: 36.5, pulse: 138, weight: 4.6, height: 55, muac: 12.4, respRate: 36, spo2: 99 },
      { daysAgo: 2, temperature: 36.6, pulse: 130, weight: 5.4, height: 57, muac: 12.8, respRate: 34, spo2: 99 },
    ],
    completedMilestones: [
      { title: 'Birth doses', daysAgo: 60 },
      { title: '6-week doses', daysAgo: 18 },
    ],
  },
  {
    key: 'peter',
    firstName: 'Peter',
    lastName: 'Kariuki',
    sex: 'M',
    ageYears: 3,
    ageMonths: 2,
    birthDate: birthDateForYears(3, 2),
    category: 'child',
    ward: 'Kanyakine',
    village: 'Giaki',
    phone: '0700221455',
    symptoms: ['Fever', 'Cough', 'Diarrhoea'],
    notes: 'Poor appetite for three days. MUAC in red zone.',
    registeredDaysAgo: 6,
    vitals: [
      { daysAgo: 6, temperature: 38.9, pulse: 138, weight: 11.6, height: 89, muac: 11.8, respRate: 38, spo2: 96 },
      { daysAgo: 0, temperature: 39.8, pulse: 152, weight: 11.2, height: 89, muac: 11.2, respRate: 42, spo2: 94, dangerSigns: ['unable_to_feed'] },
    ],
    referral: { urgency: 'urgent', status: 'approved', daysAgo: 0, reason: 'Severe acute malnutrition with fever and inability to feed' },
    manualSchedules: [
      { title: 'Severe malnutrition follow-up', detail: 'RUTF review at outreach point', type: 'nutrition', dueOffset: 3, status: 'pending' },
    ],
  },
  {
    key: 'esther',
    firstName: 'Esther',
    lastName: 'Ntinyari',
    sex: 'F',
    ageYears: 30,
    ageMonths: 0,
    category: 'anc',
    ward: 'Nkubu',
    village: 'Nkubu Market',
    phone: '0745882390',
    gestationWeeks: 20,
    gravida: 3,
    para: 2,
    symptoms: ['Pregnancy check-up'],
    notes: 'Booking visit completed at week 12. No danger signs.',
    registeredDaysAgo: 63,
    vitals: [
      { daysAgo: 60, systolic: 116, diastolic: 72, temperature: 36.5, pulse: 80, weight: 59, height: 158, spo2: 99, respRate: 18 },
      { daysAgo: 5, systolic: 112, diastolic: 72, temperature: 36.5, pulse: 78, weight: 61, height: 158, spo2: 99, respRate: 18 },
    ],
  },
  {
    key: 'daniel',
    firstName: 'Daniel',
    lastName: 'Mwangi',
    sex: 'M',
    ageYears: 67,
    ageMonths: 0,
    category: 'chronic',
    ward: 'Igoji',
    village: 'Kanyakine',
    phone: '0788112450',
    symptoms: ['Fatigue', 'Swelling'],
    notes: 'Type 2 diabetes and hypertension. On metformin and amlodipine.',
    registeredDaysAgo: 340,
    vitals: [
      { daysAgo: 33, systolic: 144, diastolic: 92, temperature: 36.4, pulse: 76, weight: 71, height: 168, spo2: 97, respRate: 18 },
      { daysAgo: 2, systolic: 138, diastolic: 88, temperature: 36.4, pulse: 72, weight: 70, height: 168, spo2: 97, respRate: 18 },
    ],
    completeSchedulesBefore: true,
  },
  {
    key: 'lucy',
    firstName: 'Lucy',
    lastName: 'Muthoni',
    sex: 'F',
    ageYears: 0,
    ageMonths: 9,
    birthDate: birthDateForYears(0, 9),
    category: 'child',
    ward: 'Timau',
    village: 'Kianjai',
    phone: '0701332948',
    symptoms: ['Immunization visit'],
    notes: 'Growth monitoring on track. Vitamin A due at 9 months.',
    registeredDaysAgo: 260,
    vitals: [
      { daysAgo: 95, temperature: 36.7, pulse: 122, weight: 7.4, height: 68, muac: 13.1, respRate: 32, spo2: 99 },
      { daysAgo: 7, temperature: 36.8, pulse: 118, weight: 8.1, height: 71, muac: 13.4, respRate: 30, spo2: 99 },
    ],
    completedMilestones: [
      { title: '14-week doses', daysAgo: 176 },
      { title: '6-month review', daysAgo: 89 },
    ],
  },
  {
    key: 'samuel',
    firstName: 'Samuel',
    lastName: 'Gitonga',
    sex: 'M',
    ageYears: 29,
    ageMonths: 0,
    category: 'general',
    ward: 'Maua',
    village: 'Mitunguu',
    phone: '0728334901',
    symptoms: ['Fever', 'Headache', 'Fatigue'],
    notes: 'Presumptive malaria. RDT requested at outreach.',
    registeredDaysAgo: 12,
    vitals: [
      { daysAgo: 11, temperature: 37.8, pulse: 96, weight: 66, height: 171, spo2: 98, respRate: 18, systolic: 122, diastolic: 78 },
      { daysAgo: 0, temperature: 38.6, pulse: 104, weight: 65, height: 171, spo2: 97, respRate: 20, systolic: 118, diastolic: 76, notes: 'No malaria RDT available on site.' },
    ],
  },
  {
    key: 'rehema',
    firstName: 'Rehema',
    lastName: 'Auma',
    sex: 'F',
    ageYears: 35,
    ageMonths: 0,
    category: 'anc',
    ward: 'Maua',
    village: 'Maua Town',
    phone: '0757223094',
    gestationWeeks: 38,
    gravida: 4,
    para: 3,
    symptoms: ['Pregnancy check-up', 'Fatigue'],
    notes: 'Previous delivery by caesarean. Birth preparedness discussed.',
    registeredDaysAgo: 150,
    vitals: [
      { daysAgo: 30, systolic: 120, diastolic: 78, temperature: 36.8, pulse: 84, weight: 72, height: 165, spo2: 98, respRate: 18 },
      { daysAgo: 4, systolic: 126, diastolic: 82, temperature: 36.9, pulse: 88, weight: 74, height: 165, spo2: 98, respRate: 18 },
    ],
  },
  {
    key: 'brian',
    firstName: 'Brian',
    lastName: 'Mwenda',
    sex: 'M',
    ageYears: 6,
    ageMonths: 0,
    category: 'general',
    ward: 'Nkubu',
    village: 'Kibirichia',
    phone: '0712667123',
    symptoms: ['Cough', 'Difficulty breathing'],
    notes: 'Wheeze on auscultation, no fever history. Inhaler technique taught.',
    registeredDaysAgo: 20,
    vitals: [
      { daysAgo: 19, temperature: 38.0, pulse: 122, weight: 18.4, height: 112, spo2: 94, respRate: 28, systolic: 104, diastolic: 66 },
      { daysAgo: 1, temperature: 38.2, pulse: 118, weight: 18.2, height: 112, spo2: 92, respRate: 26, systolic: 100, diastolic: 64 },
    ],
    referral: { urgency: 'caution', status: 'completed', daysAgo: 18, reason: 'Recurrent wheeze — paediatric review' },
  },
  {
    key: 'mercy',
    firstName: 'Mercy',
    lastName: 'Gacheri',
    sex: 'F',
    ageYears: 17,
    ageMonths: 0,
    category: 'general',
    ward: 'Timau',
    village: 'Timau',
    phone: '0798441203',
    symptoms: ['Abdominal pain'],
    notes: 'Referred for school health screening. No alarm features.',
    registeredDaysAgo: 32,
    vitals: [{ daysAgo: 31, systolic: 108, diastolic: 68, temperature: 37.1, pulse: 88, weight: 52, height: 161, spo2: 99, respRate: 18 }],
  },
  {
    key: 'kevin',
    firstName: 'Kevin',
    lastName: 'Muriithi',
    sex: 'M',
    ageYears: 52,
    ageMonths: 0,
    category: 'chronic',
    ward: 'Igoji',
    village: 'Igoji',
    phone: '0721440987',
    symptoms: ['Headache'],
    notes: 'Newly diagnosed hypertension, started on amlodipine.',
    registeredDaysAgo: 58,
    vitals: [
      { daysAgo: 55, systolic: 172, diastolic: 104, temperature: 36.6, pulse: 90, weight: 82, height: 176, spo2: 97, respRate: 18 },
      { daysAgo: 9, systolic: 162, diastolic: 98, temperature: 36.6, pulse: 86, weight: 81, height: 176, spo2: 97, respRate: 18 },
    ],
    referral: { urgency: 'caution', status: 'pending_approval', daysAgo: 9, reason: 'Stage 2 hypertension — confirm treatment escalation' },
  },
]

const MEDS = [
  { name: 'Measles-Rubella vaccine', category: 'vaccine', unit: 'doses', quantity: 8, reorderLevel: 20, baselineStock: 100, batch: 'MR-26A14', expiryOffset: 22, coldChain: 'cold', supplier: 'Meru County EPI store' },
  { name: 'Penta vaccine (DTP-HepB-Hib)', category: 'vaccine', unit: 'doses', quantity: 18, reorderLevel: 20, baselineStock: 120, batch: 'PENTA-26B07', expiryOffset: 58, coldChain: 'cold', supplier: 'Meru County EPI store' },
  { name: 'BCG vaccine', category: 'vaccine', unit: 'doses', quantity: 34, reorderLevel: 15, baselineStock: 60, batch: 'BCG-26C11', expiryOffset: 168, coldChain: 'cold', supplier: 'Meru County EPI store' },
  { name: 'OPV vaccine', category: 'vaccine', unit: 'doses', quantity: 96, reorderLevel: 20, baselineStock: 120, batch: 'OPV-26D02', expiryOffset: 214, coldChain: 'cold', supplier: 'Meru County EPI store' },
  { name: 'Tetanus Toxoid vaccine', category: 'vaccine', unit: 'doses', quantity: 42, reorderLevel: 15, baselineStock: 80, batch: 'TT-26E19', expiryOffset: 302, coldChain: 'cold', supplier: 'Meru County EPI store' },
  { name: 'Vitamin A 100,000 IU', category: 'vaccine', unit: 'caps', quantity: 120, reorderLevel: 40, baselineStock: 200, batch: 'VITA-26F05', expiryOffset: 142, coldChain: 'ambient', supplier: 'County nutrition programme' },
  { name: 'Oxytocin 10 IU', category: 'medicine', unit: 'vials', quantity: 6, reorderLevel: 10, baselineStock: 40, batch: 'OXY-25K33', expiryOffset: -12, coldChain: 'cold', supplier: 'KEMSA' },
  { name: 'Amoxicillin 250 mg DT', category: 'medicine', unit: 'tabs', quantity: 90, reorderLevel: 120, baselineStock: 600, batch: 'AMX-26G21', expiryOffset: 401, coldChain: 'ambient', supplier: 'KEMSA' },
  { name: 'Artemether-Lumefantrine 20/120', category: 'medicine', unit: 'tabs', quantity: 40, reorderLevel: 60, baselineStock: 288, batch: 'AL-26H09', expiryOffset: 512, coldChain: 'ambient', supplier: 'KEMSA' },
  { name: 'Paracetamol 500 mg', category: 'medicine', unit: 'tabs', quantity: 780, reorderLevel: 200, baselineStock: 1000, batch: 'PCM-26J44', expiryOffset: 648, coldChain: 'ambient', supplier: 'KEMSA' },
  { name: 'Oral Rehydration Salts', category: 'medicine', unit: 'sachets', quantity: 66, reorderLevel: 80, baselineStock: 400, batch: 'ORS-26K12', expiryOffset: 255, coldChain: 'ambient', supplier: 'KEMSA' },
  { name: 'Ferrous Sulphate + Folic Acid', category: 'medicine', unit: 'tabs', quantity: 210, reorderLevel: 150, baselineStock: 900, batch: 'FF-25L90', expiryOffset: -4, coldChain: 'ambient', supplier: 'KEMSA' },
  { name: 'Amlodipine 5 mg', category: 'medicine', unit: 'tabs', quantity: 150, reorderLevel: 60, baselineStock: 300, batch: 'AML-26M08', expiryOffset: 85, coldChain: 'ambient', supplier: 'KEMSA' },
  { name: 'Metformin 500 mg', category: 'medicine', unit: 'tabs', quantity: 260, reorderLevel: 80, baselineStock: 400, batch: 'MET-26N31', expiryOffset: 412, coldChain: 'ambient', supplier: 'KEMSA' },
  { name: 'Salbutamol inhaler 100 µg', category: 'medicine', unit: 'pcs', quantity: 4, reorderLevel: 6, baselineStock: 20, batch: 'SAL-26P17', expiryOffset: 221, coldChain: 'ambient', supplier: 'KEMSA' },
  { name: 'Examination gloves', category: 'consumable', unit: 'pcs', quantity: 320, reorderLevel: 100, baselineStock: 500, batch: 'GLV-26Q03', expiryOffset: 720, coldChain: 'ambient', supplier: 'County supply chain' },
]

async function insertVitals(patient, entries, actor) {
  const sorted = [...entries].sort((a, b) => b.daysAgo - a.daysAgo)
  let lastAssessment = null
  for (const entry of sorted) {
    const { daysAgo, ...readings } = entry
    const assessment = assessVitals(readings, patient)
    const recordedAt = stamp(daysAgo, 8 + (daysAgo % 7))
    await db.vitals.add({
      patientId: patient.id,
      systolic: readings.systolic ?? null,
      diastolic: readings.diastolic ?? null,
      temperature: readings.temperature ?? null,
      pulse: readings.pulse ?? null,
      weight: readings.weight ?? null,
      height: readings.height ?? null,
      spo2: readings.spo2 ?? null,
      respRate: readings.respRate ?? null,
      muac: readings.muac ?? null,
      dangerSigns: readings.dangerSigns || [],
      notes: readings.notes || '',
      recordedAt,
      recordedBy: actor.name,
      recordedByRole: actor.role,
      triageLevel: assessment.level,
      flags: assessment.flags,
      summary: assessment.summary,
      bmi: assessment.bmi,
    })
    lastAssessment = { assessment, recordedAt }
  }
  if (lastAssessment) {
    await db.patients.update(patient.id, {
      riskLevel: lastAssessment.assessment.level,
      lastVisitAt: lastAssessment.recordedAt,
      lastVitalAt: lastAssessment.recordedAt,
      lastTriageSummary: lastAssessment.assessment.summary,
    })
  }
}

export async function seedDemoData({ reset = true } = {}) {
  if (reset) await clearOperationalData()

  // Preserve an operator's own profile / lighting choice when refreshing demo data.
  for (const [key, value] of Object.entries(PROFILES)) {
    if (!(await db.prefs.get(key))) await db.prefs.put({ key, value })
  }
  if (!(await db.prefs.get('role'))) await db.prefs.put({ key: 'role', value: 'admin' })
  if (!(await db.prefs.get('theme'))) await db.prefs.put({ key: 'theme', value: 'clinical' })
  await db.prefs.put({ key: 'seeded', value: true })

  const ids = {}
  const patients = {}

  for (const person of PEOPLE) {
    const { vitals, referral, manualSchedules, completedMilestones, completeSchedulesBefore, registeredDaysAgo, actor, key, ...record } = person
    const actorForRecord = actor || ADMIN
    const { id } = await createPatient(
      { ...record, edd: record.category === 'anc' ? estimatedEdd({ ...record }) : null },
      actorForRecord,
      null,
    )
    ids[key] = id
    const createdAt = stamp(registeredDaysAgo, 8)
    await db.patients.update(id, { createdAt, updatedAt: createdAt, createdBy: actorForRecord.name })
    const saved = await db.patients.get(id)
    patients[key] = saved

    if (vitals?.length) await insertVitals(saved, vitals, actorForRecord)

    if (manualSchedules?.length) {
      for (const row of manualSchedules) {
        await db.schedules.add({
          patientId: id,
          type: row.type,
          title: row.title,
          detail: row.detail || '',
          dueDate: addDays(toISODate(new Date()), row.dueOffset),
          status: row.status,
          source: 'seed',
          completedAt: row.status === 'completed' && row.completedDaysAgo ? stamp(row.completedDaysAgo) : null,
          completedBy: row.status === 'completed' ? actorForRecord.name : null,
          createdAt: stamp(registeredDaysAgo),
        })
      }
    }

    if (completedMilestones?.length) {
      for (const milestone of completedMilestones) {
        const match = await db.schedules
          .where('patientId')
          .equals(id)
          .filter((row) => row.title === milestone.title)
          .first()
        if (match) {
          await db.schedules.update(match.id, {
            status: 'completed',
            completedAt: stamp(milestone.daysAgo, 10),
            completedBy: actorForRecord.name,
            completionNote: 'Recorded from the paper register during onboarding',
          })
        }
      }
    }

    if (completeSchedulesBefore) {
      const pending = await db.schedules.where('patientId').equals(id).toArray()
      const past = pending.filter((row) => row.status === 'pending' && row.dueDate < toISODate(new Date()))
      for (const row of past) {
        await db.schedules.update(row.id, {
          status: 'completed',
          completedAt: stamp(12),
          completedBy: actorForRecord.name,
          completionNote: 'Closed during outreach round',
        })
      }
    }

    if (referral) {
      await db.referrals.add({
        patientId: id,
        reason: referral.reason,
        urgency: referral.urgency,
        status: referral.status,
        notes: '',
        createdAt: stamp(referral.daysAgo, 11),
        createdBy: actorForRecord.name,
        createdByRole: 'chp',
        ...(referral.status === 'approved'
          ? { decidedAt: stamp(referral.daysAgo, 13), decidedBy: 'Dr. Faith Makena', decisionNote: 'Ambulance dispatched' }
          : {}),
        ...(referral.status === 'completed'
          ? { completedAt: stamp(referral.daysAgo - 1, 15), completedBy: 'Dr. Faith Makena' }
          : {}),
      })
    }
  }

  /* --------------------------------------------------------- dispensary */
  const medIds = {}
  for (const med of MEDS) {
    const { expiryOffset, ...rest } = med
    const id = await db.medications.add({
      ...rest,
      expiryDate: addDays(toISODate(new Date()), expiryOffset),
      notes: '',
      createdAt: stamp(120),
      updatedAt: stamp(4),
      updatedBy: ADMIN.name,
    })
    medIds[med.name] = id
    await db.adjustments.add({
      medicationId: id,
      delta: med.baselineStock,
      type: 'restock',
      balanceAfter: med.baselineStock,
      reason: 'Quarterly KEMSA delivery',
      at: stamp(88, 10),
      by: ADMIN.name,
    })
    if (med.baselineStock !== med.quantity) {
      await db.adjustments.add({
        medicationId: id,
        delta: med.quantity - med.baselineStock,
        type: 'dispense',
        balanceAfter: med.quantity,
        reason: 'Cumulative dispensing since delivery',
        at: stamp(6, 12),
        by: ADMIN.name,
      })
    }
  }

  const dispensePlan = [
    { key: 'amina', med: 'Ferrous Sulphate + Folic Acid', qty: 60, daysAgo: 3 },
    { key: 'amina', med: 'Tetanus Toxoid vaccine', qty: 1, daysAgo: 30 },
    { key: 'peter', med: 'Amoxicillin 250 mg DT', qty: 21, daysAgo: 5 },
    { key: 'peter', med: 'Oral Rehydration Salts', qty: 4, daysAgo: 0 },
    { key: 'samuel', med: 'Artemether-Lumefantrine 20/120', qty: 24, daysAgo: 0 },
    { key: 'samuel', med: 'Paracetamol 500 mg', qty: 12, daysAgo: 0 },
    { key: 'joseph', med: 'Amlodipine 5 mg', qty: 30, daysAgo: 1 },
    { key: 'daniel', med: 'Metformin 500 mg', qty: 60, daysAgo: 2 },
    { key: 'daniel', med: 'Amlodipine 5 mg', qty: 30, daysAgo: 2 },
    { key: 'brian', med: 'Salbutamol inhaler 100 µg', qty: 1, daysAgo: 1 },
    { key: 'faith', med: 'Measles-Rubella vaccine', qty: 1, daysAgo: 37 },
    { key: 'lucy', med: 'Vitamin A 100,000 IU', qty: 2, daysAgo: 88 },
  ]

  for (const item of dispensePlan) {
    const medId = medIds[item.med]
    if (!medId) continue
    await db.dispensings.add({
      medicationId: medId,
      patientId: ids[item.key],
      quantity: item.qty,
      notes: 'Dispensed at consultation',
      dispensedAt: stamp(item.daysAgo, 10 + (item.daysAgo % 6)),
      dispensedBy: ADMIN.name,
      medicationName: item.med,
      unit: MEDS.find((m) => m.name === item.med)?.unit || 'tabs',
      batch: MEDS.find((m) => m.name === item.med)?.batch || '',
    })
  }

  /* ------------------------------------------------------------- ledger */
  const feed = [
    { kind: 'vitals', message: 'AFY joseph vitals · URGENT', actor: ADMIN.name, daysAgo: 1 },
    { kind: 'referral', message: 'Referral raised for hypertensive crisis', actor: 'James Kimathi', daysAgo: 1 },
    { kind: 'stock', message: 'Measles-Rubella vaccine down to 8 doses', actor: ADMIN.name, daysAgo: 1 },
    { kind: 'vitals', message: 'vitals recorded for Peter Kariuki · URGENT', actor: 'James Kimathi', daysAgo: 0 },
    { kind: 'stock', message: 'Artemether-Lumefantrine dispensed −24 tabs', actor: ADMIN.name, daysAgo: 0 },
    { kind: 'schedule', message: 'Immunization outreach round closed for Kanyakine', actor: 'James Kimathi', daysAgo: 3 },
    { kind: 'patient', message: 'New household registration · Kianjai village', actor: 'James Kimathi', daysAgo: 4 },
  ]
  for (const entry of feed) {
    await db.activity.add({
      kind: entry.kind,
      message: entry.message,
      actor: entry.actor,
      actorRole: entry.actor === 'James Kimathi' ? 'chp' : 'admin',
      at: stamp(entry.daysAgo, 9 + (entry.daysAgo % 8)),
    })
  }

  await db.prefs.put({ key: 'patientSeq', value: PEOPLE.length })
  await db.prefs.put({ key: 'demoSeededAt', value: new Date().toISOString() })

  return { patients: PEOPLE.length, medications: MEDS.length }
}
