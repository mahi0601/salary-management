import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError, api } from '../api/client'
import type { Employee, Meta } from '../api/types'
import EmployeeFormDialog from './EmployeeFormDialog'

const meta: Meta = {
  countries: [
    { code: 'US', name: 'United States', currency: 'USD', usd_rate: 1 },
    { code: 'DE', name: 'Germany', currency: 'EUR', usd_rate: 1.08 },
  ],
  departments: ['Engineering'],
  job_titles: ['Software Engineer'],
}

const asha: Employee = {
  id: 7,
  full_name: 'Asha Rao',
  email: 'asha@acme.com',
  job_title: 'Software Engineer',
  department: 'Engineering',
  country: 'US',
  salary: 100000,
  currency: 'USD',
  salary_usd: 100000,
  hire_date: '2022-03-14',
}

// no artificial pause between keystrokes: the form test types a lot and must not depend on machine speed
const user = userEvent.setup({ delay: null })

afterEach(() => vi.restoreAllMocks())

async function fillNewEmployee() {
  await user.type(screen.getByLabelText(/Full name/), '  Max Mueller ')
  await user.type(screen.getByLabelText(/Email/), 'max@acme.com')
  await user.type(screen.getByLabelText(/Department/), 'Engineering')
  await user.type(screen.getByLabelText(/Job title/), 'Software Engineer')
  await user.click(screen.getByRole('combobox', { name: /Country/ }))
  await user.click(screen.getByRole('option', { name: /Germany/ }))
  await user.type(screen.getByLabelText(/Annual base salary/), '90000')
  await user.type(screen.getByLabelText(/Hire date/), '2023-05-01')
}

describe('EmployeeFormDialog', () => {
  it('creates an employee with trimmed values and tells the page', async () => {
    const create = vi.spyOn(api, 'createEmployee').mockResolvedValue({ ...asha, id: 8 })
    const onSaved = vi.fn()
    render(<EmployeeFormDialog meta={meta} employee={null} onClose={() => {}} onSaved={onSaved} />)

    await fillNewEmployee()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(create).toHaveBeenCalledWith({
      full_name: 'Max Mueller',
      email: 'max@acme.com',
      job_title: 'Software Engineer',
      department: 'Engineering',
      country: 'DE',
      salary: 90000,
      hire_date: '2023-05-01',
    })
  })

  it('shows the currency of the chosen country next to the salary', async () => {
    render(<EmployeeFormDialog meta={meta} employee={null} onClose={() => {}} onSaved={() => {}} />)

    await user.click(screen.getByRole('combobox', { name: /Country/ }))
    await user.click(screen.getByRole('option', { name: /Germany/ }))

    expect(screen.getByText('EUR')).toBeInTheDocument()
  })

  it('edits an existing employee: fields are prefilled and the update uses their id', async () => {
    const update = vi.spyOn(api, 'updateEmployee').mockResolvedValue(asha)
    const onSaved = vi.fn()
    render(<EmployeeFormDialog meta={meta} employee={asha} onClose={() => {}} onSaved={onSaved} />)
    expect(screen.getByLabelText(/Full name/)).toHaveValue('Asha Rao')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(update).toHaveBeenCalledWith(7, expect.objectContaining({ email: 'asha@acme.com', salary: 100000 }))
  })

  it('puts a duplicate-email refusal on the email field', async () => {
    vi.spyOn(api, 'updateEmployee').mockRejectedValue(
      new ApiError(409, 'An employee with email asha@acme.com already exists'),
    )
    render(<EmployeeFormDialog meta={meta} employee={asha} onClose={() => {}} onSaved={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('An employee with email asha@acme.com already exists')).toBeInTheDocument()
  })

  it('shows any other server error at the top', async () => {
    vi.spyOn(api, 'updateEmployee').mockRejectedValue(new ApiError(500, 'Something went wrong'))
    render(<EmployeeFormDialog meta={meta} employee={asha} onClose={() => {}} onSaved={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
  })
})
