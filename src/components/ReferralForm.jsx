import React, { useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { createReferral } from '../db/repo'
import { useApp } from '../context/AppProvider'
import { fullName } from '../lib/format'
import Modal from './ui/Modal'
import { Field, Select, SubmitRow, TextArea } from './ui/Fields'

export default function ReferralForm({ open, onClose, patient }) {
  const { profile, toast, buzz } = useApp()
  const [form, setForm] = useState({ urgency: 'caution', reason: '', notes: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({ urgency: 'caution', reason: '', notes: '' })
      setError('')
    }
  }, [open, patient?.id])

  const submit = async (event) => {
    event.preventDefault()
    if (!form.reason.trim()) {
      setError('State the clinical reason so the referral can be triaged.')
      return
    }
    setBusy(true)
    try {
      await createReferral({ ...form, patientId: patient.id }, profile)
      toast({
        title: profile.role === 'admin' ? 'Referral approved' : 'Referral raised',
        message:
          profile.role === 'admin'
            ? `${fullName(patient)} approved for transfer. Print or share the referral slip.`
            : `${fullName(patient)} · awaiting clinical officer approval.`,
        tone: 'success',
      })
      buzz(20)
      onClose?.()
    } catch (err) {
      toast({ title: 'Could not raise referral', message: err.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      onSubmit={submit}
      open={open}
      onClose={onClose}
      title="Raise a referral"
      subtitle={patient ? `${fullName(patient)} · ${patient.code} · ${patient.ward || 'No ward'}` : ''}
      icon={Send}
      size="md"
      footer={<SubmitRow onCancel={onClose} submitLabel="Send to referral queue" busy={busy} hint="Works offline — the queue syncs when connectivity returns." />}
    >
      <div className="space-y-4">
        <Field label="Urgency" htmlFor="referral-urgency" required>
          <Select id="referral-urgency" value={form.urgency} onChange={(e) => setForm((c) => ({ ...c, urgency: e.target.value }))}>
            <option value="caution">Caution — review within 24 hours</option>
            <option value="urgent">Urgent — immediate transfer</option>
          </Select>
        </Field>
        <Field label="Clinical reason" htmlFor="referral-reason" error={error} required>
          <TextArea
            id="referral-reason"
            rows={3}
            value={form.reason}
            onChange={(e) => {
              setForm((c) => ({ ...c, reason: e.target.value }))
              if (error) setError('')
            }}
            placeholder="e.g. Hypertensive crisis 186/112 with visual disturbance"
          />
        </Field>
        <Field label="Handover notes" htmlFor="referral-notes" hint="Treatment already given, transport arrangement, next of kin.">
          <TextArea
            id="referral-notes"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
            placeholder="Optional"
          />
        </Field>
        {profile.role === 'chp' ? (
          <p className="rounded-xl border border-warn/25 bg-warn/5 px-3 py-2 text-[11px] leading-relaxed text-warn/90">
            Field-raised referrals enter the queue as <strong>pending clinical approval</strong>. Only a Clinical Officer can approve
            transfer.
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
