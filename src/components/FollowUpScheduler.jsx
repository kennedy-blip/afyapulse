import React, { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  Apple,
  Baby,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronDown,
  Clock,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Syringe,
  Trash2,
  TriangleAlert,
  Undo2,
} from 'lucide-react'
import { db } from '../db/db'
import { completeSchedule, deleteSchedule, reopenSchedule, rescheduleSchedule } from '../db/repo'
import { useApp } from '../context/AppProvider'
import { addDays, daysUntil, formatDate, relativeDue, todayISO } from '../lib/dates'
import { fullName } from '../lib/format'
import ConfirmDialog from './ui/ConfirmDialog'
import ScheduleForm from './forms/ScheduleForm'
import { EmptyState, SectionHeading, Segmented, StatTile, TrustNote } from './ui/Primitives'
import { TextInput } from './ui/Fields'

const TYPE_META = {
  immunization: { label: 'Immunisation', icon: Syringe, tone: 'brand' },
  anc: { label: 'ANC', icon: Baby, tone: 'accent' },
  chronic: { label: 'Chronic', icon: Activity, tone: 'warn' },
  nutrition: { label: 'Nutrition', icon: Apple, tone: 'ok' },
  referral: { label: 'Referral', icon: Send, tone: 'danger' },
}

const STATUS_TABS = [
  { value: 'pending', label: 'Open' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'completed', label: 'Completed' },
]

const TYPE_FILTERS = [
  { value: 'all', label: 'All types' },
  { value: 'immunization', label: 'EPI' },
  { value: 'anc', label: 'ANC' },
  { value: 'chronic', label: 'Chronic' },
  { value: 'nutrition', label: 'Nutrition' },
]

