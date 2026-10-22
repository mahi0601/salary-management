import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material'
import { useState } from 'react'
import { ApiError, api } from '../api/client'
import type { Employee, Meta } from '../api/types'
import { type EmployeeFormValues, type FormErrors, toInput, validateEmployee } from '../lib/validation'

interface Props {
  meta: Meta
  employee: Employee | null // null = create
  onClose: () => void
  onSaved: () => void
}

function initialValues(employee: Employee | null): EmployeeFormValues {
  return {
    full_name: employee?.full_name ?? '',
    email: employee?.email ?? '',
    job_title: employee?.job_title ?? '',
    department: employee?.department ?? '',
    country: employee?.country ?? '',
    salary: employee ? String(employee.salary) : '',
    hire_date: employee?.hire_date ?? '',
  }
}

export default function EmployeeFormDialog({ meta, employee, onClose, onSaved }: Props) {
  const [values, setValues] = useState(() => initialValues(employee))
  const [errors, setErrors] = useState<FormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = (field: keyof EmployeeFormValues) => (value: string) =>
    setValues((v) => ({ ...v, [field]: value }))
  const currency = meta.countries.find((c) => c.code === values.country)?.currency

  async function submit() {
    const found = validateEmployee(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    setServerError(null)
    try {
      const input = toInput(values)
      if (employee) await api.updateEmployee(employee.id, input)
      else await api.createEmployee(input)
      onSaved()
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setErrors({ email: e.message })
      else setServerError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const text = (field: keyof EmployeeFormValues, label: string, extra = {}) => (
    <TextField
      label={label}
      value={values[field]}
      onChange={(e) => set(field)(e.target.value)}
      error={!!errors[field]}
      helperText={errors[field]}
      required
      fullWidth
      {...extra}
    />
  )

  const suggest = (field: 'job_title' | 'department', label: string, options: string[]) => (
    <Autocomplete
      freeSolo
      options={options}
      inputValue={values[field]}
      onInputChange={(_, v) => set(field)(v)}
      renderInput={(params) => (
        <TextField {...params} label={label} required error={!!errors[field]} helperText={errors[field]} />
      )}
    />
  )

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{employee ? 'Edit employee' : 'Add employee'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {serverError && <Alert severity="error">{serverError}</Alert>}
          {text('full_name', 'Full name')}
          {text('email', 'Email', { type: 'email' })}
          {suggest('department', 'Department', meta.departments)}
          {suggest('job_title', 'Job title', meta.job_titles)}
          <TextField
            select
            label="Country"
            value={values.country}
            onChange={(e) => set('country')(e.target.value)}
            error={!!errors.country}
            helperText={errors.country}
            required
          >
            {meta.countries.map((c) => (
              <MenuItem key={c.code} value={c.code}>
                {c.name} ({c.currency})
              </MenuItem>
            ))}
          </TextField>
          {text('salary', 'Annual base salary', {
            inputMode: 'numeric',
            slotProps: {
              input: { endAdornment: <InputAdornment position="end">{currency ?? ''}</InputAdornment> },
            },
          })}
          {text('hire_date', 'Hire date', { type: 'date', slotProps: { inputLabel: { shrink: true } } })}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
