import type {
  Band,
  Employee,
  EmployeeInput,
  EmployeePage,
  Filters,
  GroupBy,
  GroupStats,
  Meta,
  SalaryChange,
  SalaryChangeInput,
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

// sessionStorage: the login goes away when the tab closes. Storage can be blocked, hence the try/catch.
const TOKEN_KEY = 'token'

export const session = {
  token(): string | null {
    try {
      return sessionStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  save(token: string) {
    try {
      sessionStorage.setItem(TOKEN_KEY, token)
    } catch {
      // the user just has to sign in again after a refresh
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(TOKEN_KEY)
    } catch {
      // nothing stored, nothing to clear
    }
  },
}

let onSignedOut: () => void = () => {}

// the app registers this so an expired token drops the user back on the login page
export function setSignedOutHandler(handler: () => void) {
  onSignedOut = handler
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = session.token()
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra
}

async function failure(response: Response, isLogin: boolean): Promise<ApiError> {
  if (response.status === 401 && !isLogin) {
    session.clear()
    onSignedOut()
  }
  const body = await response.json().catch(() => ({}))
  return new ApiError(response.status, describeDetail(body.detail))
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: authHeaders(init?.body ? { 'Content-Type': 'application/json' } : {}),
  })
  if (!response.ok) throw await failure(response, path === '/api/auth/login')
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
  login: (email: string, password: string) =>
    request<{ token: string; email: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ email: string }>('/api/auth/me'),

  getMeta: () => request<Meta>('/api/meta'),

  listEmployees: ({ filters, sortBy, order, page, pageSize }: ListParams) =>
    request<EmployeePage>(
      `/api/employees${buildQuery({ ...filters, sort_by: sortBy, order, page, page_size: pageSize })}`,
    ),

  // a plain <a href> can't carry the Authorization header, so fetch it and save the blob
  async downloadCsv(filters: Filters, sortBy: SortField, order: 'asc' | 'desc') {
    const url = `/api/employees/export.csv${buildQuery({ ...filters, sort_by: sortBy, order })}`
    const response = await fetch(url, { headers: authHeaders() })
    if (!response.ok) throw await failure(response, false)
    const link = document.createElement('a')
    link.href = URL.createObjectURL(await response.blob())
    link.download = 'employees.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  },

  createEmployee: (input: EmployeeInput) =>
    request<Employee>('/api/employees', { method: 'POST', body: JSON.stringify(input) }),

  updateEmployee: (id: number, input: EmployeeInput) =>
    request<Employee>(`/api/employees/${id}`, { method: 'PUT', body: JSON.stringify(input) }),

  salaryHistory: (id: number) => request<SalaryChange[]>(`/api/employees/${id}/salary-history`),

  addSalaryChange: (id: number, input: SalaryChangeInput) =>
    request<SalaryChange[]>(`/api/employees/${id}/salary-changes`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  deleteEmployee: (id: number) => request<void>(`/api/employees/${id}`, { method: 'DELETE' }),

  summary: (filters: Filters) =>
    request<{ stats: SalaryStats | null }>(`/api/insights/summary${buildQuery({ ...filters })}`),

  breakdown: (groupBy: GroupBy, filters: Filters) =>
    request<GroupStats[]>(`/api/insights/breakdown${buildQuery({ ...filters, group_by: groupBy })}`),

  distribution: (filters: Filters, bucketSize: number) =>
    request<Band[]>(`/api/insights/distribution${buildQuery({ ...filters, bucket_size: bucketSize })}`),
}