export default function FollowUpScheduler() {
  const { isAdmin, profile, toast, buzz } = useApp()
  const [statusTab, setStatusTab] = useState('pending')
  const [typeFilter, setTypeFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [rescheduleDate, setRescheduleDate] = useState(todayISO())
  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [busy, setBusy] = useState(false)

  const dataset = useLiveQuery(async () => {
    const [schedules, patients] = await Promise.all([db.schedules.toArray(), db.patients.toArray()])
    const byId = new Map(patients.map((patient) => [patient.id, patient]))
    const rows = schedules.map((row) => ({ ...row, patient: byId.get(row.patientId) }))
    return { rows, patients }
  }, [])

  const rows = dataset?.rows || []
  const today = todayISO()
  const monthStart = today.slice(0, 8) + '01'

  const stats = useMemo(() => {
    const open = rows.filter((row) => row.status === 'pending')
    const overdue = open.filter((row) => row.dueDate < today)
    const dueToday = open.filter((row) => row.dueDate === today)
    const week = open.filter((row) => row.dueDate > today && daysUntil(row.dueDate) <= 7)
    const closed = rows.filter((row) => row.status === 'completed' && (row.completedAt || '').slice(0, 10) >= monthStart)
    const epiDue = open.filter((row) => row.type === 'immunization' && row.dueDate <= addDays(today, 14))
    return { overdue, dueToday, week, closed, epiDue, open }
  }, [rows, today, monthStart])

  const counts = useMemo(
    () => ({
      pending: stats.open.length,
      overdue: stats.overdue.length,
      today: stats.dueToday.length,
      week: stats.week.length,
      completed: rows.filter((row) => row.status === 'completed').length,
    }),
    [rows, stats],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows
      .filter((row) => {
        if (statusTab === 'pending') return row.status === 'pending'
        if (statusTab === 'overdue') return row.status === 'pending' && row.dueDate < today
        if (statusTab === 'today') return row.status === 'pending' && row.dueDate === today
        if (statusTab === 'week') return row.status === 'pending' && row.dueDate >= today && daysUntil(row.dueDate) <= 7
        return row.status === 'completed'
      })
      .filter((row) => (typeFilter === 'all' ? true : row.type === typeFilter))
      .filter((row) => {
        if (!needle) return true
        return [row.title, row.detail, row.patient ? fullName(row.patient) : '', row.patient?.code, row.patient?.ward]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle)
      })
      .sort((a, b) => {
        if (statusTab === 'completed') return (b.completedAt || '').localeCompare(a.completedAt || '')
        return a.dueDate.localeCompare(b.dueDate)
      })
  }, [rows, statusTab, typeFilter, query, today])

  const grouped = useMemo(() => {
    if (statusTab !== 'pending') return [{ key: 'list', label: null, rows: filtered }]
    const buckets = [
      { key: 'overdue', label: 'Overdue — visit the household', rows: [] },
      { key: 'today', label: 'Due today', rows: [] },
      { key: 'week', label: 'Next 7 days', rows: [] },
      { key: 'later', label: 'Later', rows: [] },
    ]
    for (const row of filtered) {
      const delta = daysUntil(row.dueDate)
      if (delta < 0) buckets[0].rows.push(row)
      else if (delta === 0) buckets[1].rows.push(row)
      else if (delta <= 7) buckets[2].rows.push(row)
      else buckets[3].rows.push(row)
    }
    return buckets.filter((bucket) => bucket.rows.length)
  }, [filtered, statusTab])

  useEffect(() => {
    if (expandedId && !filtered.some((row) => row.id === expandedId)) setExpandedId(null)
  }, [filtered, expandedId])

  const handleComplete = async (row) => {
    try {
      await completeSchedule(row.id, profile, 'Closed from follow-up queue')
      buzz(18)
      toast({
        title: 'Visit closed',
        message: `${row.patient ? fullName(row.patient) : 'Patient'} · ${row.title}`,
        tone: 'success',
      })
      setExpandedId(null)
    } catch (error) {
      toast({ title: 'Could not close visit', message: error.message, tone: 'error' })
    }
  }

  const handleSnooze = async (row, days = 7) => {
    try {
      await rescheduleSchedule(row.id, addDays(row.dueDate < today ? today : row.dueDate, days), profile)
      toast({
        title: `Moved ${days} days`,
        message: `${row.title} now due ${formatDate(addDays(row.dueDate < today ? today : row.dueDate, days))}.`,
        tone: 'info',
      })
      buzz(10)
    } catch (error) {
      toast({ title: 'Could not reschedule', message: error.message, tone: 'error' })
    }
  }

  const handleReschedule = async (row) => {
    if (!rescheduleDate) return
    try {
      await rescheduleSchedule(row.id, rescheduleDate, profile)
      toast({ title: 'Visit rescheduled', message: `${row.title} → ${formatDate(rescheduleDate)}`, tone: 'success' })
      setExpandedId(null)
    } catch (error) {
      toast({ title: 'Could not reschedule', message: error.message, tone: 'error' })
    }
  }

  const handleReopen = async (row) => {
    try {
      await reopenSchedule(row.id, profile)
      toast({ title: 'Visit reopened', message: `${row.title} is back in the open queue.`, tone: 'info' })
    } catch (error) {
      toast({ title: 'Could not reopen', message: error.message, tone: 'error' })
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await deleteSchedule(deleteTarget.id, profile)
      toast({ title: 'Follow-up removed', message: deleteTarget.title, tone: 'warning' })
      setDeleteTarget(null)
      setExpandedId(null)
    } catch (error) {
      toast({ title: 'Could not remove', message: error.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const coverage = stats.open.length + stats.closed.length
    ? Math.round((stats.closed.length / (stats.open.length + stats.closed.length)) * 100)
    : 0

  return (
    <div className="space-y-4 sm:space-y-5">
      <SectionHeading
        eyebrow={isAdmin ? 'Clinical console' : 'Field console'}
        title="Follow-up & immunisation"
        description="ANC contacts, EPI milestones and chronic reviews with live countdowns — closed visits sync when the network returns."
        icon={CalendarClock}
        action={
          <>
            <button type="button" className="btn btn-secondary hidden sm:inline-flex" onClick={() => setStatusTab('overdue')}>
              <TriangleAlert size={15} /> Overdue ({stats.overdue.length})
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
              <CalendarPlus size={15} /> Add follow-up
            </button>
          </>
        }
      />

      {stats.overdue.length ? (
        <motion.div
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-warn/35 bg-warn/[0.06] p-3.5"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-warn/35 bg-warn/15 text-warn">
              <ShieldAlert size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-content">
                {stats.overdue.length} overdue {stats.overdue.length === 1 ? 'visit' : 'visits'} across {new Set(stats.overdue.map((row) => row.patientId)).size} households
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                Overdue EPI doses and ANC contacts are the leading cause of missed immunisation in outreach units — start with the oldest.
              </p>
            </div>
            <button type="button" className="btn btn-secondary !py-1.5 !text-[11px]" onClick={() => setStatusTab('overdue')}>
              Work the overdue list
            </button>
          </div>
        </motion.div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile label="Overdue" value={stats.overdue.length} icon={TriangleAlert} tone={stats.overdue.length ? 'danger' : 'ok'} hint="Past due, still open" onClick={() => setStatusTab('overdue')} active={statusTab === 'overdue'} />
        <StatTile label="Due today" value={stats.dueToday.length} icon={CalendarDays} tone={stats.dueToday.length ? 'warn' : 'ok'} hint="Household visits for today" onClick={() => setStatusTab('today')} active={statusTab === 'today'} />
        <StatTile label="Next 7 days" value={stats.week.length} icon={Clock} tone="brand" hint={`${stats.epiDue.length} EPI doses within 14 days`} onClick={() => setStatusTab('week')} active={statusTab === 'week'} />
        <StatTile label="Closure rate" value={`${coverage}%`} icon={CalendarCheck2} tone="ok" hint={`${stats.closed.length} closed this month`} onClick={() => setStatusTab('completed')} active={statusTab === 'completed'} />
      </div>

      <div className="glass rounded-2xl p-3">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <TextInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search patient, clinic number or visit…"
                className="!py-2.5 pl-9"
                aria-label="Search follow-ups"
              />
            </div>
            <div className="overflow-x-auto no-scrollbar">
              <Segmented
                options={STATUS_TABS.map((tab) => ({ ...tab, count: counts[tab.value] }))}
                value={statusTab}
                onChange={setStatusTab}
                size="sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {TYPE_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setTypeFilter(filter.value)}
                className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-clinical transition-all ${
                  typeFilter === filter.value
                    ? 'border-brand/45 bg-brand/15 text-brand'
                    : 'border-line/20 bg-surface/30 text-muted hover:text-content'
                }`}
              >
                {filter.label}
              </button>
            ))}
            <span className="ml-auto hidden text-[10px] uppercase tracking-clinical text-muted sm:block">{filtered.length} visits</span>
          </div>
        </div>
      </div>

      {!dataset ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="glass h-20 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filtered.length ? (
        <div className="space-y-5">
          {grouped.map((group) => (
            <section key={group.key}>
              {group.label ? (
                <div className="mb-2 flex items-center gap-2">
                  <p className={`label-clinical ${group.key === 'overdue' ? '!text-danger' : ''}`}>{group.label}</p>
                  <span className="rounded-md bg-surface/60 px-1.5 py-0.5 text-[10px] tabular-nums text-muted">{group.rows.length}</span>
                  <span className="h-px flex-1 bg-line/15" />
                </div>
              ) : null}
              <ul className="space-y-2">
                {group.rows.map((row) => {
                  const meta = TYPE_META[row.type] || TYPE_META.immunization
                  const Icon = meta.icon
                  const delta = daysUntil(row.dueDate)
                  const expanded = expandedId === row.id
                  return (
                    <motion.li
                      layout
                      key={row.id}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      className={`glass overflow-hidden rounded-xl transition-colors ${expanded ? 'border-brand/35' : 'glass-hover'} ${
                        row.status === 'completed' ? 'opacity-70' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5 p-3">
                        <span
                          className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${
                            delta < 0 && row.status === 'pending'
                              ? 'border-danger/30 bg-danger/10 text-danger'
                              : row.status === 'completed'
                                ? 'border-ok/30 bg-ok/10 text-ok'
                                : 'border-line/20 bg-surface/40 text-brand'
                          }`}
                        >
                          {row.status === 'completed' ? <Check size={16} /> : <Icon size={16} />}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className={`text-[13px] font-semibold ${row.status === 'completed' ? 'text-muted line-through' : 'text-content'}`}>
                              {row.title}
                            </p>
                            <span className="rounded-md border border-line/20 bg-surface/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-clinical text-muted">
                              {meta.label}
                            </span>
                            {row.source === 'epi' || row.source === 'anc' ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-brand/25 bg-brand/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-clinical text-brand">
                                <Sparkles size={8} /> Auto
                              </span>
                            ) : null}
                            {row.patient?.archived ? (
                              <span className="rounded-md border border-warn/25 bg-warn/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-clinical text-warn">
                                Archived patient
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-muted">
                            <span className="font-medium text-content/85">{row.patient ? fullName(row.patient) : 'Unknown patient'}</span>
                            {row.patient ? ` · ${row.patient.code} · ${row.patient.ward || 'No ward'}` : ''}
                          </p>
                          {row.detail ? <p className="mt-0.5 truncate text-[10px] text-muted">{row.detail}</p> : null}
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays size={10} /> {formatDate(row.dueDate)}
                            </span>
                            {row.status === 'completed' ? (
                              <span className="inline-flex items-center gap-1 text-ok">
                                <Check size={10} /> {row.completedBy || 'Closed'}
                                {row.completedAt ? ` · ${formatDate(row.completedAt.slice(0, 10))}` : ''}
                              </span>
                            ) : (
                              <span
                                className={`rounded px-1 py-0.5 font-semibold ${
                                  delta < 0 ? 'bg-danger/15 text-danger' : delta === 0 ? 'bg-warn/15 text-warn' : 'text-muted'
                                }`}
                              >
                                {relativeDue(row.dueDate)}
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          {row.status === 'pending' ? (
                            <div className="flex items-center gap-1">
                              <motion.button
                                type="button"
                                whileTap={{ scale: 0.94 }}
                                onClick={() => handleComplete(row)}
                                className="inline-flex items-center gap-1 rounded-lg border border-ok/35 bg-ok/10 px-2 py-1.5 text-[10px] font-semibold text-ok transition-colors hover:bg-ok/20"
                                title="Mark visit completed"
                              >
                                <Check size={12} />
                                <span className="hidden sm:inline">Done</span>
                              </motion.button>
                              <button
                                type="button"
                                onClick={() => handleSnooze(row, 7)}
                                className="inline-flex items-center gap-1 rounded-lg border border-line/25 bg-surface/40 px-2 py-1.5 text-[10px] font-semibold text-muted transition-colors hover:text-brand"
                                title="Defer 7 days"
                              >
                                <Clock size={12} /> +7d
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReopen(row)}
                              className="inline-flex items-center gap-1 rounded-lg border border-line/25 bg-surface/40 px-2 py-1.5 text-[10px] font-semibold text-muted transition-colors hover:text-brand"
                            >
                              <Undo2 size={12} /> Reopen
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedId(expanded ? null : row.id)
                              setRescheduleDate(row.dueDate)
                            }}
                            className="inline-flex items-center gap-1 text-[10px] text-muted hover:text-content"
                            aria-expanded={expanded}
                          >
                            Manage
                            <motion.span animate={{ rotate: expanded ? 180 : 0 }}>
                              <ChevronDown size={12} />
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
                            <div className="space-y-2.5 border-t border-line/15 px-3 py-3">
                              {row.notes || row.completionNote ? (
                                <p className="rounded-lg border border-line/15 bg-surface/30 px-2.5 py-2 text-[11px] leading-relaxed text-muted">
                                  {row.notes || row.completionNote}
                                </p>
                              ) : null}
                              <div className="flex flex-wrap items-end gap-2">
                                <label className="text-[10px] font-semibold uppercase tracking-clinical text-muted">
                                  New due date
                                  <TextInput
                                    type="date"
                                    value={rescheduleDate}
                                    onChange={(event) => setRescheduleDate(event.target.value)}
                                    className="mt-1 !w-40 !py-1.5 text-xs"
                                  />
                                </label>
                                <button
                                  type="button"
                                  className="btn btn-secondary !px-2.5 !py-1.5 !text-[11px]"
                                  onClick={() => handleReschedule(row)}
                                >
                                  <RotateCcw size={12} /> Reschedule
                                </button>
                                {isAdmin ? (
                                  <button
                                    type="button"
                                    className="btn btn-ghost ml-auto !px-2 !py-1.5 !text-[11px] hover:!text-danger"
                                    onClick={() => setDeleteTarget(row)}
                                  >
                                    <Trash2 size={12} /> Remove
                                  </button>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {[3, 7, 14].map((days) => (
                                  <button
                                    key={days}
                                    type="button"
                                    onClick={() => handleSnooze(row, days)}
                                    className="rounded-md border border-line/20 bg-surface/30 px-2 py-1 text-[10px] text-muted hover:border-brand/30 hover:text-brand"
                                  >
                                    +{days} days
                                  </button>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </motion.li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={statusTab === 'completed' ? CalendarCheck2 : CalendarClock}
          title={
            statusTab === 'overdue'
              ? 'Nothing overdue — excellent outreach'
              : statusTab === 'completed'
                ? 'No visits closed yet'
                : query
                  ? 'No visits match this search'
                  : 'The follow-up queue is clear'
          }
          description={
            statusTab === 'overdue'
              ? 'Every scheduled ANC contact and EPI milestone is on time.'
              : 'New registrations automatically generate EPI and ANC schedules. You can also add a visit manually.'
          }
          action={
            <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
              <CalendarPlus size={14} /> Schedule a follow-up
            </button>
          }
        />
      )}

      <div className="grid gap-2.5 lg:grid-cols-2">
        <TrustNote>
          Care plans are generated offline from the Kenya EPI table and WHO ANC contact schedule. Closing a visit stamps the worker,
          time and note into the patient's local history.
        </TrustNote>
        <div className="glass flex items-center gap-3 rounded-xl px-3.5 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-brand/25 bg-brand/10 text-brand">
            <CalendarCheck2 size={16} />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-content">{stats.open.length} open visits in this device's queue</p>
            <p className="text-[10px] leading-snug text-muted">Countdowns recalculate at midnight using the device clock.</p>
          </div>
        </div>
      </div>

      <ScheduleForm open={addOpen} onClose={() => setAddOpen(false)} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title="Remove this follow-up?"
        description={deleteTarget ? `"${deleteTarget.title}" will be deleted from the outreach queue. The patient record itself is untouched.` : ''}
        confirmLabel="Remove visit"
      />
    </div>
  )
}
