import React, { useEffect, useState } from 'react'
import { CalendarCog, SlidersHorizontal } from 'lucide-react'
import { adjustStock, overrideExpiry } from '../../db/repo'
import { useApp } from '../../context/AppProvider'
import { addDays, formatDate, todayISO } from '../../lib/dates'
import Modal from '../ui/Modal'
import { Field, NumberInput, SubmitRow, TextArea, TextInput } from '../ui/Fields'

/**
 * mode: 'adjust'   — correct a shelf count with a signed delta
 *       'expiry'   — clinical expiry override with mandatory justification
 */
export default function StockActionForm({ open, onClose, medication, mode = 'adjust' }) {
  const { profile, toast, buzz } = useApp()
  const [form, setForm] = useState({ delta: '', reason: '', expiryDate: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setError('')
    setForm({
      delta: '',
      reason: '',
      expiryDate: medication?.expiryDate || addDays(todayISO(), 180),
    })
  }, [open, medication, mode])

  const nextBalance = Math.max(0, (Number(medication?.quantity) || 0) + (Number(form.delta) || 0))

  const submit = async (event) => {
    event.preventDefault()
    if (mode === 'adjust') {
      if (!Number(form.delta)) {
        setError('Enter the signed correction (e.g. -6 for breakage).')
        return
      }
      if (!form.reason.trim()) {
        setError('Explain the correction for the audit trail.')
        return
      }
      setBusy(true)
      try {
        await adjustStock({ id: medication.id, delta: form.delta, reason: form.reason }, profile)
        toast({ title: 'Stock corrected', message: `${medication.name} · new balance ${nextBalance} ${medication.unit}.`, tone: 'success' })
        buzz(14)
        onClose?.()
      } catch (err) {
        setError(err.message)
      } finally {
        setBusy(false)
      }
      return
    }

    if (!form.expiryDate) {
      setError('Pick the confirmed expiry date.')
      return
    }
    if (!form.reason.trim()) {
      setError('An expiry override requires a clinical justification.')
      return
    }
    setBusy(true)
    try {
      await overrideExpiry({ id: medication.id, expiryDate: form.expiryDate, reason: form.reason }, profile)
      toast({
        title: 'Expiry override recorded',
        message: `${medication.name} → ${formatDate(form.expiryDate)}. Your name is attached to this change.`,
        tone: 'success',
      })
      buzz(14)
      onClose?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const isAdjust = mode === 'adjust'

  return (
    <Modal
      onSubmit={submit}
      open={open}
      onClose={onClose}
      title={isAdjust ? 'Adjust shelf count' : 'Override expiry date'}
      subtitle={
        medication
          ? `${medication.name} · batch ${medication.batch || '—'} · ${medication.quantity} ${medication.unit} on shelf`
          : ''
      }
      icon={isAdjust ? SlidersHorizontal : CalendarCog}
      size="sm"
      footer={
        <SubmitRow
          onCancel={onClose}
          submitLabel={isAdjust ? 'Post correction' : 'Apply override'}
          busy={busy}
          hint="Both actions are permission-gated to the Clinical Officer and fully audited."
        />
      }
    >
      <div className="space-y-4">
        {isAdjust ? (
          <>
            <Field label="Correction (+/-)" htmlFor="adjust-delta" error={error} required hint="Use negative values for breakage, loss or expired disposal.">
              <NumberInput
                id="adjust-delta"
                value={form.delta}
                onChange={(event) => setForm((c) => ({ ...c, delta: event.target.value }))}
                placeholder="-6"
                suffix={medication?.unit}
              />
            </Field>
            <div className="flex items-center justify-between rounded-xl border border-line/20 bg-surface/40 px-3 py-2.5">
              <span className="text-[11px] text-muted">
                {medication?.quantity ?? 0} → <span className="font-semibold text-content">{nextBalance}</span> {medication?.unit}
              </span>
              <span className={`text-[10px] font-semibold uppercase tracking-clinical ${Number(form.delta) < 0 ? 'text-danger' : 'text-ok'}`}>
                {Number(form.delta) > 0 ? 'increase' : Number(form.delta) < 0 ? 'decrease' : 'no change'}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-warn/25 bg-warn/5 px-3 py-2 text-[11px] leading-relaxed text-warn/90">
              Current recorded expiry: <strong>{formatDate(medication?.expiryDate)}</strong>. Only override when the manufacturer's
              label or a documented stability assessment supports it.
            </div>
            <Field label="Confirmed expiry" htmlFor="expiry-date" required>
              <TextInput
                id="expiry-date"
                type="date"
                value={form.expiryDate}
                onChange={(event) => setForm((c) => ({ ...c, expiryDate: event.target.value }))}
              />
            </Field>
          </>
        )}

        <Field label="Justification" htmlFor="stock-reason" error={error} required>
          <TextArea
            id="stock-reason"
            rows={3}
            value={form.reason}
            onChange={(event) => {
              setForm((c) => ({ ...c, reason: event.target.value }))
              if (error) setError('')
            }}
            placeholder={isAdjust ? 'e.g. 6 tablets damaged in transit — verified by two officers' : 'e.g. Manufacturer confirmed extended shelf life, batch letter filed'}
          />
        </Field>
      </div>
    </Modal>
  )
}
