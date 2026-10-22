import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import LogoutIcon from '@mui/icons-material/Logout'
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
import { api, session, setSignedOutHandler } from './api/client'
import type { Meta } from './api/types'
import EmployeesPage from './components/EmployeesPage'
import LoginPage from './components/LoginPage'
import { type Mode, initialMode, makeTheme } from './theme'

// recharts is big, so only fetch it when someone opens this tab
const InsightsPage = lazy(() => import('./components/InsightsPage'))

function Shell({ email, mode, onToggleMode, onSignOut }: ShellProps) {
  const [tab, setTab] = useState<'employees' | 'insights'>(() =>
    window.location.hash === '#insights' ? 'insights' : 'employees',
  )
  const [meta, setMeta] = useState<Meta | null>(null)
  const [metaVersion, setMetaVersion] = useState(0)
  useEffect(() => {
    api.getMeta().then(setMeta).catch(() => setMeta(null))
  }, [metaVersion])

  return (
    <>
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <PaymentsIcon sx={{ mr: 1.5 }} />
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
            ACME Salary Management
          </Typography>
          <IconButton
            color="inherit"
            onClick={onToggleMode}
            aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
          <Typography variant="body2" sx={{ mx: 1, display: { xs: 'none', sm: 'block' } }}>
            {email}
          </Typography>
          <IconButton color="inherit" onClick={onSignOut} aria-label="Sign out">
            <LogoutIcon />
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
    </>
  )
}

interface ShellProps {
  email: string
  mode: Mode
  onToggleMode: () => void
  onSignOut: () => void
}

export default function App() {
  const [mode, setMode] = useState<Mode>(initialMode)
  const theme = useMemo(() => makeTheme(mode), [mode])
  const [email, setEmail] = useState<string | null>(null)
  // if a token is already saved we ask the server whether it is still good
  const [checking, setChecking] = useState(() => session.token() !== null)

  useEffect(() => {
    setSignedOutHandler(() => setEmail(null))
    if (session.token() === null) return
    api
      .me()
      .then((me) => setEmail(me.email))
      .catch(() => session.clear())
      .finally(() => setChecking(false))
  }, [])

  const toggleMode = () => {
    const next = mode === 'dark' ? 'light' : 'dark'
    setMode(next)
    try {
      localStorage.setItem('mode', next)
    } catch {
      // not worth failing over
    }
  }

  const signOut = () => {
    session.clear()
    setEmail(null)
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {checking ? null : email ? (
        <Shell email={email} mode={mode} onToggleMode={toggleMode} onSignOut={signOut} />
      ) : (
        <LoginPage onSignedIn={setEmail} />
      )}
    </ThemeProvider>
  )
}
