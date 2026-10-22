import { AppBar, Container, Tab, Tabs, Toolbar, Typography } from '@mui/material'
import { Suspense, lazy, useEffect, useState } from 'react'
import { api } from './api/client'
import type { Meta } from './api/types'
import EmployeesPage from './components/EmployeesPage'

// recharts is big, so only fetch it when someone opens this tab
const InsightsPage = lazy(() => import('./components/InsightsPage'))

export default function App() {
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
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
            ACME Salary Management
          </Typography>
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
