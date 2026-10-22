export interface Employee {
  id: number
  full_name: string
  email: string
  job_title: string
  department: string
  country: string
  salary: number
  currency: string
  salary_usd: number
  hire_date: string
}

export interface EmployeeInput {
  full_name: string
  email: string
  job_title: string
  department: string
  country: string
  salary: number
  hire_date: string
}

export interface SalaryChange {
  id: number
  effective_date: string
  salary: number
  currency: string
  salary_usd: number
  change_pct: number | null
  reason: string
  changed_by: string
}

export interface SalaryChangeInput {
  salary: number
  effective_date: string
  reason: string
}

export interface ImportReport {
  dry_run: boolean
  total_rows: number
  valid_rows: number
  created: number
  error_count: number
  errors: { row: number; field: string; message: string }[]
}

export interface EmployeePage {
  items: Employee[]
  total: number
  page: number
  page_size: number
}

export interface CountryInfo {
  code: string
  name: string
  currency: string
  usd_rate: number
}

export interface Meta {
  countries: CountryInfo[]
  departments: string[]
  job_titles: string[]
}

export interface SalaryStats {
  headcount: number
  total_usd: number
  average_usd: number
  min_usd: number
  p25_usd: number
  median_usd: number
  p75_usd: number
  max_usd: number
}

export interface GroupStats extends SalaryStats {
  key: string
}

export interface Band {
  from_usd: number
  to_usd: number
  count: number
}

export type GroupBy = 'country' | 'department' | 'job_title'

export type SortField =
  | 'full_name'
  | 'job_title'
  | 'department'
  | 'country'
  | 'hire_date'
  | 'salary_usd'

export interface Filters {
  search?: string
  country?: string
  department?: string
  job_title?: string
  min_salary_usd?: string
  max_salary_usd?: string
}
