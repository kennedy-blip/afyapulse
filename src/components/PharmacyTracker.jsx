import React, { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCog,
  ClipboardList,
  History,
  Lock,
  Package,
  PackagePlus,
  Pill,
  Plus,
  Search,
  SlidersHorizontal,
  Snowflake,
  Syringe,
  Trash2,
  TriangleAlert,
  Warehouse,
} from 'lucide-react'
import { db } from '../db/db'
import { deleteMedication } from '../db/repo'
import { useApp } from '../context/AppProvider'
import { formatDate, formatDateTime, todayISO } from '../lib/dates'
import { fullName } from '../lib/format'
import {
  CATEGORY_LABEL,
  COLD_CHAIN_LABEL,
  expiryStatus,
  needsAttention,
  sortInventory,
  stockPercent,
  stockStatus,
} from '../lib/pharmacy'
import { AdminLock, Badge, EmptyState, ProgressBar, SectionHeading, Segmented, StatTile, TrustNote } from './ui/Primitives'
import { Select, TextInput } from './ui/Fields'
import ConfirmDialog from './ui/ConfirmDialog'
import DispenseForm from './forms/DispenseForm'
import RestockForm from './forms/RestockForm'
import MedicationForm from './forms/MedicationForm'
import StockActionForm from './forms/StockActionForm'

const VIEWS = [
  { value: 'inventory', label: 'Inventory' },
  { value: 'dispensing', label: 'Dispensing' },
  { value: 'movements', label: 'Ledger' },
]

const FILTERS = [
  { value: 'all', label: 'All lines' },
  { value: 'low', label: 'Low stock' },
  { value: 'expiring', label: 'Expiring' },
  { value: 'vaccine', label: 'Vaccines' },
  { value: 'cold', label: 'Cold chain' },
]

const CATEGORY_ICON = { vaccine: Syringe, medicine: Pill, consumable: Package }

