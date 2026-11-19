import React from 'react'
import { motion } from 'framer-motion'
import { Check, Contrast, Moon, Sun } from 'lucide-react'
import { THEMES, useApp } from '../context/AppProvider'

const ICONS = { clinical: Moon, sterile: Sun, amber: Contrast }

export default function ThemeToggle({ compact = false }) {
  const { theme, setTheme } = useApp()

  return (
    <section className={compact ? '' : 'glass rounded-2xl p-3.5 sm:p-4'}>
      {!compact ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-brand/25 bg-brand/10 text-brand">
            <Contrast size={17} />
          </span>
          <div>
            <p className="label-clinical">Ward lighting</p>
            <h2 className="text-sm font-semibold text-content">Theme engine</h2>
          </div>
          <span className="ml-auto text-[10px] uppercase tracking-clinical text-muted">Persisted on device</span>
        </div>
      ) : null}

      <div className={compact ? 'flex gap-1.5' : 'grid gap-2.5 sm:grid-cols-3'}>
        {Object.values(THEMES).map((item) => {
          const active = theme === item.id
          const Icon = ICONS[item.id]
          return (
            <motion.button
              key={item.id}
              type="button"
              onClick={() => setTheme(item.id)}
              whileTap={{ scale: 0.985 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              aria-pressed={active}
              className={`relative overflow-hidden rounded-xl border p-2.5 text-left transition-colors ${
                active ? 'border-brand/50 ring-1 ring-brand/25' : 'border-line/20 hover:border-brand/35'
              }`}
              style={{ background: `linear-gradient(150deg, ${item.swatch[0]} 0%, ${item.swatch[0]} 55%, ${item.swatch[1]}22 100%)` }}
            >
              <div className="flex items-center gap-1.5">
                <Icon size={12} style={{ color: item.swatch[1] }} />
                <p className="text-[11px] font-semibold" style={{ color: item.id === 'sterile' ? '#0b2b36' : '#f2fffd' }}>
                  {item.label}
                </p>
                {active ? (
                  <span className="ml-auto grid h-4 w-4 place-items-center rounded-full" style={{ background: item.swatch[1] }}>
                    <Check size={10} strokeWidth={3} color={item.id === 'sterile' ? '#fff' : '#04191b'} />
                  </span>
                ) : null}
              </div>
              <p
                className="mt-0.5 text-[9px] leading-snug"
                style={{ color: item.id === 'sterile' ? '#4f6f7c' : 'rgba(242,255,253,0.6)' }}
              >
                {item.hint}
              </p>
              <div className="mt-2 flex items-center gap-1">
                {item.swatch.map((color) => (
                  <span
                    key={color}
                    className="h-3.5 w-3.5 rounded-full border border-white/25"
                    style={{ background: color, boxShadow: `0 0 10px -2px ${color}` }}
                  />
                ))}
                <span className="ml-auto flex gap-1">
                  <span className="h-3.5 w-6 rounded-sm border border-white/20 bg-white/10 backdrop-blur" />
                  <span className="h-3.5 w-3 rounded-sm" style={{ background: item.swatch[1] }} />
                </span>
              </div>
            </motion.button>
          )
        })}
      </div>
    </section>
  )
}
