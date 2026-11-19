import React, { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { HandCoins, Pill } from 'lucide-react'
import { db } from '../../db/db'
import { dispenseMedication } from '../../db/repo'
import { useApp } from '../../context/AppProvider'
import { fullName } from '../../lib/format'
import { expiryStatus, stockStatus } from '../../lib/pharmacy'
import { formatDate } from '../../lib/dates'
import Modal from '../ui/Modal'
import { Field, NumberInput, Select, SubmitRow, TextArea } from '../ui/Fields'

export default function DispenseForm({ open, onClose, medication }) {
  const { profile, toast, buzz } = useApp()
  const [form, setForm] = useState({ patientId: '', quantity: '', notes: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const patients = useLiveQuery(() => db.patients.filter((patient) => !patient.archived).toArray(), [])

  useEffect(() => {
    if (open) {
      setForm({ patientId: '', quantity: '', notes: '' })
      setError('')
    }
  }, [open, medication?.id])

  const remaining = useMemo(() => {
    const qty = Number(form.quantity)
    if (!Number.isFinite(qty) || qty <= 0) return Number(medication?.quantity) || 0
    return Math.max(0, (Number(medication?.quantity) || 0) - qty)
  }, [form.quantity, medication])

  const stock = stockStatus(medication || {})
  const expiry = expiryStatus(medication || {})

  const submit = async (event) => {
    event.preventDefault()
    const qty = Number(form.quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Enter how many units are being dispensed.')
      return
    }
    if (qty > (Number(medication?.quantity) || 0)) {
      setError(`Only ${medication.quantity} ${medication.unit} remain on the shelf.`)
      return
    }
    if (expiry.id === 'expired') {
      setError('This batch has expired. Quarantine it — do not dispense to a patient.')
      return
    }
    setBusy(true)
    try {
      const result = await dispenseMedication(
        { medicationId: medication.id, patientId: form.patientId || null, quantity: qty, notes: form.notes },
        profile,
      )
      toast({
        title: 'Dispensed & deducted',
        message: `${qty} ${medication.unit} of ${medication.name} · ${result.remaining} left${result.remaining <= (medication.reorderLevel || 0) ? ' — reorder now' : ''}.`,
        tone: result.remaining <= (medication.reorderLevel || 0) ? 'warning' : 'success',
      })
      buzz(18)
      onClose?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      onSubmit={submit}
      open={open}
      onClose={onClose}
      title="Dispense medication"
      subtitle={medication ? `${medication.name} · batch ${medication.batch || '—'} · ${medication.quantity} ${medication.unit} available` : ''}
      icon={HandCoins}
      size="md"
      footer={<SubmitRow onCancel={onClose} submitLabel="Dispense & deduct" busy={busy} hint="Dispensing writes to the stock ledger and the patient history." />}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-line/20 bg-surface/40 p-2.5">
            <p className="label-clinical">On shelf</p>
            <p className="metric mt-1 text-lg font-semibold text-content">
              {medication?.quantity ?? 0}
              <span className="ml-1 text-[10px] font-normal text-muted">{medication?.unit}</span>
            </p>
          </div>
          <div className="rounded-xl border border-line/20 bg-surface/40 p-2.5">
            <p className="label-clinical">After dispensing</p>
            <p className={`metric mt-1 text-lg font-semibold ${remaining <= (medication?.reorderLevel || 0) ? 'text-warn' : 'text-ok'}`}>
              {remaining}
              <span className="ml-1 text-[10px] font-normal text-muted">{medication?.unit}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-clinical ${
            stock.tone === 'danger' ? 'border-danger/30 bg-danger/10 text-danger' : stock.tone === 'warn' ? 'border-warn/30 bg-warn/10 text-warn' : 'border-ok/30 bg-ok/10 text-ok'
          }`}>
            {stock.label}
          </span>
          <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-clinical ${
            expiry.tone === 'danger' ? 'border-danger/30 bg-danger/10 text-danger' : expiry.tone === 'warn' ? 'border-warn/30 bg-warn/10 text-warn' : 'border-line/20 bg-surface/40 text-muted'
          }`}>
            Expires {formatDate(medication?.expiryDate)}
          </span>
        </div>

        <Field label="Patient" htmlFor="dispense-patient" hint="Link the dose to a patient or record a walk-in.">
          <Select id="dispense-patient" value={form.patientId} onChange={(event) => setForm((c) => ({ ...c, patientId: event.target.value }))}>
            <option value="">Walk-in / unregistered</option>
            {(patients || []).map((patient) => (
              <option key={patient.id} value={patient.id}>
                {fullName(patient)} · {patient.code}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={`Quantity (${medication?.unit || 'units'})`} htmlFor="dispense-qty" error={error} required>
          <NumberInput
            id="dispense-qty"
            value={form.quantity}
            onChange={(event) => {
              setForm((c) => ({ ...c, quantity: event.target.value }))
              if (error) setError('')
            }}
            min={1}
            max={medication?.quantity || 0}
            placeholder="10"
            suffix={medication?.unit}
          />
        </Field>

        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 5, 10, 30].map((qty) => (
            <button
              key={qty}
              type="button"
              onClick={() => setForm((c) => ({ ...c, quantity: String(Math.min(qty, medication?.quantity || 0)) }))}
              className="rounded-md border border-line/20 bg-surface/30 px-2 py-1 text-[10px] text-muted transition-colors hover:border-brand/30 hover:text-brand"
            >
              {qty}
            </button>
          ))}
        </div>

        <Field label="Dispensing notes" htmlFor="dispense-notes">
          <TextArea
            id="dispense-notes"
            rows={2}
            value={form.notes}
            onChange={(event) => setForm((c) => ({ ...c, notes: event.target.value }))}
            placeholder="Dosage instructions, counselled on adherence…"
          />
        </Field>

        <p className="flex items-start gap-2 rounded-xl border border-brand/20 bg-brand/5 px-3 py-2 text-[10px] leading-relaxed text-muted">
          <Pill size={12} className="mt-0.5 shrink-0 text-brand" />
          Verify the patient, dose and batch before dispensing. Expired batches must be quarantined, not issued.
        </p>
      </div>
    </Modal>
  )
}
