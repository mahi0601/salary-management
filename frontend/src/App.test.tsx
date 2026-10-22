import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api, session } from './api/client'
import App from './App'

const meta = { countries: [{ code: 'US', name: 'United States', currency: 'USD', usd_rate: 1 }], departments: [], job_titles: [] }

function mockData() {
  vi.spyOn(api, 'getMeta').mockResolvedValue(meta)
  vi.spyOn(api, 'listEmployees').mockResolvedValue({ items: [], total: 0, page: 1, page_size: 25 })
}

beforeEach(() => {
  session.clear()
  localStorage.clear()
  window.location.hash = ''
})
afterEach(() => vi.restoreAllMocks())

describe('App', () => {
  it('shows the login page when nobody is signed in', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('goes straight to the employees page when the saved token is still good', async () => {
    session.save('good-token')
    vi.spyOn(api, 'me').mockResolvedValue({ email: 'hr@acme.com' })
    mockData()

    render(<App />)

    expect(await screen.findByText('hr@acme.com')).toBeInTheDocument()
    expect(await screen.findByText('No employees match these filters.')).toBeInTheDocument()
  })

  it('drops an expired token and shows the login page', async () => {
    session.save('stale-token')
    vi.spyOn(api, 'me').mockRejectedValue(new Error('Please sign in'))

    render(<App />)

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(session.token()).toBeNull()
  })

  it('signs out', async () => {
    session.save('good-token')
    vi.spyOn(api, 'me').mockResolvedValue({ email: 'hr@acme.com' })
    mockData()
    render(<App />)
    await screen.findByText('hr@acme.com')

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(session.token()).toBeNull()
  })

  it('remembers the dark mode choice', async () => {
    session.save('good-token')
    vi.spyOn(api, 'me').mockResolvedValue({ email: 'hr@acme.com' })
    mockData()
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Switch to dark mode' }))

    expect(localStorage.getItem('mode')).toBe('dark')
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument()
  })

  it('opens the insights tab from the URL hash', async () => {
    window.location.hash = '#insights'
    session.save('good-token')
    vi.spyOn(api, 'me').mockResolvedValue({ email: 'hr@acme.com' })
    mockData()
    vi.spyOn(api, 'summary').mockResolvedValue({ stats: null })
    vi.spyOn(api, 'breakdown').mockResolvedValue([])
    vi.spyOn(api, 'distribution').mockResolvedValue([])
    render(<App />)

    expect(await screen.findByText('No employees match this scope.')).toBeInTheDocument()
    await waitFor(() => expect(api.summary).toHaveBeenCalled())
  })
})
