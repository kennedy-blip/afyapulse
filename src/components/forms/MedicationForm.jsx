import React, { useEffect, useState } from 'react'
import { PackagePlus } from 'lucide-react'
import { createMedication, updateMedication } from '../../db/repo'
import { useApp } from '../../context/AppProvider'
import { addDays, todayISO } from '../../lib/dates'
import { COLD_CHAIN_LABEL, CATEGORY_LABEL, STOCK_UNITS } from '../../lib/pharmacy'
import Modal from '../ui/Modal'
import { Field, NumberInput, Select, SubmitRow, TextArea, TextInput } from '../ui/Fields'

const EMPTY = {
  name: '',
  category: 'medicine',
  quantity: '',
  unit: 'tabs',
  reorderLevel: '',
  baselineStock: '',
  batch: '',
  expiryDate: addDays(todayISO(), 365),
  coldChain: 'ambient',
  supplier: '',
  notes: '',
}

export default function MedicationForm({ open, onClose, medication = null }) {
  const { profile, toast, buzz } = useApp()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const editing = Boolean(medication?.id)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm(
      medication
        ? {
            name: medication.name || '',
            category: medication.category || 'medicine',
            quantity: medication.quantity ?? '',
            unit: medication.unit || 'tabs',
            reorderLevel: medication.reorderLevel ?? '',
            baselineStock: medication.baselineStock ?? '',
            batch: medication.batch || '',
            expiryDate: medication.expiryDate || '',
            coldChain: medication.coldChain || 'ambient',
            supplier: medication.supplier || '',
            notes: medication.notes || '',
          }
        : EMPTY,
    )
  }, [open, medication])

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!form.name.trim()) nextErrors.name = 'Drug or vaccine name is required.'
    if (form.quantity === '' || Number(form.quantity) < 0) nextErrors.quantity = 'Enter the current quantity.'
    if (!form.expiryDate) nextErrors.expiryDate = 'An expiry date is required for stock safety.'
    if (Number(form.reorderLevel) < 0) nextErrors.reorderLevel = 'Reorder level cannot be negative.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setBusy(true)
    try {
      if (editing) {
        await updateMedication(medication.id, form, profile)
        toast({ title: 'Stock line updated', message: form.name, tone: 'success' })
      } else {
        await createMedication(form, profile)
        toast({ title: 'Stock line added', message: `${form.name} · ${form.quantity} ${form.unit}`, tone: 'success' })
      }
      buzz(16)
      onClose?.()
    } catch (error) {
      toast({ title: 'Could not save stock line', message: error.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      onSubmit={submit}
      open={open}
      onClose={onClose}
      title={editing ? 'Edit stock line' : 'Add stock line'}
      subtitle="Inventory changes are audit-logged with your name and timestamp."
      icon={PackagePlus}
      size="lg"
      footer={<SubmitRow onCancel={onClose} submitLabel={editing ? 'Save stock line' : 'Add to dispensary'} busy={busy} hint="Clinical Officer privilege required." />}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Drug / vaccine name" htmlFor="med-name" error={errors.name} required className="sm:col-span-2">
            <TextInput id="med-name" value={form.name} onChange={update('name')} placeholder="e.g. Amoxicillin 250 mg DT" />
          </Field>
          <Field label="Category" htmlFor="med-category" required>
            <Select id="med-category" value={form.category} onChange={update('category')}>
              {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cold chain" htmlFor="med-cold" required>
            <Select id="med-cold" value={form.coldChain} onChange={update('coldChain')}>
              {Object.entries(COLD_CHAIN_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Quantity on shelf" htmlFor="med-qty" error={errors.quantity} required>
            <NumberInput id="med-qty" value={form.quantity} onChange={update('quantity')} min={0} placeholder="120" suffix={form.unit} />
          </Field>
          <Field label="Unit" htmlFor="med-unit" required>
            <Select id="med-unit" value={form.unit} onChange={update('unit')}>
              {STOCK_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reorder level" htmlFor="med-reorder" error={errors.reorderLevel} hint="Low-stock alert triggers at or below this level.">
            <NumberInput id="med-reorder" value={form.reorderLevel} onChange={update('reorderLevel')} min={0} placeholder="60" suffix={form.unit} />
          </Field>
          <Field label="Full-shelf baseline" htmlFor="med-baseline" hint="Used for the stock-level bar.">
            <NumberInput id="med-baseline" value={form.baselineStock} onChange={update('baselineStock')} min={1} placeholder="300" suffix={form.unit} />
          </Field>
          <Field label="Batch / lot number" htmlFor="med-batch">
            <TextInput id="med-batch" value={form.batch} onChange={update('batch')} placeholder="AMX-26G21" />
          </Field>
          <Field label="Expiry date" htmlFor="med-expiry" error={errors.expiryDate} required>
            <TextInput id="med-expiry" type="date" value={form.expiryDate} onChange={update('expiryDate')} />
          </Field>
          <Field label="Supplier" htmlFor="med-supplier" className="sm:col-span-2">
            <TextInput id="med-supplier" value={form.supplier} onChange={update('supplier')} placeholder="KEMSA / county store" />
          </Field>
          <Field label="Notes" htmlFor="med-notes" className="sm:col-span-2">
            <TextArea id="med-notes" rows={2} value={form.notes} onChange={update('notes')} placeholder="Storage instructions, alternate pack size…" />
          </Field>
        </div>
        {Number(form.quantity) <= Number(form.reorderLevel) && form.quantity !== '' ? (
          <p className="rounded-xl border border-warn/30 bg-warn/5 px-3 py-2 text-[11px] leading-relaxed text-warn">
            This quantity is at or below the reorder level — the line will immediately appear in low-stock alerts.
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
