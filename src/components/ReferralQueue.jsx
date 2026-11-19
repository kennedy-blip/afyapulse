import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ExternalLink, Lock, Send, ShieldCheck, X } from 'lucide-react'
import { db } from '../db/db'
import { decideReferral, completeReferral } from '../db/repo'
import { useApp } from '../context/AppProvider'
import { fullName } from '../lib/format'
import { formatDateTime } from '../lib/dates'
import Modal from './ui/Modal'
import { Avatar, Badge, EmptyState, TriageBadge } from './ui/Primitives'
import { TextArea } from './ui/Fields'

export default function ReferralQueue({ open, onClose, onOpenPatient }) {
  const { isAdmin, profile, toast, buzz } = useApp()
  const [decliningId, setDecliningId] = useState(null)
  const [note, setNote] = useState('')
  const [busyId, setBusyId] = useState(null)

  const referrals = useLiveQuery(async () => {
    const rows = await db.referrals.toArray()
    const patients = await db.patients.toArray()
    const byId = new Map(patients.map((patient) => [patient.id, patient]))
    return rows
      .map((row) => ({ ...row, patient: byId.get(row.patientId) }))
      .sort((a, b) => {
        const weight = (row) => (row.status === 'pending_approval' ? 0 : row.status === 'approved' ? 1 : 2)
        return weight(a) - weight(b) || b.createdAt.localeCompare(a.createdAt)
      })
      .slice(0, 40)
  }, [])

  const decide = async (referral, status) => {
    setBusyId(referral.id)
    try {
      await decideReferral(referral.id, status, profile, note)
      toast({
        title: status === 'approved' ? 'Referral approved' : 'Referral declined',
        message: `${fullName(referral.patient)} · ${status === 'approved' ? 'transfer authorised' : 'kept for local management'}.`,
        tone: status === 'approved' ? 'success' : 'warning',
      })
      buzz(14)
      setDecliningId(null)
      setNote('')
    } catch (error) {
      toast({ title: 'Action blocked', message: error.message, tone: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  const close = async (referral) => {
    setBusyId(referral.id)
    try {
      await completeReferral(referral.id, profile)
      toast({ title: 'Referral closed', message: `${fullName(referral.patient)} completed transfer.`, tone: 'success' })
    } finally {
      setBusyId(null)
    }
  }

  const pending = (referrals || []).filter((row) => row.status === 'pending_approval')
  const active = (referrals || []).filter((row) => row.status === 'approved')
  const closed = (referrals || []).filter((row) => ['declined', 'completed'].includes(row.status)).slice(0, 5)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Referral approval queue"
      subtitle={
        isAdmin
          ? 'Clinical officers authorise transfer. Every decision is written to the local audit trail.'
          : 'Field staff can follow the queue; only a Clinical Officer can approve transfer.'
      }
      icon={Send}
      size="lg"
    >
      <div className="space-y-5">
        {!referrals ? (
          <div className="space-y-2">
            {[0, 1].map((key) => (
              <div key={key} className="h-20 animate-pulse rounded-xl bg-surface/40" />
            ))}
          </div>
        ) : (
          <>
            <section>
              <div className="mb-2 flex items-center gap-2">
                <p className="label-clinical">Awaiting approval</p>
                <span className="rounded-md bg-danger/15 px-1.5 py-0.5 text-[10px] font-bold text-danger">{pending.length}</span>
                {!isAdmin ? (
                  <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-clinical text-muted">
                    <Lock size={10} /> Read-only
                  </span>
                ) : null}
              </div>
              {pending.length ? (
                <ul className="space-y-2">
                  {pending.map((referral) => (
                    <motion.li
                      layout
                      key={referral.id}
                      className="rounded-xl border border-danger/25 bg-danger/5 p-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <Avatar
                          initials={(referral.patient?.firstName?.[0] || '') + (referral.patient?.lastName?.[0] || '')}
                          tone="danger"
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-[13px] font-semibold text-content">{fullName(referral.patient)}</p>
                            <span className="metric text-[9px] text-muted">{referral.patient?.code}</span>
                            <TriageBadge level={referral.urgency === 'urgent' ? 'urgent' : 'caution'} />
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-muted">{referral.reason}</p>
                          <p className="mt-1 text-[10px] text-muted">
                            Raised by {referral.createdBy} · {formatDateTime(referral.createdAt)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenPatient?.(referral.patientId)}
                          className="rounded-lg border border-line/20 bg-surface/40 p-1.5 text-muted transition-colors hover:text-brand"
                          aria-label="Open patient record"
                        >
                          <ExternalLink size={13} />
                        </button>
                      </div>

                      {isAdmin ? (
                        <div className="mt-2.5">
                          <AnimatePresence initial={false} mode="wait">
                            {decliningId === referral.id ? (
                              <motion.div
                                key="decline"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-2 overflow-hidden"
                              >
                                <TextArea
                                  rows={2}
                                  value={note}
                                  onChange={(event) => setNote(event.target.value)}
                                  placeholder="Reason for declining (stored in the audit trail)"
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-danger !py-1.5 !text-[11px]"
                                    disabled={busyId === referral.id}
                                    onClick={() => decide(referral, 'declined')}
                                  >
                                    Confirm decline
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-ghost !py-1.5 !text-[11px]"
                                    onClick={() => {
                                      setDecliningId(null)
                                      setNote('')
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </motion.div>
                            ) : (
                              <motion.div key="actions" className="flex gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <button
                                  type="button"
                                  className="btn btn-primary !px-3 !py-1.5 !text-[11px]"
                                  disabled={busyId === referral.id}
                                  onClick={() => decide(referral, 'approved')}
                                >
                                  <Check size={12} /> Approve transfer
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary !px-3 !py-1.5 !text-[11px]"
                                  onClick={() => setDecliningId(referral.id)}
                                >
                                  <X size={12} /> Decline
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ) : (
                        <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-line/20 bg-surface/40 px-2 py-1 text-[10px] text-muted">
                          <ShieldCheck size={11} className="text-brand" /> Awaiting clinical officer decision
                        </p>
                      )}
                    </motion.li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={ShieldCheck}
                  title="No referrals waiting"
                  description="Urgent vitals automatically create a referral here for clinical approval."
                  className="!py-8"
                />
              )}
            </section>

            {active.length ? (
              <section>
                <p className="label-clinical mb-2">Approved · in transit</p>
                <ul className="space-y-2">
                  {active.map((referral) => (
                    <li
                      key={referral.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-ok/25 bg-ok/5 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-content">
                          {fullName(referral.patient)} <span className="metric text-[9px] text-muted">{referral.patient?.code}</span>
                        </p>
                        <p className="truncate text-[10px] text-muted">
                          {referral.reason} · approved by {referral.decidedBy || 'clinical officer'}
                        </p>
                      </div>
                      <Badge tone="ok" dot>
                        Approved
                      </Badge>
                      <button
                        type="button"
                        className="btn btn-secondary !px-2.5 !py-1 !text-[10px]"
                        disabled={busyId === referral.id}
                        onClick={() => close(referral)}
                      >
                        <Check size={11} /> Mark arrived
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {closed.length ? (
              <section>
                <p className="label-clinical mb-2">Recently closed</p>
                <ul className="space-y-1.5">
                  {closed.map((referral) => (
                    <li key={referral.id} className="flex items-center justify-between gap-2 rounded-lg border border-line/15 bg-surface/25 px-3 py-1.5">
                      <span className="min-w-0">
                        <span className="block truncate text-[11px] font-medium text-content">{fullName(referral.patient)}</span>
                        <span className="block truncate text-[10px] text-muted">{referral.reason}</span>
                      </span>
                      <Badge tone={referral.status === 'completed' ? 'ok' : 'muted'}>{referral.status}</Badge>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}

        <p className="rounded-xl border border-brand/20 bg-brand/5 px-3 py-2 text-[10px] leading-relaxed text-muted">
          Decision timestamps and approver identity are stored offline with the patient record, then mirrored on sync.
          {pending.length ? ` Oldest pending: ${formatDateTime(pending[pending.length - 1]?.createdAt)}.` : ''}
        </p>
      </div>
    </Modal>
  )
}