export default function PharmacyTracker() {
  const { isAdmin, profile, toast } = useApp()
  const [view, setView] = useState('inventory')
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('urgency')
  const [expandedId, setExpandedId] = useState(null)

  const [dispenseFor, setDispenseFor] = useState(null)
  const [restockFor, setRestockFor] = useState(null)
  const [medForm, setMedForm] = useState({ open: false, medication: null })
  const [stockAction, setStockAction] = useState({ open: false, medication: null, mode: 'adjust' })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [busy, setBusy] = useState(false)

  const data = useLiveQuery(async () => {
    const [meds, dispensings, adjustments, patients] = await Promise.all([
      db.medications.toArray(),
      db.dispensings.toArray(),
      db.adjustments.toArray(),
      db.patients.toArray(),
    ])
    const medById = new Map(meds.map((med) => [med.id, med]))
    const patientById = new Map(patients.map((patient) => [patient.id, patient]))
    return {
      meds,
      dispensings: dispensings
        .map((row) => ({ ...row, medication: medById.get(row.medicationId), patient: patientById.get(row.patientId) }))
        .sort((a, b) => b.dispensedAt.localeCompare(a.dispensedAt)),
      adjustments: adjustments
        .map((row) => ({ ...row, medication: medById.get(row.medicationId) }))
        .sort((a, b) => b.at.localeCompare(a.at)),
      patients,
    }
  }, [])

  const meds = data?.meds || []
  const today = todayISO()

  const stats = useMemo(() => {
    const low = meds.filter((med) => ['low', 'out'].includes(stockStatus(med).id))
    const expiring = meds.filter((med) => ['critical', 'expired'].includes(expiryStatus(med).id))
    const cold = meds.filter((med) => med.coldChain === 'cold')
    const dispensedToday = (data?.dispensings || [])
      .filter((row) => row.dispensedAt?.slice(0, 10) === today)
      .reduce((total, row) => total + (Number(row.quantity) || 0), 0)
    return { low, expiring, cold, dispensedToday }
  }, [meds, data, today])

  const filteredMeds = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const rows = meds
      .filter((med) => {
        if (filter === 'low') return ['low', 'out'].includes(stockStatus(med).id)
        if (filter === 'expiring') return ['critical', 'expired', 'warning'].includes(expiryStatus(med).id)
        if (filter === 'vaccine') return med.category === 'vaccine'
        if (filter === 'cold') return med.coldChain === 'cold'
        return true
      })
      .filter((med) => {
        if (!needle) return true
        return [med.name, med.batch, med.supplier, CATEGORY_LABEL[med.category]].filter(Boolean).join(' ').toLowerCase().includes(needle)
      })
    if (sort === 'name') return rows.sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'expiry') return rows.sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate)))
    return sortInventory(rows)
  }, [meds, filter, query, sort])

  const filteredDispensings = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (data?.dispensings || []).filter((row) => {
      if (!needle) return true
      return [row.medicationName, row.patient ? fullName(row.patient) : 'walk-in', row.patient?.code, row.batch, row.dispensedBy]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [data, query])

  const filteredAdjustments = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (data?.adjustments || []).filter((row) => {
      if (!needle) return true
      return [row.medication?.name, row.reason, row.by, row.type].filter(Boolean).join(' ').toLowerCase().includes(needle)
    })
  }, [data, query])

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await deleteMedication(deleteTarget.id, profile)
      toast({ title: 'Stock line removed', message: deleteTarget.name, tone: 'warning' })
      setDeleteTarget(null)
    } catch (error) {
      toast({ title: 'Could not remove', message: error.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <SectionHeading
        eyebrow={isAdmin ? 'Dispensary console' : 'Field stock view'}
        title="Pharmacy & cold chain"
        description={
          isAdmin
            ? 'Batch-level stock control, expiry surveillance and a dispensing ledger that works with no signal.'
            : 'Check what the clinic can offer before referring a household. Stock changes stay locked to the clinical officer.'
        }
        icon={Pill}
        action={
          isAdmin ? (
            <button type="button" className="btn btn-primary" onClick={() => setMedForm({ open: true, medication: null })}>
              <PackagePlus size={15} /> Add stock line
            </button>
          ) : (
            <AdminLock label="Inventory locked" />
          )
        }
      />

      {stats.expiring.length ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-warn/35 bg-warn/[0.06] p-3.5"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-warn/35 bg-warn/15 text-warn">
              <TriangleAlert size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-content">
                {stats.expiring.length} {stats.expiring.length === 1 ? 'batch needs' : 'batches need'} expiry action
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                {stats.expiring.filter((med) => expiryStatus(med).id === 'expired').length} expired ·{' '}
                {stats.expiring.filter((med) => expiryStatus(med).id === 'critical').length} expiring within 30 days. Quarantine expired
                stock and reorder before the shelf empties.
              </p>
            </div>
            <button type="button" className="btn btn-secondary !py-1.5 !text-[11px]" onClick={() => setFilter('expiring')}>
              Review expiries
            </button>
          </div>
        </motion.div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile label="Stock lines" value={meds.length} icon={Warehouse} tone="brand" hint={`${meds.filter((med) => med.category === 'vaccine').length} vaccine lines`} />
        <StatTile label="Low / out of stock" value={stats.low.length} icon={TriangleAlert} tone={stats.low.length ? 'danger' : 'ok'} hint="At or below reorder level" onClick={() => { setView('inventory'); setFilter('low') }} active={filter === 'low'} />
        <StatTile label="Expiry alerts" value={stats.expiring.length} icon={CalendarCog} tone={stats.expiring.length ? 'warn' : 'ok'} hint="Expired or under 90 days" onClick={() => { setView('inventory'); setFilter('expiring') }} active={filter === 'expiring'} />
        <StatTile label="Dispensed today" value={stats.dispensedToday} icon={ClipboardList} tone="accent" hint={`${(data?.dispensings || []).filter((row) => row.dispensedAt?.slice(0, 10) === today).length} dispensing records`} onClick={() => setView('dispensing')} active={view === 'dispensing'} />
      </div>

      <div className="glass rounded-2xl p-3">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <TextInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={view === 'inventory' ? 'Search drug, batch or supplier…' : view === 'dispensing' ? 'Search patient, drug or worker…' : 'Search ledger entries…'}
                className="!py-2.5 pl-9"
                aria-label="Search pharmacy records"
              />
            </div>
            <div className="overflow-x-auto no-scrollbar">
              <Segmented options={VIEWS} value={view} onChange={setView} size="sm" />
            </div>
            {view === 'inventory' ? (
              <Select value={sort} onChange={(event) => setSort(event.target.value)} className="!py-2.5 text-[11px]" aria-label="Sort inventory">
                <option value="urgency">Sort: urgency</option>
                <option value="expiry">Sort: expiry</option>
                <option value="name">Sort: name</option>
              </Select>
            ) : null}
          </div>

          {view === 'inventory' ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {FILTERS.map((item) => {
                const active = filter === item.value
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFilter(item.value)}
                    className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-clinical transition-all ${
                      active ? 'border-brand/45 bg-brand/15 text-brand' : 'border-line/20 bg-surface/30 text-muted hover:text-content'
                    }`}
                  >
                    {item.label}
                  </button>
                )
              })}
              <span className="ml-auto hidden text-[10px] uppercase tracking-clinical text-muted sm:block">{filteredMeds.length} lines</span>
            </div>
          ) : null}
        </div>
      </div>

      {!data ? (
        <div className="grid gap-2.5 xl:grid-cols-2">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="glass h-32 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : view === 'inventory' ? (
        filteredMeds.length ? (
          <div className="grid gap-2.5 xl:grid-cols-2">
            {filteredMeds.map((med) => {
              const stock = stockStatus(med)
              const expiry = expiryStatus(med)
              const percent = stockPercent(med)
              const Icon = CATEGORY_ICON[med.category] || Pill
              const expanded = expandedId === med.id
              const expired = expiry.id === 'expired'
              return (
                <motion.article
                  layout
                  key={med.id}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className={`glass overflow-hidden rounded-2xl ${expanded ? 'border-brand/35' : 'glass-hover'} ${
                    expired ? 'border-danger/35' : ''
                  }`}
                >
                  <div className="p-3 sm:p-3.5">
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
                          expired
                            ? 'border-danger/35 bg-danger/10 text-danger'
                            : med.coldChain === 'cold'
                              ? 'border-accent/30 bg-accent/10 text-accent'
                              : 'border-brand/25 bg-brand/10 text-brand'
                        }`}
                      >
                        <Icon size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="truncate text-[13px] font-semibold text-content">{med.name}</h3>
                          <Badge tone={expired ? 'danger' : expiry.tone === 'warn' ? 'warn' : 'muted'}>{expiry.label}</Badge>
                          {med.coldChain === 'cold' ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-accent/25 bg-accent/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-clinical text-accent">
                              <Snowflake size={9} /> 2–8 °C
                            </span>
                          ) : null}
                          {med.expiryOverriddenAt ? (
                            <span className="rounded-md border border-warn/25 bg-warn/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-clinical text-warn">
                              Override
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-[10px] text-muted">
                          {CATEGORY_LABEL[med.category]} · batch {med.batch || '—'} · exp {formatDate(med.expiryDate)}
                          {med.supplier ? ` · ${med.supplier}` : ''}
                        </p>

                        <div className="mt-2.5">
                          <div className="flex items-end justify-between">
                            <p className="metric text-[15px] font-semibold leading-none text-content">
                              {med.quantity}
                              <span className="ml-1 text-[10px] font-normal text-muted">{med.unit} on shelf</span>
                            </p>
                            <span
                              className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-clinical ${
                                stock.tone === 'danger'
                                  ? 'border-danger/30 bg-danger/10 text-danger'
                                  : stock.tone === 'warn'
                                    ? 'border-warn/30 bg-warn/10 text-warn'
                                    : 'border-ok/30 bg-ok/10 text-ok'
                              }`}
                            >
                              {stock.label}
                            </span>
                          </div>
                          <ProgressBar value={percent} tone={stock.tone === 'danger' ? 'danger' : stock.tone === 'warn' ? 'warn' : 'ok'} className="mt-1.5" />
                          <p className="mt-1 text-[10px] text-muted">
                            Reorder at {med.reorderLevel} {med.unit} · full shelf {med.baselineStock} {med.unit} · {COLD_CHAIN_LABEL[med.coldChain]}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {isAdmin ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-primary !px-2.5 !py-1.5 !text-[11px]"
                            disabled={expired || Number(med.quantity) <= 0}
                            onClick={() => setDispenseFor(med)}
                          >
                            <Pill size={12} /> Dispense
                          </button>
                          <button type="button" className="btn btn-secondary !px-2.5 !py-1.5 !text-[11px]" onClick={() => setRestockFor(med)}>
                            <Plus size={12} /> Restock
                          </button>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-line/20 bg-surface/40 px-2 py-1.5 text-[10px] uppercase tracking-clinical text-muted">
                          <Lock size={11} /> View only · ask clinical officer to dispense
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : med.id)}
                        aria-expanded={expanded}
                        className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-clinical text-muted hover:text-content"
                      >
                        Manage
                        <motion.span animate={{ rotate: expanded ? 180 : 0 }}>
                          <SlidersHorizontal size={12} />
                        </motion.span>
                      </button>
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {expanded ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-line/15 bg-surface/20 px-3 py-3">
                          {med.notes ? <p className="mb-2 text-[11px] leading-relaxed text-muted">{med.notes}</p> : null}
                          {med.expiryOverrideReason ? (
                            <p className="mb-2 rounded-lg border border-warn/25 bg-warn/5 px-2 py-1.5 text-[10px] leading-relaxed text-warn/90">
                              Expiry overridden by {med.expiryOverriddenBy}: {med.expiryOverrideReason}
                            </p>
                          ) : null}
                          {isAdmin ? (
                            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                              <button
                                type="button"
                                className="btn btn-ghost !justify-start !px-2 !py-1.5 !text-[11px]"
                                onClick={() => setMedForm({ open: true, medication: med })}
                              >
                                <SlidersHorizontal size={12} /> Edit details
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost !justify-start !px-2 !py-1.5 !text-[11px]"
                                onClick={() => setStockAction({ open: true, medication: med, mode: 'adjust' })}
                              >
                                <ArrowDownRight size={12} /> Adjust count
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost !justify-start !px-2 !py-1.5 !text-[11px]"
                                onClick={() => setStockAction({ open: true, medication: med, mode: 'expiry' })}
                              >
                                <CalendarCog size={12} /> Override expiry
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost !justify-start !px-2 !py-1.5 !text-[11px] hover:!text-danger"
                                onClick={() => setDeleteTarget(med)}
                              >
                                <Trash2 size={12} /> Remove line
                              </button>
                            </div>
                          ) : (
                            <p className="text-[10px] uppercase tracking-clinical text-muted">
                              Inventory editing requires Clinical Officer privileges.
                            </p>
                          )}
                          <p className="mt-2 text-[10px] text-muted">
                            Last updated {formatDateTime(med.updatedAt)} · {med.updatedBy || 'system'}
                          </p>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.article>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={Warehouse}
            title="No stock lines match"
            description="Adjust the filter or clear the search to see the rest of the dispensary shelf."
            action={
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setFilter('all')
                  setQuery('')
                }}
              >
                Clear filters
              </button>
            }
          />
        )
      ) : view === 'dispensing' ? (
        filteredDispensings.length ? (
          <div className="glass overflow-hidden rounded-2xl">
            <div className="hidden grid-cols-[1.4fr_1.6fr_0.8fr_1fr_0.9fr] gap-2 border-b border-line/15 px-4 py-2.5 sm:grid">
              {['Medication', 'Patient', 'Qty', 'Dispensed', 'By'].map((header) => (
                <p key={header} className="label-clinical">
                  {header}
                </p>
              ))}
            </div>
            <ul className="divide-y divide-line/10">
              {filteredDispensings.map((row) => (
                <li key={row.id} className="grid grid-cols-2 gap-2 px-3.5 py-2.5 transition-colors hover:bg-surface/30 sm:grid-cols-[1.4fr_1.6fr_0.8fr_1fr_0.9fr] sm:items-center sm:px-4">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-content">{row.medicationName}</p>
                    <p className="truncate text-[10px] text-muted">batch {row.batch || '—'}</p>
                  </div>
                  <div className="min-w-0 text-right sm:text-left">
                    <p className="truncate text-[11px] text-content">{row.patient ? fullName(row.patient) : 'Walk-in'}</p>
                    <p className="metric truncate text-[10px] text-muted">{row.patient?.code || '—'}</p>
                  </div>
                  <p className="metric text-[12px] font-semibold text-brand">
                    −{row.quantity} <span className="text-[9px] font-normal text-muted">{row.unit}</span>
                  </p>
                  <p className="text-right text-[10px] text-muted sm:text-left">{formatDateTime(row.dispensedAt)}</p>
                  <p className="col-span-2 truncate text-[10px] text-muted sm:col-span-1">{row.dispensedBy}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <EmptyState icon={ClipboardList} title="No dispensing records" description="Dispensed medicines appear here with the patient, batch and worker who issued them." />
        )
      ) : filteredAdjustments.length ? (
        <div className="glass overflow-hidden rounded-2xl">
          <ul className="divide-y divide-line/10">
            {filteredAdjustments.map((row) => {
              const positive = row.delta > 0
              return (
                <li key={row.id} className="flex items-start gap-2.5 px-3.5 py-2.5 sm:px-4">
                  <span
                    className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${
                      positive ? 'border-ok/30 bg-ok/10 text-ok' : 'border-danger/30 bg-danger/10 text-danger'
                    }`}
                  >
                    {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-content">{row.medication?.name || 'Removed stock line'}</p>
                    <p className="truncate text-[10px] text-muted">
                      {row.reason} · {row.by}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`metric text-[12px] font-semibold ${positive ? 'text-ok' : 'text-danger'}`}>
                      {positive ? '+' : ''}
                      {row.delta} <span className="text-[9px] font-normal text-muted">{row.medication?.unit || ''}</span>
                    </p>
                    <p className="text-[9px] text-muted">
                      bal {row.balanceAfter} · {formatDateTime(row.at)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <EmptyState icon={History} title="Ledger empty" description="Restocks, corrections and dispensing deductions are recorded here for audit." />
      )}

      <div className="grid gap-2.5 lg:grid-cols-[1.4fr_1fr]">
        <TrustNote>
          Expiry overrides are restricted to the Clinical Officer and carry the officer's name, timestamp and justification. Only the
          latest shelf balance is synced; the full movement ledger stays on-device.
        </TrustNote>
        <div className="glass rounded-xl px-3.5 py-3">
          <div className="flex items-center gap-2">
            <Snowflake size={14} className="text-accent" />
            <p className="text-[11px] font-semibold text-content">Cold chain surveillance</p>
            <span className="ml-auto text-[10px] text-muted">{stats.cold.length} lines</span>
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
            {stats.cold.filter((med) => needsAttention(med)).length
              ? `${stats.cold.filter((med) => needsAttention(med)).length} cold-chain lines need attention (stock or expiry).`
              : 'All cold-chain vaccine lines are within stock and shelf-life thresholds.'}{' '}
            Keep the fridge at 2–8 °C and log the reading at every outreach round.
          </p>
        </div>
      </div>

      <DispenseForm open={Boolean(dispenseFor)} medication={dispenseFor} onClose={() => setDispenseFor(null)} />
      <RestockForm open={Boolean(restockFor)} medication={restockFor} onClose={() => setRestockFor(null)} />
      <MedicationForm
        open={medForm.open}
        medication={medForm.medication}
        onClose={() => setMedForm({ open: false, medication: null })}
      />
      <StockActionForm
        open={stockAction.open}
        medication={stockAction.medication}
        mode={stockAction.mode}
        onClose={() => setStockAction({ open: false, medication: null, mode: 'adjust' })}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title="Remove stock line?"
        description={
          deleteTarget
            ? `${deleteTarget.name} (batch ${deleteTarget.batch || '—'}) and its dispensing history will be removed from this device. This cannot be undone.`
            : ''
        }
        confirmLabel="Remove stock line"
      />
    </div>
  )
}
