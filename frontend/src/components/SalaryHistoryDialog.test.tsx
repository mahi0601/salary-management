import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '../api/client'
import type { Employee, SalaryChange } from '../api/types'
import SalaryHistoryDialog from './SalaryHistoryDialog'

const employee: Employee = {
  id: 7,
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

const start: SalaryChange = {
  id: 1, effective_date: '2022-03-14', salary: 2000000, currency: 'INR', salary_usd: 24000,
  change_pct: null, reason: 'Starting salary', changed_by: 'hr@acme.com',
}
const raise: SalaryChange = {
  id: 2, effective_date: '2024-04-01', salary: 2400000, currency: 'INR', salary_usd: 28800,
  change_pct: 20, reason: 'Promotion', changed_by: 'hr@acme.com',
}

afterEach(() => vi.restoreAllMocks())

describe('SalaryHistoryDialog', () => {
  it('lists changes newest first with the percentage change', async () => {
    vi.spyOn(api, 'salaryHistory').mockResolvedValue([start, raise])

    render(<SalaryHistoryDialog employee={employee} onClose={() => {}} onChanged={() => {}} />)

    const rows = await screen.findAllByRole('row')
    expect(within(rows[1]).getByText('2024-04-01')).toBeInTheDocument()
    expect(within(rows[1]).getByText('+20%')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Starting salary')).toBeInTheDocument()
  })

  it('shows a load error', async () => {
    vi.spyOn(api, 'salaryHistory').mockRejectedValue(new Error('Employee 7 not found'))

    render(<SalaryHistoryDialog employee={employee} onClose={() => {}} onChanged={() => {}} />)

    expect(await screen.findByText('Employee 7 not found')).toBeInTheDocument()
  })

  it('does not call the API when the form is invalid', async () => {
    vi.spyOn(api, 'salaryHistory').mockResolvedValue([start])
    const add = vi.spyOn(api, 'addSalaryChange')
    render(<SalaryHistoryDialog employee={employee} onClose={() => {}} onChanged={() => {}} />)
    await screen.findByText('Starting salary')

    await userEvent.click(screen.getByRole('button', { name: 'Record change' }))

    expect(await screen.findByText('Enter a whole number greater than 0')).toBeInTheDocument()
    expect(screen.getByText('Give a reason')).toBeInTheDocument()
    expect(add).not.toHaveBeenCalled()
  })

  it('records a change, shows the new history and tells the page to reload', async () => {
    vi.spyOn(api, 'salaryHistory').mockResolvedValue([start])
    const add = vi.spyOn(api, 'addSalaryChange').mockResolvedValue([start, raise])
    const onChanged = vi.fn()
    render(<SalaryHistoryDialog employee={employee} onClose={() => {}} onChanged={onChanged} />)
    await screen.findByText('Starting salary')

    await userEvent.type(screen.getByLabelText(/New annual salary/), '2400000')
    await userEvent.type(screen.getByLabelText('Reason'), 'Promotion')
    await userEvent.click(screen.getByRole('button', { name: 'Record change' }))

    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(add).toHaveBeenCalledWith(7, expect.objectContaining({ salary: 2400000, reason: 'Promotion' }))
    expect(await screen.findByText('+20%')).toBeInTheDocument()
  })

  it('shows the server message when the change is refused', async () => {
    vi.spyOn(api, 'salaryHistory').mockResolvedValue([start])
    vi.spyOn(api, 'addSalaryChange').mockRejectedValue(new Error('That is already the salary on that date'))
    render(<SalaryHistoryDialog employee={employee} onClose={() => {}} onChanged={() => {}} />)
    await screen.findByText('Starting salary')

    await userEvent.type(screen.getByLabelText(/New annual salary/), '2000000')
    await userEvent.type(screen.getByLabelText('Reason'), 'Oops')
    await userEvent.click(screen.getByRole('button', { name: 'Record change' }))

    expect(await screen.findByText('That is already the salary on that date')).toBeInTheDocument()
  })
})
