import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Employee, SalaryChange } from '../api/types'
import { formatMoney, formatUsd } from '../lib/format'
import { type RaiseErrors, type RaiseFormValues, validateRaise } from '../lib/validation'

const REASONS = ['Annual review', 'Promotion', 'Market adjustment', 'Correction']

interface Props {
  employee: Employee
  onClose: () => void
  onChanged: () => void // the current salary may have moved, so the list should reload
}

const today = () => new Date().toISOString().slice(0, 10)

export default function SalaryHistoryDialog({ employee, onClose, onChanged }: Props) {
  const [rows, setRows] = useState<SalaryChange[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [form, setForm] = useState<RaiseFormValues>({ salary: '', effective_date: today(), reason: '' })
  const [errors, setErrors] = useState<RaiseErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api
      .salaryHistory(employee.id)
      .then(setRows)
      .catch((e: Error) => setLoadError(e.message))
  }, [employee.id])

  const set = (field: keyof RaiseFormValues) => (value: string) => setForm((f) => ({ ...f, [field]: value }))

  async function submit() {
    const found = validateRaise(form, employee.hire_date)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    setServerError(null)
    try {
      setRows(
        await api.addSalaryChange(employee.id, {
          salary: Number(form.salary),
          effective_date: form.effective_date,
          reason: form.reason.trim(),
        }),
      )
      setForm({ salary: '', effective_date: today(), reason: '' })
      onChanged()
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const latest = rows?.[rows.length - 1]

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        Salary history: {employee.full_name}
        <Typography variant="body2" color="text.secondary">
          {employee.job_title}, {employee.country}
          {latest && ` · now ${formatMoney(latest.salary, latest.currency)}`}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {loadError && <Alert severity="error">{loadError}</Alert>}
        {rows && (
          <Table size="small" aria-label="Salary history">
            <TableHead>
              <TableRow>
                <TableCell>Effective</TableCell>
                <TableCell align="right">Salary</TableCell>
                <TableCell align="right">Change</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>By</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[...rows].reverse().map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.effective_date}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{formatMoney(r.salary, r.currency)}</Typography>
                    {r.currency !== 'USD' && (
                      <Typography variant="caption" color="text.secondary">
                        ≈ {formatUsd(r.salary_usd)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {r.change_pct === null ? '–' : `${r.change_pct > 0 ? '+' : ''}${r.change_pct}%`}
                  </TableCell>
                  <TableCell>{r.reason}</TableCell>
                  <TableCell>{r.changed_by}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Divider sx={{ my: 3 }} />
        <Typography variant="subtitle1" component="h3" sx={{ mb: 1.5 }}>
          Record a salary change
        </Typography>
        {serverError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {serverError}
          </Alert>
        )}
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
          <TextField
            label={`New annual salary (${latest?.currency ?? employee.currency})`}
            value={form.salary}
            onChange={(e) => set('salary')(e.target.value)}
            error={!!errors.salary}
            helperText={errors.salary}
            inputMode="numeric"
          />
          <TextField
            label="Effective date"
            type="date"
            value={form.effective_date}
            onChange={(e) => set('effective_date')(e.target.value)}
            error={!!errors.effective_date}
            helperText={errors.effective_date}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Autocomplete
            freeSolo
            options={REASONS}
            inputValue={form.reason}
            onInputChange={(_, v) => set('reason')(v)}
            renderInput={(params) => (
              <TextField {...params} label="Reason" error={!!errors.reason} helperText={errors.reason} />
            )}
          />
        </Box>
        <Stack direction="row" sx={{ mt: 2, justifyContent: 'flex-end' }}>
          <Button variant="contained" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Record change'}
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
