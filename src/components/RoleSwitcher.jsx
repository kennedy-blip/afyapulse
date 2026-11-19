import React from 'react'
import { motion } from 'framer-motion'
import { Check, HeartHandshake, Lock, ShieldCheck, Sparkles } from 'lucide-react'
import { ROLES, useApp } from '../context/AppProvider'

const PRIVILEGES = {
  admin: ['Clinical histories & referral approvals', 'Inventory, dispensing & expiry overrides', 'Anonymised epidemiological exports'],
  chp: ['Register patients & log vitals', 'Work scheduled home visits', 'View clinic stock availability'],
}

export default function RoleSwitcher() {
  const { role, setRole, profiles } = useApp()

  return (
    <section className="glass glass-outline rounded-2xl p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl border border-brand/25 bg-brand/10 text-brand">
          <ShieldCheck size={17} />
        </span>
        <div>
          <p className="label-clinical">Access & identity</p>
          <h2 className="text-sm font-semibold text-content">Role-based privileges</h2>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-clinical text-brand">
          <Sparkles size={10} /> Applies instantly
        </span>
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {Object.values(ROLES).map((item) => {
          const active = item.id === role
          const profile = profiles[item.id]
          const Icon = item.id === 'admin' ? ShieldCheck : HeartHandshake
          return (
            <motion.button
              key={item.id}
              type="button"
              onClick={() => setRole(item.id)}
              whileTap={{ scale: 0.99 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={`relative overflow-hidden rounded-xl border p-3 text-left transition-colors ${
                active
                  ? 'border-brand/45 bg-gradient-to-br from-brand/15 via-brand/5 to-transparent'
                  : 'border-line/20 bg-surface/30 hover:border-brand/30'
              }`}
              aria-pressed={active}
            >
              {active ? (
                <motion.span
                  layoutId="role-active"
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="absolute inset-0 border border-brand/40 bg-brand/[0.06]"
                  style={{ borderRadius: 'inherit' }}
                />
              ) : null}
              <div className="relative flex items-start gap-2.5">
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${
                    active ? 'border-brand/40 bg-brand/15 text-brand' : 'border-line/20 bg-surface/50 text-muted'
                  }`}
                >
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[12px] font-semibold text-content">{item.label}</p>
                    {active ? (
                      <span className="grid h-4 w-4 place-items-center rounded-full bg-brand text-canvas">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[10px] font-medium text-muted">{profile.name}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted">{item.description}</p>
                  <ul className="mt-2 space-y-1">
                    {PRIVILEGES[item.id].map((line) => (
                      <li key={line} className="flex items-start gap-1.5 text-[10px] leading-snug text-muted">
                        <Check size={10} className={`mt-0.5 shrink-0 ${active ? 'text-brand' : 'text-ok'}`} />
                        {line}
                      </li>
                    ))}
                  </ul>
                  {item.id === 'chp' ? (
                    <p className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-line/20 bg-surface/40 px-1.5 py-0.5 text-[9px] uppercase tracking-clinical text-muted">
                      <Lock size={9} /> No deletion or inventory rights
                    </p>
                  ) : null}
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>

      <p className="mt-2.5 flex items-center gap-1.5 text-[10px] leading-snug text-muted">
        <Lock size={10} className="shrink-0 text-brand" />
        Every mutation is stamped with the acting worker's role in the local audit trail.
      </p>
    </section>
  )
}
