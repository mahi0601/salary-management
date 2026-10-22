import { ApiError, api, buildQuery, session, setSignedOutHandler } from './client'

afterEach(() => {
  vi.restoreAllMocks()
  session.clear()
  setSignedOutHandler(() => {})
})

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

describe('sign-in handling', () => {
  it('sends the saved token as a bearer header', async () => {
    session.save('abc123')
    const spy = mockFetch(200, { email: 'hr@acme.com' })

    await api.me()

    const init = spy.mock.calls[0][1] as RequestInit
    expect(init.headers).toMatchObject({ Authorization: 'Bearer abc123' })
  })

  it('sends no Authorization header when signed out', async () => {
    const spy = mockFetch(200, {})

    await api.getMeta()

    expect((spy.mock.calls[0][1] as RequestInit).headers).not.toHaveProperty('Authorization')
  })

  it('forgets the token and tells the app when the server says 401', async () => {
    session.save('expired')
    const signedOut = vi.fn()
    setSignedOutHandler(signedOut)
    mockFetch(401, { detail: 'Please sign in' })

    await expect(api.getMeta()).rejects.toMatchObject({ status: 401 })

    expect(session.token()).toBeNull()
    expect(signedOut).toHaveBeenCalledOnce()
  })

  it('a wrong password is just an error, not a sign-out', async () => {
    const signedOut = vi.fn()
    setSignedOutHandler(signedOut)
    mockFetch(401, { detail: 'Incorrect email or password' })

    await expect(api.login('a@b.com', 'x')).rejects.toThrow('Incorrect email or password')

    expect(signedOut).not.toHaveBeenCalled()
  })
})

describe('downloadCsv', () => {
  it('fetches with the token and saves the file', async () => {
    session.save('abc123')
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('id,name\n1,Asha', { status: 200 }))
    URL.createObjectURL = vi.fn(() => 'blob:fake')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await api.downloadCsv({ country: 'IN' }, 'full_name', 'asc')

    expect(spy.mock.calls[0][0]).toBe('/api/employees/export.csv?country=IN&sort_by=full_name&order=asc')
    expect((spy.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer abc123' })
    expect(click).toHaveBeenCalledOnce()
  })

  it('throws when the export fails', async () => {
    mockFetch(500, { detail: 'boom' })

    await expect(api.downloadCsv({}, 'full_name', 'asc')).rejects.toThrow('boom')
  })
})

describe('import', () => {
  it('sends the file as the raw body with the filename and mode in the query', async () => {
    session.save('abc123')
    const report = { dry_run: true, total_rows: 1, valid_rows: 1, created: 0, error_count: 0, errors: [] }
    const spy = mockFetch(200, report)
    const file = new File(['a,b'], 'march.csv')

    await expect(api.importFile(file, true)).resolves.toEqual(report)

    expect(spy.mock.calls[0][0]).toBe('/api/employees/import?filename=march.csv&dry_run=true')
    const init = spy.mock.calls[0][1] as RequestInit
    expect(init.body).toBe(file)
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/octet-stream',
      Authorization: 'Bearer abc123',
    })
  })

  it('turns a bad file into an error with the server message', async () => {
    mockFetch(422, { detail: 'Missing columns: salary' })

    await expect(api.importFile(new File(['x'], 'a.csv'), false)).rejects.toThrow('Missing columns: salary')
  })

  it('downloads the template with the token', async () => {
    session.save('abc123')
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('full_name,email', { status: 200 }))
    URL.createObjectURL = vi.fn(() => 'blob:fake')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await api.downloadImportTemplate()

    expect(spy.mock.calls[0][0]).toBe('/api/employees/import-template.csv')
    expect((spy.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer abc123' })
  })
})
