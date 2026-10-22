import PaymentsIcon from '@mui/icons-material/Payments'
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import { type FormEvent, useState } from 'react'
import { api, session } from '../api/client'

export default function LoginPage({ onSignedIn }: { onSignedIn: (email: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await api.login(email, password)
      session.save(result.token)
      onSignedIn(result.email)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper variant="outlined" component="form" onSubmit={submit} sx={{ p: 4, width: '100%', maxWidth: 380 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <PaymentsIcon color="primary" />
            <Typography variant="h6" component="h1">
              ACME Salary Management
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Sign in to manage salaries.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
