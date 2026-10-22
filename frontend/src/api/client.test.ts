import { ApiError, api, buildQuery } from './client'

afterEach(() => vi.restoreAllMocks())

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(status === 204 ? null : JSON.stringify(body), { status }),
  )
}

describe('buildQuery', () => {
  it('skips empty and undefined values', () => {
    expect(buildQuery({ a: 'x', b: '', c: undefined, d: 0 })).toBe('?a=x&d=0')
  })

  it('returns an empty string when there are no params', () => {
    expect(buildQuery({})).toBe('')
  })
})

describe('api', () => {
  it('sends filters, sort and pagination to the list endpoint', async () => {
    const spy = mockFetch(200, { items: [], total: 0, page: 2, page_size: 25 })

    await api.listEmployees({
      filters: { country: 'US', search: '' },
      sortBy: 'salary_usd',
      order: 'desc',
      page: 2,
      pageSize: 25,
    })

    expect(spy.mock.calls[0][0]).toBe(
      '/api/employees?country=US&sort_by=salary_usd&order=desc&page=2&page_size=25',
    )
  })

  it('turns a domain error into an ApiError carrying status and message', async () => {
    mockFetch(409, { detail: 'An employee with email a@b.com already exists' })

    await expect(api.deleteEmployee(1)).rejects.toMatchObject({
      status: 409,
      message: 'An employee with email a@b.com already exists',
    })
  })

  it('flattens FastAPI validation errors into readable text', async () => {
    mockFetch(422, { detail: [{ loc: ['body', 'salary'], msg: 'must be greater than 0' }] })

    const error = await api.createEmployee({} as never).catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.message).toBe('salary: must be greater than 0')
  })

  it('handles 204 responses without a body', async () => {
    mockFetch(204, null)

    await expect(api.deleteEmployee(1)).resolves.toBeUndefined()
  })
})
