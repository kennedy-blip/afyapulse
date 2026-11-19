/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--c-canvas) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        elevated: 'rgb(var(--c-elevated) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        content: 'rgb(var(--c-content) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        brand: 'rgb(var(--c-brand) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        warn: 'rgb(var(--c-warn) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        ok: 'rgb(var(--c-ok) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      letterSpacing: {
        clinical: '0.16em',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.75rem',
      },
      boxShadow: {
        glass: '0 24px 60px -24px rgba(2, 12, 16, 0.65), inset 0 1px 0 0 rgba(255,255,255,0.06)',
        glow: '0 0 0 1px rgb(var(--c-brand) / 0.35), 0 24px 70px -30px rgb(var(--c-brand) / 0.6)',
        'glow-sm': '0 0 24px -6px rgb(var(--c-brand) / 0.55)',
      },
      backgroundImage: {
        'brand-sheen': 'linear-gradient(120deg, rgb(var(--c-brand)) 0%, rgb(var(--c-accent)) 100%)',
      },
      transitionTimingFunction: {
        clinical: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        meshDrift: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '33%': { transform: 'translate3d(6%, -8%, 0) scale(1.12)' },
          '66%': { transform: 'translate3d(-7%, 5%, 0) scale(0.94)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.85)', opacity: '0.75' },
          '100%': { transform: 'scale(2.1)', opacity: '0' },
        },
        floatSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1200%)' },
        },
      },
      animation: {
        mesh: 'meshDrift 26s ease-in-out infinite',
        'mesh-slow': 'meshDrift 38s ease-in-out infinite reverse',
        shimmer: 'shimmer 2.4s linear infinite',
        'pulse-ring': 'pulseRing 1.8s ease-out infinite',
        float: 'floatSoft 6s ease-in-out infinite',
        scanline: 'scanline 7s linear infinite',
      },
    },
  },
  plugins: [],
}
