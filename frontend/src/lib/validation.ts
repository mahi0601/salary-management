import type { EmployeeInput } from '../api/types'

export interface EmployeeFormValues {
  full_name: string
  email: string
  job_title: string
  department: string
  country: string
  salary: string
  hire_date: string
}

export type FormErrors = Partial<Record<keyof EmployeeFormValues, string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Same rules as the API, just so the form complains before a round trip. The server still decides.
export function validateEmployee(values: EmployeeFormValues, today = new Date()): FormErrors {
  const errors: FormErrors = {}
  if (!values.full_name.trim()) errors.full_name = 'Name is required'
  if (!EMAIL.test(values.email.trim())) errors.email = 'Enter a valid email address'
  if (!values.job_title.trim()) errors.job_title = 'Job title is required'
  if (!values.department.trim()) errors.department = 'Department is required'
  if (!values.country) errors.country = 'Country is required'

  if (!/^\d+$/.test(values.salary) || Number(values.salary) <= 0) {
    errors.salary = 'Enter a whole number greater than 0'
  }

  if (!values.hire_date) {
    errors.hire_date = 'Hire date is required'
  } else if (values.hire_date > today.toISOString().slice(0, 10)) {
    errors.hire_date = 'Hire date cannot be in the future'
  }
  return errors
}

export function toInput(values: EmployeeFormValues): EmployeeInput {
  return {
    full_name: values.full_name.trim(),
    email: values.email.trim(),
    job_title: values.job_title.trim(),
    department: values.department.trim(),
    country: values.country,
    salary: Number(values.salary),
    hire_date: values.hire_date,
  }
}

export interface RaiseFormValues {
  salary: string
  effective_date: string
  reason: string
}

export type RaiseErrors = Partial<Record<keyof RaiseFormValues, string>>

export function validateRaise(values: RaiseFormValues, hireDate: string, today = new Date()): RaiseErrors {
  const errors: RaiseErrors = {}
  if (!/^\d+$/.test(values.salary) || Number(values.salary) <= 0) {
    errors.salary = 'Enter a whole number greater than 0'
  }
  if (!values.effective_date) {
    errors.effective_date = 'Effective date is required'
  } else if (values.effective_date > today.toISOString().slice(0, 10)) {
    errors.effective_date = 'Effective date cannot be in the future'
  } else if (values.effective_date < hireDate) {
    errors.effective_date = `Effective date is before the hire date (${hireDate})`
  }
  if (!values.reason.trim()) errors.reason = 'Give a reason'
  return errors
}
