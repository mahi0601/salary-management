import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '../api/client'
import type { Employee, Meta } from '../api/types'
import EmployeesPage from './EmployeesPage'

const meta: Meta = {
  countries: [
    { code: 'US', name: 'United States', currency: 'USD', usd_rate: 1 },
    { code: 'IN', name: 'India', currency: 'INR', usd_rate: 0.012 },
  ],
  departments: ['Engineering'],
  job_titles: ['Software Engineer'],
}

const asha: Employee = {
  id: 1,
  full_name: 'Asha Rao',
  email: 'asha@acme.com',
  job_title: 'Software Engineer',
  department: 'Engineering',
  country: 'IN',
  salary: 2400000,
  currency: 'INR',
  salary_usd: 28800,
  hire_date: '2022-03-14',
}

function mockList(items: Employee[]) {
  return vi
    .spyOn(api, 'listEmployees')
    .mockResolvedValue({ items, total: items.length, page: 1, page_size: 25 })
}

afterEach(() => vi.restoreAllMocks())

describe('EmployeesPage', () => {
  it('shows salary in local currency with its USD equivalent', async () => {
    mockList([asha])

    render(<EmployeesPage meta={meta} onDataChanged={() => {}} />)

    const row = (await screen.findByText('Asha Rao')).closest('tr')!
    expect(within(row).getByText(/2,400,000/)).toBeInTheDocument()
    expect(within(row).getByText(/≈ \$28,800/)).toBeInTheDocument()
  })

  it('shows an empty state when nothing matches', async () => {
    mockList([])

    render(<EmployeesPage meta={meta} onDataChanged={() => {}} />)

    expect(await screen.findByText('No employees match these filters.')).toBeInTheDocument()
  })

  it('shows the API error instead of failing silently', async () => {
    vi.spyOn(api, 'listEmployees').mockRejectedValue(new Error('Server exploded'))

    render(<EmployeesPage meta={meta} onDataChanged={() => {}} />)

    expect(await screen.findByText('Server exploded')).toBeInTheDocument()
  })

  it('re-queries sorted by salary descending on second header click', async () => {
    const list = mockList([asha])
    render(<EmployeesPage meta={meta} onDataChanged={() => {}} />)
    await screen.findByText('Asha Rao')

    await userEvent.click(screen.getByText('Annual salary'))
    await userEvent.click(screen.getByText('Annual salary'))

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: 'salary_usd', order: 'desc' })),
    )
  })

  it('asks for confirmation before deleting, then deletes and notifies the parent', async () => {
    mockList([asha])
    const remove = vi.spyOn(api, 'deleteEmployee').mockResolvedValue(undefined)
    const onDataChanged = vi.fn()
    render(<EmployeesPage meta={meta} onDataChanged={onDataChanged} />)

    await userEvent.click(await screen.findByLabelText('Delete Asha Rao'))
    expect(remove).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(remove).toHaveBeenCalledWith(1))
    expect(onDataChanged).toHaveBeenCalled()
  })

  it('blocks submit and shows errors when the form is invalid', async () => {
    mockList([])
    const create = vi.spyOn(api, 'createEmployee')
    render(<EmployeesPage meta={meta} onDataChanged={() => {}} />)

    await userEvent.click(await screen.findByRole('button', { name: /add employee/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })
})
