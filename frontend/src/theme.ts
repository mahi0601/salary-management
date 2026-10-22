import { createTheme } from '@mui/material'

export type Mode = 'light' | 'dark'

export const makeTheme = (mode: Mode) =>
  createTheme({
    palette: {
      mode,
      primary: { main: mode === 'dark' ? '#6cb4e4' : '#1f5f8b' },
      background:
        mode === 'dark' ? { default: '#12171d', paper: '#1b222b' } : { default: '#f5f7fa' },
    },
    shape: { borderRadius: 8 },
  })

export function initialMode(): Mode {
  try {
    const saved = localStorage.getItem('mode')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // storage blocked, fall through
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
