import React, { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarPlus } from 'lucide-react'
import { db } from '../../db/db'
import { createSchedule } from '../../db/repo'
import { useApp } from '../../context/AppProvider'
import { fullName } from '../../lib/format'
import { todayISO } from '../../lib/dates'
import Modal from '../ui/Modal'
import { Field, Select, TextArea, TextInput, SubmitRow } from '../ui/Fields'

const TYPES = [
  { value: 'immunization', label: 'Immunisation / EPI' },
  { value: 'anc', label: 'Antenatal care (ANC)' },
  { value: 'chronic', label: 'Chronic care review' },
  { value: 'nutrition', label: 'Nutrition / growth' },
  { value: 'referral', label: 'Referral follow-up' },
]

const TITLE_HINTS = {
  immunization: 'e.g. Measles-Rubella 2',
  anc: 'e.g. ANC contact 4',
  chronic: 'e.g. Monthly BP review',
  nutrition: 'e.g. RUTF weight check',
  referral: 'e.g. Post-referral review',
}

export default function ScheduleForm({ open, onClose, patientId = null, defaultType = 'immunization' }) {
  const { profile, toast, buzz } = useApp()
  const patients = useLiveQuery(
    () => db.patients.filter((p) => !p.archived).toArray(),
    [],
  )
  const [form, setForm] = useState({
    patientId: patientId ? String(patientId) : '',
    type: defaultType,
    title: '',
    detail: '',
    dueDate: todayISO(),
    notes: '',
  })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({
      patientId: patientId ? String(patientId) : '',
      type: defaultType,
      title: '',
      detail: '',
      dueDate: todayISO(),
      notes: '',
    })
    setErrors({})
  }, [open, patientId, defaultType])

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const handleType = (event) => {
    const type = event.target.value
    setForm((current) => ({ ...current, type, title: current.title || '' }))
  }

  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!form.patientId) nextErrors.patientId = 'Choose the patient this visit belongs to.'
    if (!form.title.trim()) nextErrors.title = 'Name the visit so the outreach team knows what is due.'
    if (!form.dueDate) nextErrors.dueDate = 'Pick a due date.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setBusy(true)
    try {
      await createSchedule(form, profile)
      toast({
        title: 'Follow-up scheduled',
        message: `Due ${form.dueDate}. It will appear in the outreach queue offline.`,
        tone: 'success',
      })
      buzz([10, 30, 10])
      onClose?.()
    } catch (error) {
      toast({ title: 'Could not schedule', message: error.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      onSubmit={submit}
      open={open}
      onClose={onClose}
      title="Schedule a follow-up"
      subtitle="Add an ANC contact, EPI milestone or outreach visit to the register."
      icon={CalendarPlus}
      size="md"
      footer={
        <SubmitRow
          onCancel={onClose}
          submitLabel="Add to schedule"
          busy={busy}
          hint="Saved on this device immediately — no network required."
        />
      }
    >
      <div className="space-y-4">
        {patients && patients.length === 0 ? (
          <p className="rounded-xl border border-warn/30 bg-warn/5 px-3 py-2 text-[11px] leading-relaxed text-warn">
            There are no active patients on this device yet. Register a patient first, then add their follow-up.
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Patient" htmlFor="schedule-patient" error={errors.patientId} required>
            <Select id="schedule-patient" value={form.patientId} onChange={update('patientId')} disabled={Boolean(patientId)}>
              <option value="">Select patient…</option>
              {(patients || []).map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {fullName(patient)} · {patient.code}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Visit type" htmlFor="schedule-type" required>
            <Select id="schedule-type" value={form.type} onChange={handleType}>
              {TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Visit title" htmlFor="schedule-title" error={errors.title} required>
          <TextInput
            id="schedule-title"
            value={form.title}
            onChange={update('title')}
            placeholder={TITLE_HINTS[form.type]}
            invalid={Boolean(errors.title)}
          />
        </Field>

        <Field label="Due date" htmlFor="schedule-date" error={errors.dueDate} required hint="The countdown updates automatically, offline.">
          <TextInput id="schedule-date" type="date" value={form.dueDate} onChange={update('dueDate')} />
        </Field>

        <Field label="What happens at the visit" htmlFor="schedule-detail" hint="Vaccines, tests or counselling expected.">
          <TextInput
            id="schedule-detail"
            value={form.detail}
            onChange={update('detail')}
            placeholder="e.g. Penta 3 · OPV 3 · growth check"
          />
        </Field>

        <Field label="Field notes" htmlFor="schedule-notes">
          <TextArea id="schedule-notes" rows={2} value={form.notes} onChange={update('notes')} placeholder="Optional context for the visiting CHP" />
        </Field>
      </div>
    </Modal>
  )
}
