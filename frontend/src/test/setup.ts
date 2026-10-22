import '@testing-library/jest-dom/vitest'

// jsdom has no ResizeObserver, which recharts' ResponsiveContainer needs
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
