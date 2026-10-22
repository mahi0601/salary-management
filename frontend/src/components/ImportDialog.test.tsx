import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '../api/client'
import type { ImportReport } from '../api/types'
import ImportDialog from './ImportDialog'

const file = new File(['x'], 'people.xlsx')

const clean: ImportReport = { dry_run: true, total_rows: 120, valid_rows: 120, created: 0, error_count: 0, errors: [] }
const broken: ImportReport = {
  dry_run: true,
  total_rows: 120,
  valid_rows: 118,
  created: 0,
  error_count: 2,
  errors: [
    { row: 4, field: 'salary', message: 'Input should be greater than 0' },
    { row: 9, field: 'email', message: 'An employee with this email already exists' },
  ],
}

afterEach(() => vi.restoreAllMocks())

const choose = () => userEvent.upload(screen.getByLabelText('Choose file'), file)

describe('ImportDialog', () => {
  it('checks the file as soon as it is chosen and keeps Import disabled while it has problems', async () => {
    const importFile = vi.spyOn(api, 'importFile').mockResolvedValue(broken)
    render(<ImportDialog onClose={() => {}} onImported={() => {}} />)

    await choose()

    expect(await screen.findByText(/118 of 120 rows are fine/)).toBeInTheDocument()
    expect(screen.getByText('Input should be greater than 0')).toBeInTheDocument()
    expect(screen.getByText('An employee with this email already exists')).toBeInTheDocument()
    expect(importFile).toHaveBeenCalledWith(file, true)
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
  })

  it('imports for real once the check is clean, then tells the page how many were created', async () => {
    const importFile = vi
      .spyOn(api, 'importFile')
      .mockResolvedValueOnce(clean)
      .mockResolvedValueOnce({ ...clean, dry_run: false, created: 120 })
    const onImported = vi.fn()
    render(<ImportDialog onClose={() => {}} onImported={onImported} />)
    await choose()

    await userEvent.click(await screen.findByRole('button', { name: 'Import 120 employees' }))

    await waitFor(() => expect(onImported).toHaveBeenCalledWith(120))
    expect(importFile).toHaveBeenLastCalledWith(file, false)
  })

  it('shows the server message for an unreadable file', async () => {
    vi.spyOn(api, 'importFile').mockRejectedValue(new Error('Missing columns: salary'))
    render(<ImportDialog onClose={() => {}} onImported={() => {}} />)

    await choose()

    expect(await screen.findByText('Missing columns: salary')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
  })

  it('says so when the file has no data rows', async () => {
    vi.spyOn(api, 'importFile').mockResolvedValue({ ...clean, total_rows: 0, valid_rows: 0 })
    render(<ImportDialog onClose={() => {}} onImported={() => {}} />)

    await choose()

    expect(await screen.findByText('The file has no data rows.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
  })

  it('mentions how many problems are hidden when the list is capped', async () => {
    vi.spyOn(api, 'importFile').mockResolvedValue({ ...broken, error_count: 250 })
    render(<ImportDialog onClose={() => {}} onImported={() => {}} />)

    await choose()

    expect(await screen.findByText('Showing the first 2 of 250.')).toBeInTheDocument()
  })

  it('offers the template', async () => {
    const download = vi.spyOn(api, 'downloadImportTemplate').mockResolvedValue(undefined)
    render(<ImportDialog onClose={() => {}} onImported={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: 'Download template' }))

    expect(download).toHaveBeenCalled()
  })
})
