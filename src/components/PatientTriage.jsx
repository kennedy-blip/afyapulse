import React, { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import {
  Activity,
  Archive,
  CalendarClock,
  ChevronRight,
  FileSpreadsheet,
  Filter,
  Plus,
  Search,
  ShieldAlert,
  Stethoscope,
  TriangleAlert,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { db } from '../db/db'
import { archivePatient, deletePatient } from '../db/repo'
import { useApp } from '../context/AppProvider'
import { daysUntil, todayISO } from '../lib/dates'
import { ageBand, fullName, maskedRef } from '../lib/format'
import { toCSV } from '../lib/csv'
import { deliverExport } from '../lib/share'
import { needsAttention } from '../lib/pharmacy'
import { AdminLock, EmptyState, SectionHeading, Segmented, StatTile, TrustNote } from './ui/Primitives'
import { Select, TextInput } from './ui/Fields'
import PatientCard from './PatientCard'
import PatientForm from './forms/PatientForm'
import VitalsForm from './forms/VitalsForm'
import ScheduleForm from './forms/ScheduleForm'
import ReferralForm from './ReferralForm'
import ReferralQueue from './ReferralQueue'
import ConfirmDialog from './ui/ConfirmDialog'

const CATEGORY_TABS = [
  { value: 'all', label: 'All' },
  { value: 'general', label: 'General' },
  { value: 'anc', label: 'ANC' },
  { value: 'child', label: 'Under-5' },
  { value: 'chronic', label: 'Chronic' },
]

const RISK_FILTERS = [
  { value: 'all', label: 'All risks' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'caution', label: 'Caution' },
  { value: 'normal', label: 'Normal' },
]

export default function PatientTriage() {
  const { isAdmin, profile, toast, buzz, isNative } = useApp()
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [category, setCategory] = useState('all')
  const [risk, setRisk] = useState('all')
  const [sort, setSort] = useState('priority')
  const [showArchived, setShowArchived] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  const [patientModal, setPatientModal] = useState({ open: false, patient: null })
  const [vitalsFor, setVitalsFor] = useState(null)
  const [scheduleFor, setScheduleFor] = useState(null)
  const [referralFor, setReferralFor] = useState(null)
  const [queueOpen, setQueueOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [busy, setBusy] = useState(false)

  const dataset = useLiveQuery(async () => {
    const [patients, vitals, schedules, referrals, meds] = await Promise.all([
      db.patients.toArray(),
      db.vitals.toArray(),
      db.schedules.toArray(),
      db.referrals.toArray(),
      db.medications.toArray(),
    ])
    return { patients, vitals, schedules, referrals, meds }
  }, [])

  const { latestVitals, openReferrals, schedulesByPatient, historyByPatient } = useMemo(() => {
    const history = new Map()
    for (const vital of dataset?.vitals || []) {
      if (!history.has(vital.patientId)) history.set(vital.patientId, [])
      history.get(vital.patientId).push(vital)
    }
    for (const rows of history.values()) rows.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    const latest = new Map()
    for (const vital of dataset?.vitals || []) {
      const current = latest.get(vital.patientId)
      if (!current || vital.recordedAt > current.recordedAt) latest.set(vital.patientId, vital)
    }
    const referrals = new Map()
    for (const referral of dataset?.referrals || []) {
      if (['pending_approval', 'approved'].includes(referral.status)) {
        const current = referrals.get(referral.patientId)
        if (!current || referral.createdAt > current.createdAt) referrals.set(referral.patientId, referral)
      }
    }
    const byPatient = new Map()
    for (const schedule of dataset?.schedules || []) {
      if (!byPatient.has(schedule.patientId)) byPatient.set(schedule.patientId, [])
      byPatient.get(schedule.patientId).push(schedule)
    }
    return { latestVitals: latest, openReferrals: referrals, schedulesByPatient: byPatient, historyByPatient: history }
  }, [dataset])

  const allPatients = dataset?.patients || []
  const patients = useMemo(() => allPatients.filter((patient) => !patient.archived), [allPatients])
  const archivedPatients = useMemo(() => allPatients.filter((patient) => patient.archived), [allPatients])
  const source = showArchived ? archivedPatients : patients
  const today = todayISO()

  const stats = useMemo(() => {
    const urgent = patients.filter((patient) => patient.riskLevel === 'urgent').length
    const vitalsToday = (dataset?.vitals || []).filter((vital) => vital.recordedAt?.slice(0, 10) === today).length
    const dueOrOverdue = (dataset?.schedules || []).filter((row) => row.status === 'pending' && row.dueDate <= today).length
    const pendingReferrals = (dataset?.referrals || []).filter((row) => row.status === 'pending_approval').length
    const stockAlerts = (dataset?.meds || []).filter(needsAttention).length
    return { urgent, vitalsToday, dueOrOverdue, pendingReferrals, stockAlerts }
  }, [patients, dataset, today])

  const counts = useMemo(() => {
    const byCategory = { all: source.length, general: 0, anc: 0, child: 0, chronic: 0 }
    const byRisk = { all: source.length, urgent: 0, caution: 0, normal: 0 }
    for (const patient of source) {
      byCategory[patient.category] = (byCategory[patient.category] || 0) + 1
      const level = patient.riskLevel || 'normal'
      byRisk[level] = (byRisk[level] || 0) + 1
    }
    return { byCategory, byRisk }
  }, [source])

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase()
    const weight = { urgent: 0, caution: 1, normal: 2 }
    return source
      .filter((patient) => (category === 'all' ? true : patient.category === category))
      .filter((patient) => (risk === 'all' ? true : (patient.riskLevel || 'normal') === risk))
      .filter((patient) => {
        if (!needle) return true
        const haystack = [patient.firstName, patient.lastName, patient.code, patient.ward, patient.village, patient.phone, ...(patient.symptoms || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(needle)
      })
      .sort((a, b) => {
        if (sort === 'name') return fullName(a).localeCompare(fullName(b))
        if (sort === 'recent') return (b.lastVisitAt || b.createdAt || '').localeCompare(a.lastVisitAt || a.createdAt || '')
        if (sort === 'overdue') {
          const overdue = (patient) =>
            (schedulesByPatient.get(patient.id) || []).filter((row) => row.status === 'pending' && daysUntil(row.dueDate) < 0).length
          return overdue(b) - overdue(a)
        }
        return (weight[a.riskLevel || 'normal'] ?? 3) - (weight[b.riskLevel || 'normal'] ?? 3) ||
          (b.lastVisitAt || '').localeCompare(a.lastVisitAt || '')
      })
  }, [source, category, risk, deferredQuery, sort, schedulesByPatient])

  useEffect(() => {
    if (!expandedId) return
    if (!filtered.some((patient) => patient.id === expandedId)) setExpandedId(null)
  }, [filtered, expandedId])

  const openPatient = (id) => {
    setCategory('all')
    setRisk('all')
    setQuery('')
    setExpandedId(id)
    setQueueOpen(false)
    window.setTimeout(() => {
      document.getElementById(`patient-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
  }

  const exportEpi = () => {
    if (!isAdmin) {
      toast({ title: 'Admin only', message: 'Epidemiological exports require Clinical Officer privileges.', tone: 'warning' })
      return
    }
    const rows = patients.map((patient) => {
      const schedules = schedulesByPatient.get(patient.id) || []
      const pending = schedules.filter((row) => row.status === 'pending')
      const overdue = pending.filter((row) => daysUntil(row.dueDate) < 0)
      const vital = latestVitals.get(patient.id)
      return {
        ref: maskedRef(patient.code),
        band: ageBand(patient),
        sex: patient.sex === 'F' ? 'Female' : patient.sex === 'M' ? 'Male' : 'Unspecified',
        ward: patient.ward || 'Unassigned',
        pathway: patient.category,
        risk: patient.riskLevel || 'normal',
        top_flag: vital?.flags?.[0]?.label || (vital ? 'Within range' : 'No vitals'),
        last_visit: patient.lastVisitAt?.slice(0, 10) || '',
        pending_visits: pending.length,
        overdue_visits: overdue.length,
        symptoms: (patient.symptoms || []).join('; '),
      }
    })
    const columns = [
      { key: 'ref', label: 'case_ref' },
      { key: 'band', label: 'age_band' },
      { key: 'sex', label: 'sex' },
      { key: 'ward', label: 'ward' },
      { key: 'pathway', label: 'care_pathway' },
      { key: 'risk', label: 'triage_level' },
      { key: 'top_flag', label: 'primary_flag' },
      { key: 'last_visit', label: 'last_visit' },
      { key: 'pending_visits', label: 'pending_visits' },
      { key: 'overdue_visits', label: 'overdue_visits' },
      { key: 'symptoms', label: 'symptoms' },
    ]
    deliverExport({
      filename: `afyapulse-epi-${todayISO()}.csv`,
      content: toCSV(rows, columns),
      mime: 'text/csv;charset=utf-8',
      isNative,
      title: 'AfyaPulse anonymised export',
    }).catch((error) => toast({ title: 'Export failed', message: error.message, tone: 'error' }))
    buzz(10)
    toast({
      title: 'Anonymised export ready',
      message: `${rows.length} rows · identifiers replaced with salted case references.`,
      tone: 'success',
    })
  }

  const confirmArchive = async () => {
    if (!archiveTarget) return
    setBusy(true)
    try {
      const restoring = Boolean(archiveTarget.archived)
      await archivePatient(archiveTarget.id, profile, !restoring)
      toast({
        title: restoring ? 'Record restored' : 'Record archived',
        message: restoring
          ? `${fullName(archiveTarget)} is back on the active register.`
          : `${fullName(archiveTarget)} hidden from the active register — switch to Archived to restore.`,
        tone: 'success',
      })
      setArchiveTarget(null)
      if (expandedId === archiveTarget.id) setExpandedId(null)
    } catch (error) {
      toast({ title: 'Could not archive', message: error.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await deletePatient(deleteTarget.id, profile)
      toast({
        title: 'Record deleted',
        message: `${deleteTarget.code} and its vitals, schedules and referrals were removed.`,
        tone: 'warning',
      })
      setDeleteTarget(null)
      if (expandedId === deleteTarget.id) setExpandedId(null)
    } catch (error) {
      toast({ title: 'Could not delete', message: error.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const activeFilters = category !== 'all' || risk !== 'all' || query

  return (
    <div className="space-y-4 sm:space-y-5">
      <SectionHeading
        eyebrow={isAdmin ? 'Clinical console' : 'Field console'}
        title="Triage & patient register"
        description="Register households, capture vitals and let the triage engine flag the patients who cannot wait."
        icon={Stethoscope}
        action={
          <>
            <button type="button" className="btn btn-secondary hidden sm:inline-flex" onClick={() => setQueueOpen(true)}>
              <ShieldAlert size={15} />
              Referrals
              {stats.pendingReferrals ? (
                <span className="rounded-md bg-danger/20 px-1.5 py-0.5 text-[10px] font-bold text-danger">{stats.pendingReferrals}</span>
              ) : null}
            </button>
            <button
              type="button"
              className={`btn btn-secondary hidden sm:inline-flex ${!isAdmin ? 'cursor-not-allowed opacity-50' : ''}`}
              onClick={exportEpi}
              aria-disabled={!isAdmin}
              title={isAdmin ? 'Export anonymised epidemiological CSV' : 'Clinical Officer required'}
            >
              <FileSpreadsheet size={15} /> Epi export
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setPatientModal({ open: true, patient: null })}>
              <Plus size={15} /> Register patient
            </button>
          </>
        }
      />

      {stats.urgent > 0 || stats.pendingReferrals > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="relative overflow-hidden rounded-2xl border border-danger/30 bg-danger/[0.07] p-3.5 sm:p-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-danger/35 bg-danger/15 text-danger">
              <TriangleAlert size={18} />
              <span className="absolute inset-0 animate-pulse-ring rounded-xl border border-danger/50" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-content">
                {stats.urgent} urgent {stats.urgent === 1 ? 'patient' : 'patients'} on the register
                {stats.pendingReferrals ? ` · ${stats.pendingReferrals} referral${stats.pendingReferrals === 1 ? '' : 's'} awaiting approval` : ''}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                Red flags persist until reviewed. Referral approvals are restricted to the clinical officer.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary !py-1.5 !text-[11px]"
                onClick={() => {
                  setRisk('urgent')
                  setCategory('all')
                  setQuery('')
                }}
              >
                <Filter size={12} /> Show urgent
              </button>
              <button type="button" className="btn btn-primary !py-1.5 !text-[11px]" onClick={() => setQueueOpen(true)}>
                Review queue <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}

      {showArchived ? (
        <div className="glass flex flex-wrap items-center gap-2 rounded-xl border border-warn/25 px-3 py-2.5">
          <Archive size={14} className="text-warn" />
          <p className="text-[11px] text-muted">
            Viewing <span className="font-semibold text-content">{archivedPatients.length}</span> archived{' '}
            {archivedPatients.length === 1 ? 'record' : 'records'}. Restore any record to return it to the active register.
          </p>
          <button
            type="button"
            className="btn btn-secondary ml-auto !px-2.5 !py-1 !text-[10px]"
            onClick={() => setShowArchived(false)}
          >
            Back to active
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile
          label="Active register"
          value={patients.length}
          icon={Users}
          tone="brand"
          hint={`${archivedPatients.length} archived · ${stats.vitalsToday} vitals today`}
        />
        <StatTile
          label="Urgent red flags"
          value={stats.urgent}
          icon={TriangleAlert}
          tone={stats.urgent ? 'danger' : 'ok'}
          hint={stats.urgent ? 'Needs immediate referral review' : 'No urgent cases right now'}
          onClick={() => setRisk(stats.urgent ? 'urgent' : 'all')}
          active={risk === 'urgent'}
        />
        <StatTile
          label="Due / overdue visits"
          value={stats.dueOrOverdue}
          icon={CalendarClock}
          tone={stats.dueOrOverdue ? 'warn' : 'ok'}
          hint="ANC contacts, EPI and reviews"
          onClick={() => {
            window.location.hash = '#schedules'
          }}
        />
        <StatTile
          label="Stock alerts"
          value={stats.stockAlerts}
          icon={Activity}
          tone={stats.stockAlerts ? 'warn' : 'ok'}
          hint="Low stock or near expiry"
          onClick={() => {
            window.location.hash = '#pharmacy'
          }}
        />
      </div>

      <div className="glass rounded-2xl p-3 sm:p-3.5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <TextInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, clinic number, ward, village or symptom…"
                className="!py-2.5 pl-9 pr-9"
                aria-label="Search patients"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:text-content"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:flex-none">
                <Select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort patients" className="!py-2.5 pr-8 text-[11px]">
                  <option value="priority">Sort: triage priority</option>
                  <option value="recent">Sort: recent visit</option>
                  <option value="overdue">Sort: most overdue</option>
                  <option value="name">Sort: name A–Z</option>
                </Select>
              </div>
              <span className="hidden shrink-0 rounded-lg border border-line/20 bg-surface/40 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-clinical text-muted sm:inline-block">
                {filtered.length} shown
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="overflow-x-auto no-scrollbar">
              <Segmented
                options={CATEGORY_TABS.map((tab) => ({ ...tab, count: counts.byCategory[tab.value] ?? 0 }))}
                value={category}
                onChange={setCategory}
                size="sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {RISK_FILTERS.map((filter) => {
                const active = risk === filter.value
                const count = counts.byRisk[filter.value] ?? 0
                const tone =
                  filter.value === 'urgent'
                    ? 'border-danger/40 bg-danger/15 text-danger'
                    : filter.value === 'caution'
                      ? 'border-warn/40 bg-warn/15 text-warn'
                      : filter.value === 'normal'
                        ? 'border-ok/40 bg-ok/15 text-ok'
                        : 'border-brand/40 bg-brand/15 text-brand'
                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setRisk(filter.value)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-semibold uppercase tracking-clinical transition-all ${
                      active ? tone : 'border-line/20 bg-surface/30 text-muted hover:text-content'
                    }`}
                  >
                    {filter.label}
                    <span className="tabular-nums opacity-70">{count}</span>
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => {
                  setShowArchived((current) => !current)
                  setCategory('all')
                  setRisk('all')
                  setExpandedId(null)
                }}
                aria-pressed={showArchived}
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-semibold uppercase tracking-clinical transition-all ${
                  showArchived
                    ? 'border-warn/40 bg-warn/15 text-warn'
                    : 'border-line/20 bg-surface/30 text-muted hover:text-content'
                }`}
              >
                <Archive size={11} /> Archived ({archivedPatients.length})
              </button>
              {activeFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setCategory('all')
                    setRisk('all')
                    setQuery('')
                  }}
                  className="ml-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-clinical text-brand hover:underline"
                >
                  <X size={10} /> Reset
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {!dataset ? (
        <div className="grid gap-2.5">
          {[0, 1, 2].map((key) => (
            <div key={key} className="glass h-24 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : filtered.length ? (
        <div className="grid gap-2.5 xl:grid-cols-2">
          {filtered.map((patient) => (
            <div key={patient.id} id={`patient-${patient.id}`}>
              <PatientCard
                patient={patient}
                latestVital={latestVitals.get(patient.id)}
                history={historyByPatient.get(patient.id) || []}
                schedules={schedulesByPatient.get(patient.id) || []}
                openReferral={openReferrals.get(patient.id)}
                expanded={expandedId === patient.id}
                onToggle={() => setExpandedId(expandedId === patient.id ? null : patient.id)}
                onRecordVitals={() => setVitalsFor(patient)}
                onSchedule={() => setScheduleFor(patient)}
                onReferral={() => setReferralFor(patient)}
                onEdit={() => setPatientModal({ open: true, patient })}
                onArchive={() => setArchiveTarget(patient)}
                onRestore={() => setArchiveTarget(patient)}
                onDelete={() => setDeleteTarget(patient)}
                archived={Boolean(patient.archived)}
                canManage={isAdmin}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={UserRound}
          title={
            showArchived
              ? 'No archived records'
              : patients.length
                ? 'No patients match these filters'
                : 'The register is empty'
          }
          description={
            showArchived
              ? 'Archived records keep their vitals and follow-up history. Archive a patient to see them here.'
              : patients.length
                ? 'Clear the search or widen the triage filter to see the rest of the household register.'
                : 'Register the first patient to start triaging. Everything is saved offline on this device.'
          }
          action={
            patients.length || showArchived ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setCategory('all')
                  setRisk('all')
                  setQuery('')
                  setShowArchived(false)
                }}
              >
                {showArchived ? 'Back to active register' : 'Clear filters'}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setPatientModal({ open: true, patient: null })}>
                <Plus size={14} /> Register patient
              </button>
            )
          }
        />
      )}

      <div className="hidden lg:block">
        <TrustNote>
          Triage runs entirely on-device against age-banded thresholds. Urgent readings automatically raise a referral for clinical
          approval, and every change is written to an audit trail that survives app restarts.
        </TrustNote>
      </div>

      {!isAdmin ? (
        <div className="flex items-center gap-2 lg:hidden">
          <AdminLock compact label="Epi export locked" />
          <span className="text-[10px] leading-snug text-muted">Switch to Clinical Officer in Settings to export anonymised data.</span>
        </div>
      ) : null}

      <motion.button
        type="button"
        onClick={() => setPatientModal({ open: true, patient: null })}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-[calc(5.6rem+env(safe-area-inset-bottom))] right-4 z-40 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand to-accent text-canvas shadow-glow sm:hidden"
        aria-label="Register patient"
      >
        <Plus size={22} strokeWidth={2.6} />
      </motion.button>

      <PatientForm
        open={patientModal.open}
        patient={patientModal.patient}
        onClose={() => setPatientModal({ open: false, patient: null })}
      />
      <VitalsForm open={Boolean(vitalsFor)} patient={vitalsFor} onClose={() => setVitalsFor(null)} />
      <ScheduleForm
        open={Boolean(scheduleFor)}
        patientId={scheduleFor?.id}
        defaultType={scheduleFor?.category === 'anc' ? 'anc' : scheduleFor?.category === 'child' ? 'immunization' : 'chronic'}
        onClose={() => setScheduleFor(null)}
      />
      <ReferralForm open={Boolean(referralFor)} patient={referralFor} onClose={() => setReferralFor(null)} />
      <ReferralQueue open={queueOpen} onClose={() => setQueueOpen(false)} onOpenPatient={openPatient} />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={confirmArchive}
        busy={busy}
        title={archiveTarget?.archived ? 'Restore this patient?' : 'Archive this patient?'}
        description={
          archiveTarget
            ? archiveTarget.archived
              ? `${fullName(archiveTarget)} (${archiveTarget.code}) will return to the active register with all historical vitals and follow-ups.`
              : `${fullName(archiveTarget)} (${archiveTarget.code}) will leave the active register. Vitals, schedules and referral history are retained and can be restored at any time from the Archived view.`
            : ''
        }
        confirmLabel={archiveTarget?.archived ? 'Restore record' : 'Archive record'}
        tone="primary"
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title="Delete permanently?"
        description={
          deleteTarget
            ? `This removes ${fullName(deleteTarget)} (${deleteTarget.code}) together with all vitals, follow-ups and referrals from this device. This cannot be undone — export a backup first if the record is needed.`
            : ''
        }
        confirmLabel="Delete forever"
      />
    </div>
  )
}
