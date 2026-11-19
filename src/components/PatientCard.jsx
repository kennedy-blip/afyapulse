import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  Archive,
  Baby,
  CalendarPlus,
  ChevronDown,
  CircleDot,
  Droplets,
  HeartPulse,
  MapPin,
  Pencil,
  Phone,
  Send,
  Stethoscope,
  Thermometer,
  Trash2,
  TriangleAlert,
  Wind,
} from 'lucide-react'
import { fullName, initials, maskPhone, patientAge, sexInitial } from '../lib/format'
import { formatDateTime, relativeDue, daysUntil } from '../lib/dates'
import { TRIAGE } from '../lib/triage'
import { TriageBadge } from './ui/Primitives'

const CATEGORY_META = {
  general: { label: 'General', icon: Stethoscope },
  anc: { label: 'ANC', icon: Droplets },
  child: { label: 'Under-5', icon: Baby },
  chronic: { label: 'Chronic', icon: Activity },
}

function VitalTile({ label, value, unit, icon: Icon, alarm }) {
  return (
    <div className={`rounded-lg border px-2 py-1.5 ${alarm ? 'border-danger/30 bg-danger/5' : 'border-line/15 bg-surface/30'}`}>
      <div className="flex items-center gap-1 text-muted">
        <Icon size={10} strokeWidth={2.2} />
        <span className="text-[9px] font-semibold uppercase tracking-clinical">{label}</span>
      </div>
      <p className={`metric mt-0.5 text-[13px] font-semibold leading-none ${alarm ? 'text-danger' : 'text-content'}`}>
        {value ?? '—'}
        {value !== null && value !== undefined && unit ? (
          <span className="ml-0.5 text-[9px] font-normal text-muted">{unit}</span>
        ) : null}
      </p>
    </div>
  )
}

