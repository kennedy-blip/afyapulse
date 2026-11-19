import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

const SIZES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-3xl',
  xl: 'sm:max-w-5xl',
}

export default function Modal({ open, onClose, title, subtitle, icon: Icon, size = 'md', children, footer, onSubmit }) {
  useEffect(() => {
    if (!open) return undefined
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', handleKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-canvas/70 backdrop-blur-md"
          />
          <motion.div
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : 'Dialog'}
            initial={{ opacity: 0, y: 48, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`glass-strong glass-outline relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl border-line/25 shadow-glass sm:rounded-3xl ${SIZES[size] || SIZES.md}`}
          >
            {(() => {
              const Body = onSubmit ? 'form' : 'div'
              return (
                <Body
                  {...(onSubmit ? { onSubmit } : {})}
                  className="flex min-h-0 flex-1 flex-col"
                >
            <div className="flex items-start gap-3 border-b border-line/15 px-5 pb-4 pt-3 sm:px-6 sm:pt-5">
              <div className="flex-1">
                <div className="sheet-grabber mb-3 sm:hidden" />
                <div className="flex items-center gap-2.5">
                  {Icon ? (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand/25 bg-brand/10 text-brand">
                      <Icon size={17} strokeWidth={2.1} />
                    </span>
                  ) : null}
                  <div>
                    <h2 className="text-lg font-semibold leading-tight text-content sm:text-xl">{title}</h2>
                    {subtitle ? <p className="mt-1 text-xs text-muted">{subtitle}</p> : null}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="focus-ring mt-1 rounded-lg border border-line/20 bg-surface/40 p-1.5 text-muted transition-colors hover:text-content"
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>
            <div className="scroll-thin flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
            {footer ? (
              <div className="safe-bottom border-t border-line/15 bg-surface/20 px-5 py-3.5 sm:px-6">{footer}</div>
            ) : null}
                </Body>
              )
            })()}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
