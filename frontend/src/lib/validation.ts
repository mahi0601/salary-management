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

/** Mirrors the server rules so HR gets instant feedback; the server remains the authority. */
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
