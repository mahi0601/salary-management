import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { type ChangeEvent, useState } from 'react'
import { api } from '../api/client'
import type { ImportReport } from '../api/types'

interface Props {
  onClose: () => void
  onImported: (count: number) => void
}

export default function ImportDialog({ onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function check(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0]
    if (!chosen) return
    setFile(chosen)
    setReport(null)
    setError(null)
    setBusy(true)
    try {
      setReport(await api.importFile(chosen, true))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the file')
    } finally {
      setBusy(false)
    }
  }

  async function runImport() {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const result = await api.importFile(file, false)
      onImported(result.created)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
      setBusy(false)
    }
  }

  const ready = report !== null && report.error_count === 0 && report.total_rows > 0
  const importLabel = !ready ? 'Import' : busy ? 'Importing…' : `Import ${report.total_rows.toLocaleString()} employees`

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Import employees</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Upload an .xlsx or .csv file with the columns full_name, email, job_title, department, country (2-letter
            code), salary (annual, local currency) and hire_date. The file is checked first. If any row has a
            problem nothing is saved.
          </Typography>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
            <Button variant="outlined" component="label" disabled={busy}>
              Choose file
              <input type="file" hidden accept=".xlsx,.csv" onChange={check} aria-label="Choose file" />
            </Button>
            <Typography variant="body2">{file ? file.name : 'No file chosen'}</Typography>
            <Button onClick={() => api.downloadImportTemplate().catch((e: Error) => setError(e.message))}>
              Download template
            </Button>
          </Stack>

          {error && <Alert severity="error">{error}</Alert>}

          {report && report.error_count === 0 && report.total_rows > 0 && (
            <Alert severity="success">All {report.total_rows.toLocaleString()} rows look good and are ready to import.</Alert>
          )}
          {report && report.total_rows === 0 && <Alert severity="warning">The file has no data rows.</Alert>}
          {report && report.error_count > 0 && (
            <>
              <Alert severity="error">
                {report.valid_rows.toLocaleString()} of {report.total_rows.toLocaleString()} rows are fine,{' '}
                {report.error_count.toLocaleString()} problem{report.error_count === 1 ? '' : 's'} to fix. Nothing has
                been saved.
              </Alert>
              <Table size="small" aria-label="Problems found">
                <TableHead>
                  <TableRow>
                    <TableCell>Row</TableCell>
                    <TableCell>Column</TableCell>
                    <TableCell>Problem</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.errors.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell>{e.row}</TableCell>
                      <TableCell>{e.field}</TableCell>
                      <TableCell>{e.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {report.error_count > report.errors.length && (
                <Typography variant="caption" color="text.secondary">
                  Showing the first {report.errors.length} of {report.error_count.toLocaleString()}.
                </Typography>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!ready || busy} onClick={runImport}>
          {importLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
