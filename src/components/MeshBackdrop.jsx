import React from 'react'
import { useApp } from '../context/AppProvider'

/**
 * Animated diagnostic mesh. Pure CSS transforms keep the GPU busy instead of
 * React, so scrolling a long patient register stays at 60fps.
 */
export default function MeshBackdrop() {
  const { theme } = useApp()

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas">
      <div
        className="mesh-blob animate-mesh"
        style={{
          top: '-18vh',
          left: '-12vw',
          width: '58vw',
          height: '62vh',
          background: 'radial-gradient(circle at 40% 40%, rgb(var(--mesh-a)) 0%, transparent 68%)',
        }}
      />
      <div
        className="mesh-blob animate-mesh-slow"
        style={{
          top: '8vh',
          right: '-16vw',
          width: '54vw',
          height: '58vh',
          background: 'radial-gradient(circle at 60% 40%, rgb(var(--mesh-b)) 0%, transparent 66%)',
        }}
      />
      <div
        className="mesh-blob animate-mesh"
        style={{
          bottom: '-24vh',
          left: '22vw',
          width: '60vw',
          height: '50vh',
          background: 'radial-gradient(circle at 50% 50%, rgb(var(--mesh-c)) 0%, transparent 70%)',
          animationDelay: '-9s',
        }}
      />
      <div className="diagnostic-grid absolute inset-0" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 120% 80% at 50% 0%, transparent 30%, rgb(var(--c-canvas) / 0.55) 78%, rgb(var(--c-canvas)) 100%)',
        }}
      />
      {theme === 'clinical' ? (
        <div className="absolute inset-x-0 top-0 h-32 overflow-hidden opacity-30">
          <div className="animate-scanline h-px w-full bg-gradient-to-r from-transparent via-brand to-transparent" />
        </div>
      ) : null}
      <div className="grain absolute inset-0" />
      <style>{`
        .grain {
          opacity: 0.035;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E");
        }
        [data-theme='sterile'] .grain { opacity: 0.02; }
      `}</style>
    </div>
  )
}
