import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import PaymentsIcon from '@mui/icons-material/Payments'
import {
  AppBar,
  Container,
  CssBaseline,
  IconButton,
  Tab,
  Tabs,
  ThemeProvider,
  Toolbar,
  Typography,
} from '@mui/material'
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { api } from './api/client'
import type { Meta } from './api/types'
import EmployeesPage from './components/EmployeesPage'
import { type Mode, initialMode, makeTheme } from './theme'

// recharts is big, so only fetch it when someone opens this tab
const InsightsPage = lazy(() => import('./components/InsightsPage'))

export default function App() {
  const [tab, setTab] = useState<'employees' | 'insights'>(() =>
    window.location.hash === '#insights' ? 'insights' : 'employees',
  )
  const [meta, setMeta] = useState<Meta | null>(null)
  const [metaVersion, setMetaVersion] = useState(0)
  const [mode, setMode] = useState<Mode>(initialMode)
  const theme = useMemo(() => makeTheme(mode), [mode])

  const toggleMode = () => {
    const next = mode === 'dark' ? 'light' : 'dark'
    setMode(next)
    try {
      localStorage.setItem('mode', next)
    } catch {
      // not worth failing over
    }
  }

  useEffect(() => {
    api.getMeta().then(setMeta).catch(() => setMeta(null))
  }, [metaVersion])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <PaymentsIcon sx={{ mr: 1.5 }} />
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
            ACME Salary Management
          </Typography>
          <IconButton
            color="inherit"
            onClick={toggleMode}
            aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
        </Toolbar>
        <Tabs value={tab} onChange={(_, v) => {
            setTab(v)
            window.location.hash = v === 'insights' ? 'insights' : ''
          }} textColor="inherit" indicatorColor="secondary">
          <Tab value="employees" label="Employees" />
          <Tab value="insights" label="Pay insights" />
        </Tabs>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {meta === null ? (
          <Typography color="text.secondary">Loading…</Typography>
        ) : tab === 'employees' ? (
          <EmployeesPage meta={meta} onDataChanged={() => setMetaVersion((v) => v + 1)} />
        ) : (
          <Suspense fallback={<Typography color="text.secondary">Loading…</Typography>}>
            <InsightsPage meta={meta} />
          </Suspense>
        )}
      </Container>
    </ThemeProvider>
  )
}