export default function PatientCard({
  patient,
  latestVital,
  history = [],
  schedules = [],
  openReferral = null,
  expanded,
  onToggle,
  onRecordVitals,
  onSchedule,
  onReferral,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
  archived = false,
  canManage = false,
}) {
  const level = patient.riskLevel || latestVital?.triageLevel || 'normal'
  const meta = TRIAGE[level] || TRIAGE.normal
  const category = CATEGORY_META[patient.category] || CATEGORY_META.general
  const CategoryIcon = category.icon
  const nextVisits = schedules
    .filter((row) => row.status === 'pending')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 3)
  const overdue = nextVisits.filter((row) => daysUntil(row.dueDate) < 0).length
  const flags = latestVital?.flags || []

  return (
    <motion.article
      layout
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`glass overflow-hidden rounded-2xl transition-colors ${
        expanded ? 'border-brand/35 shadow-glow' : 'glass-hover'
      } ${level === 'urgent' ? 'border-danger/30' : ''}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 px-3.5 py-3 text-left sm:px-4"
      >
        <span className="relative shrink-0">
          <span
            className={`grid h-11 w-11 place-items-center rounded-xl border bg-gradient-to-br text-xs font-semibold tracking-wide ${
              level === 'urgent'
                ? 'border-danger/40 from-danger/25 to-danger/5 text-danger'
                : level === 'caution'
                  ? 'border-warn/40 from-warn/25 to-warn/5 text-warn'
                  : 'border-brand/30 from-brand/20 to-brand/5 text-brand'
            }`}
          >
            {initials(patient)}
          </span>
          {level === 'urgent' ? (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-canvas bg-danger">
              <span className="absolute inset-0 animate-ping rounded-full bg-danger" />
            </span>
          ) : null}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate text-sm font-semibold text-content">{fullName(patient)}</h3>
            <span className="metric rounded-md border border-line/20 bg-surface/50 px-1.5 py-0.5 text-[9px] text-muted">
              {patient.code}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-line/20 bg-surface/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-clinical text-muted">
              <CategoryIcon size={9} /> {category.label}
            </span>
            {archived ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-line/25 bg-surface/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-clinical text-muted">
                <Archive size={9} /> Archived
              </span>
            ) : null}
            {openReferral ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-danger/30 bg-danger/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-clinical text-danger">
                <Send size={9} /> Referral {openReferral.status.replace('_', ' ')}
              </span>
            ) : null}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
            <span>
              {patientAge(patient)} · {sexInitial(patient.sex)}
            </span>
            <span className="text-line/40">|</span>
            <span className="inline-flex items-center gap-1">
              <MapPin size={10} /> {patient.ward || 'No ward'}
              {patient.village ? ` · ${patient.village}` : ''}
            </span>
            <span className="text-line/40">|</span>
            <span className="inline-flex items-center gap-1">
              <Phone size={10} /> {maskPhone(patient.phone)}
            </span>
          </p>
          <p className="mt-1.5 line-clamp-1 text-[11px] leading-relaxed text-muted">
            <span className="font-medium text-content/80">
              {latestVital ? formatDateTime(latestVital.recordedAt) : 'No vitals recorded'}
            </span>
            {latestVital ? ` · ${latestVital.summary || meta.description}` : ' · Record a first set to triage'}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <TriageBadge level={level} />
          <div className="flex items-center gap-2">
            {overdue ? (
              <span className="rounded-md border border-danger/30 bg-danger/10 px-1.5 py-0.5 text-[9px] font-bold text-danger">
                {overdue} overdue
              </span>
            ) : nextVisits[0] ? (
              <span className="hidden text-[10px] text-muted sm:inline">{relativeDue(nextVisits[0].dueDate)}</span>
            ) : null}
            <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.25 }} className="text-muted">
              <ChevronDown size={15} />
            </motion.span>
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-line/15 px-3.5 pb-3.5 pt-3 sm:px-4">
              <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="label-clinical">Latest vitals</p>
                    {latestVital?.recordedBy ? (
                      <p className="text-[10px] text-muted">by {latestVital.recordedBy}</p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                    <VitalTile
                      label="BP"
                      value={latestVital?.systolic ? `${latestVital.systolic}/${latestVital.diastolic ?? '—'}` : null}
                      unit="mmHg"
                      icon={HeartPulse}
                      alarm={flags.some((f) => f.label.toLowerCase().includes('pressure'))}
                    />
                    <VitalTile
                      label="Temp"
                      value={latestVital?.temperature ?? null}
                      unit="°C"
                      icon={Thermometer}
                      alarm={flags.some((f) => /fever|hypothermia/i.test(f.label))}
                    />
                    <VitalTile label="Pulse" value={latestVital?.pulse ?? null} unit="bpm" icon={Activity} alarm={flags.some((f) => /cardia|pulse/i.test(f.label))} />
                    <VitalTile label="SpO₂" value={latestVital?.spo2 ?? null} unit="%" icon={Wind} alarm={flags.some((f) => /hypoxia|oxygen/i.test(f.label))} />
                    <VitalTile label="Weight" value={latestVital?.weight ?? null} unit="kg" icon={CircleDot} />
                    <VitalTile label="MUAC" value={latestVital?.muac ?? latestVital?.bmi ?? null} unit={latestVital?.muac ? 'cm' : 'BMI'} icon={Droplets} alarm={flags.some((f) => /malnutrition/i.test(f.label))} />
                  </div>

                  {flags.length ? (
                    <div className="mt-2.5 space-y-1.5">
                      {flags.map((flag) => (
                        <div
                          key={`${flag.label}-${flag.detail}`}
                          className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 ${
                            flag.severity === 'urgent'
                              ? 'border-danger/25 bg-danger/5'
                              : 'border-warn/25 bg-warn/5'
                          }`}
                        >
                          <TriangleAlert
                            size={12}
                            className={`mt-0.5 shrink-0 ${flag.severity === 'urgent' ? 'text-danger' : 'text-warn'}`}
                          />
                          <p className="text-[11px] leading-tight text-content">
                            {flag.label}
                            <span className="ml-1 text-muted">· {flag.detail}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {patient.symptoms?.length ? (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {patient.symptoms.map((symptom) => (
                        <span key={symptom} className="rounded-md border border-line/20 bg-surface/40 px-1.5 py-0.5 text-[10px] text-muted">
                          {symptom}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {patient.notes ? <p className="mt-2 text-[11px] leading-relaxed text-muted">{patient.notes}</p> : null}
                  {patient.allergies ? (
                    <p className="mt-1 text-[11px] font-medium text-warn">Allergies: {patient.allergies}</p>
                  ) : null}

                  <div className="mt-3">
                    <p className="label-clinical mb-1.5">Clinical history</p>
                    {canManage ? (
                      history.length > 1 ? (
                        <ul className="space-y-1">
                          {history.slice(1, 6).map((visit) => (
                            <li
                              key={visit.id}
                              className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border border-line/10 bg-surface/20 px-2 py-1 text-[10px]"
                            >
                              <span className="font-medium text-content">{formatDateTime(visit.recordedAt)}</span>
                              <span
                                className={`rounded px-1 py-0.5 text-[8px] font-bold uppercase tracking-clinical ${
                                  visit.triageLevel === 'urgent'
                                    ? 'bg-danger/15 text-danger'
                                    : visit.triageLevel === 'caution'
                                      ? 'bg-warn/15 text-warn'
                                      : 'bg-ok/15 text-ok'
                                }`}
                              >
                                {visit.triageLevel}
                              </span>
                              <span className="text-muted">
                                {visit.systolic ? `${visit.systolic}/${visit.diastolic} mmHg` : '—'}
                                {visit.temperature ? ` · ${visit.temperature}°C` : ''}
                                {visit.pulse ? ` · ${visit.pulse} bpm` : ''}
                                {visit.muac ? ` · MUAC ${visit.muac}` : ''}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="rounded-lg border border-dashed border-line/20 px-2 py-1.5 text-[10px] text-muted">
                          Only one visit recorded — future vitals build the timeline.
                        </p>
                      )
                    ) : (
                      <p className="rounded-lg border border-dashed border-line/20 px-2 py-1.5 text-[10px] text-muted">
                        Full clinical history is restricted to the Clinical Officer.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="label-clinical mb-2">Next follow-ups</p>
                  {nextVisits.length ? (
                    <ul className="space-y-1.5">
                      {nextVisits.map((visit) => {
                        const due = daysUntil(visit.dueDate)
                        return (
                          <li
                            key={visit.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-line/15 bg-surface/30 px-2.5 py-1.5"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-[11px] font-medium text-content">{visit.title}</span>
                              <span className="block text-[10px] text-muted">{visit.dueDate}</span>
                            </span>
                            <span
                              className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold ${
                                due < 0
                                  ? 'border-danger/30 bg-danger/10 text-danger'
                                  : due === 0
                                    ? 'border-warn/30 bg-warn/10 text-warn'
                                    : 'border-line/20 bg-surface/50 text-muted'
                              }`}
                            >
                              {relativeDue(visit.dueDate)}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="rounded-lg border border-dashed border-line/20 px-2.5 py-2 text-[11px] text-muted">
                      No upcoming visits. Add one to keep the household on track.
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      className="btn btn-primary !px-3 !py-1.5 !text-[11px] disabled:opacity-40"
                      onClick={onRecordVitals}
                      disabled={archived}
                    >
                      <HeartPulse size={13} /> Record vitals
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary !px-3 !py-1.5 !text-[11px] disabled:opacity-40"
                      onClick={onSchedule}
                      disabled={archived}
                    >
                      <CalendarPlus size={13} /> Schedule
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary !px-3 !py-1.5 !text-[11px] disabled:opacity-40"
                      onClick={onReferral}
                      disabled={archived}
                    >
                      <Send size={13} /> Refer
                    </button>
                  </div>
                  {canManage ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <button type="button" className="btn btn-ghost !px-2.5 !py-1.5 !text-[11px]" onClick={onEdit}>
                        <Pencil size={12} /> Edit record
                      </button>
                      {archived ? (
                        <button type="button" className="btn btn-ghost !px-2.5 !py-1.5 !text-[11px]" onClick={onRestore}>
                          <Archive size={12} /> Restore to register
                        </button>
                      ) : (
                        <button type="button" className="btn btn-ghost !px-2.5 !py-1.5 !text-[11px]" onClick={onArchive}>
                          <Archive size={12} /> Archive
                        </button>
                      )}
                      <button type="button" className="btn btn-ghost !px-2.5 !py-1.5 !text-[11px] hover:!text-danger" onClick={onDelete}>
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  )
}
