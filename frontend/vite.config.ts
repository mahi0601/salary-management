/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8000' } },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    testTimeout: 15000, // headroom for slow CI machines; a typical test takes well under a second
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/test/**', 'src/**/*.test.*', 'src/main.tsx'],
      // a floor just under today's numbers (86 / 88 / 76); CI fails if tests get thinner
      thresholds: { statements: 80, lines: 80, functions: 70, branches: 80 },
    },
  },
})
