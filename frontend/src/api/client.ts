import type {
  Band,
  Employee,
  EmployeeInput,
  EmployeePage,
  Filters,
  GroupBy,
  GroupStats,
  Meta,
  SalaryStats,
  SortField,
} from './types'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// `detail` is a string for our own errors but a list for pydantic's 422s
function describeDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((d: { loc?: string[]; msg?: string }) => `${(d.loc ?? []).slice(1).join('.')}: ${d.msg ?? ''}`)
      .join('; ')
  }
  return 'Something went wrong'
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(response.status, describeDetail(body.detail))
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export function buildQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}

export interface ListParams {
  filters: Filters
  sortBy: SortField
  order: 'asc' | 'desc'
  page: number
  pageSize: number
}

export const api = {
  getMeta: () => request<Meta>('/api/meta'),

  listEmployees: ({ filters, sortBy, order, page, pageSize }: ListParams) =>
    request<EmployeePage>(
      `/api/employees${buildQuery({ ...filters, sort_by: sortBy, order, page, page_size: pageSize })}`,
    ),

  exportUrl: (filters: Filters, sortBy: SortField, order: 'asc' | 'desc') =>
    `/api/employees/export.csv${buildQuery({ ...filters, sort_by: sortBy, order })}`,

  createEmployee: (input: EmployeeInput) =>
    request<Employee>('/api/employees', { method: 'POST', body: JSON.stringify(input) }),

  updateEmployee: (id: number, input: EmployeeInput) =>
    request<Employee>(`/api/employees/${id}`, { method: 'PUT', body: JSON.stringify(input) }),

  deleteEmployee: (id: number) => request<void>(`/api/employees/${id}`, { method: 'DELETE' }),

  summary: (filters: Filters) =>
    request<{ stats: SalaryStats | null }>(`/api/insights/summary${buildQuery({ ...filters })}`),

  breakdown: (groupBy: GroupBy, filters: Filters) =>
    request<GroupStats[]>(`/api/insights/breakdown${buildQuery({ ...filters, group_by: groupBy })}`),

  distribution: (filters: Filters, bucketSize: number) =>
    request<Band[]>(`/api/insights/distribution${buildQuery({ ...filters, bucket_size: bucketSize })}`),
}
