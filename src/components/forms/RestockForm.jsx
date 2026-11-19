import React, { useEffect, useState } from 'react'
import { PackageCheck, Snowflake } from 'lucide-react'
import { restockMedication } from '../../db/repo'
import { useApp } from '../../context/AppProvider'
import { addDays, todayISO } from '../../lib/dates'
import Modal from '../ui/Modal'
import { Field, NumberInput, SubmitRow, TextInput } from '../ui/Fields'

export default function RestockForm({ open, onClose, medication }) {
  const { profile, toast, buzz } = useApp()
  const [form, setForm] = useState({ quantity: '', batch: '', expiryDate: '', reason: 'Stock received' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !medication) return
    setForm({
      quantity: '',
      batch: medication.batch || '',
      expiryDate: medication.expiryDate || addDays(todayISO(), 365),
      reason: 'Stock received',
    })
    setError('')
  }, [open, medication])

  const nextTotal = (Number(medication?.quantity) || 0) + (Number(form.quantity) || 0)

  const submit = async (event) => {
    event.preventDefault()
    const qty = Number(form.quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Enter the quantity received.')
      return
    }
    if (!form.expiryDate) {
      setError('Record the batch expiry date.')
      return
    }
    if (form.expiryDate < todayISO()) {
      setError('That batch has already expired — quarantine it instead of adding it to the shelf.')
      return
    }
    setBusy(true)
    try {
      await restockMedication({ id: medication.id, ...form }, profile)
      toast({
        title: 'Stock received',
        message: `${medication.name} +${qty} ${medication.unit} · new balance ${nextTotal}.`,
        tone: 'success',
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
      title="Restock from store"
      subtitle={medication ? `${medication.name} · ${medication.quantity} ${medication.unit} on shelf` : ''}
      icon={PackageCheck}
      size="md"
      footer={<SubmitRow onCancel={onClose} submitLabel="Add to stock" busy={busy} hint="Updates the shelf balance and writes a restock entry to the ledger." />}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity received" htmlFor="restock-qty" error={error} required>
            <NumberInput id="restock-qty" value={form.quantity} onChange={(event) => setForm((c) => ({ ...c, quantity: event.target.value }))} min={1} placeholder="100" suffix={medication?.unit} />
          </Field>
          <Field label="New balance" htmlFor="restock-total">
            <div className="field flex items-center justify-between bg-surface/30">
              <span className="metric text-sm font-semibold text-content">{nextTotal}</span>
              <span className="text-[10px] uppercase tracking-clinical text-muted">{medication?.unit}</span>
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Batch / lot" htmlFor="restock-batch" required>
            <TextInput id="restock-batch" value={form.batch} onChange={(event) => setForm((c) => ({ ...c, batch: event.target.value }))} placeholder="AMX-26G22" />
          </Field>
          <Field label="Expiry" htmlFor="restock-expiry" required>
            <TextInput id="restock-expiry" type="date" value={form.expiryDate} onChange={(event) => setForm((c) => ({ ...c, expiryDate: event.target.value }))} />
          </Field>
        </div>

        <Field label="Reason / source" htmlFor="restock-reason">
          <TextInput id="restock-reason" value={form.reason} onChange={(event) => setForm((c) => ({ ...c, reason: event.target.value }))} placeholder="KEMSA delivery, transfer from sub-county store…" />
        </Field>

        {medication?.coldChain === 'cold' ? (
          <p className="flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3 py-2 text-[11px] leading-relaxed text-muted">
            <Snowflake size={13} className="mt-0.5 shrink-0 text-accent" />
            Cold-chain item: check the vaccine vial monitor and confirm the fridge stayed between 2–8 °C before shelving this batch.
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
