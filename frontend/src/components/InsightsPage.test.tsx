import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '../api/client'
import type { GroupStats, Meta, SalaryStats } from '../api/types'
import InsightsPage from './InsightsPage'

const meta: Meta = {
  countries: [
    { code: 'US', name: 'United States', currency: 'USD', usd_rate: 1 },
    { code: 'IN', name: 'India', currency: 'INR', usd_rate: 0.012 },
  ],
  departments: ['Engineering', 'Sales'],
  job_titles: ['Software Engineer'],
}

const stats: SalaryStats = {
  headcount: 10000,
  total_usd: 939555515,
  average_usd: 93956,
  min_usd: 10956,
  p25_usd: 51957,
  median_usd: 84488,
  p75_usd: 128923,
  max_usd: 301700,
}

const group = (key: string, median: number): GroupStats => ({ ...stats, key, headcount: 100, median_usd: median })

function mockApi() {
  return {
    summary: vi.spyOn(api, 'summary').mockResolvedValue({ stats }),
    breakdown: vi.spyOn(api, 'breakdown').mockResolvedValue([group('US', 123550), group('IN', 37272)]),
    distribution: vi.spyOn(api, 'distribution').mockResolvedValue([{ from_usd: 0, to_usd: 25000, count: 5 }]),
  }
}

afterEach(() => vi.restoreAllMocks())

describe('InsightsPage', () => {
  it('shows the headline numbers, including the middle 50% range', async () => {
    mockApi()

    render(<InsightsPage meta={meta} />)

    expect(await screen.findByText('10,000')).toBeInTheDocument()
    expect(screen.getByText('$939,555,515')).toBeInTheDocument()
    expect(screen.getByText('$84,488')).toBeInTheDocument()
    expect(screen.getByText('Middle 50%: $51,957 – $128,923')).toBeInTheDocument()
  })

  it('lists each group with its percentiles, using country names', async () => {
    mockApi()

    render(<InsightsPage meta={meta} />)

    const table = await screen.findByRole('table', { name: 'Pay statistics' })
    expect(within(table).getByText('United States')).toBeInTheDocument()
    expect(within(table).getByText('$123,550')).toBeInTheDocument()
    expect(within(table).getByText('India')).toBeInTheDocument()
  })

  it('asks for the new grouping when the toggle changes', async () => {
    const { breakdown } = mockApi()
    render(<InsightsPage meta={meta} />)
    await screen.findByText('10,000')

    await userEvent.click(screen.getByRole('button', { name: 'Job title' }))

    await waitFor(() => expect(breakdown).toHaveBeenLastCalledWith('job_title', {}))
    expect(await screen.findByText('Pay by job title')).toBeInTheDocument()
  })

  it('re-queries everything for the chosen country', async () => {
    const { summary, breakdown, distribution } = mockApi()
    render(<InsightsPage meta={meta} />)
    await screen.findByText('10,000')

    await userEvent.click(screen.getByRole('combobox', { name: 'Country' }))
    await userEvent.click(screen.getByRole('option', { name: 'India' }))

    await waitFor(() => expect(summary).toHaveBeenLastCalledWith({ country: 'IN' }))
    expect(breakdown).toHaveBeenLastCalledWith('country', { country: 'IN' })
    expect(distribution).toHaveBeenLastCalledWith({ country: 'IN' }, 25000)
  })

  it('says so when nobody matches', async () => {
    mockApi().summary.mockResolvedValue({ stats: null })

    render(<InsightsPage meta={meta} />)

    expect(await screen.findByText('No employees match this scope.')).toBeInTheDocument()
  })

  it('shows the error when the API fails', async () => {
    mockApi().summary.mockRejectedValue(new Error('Server exploded'))

    render(<InsightsPage meta={meta} />)

    expect(await screen.findByText('Server exploded')).toBeInTheDocument()
  })
})
