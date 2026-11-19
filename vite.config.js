import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base keeps the static bundle portable inside the Android WebView.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    watch: {
      // The committed Android project contains a copy of dist — never reload on it.
      ignored: ['**/android/**', '**/dist/**', '**/resources/**'],
    },
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ['src/test/**/*.test.{js,jsx}'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2019',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          motion: ['framer-motion'],
          storage: ['dexie', 'dexie-react-hooks'],
        },
      },
    },
  },
})
