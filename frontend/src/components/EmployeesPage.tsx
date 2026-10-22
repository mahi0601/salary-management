import AddIcon from '@mui/icons-material/Add'
import ClearIcon from '@mui/icons-material/Clear'
import DeleteIcon from '@mui/icons-material/Delete'
import DownloadIcon from '@mui/icons-material/Download'
import EditIcon from '@mui/icons-material/Edit'
import HistoryIcon from '@mui/icons-material/History'
import UploadIcon from '@mui/icons-material/Upload'
import {
  Alert,
  Avatar,
  Box,
  Chip,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Employee, EmployeePage, Filters, Meta, SortField } from '../api/types'
import { formatMoney, formatUsd } from '../lib/format'
import { useDebounced } from '../lib/useDebounced'
import EmployeeFormDialog from './EmployeeFormDialog'
import ImportDialog from './ImportDialog'
import SalaryHistoryDialog from './SalaryHistoryDialog'

interface Props {
  meta: Meta
  onDataChanged: () => void
}

const COLUMNS: { field: SortField; label: string; align?: 'right' }[] = [
  { field: 'full_name', label: 'Employee' },
  { field: 'job_title', label: 'Job title' },
  { field: 'department', label: 'Department' },
  { field: 'country', label: 'Country' },
  { field: 'salary_usd', label: 'Annual salary', align: 'right' },
  { field: 'hire_date', label: 'Hired' },
]

const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

export default function EmployeesPage({ meta, onDataChanged }: Props) {
  const [filters, setFilters] = useState<Filters>({})
  const [sortBy, setSortBy] = useState<SortField>('full_name')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [data, setData] = useState<EmployeePage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Employee | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Employee | null>(null)
  const [historyOf, setHistoryOf] = useState<Employee | null>(null)
  const [importing, setImporting] = useState(false)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // debounce the search box so we don't hit the API on every keystroke
  const debouncedFilters = { ...filters, search: useDebounced(filters.search) }
  const filterKey = JSON.stringify(debouncedFilters)

  const queryKey = JSON.stringify([filterKey, sortBy, order, page, pageSize])
  const loading = loadedKey !== queryKey

  const load = useCallback(() => {
    api
      .listEmployees({ filters: JSON.parse(filterKey), sortBy, order, page: page + 1, pageSize })
      .then((result) => {
        setData(result)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadedKey(queryKey))
  }, [filterKey, sortBy, order, page, pageSize, queryKey])

  useEffect(load, [load])

  const setFilter = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value || undefined }))
    setPage(0)
  }

  const sortOn = (field: SortField) => {
    setOrder(sortBy === field && order === 'asc' ? 'desc' : 'asc')
    setSortBy(field)
    setPage(0)
  }

  const afterChange = (message: string) => {
    setEditing(null)
    setDeleting(null)
    setNotice(message)
    load()
    onDataChanged()
  }

  const countryNames = Object.fromEntries(meta.countries.map((c) => [c.code, c.name]))
  const hasFilters = Object.values(filters).some(Boolean)
  const from = data && data.total > 0 ? page * pageSize + 1 : 0
  const to = data ? Math.min((page + 1) * pageSize, data.total) : 0

  const select = (key: 'country' | 'department' | 'job_title', label: string, options: [string, string][]) => (
    <TextField
      select
      size="small"
      label={label}
      value={filters[key] ?? ''}
      onChange={(e) => setFilter(key, e.target.value)}
      sx={{ minWidth: 170 }}
    >
      <MenuItem value="">All</MenuItem>
      {options.map(([value, text]) => (
        <MenuItem key={value} value={value}>
          {text}
        </MenuItem>
      ))}
    </TextField>
  )

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          label="Search name or email"
          value={filters.search ?? ''}
          onChange={(e) => setFilter('search', e.target.value)}
          sx={{ minWidth: 240 }}
        />
        {select('country', 'Country', meta.countries.map((c) => [c.code, c.name]))}
        {select('department', 'Department', meta.departments.map((d) => [d, d]))}
        {select('job_title', 'Job title', meta.job_titles.map((t) => [t, t]))}
        <TextField
          size="small"
          label="Min salary (USD)"
          type="number"
          value={filters.min_salary_usd ?? ''}
          onChange={(e) => setFilter('min_salary_usd', e.target.value)}
          sx={{ width: 150 }}
        />
        <TextField
          size="small"
          label="Max salary (USD)"
          type="number"
          value={filters.max_salary_usd ?? ''}
          onChange={(e) => setFilter('max_salary_usd', e.target.value)}
          sx={{ width: 150 }}
        />
        {hasFilters && (
          <Button startIcon={<ClearIcon />} onClick={() => { setFilters({}); setPage(0) }}>
            Clear filters
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button startIcon={<UploadIcon />} onClick={() => setImporting(true)}>
          Import
        </Button>
        <Button
          startIcon={<DownloadIcon />}
          onClick={() =>
            api.downloadCsv(JSON.parse(filterKey), sortBy, order).catch((e: Error) => setError(e.message))
          }
        >
          Export CSV
        </Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
          Add employee
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Typography variant="body2" color="text.secondary" aria-live="polite">
        {data ? `Showing ${from.toLocaleString()}–${to.toLocaleString()} of ${data.total.toLocaleString()} employees` : ' '}
      </Typography>

      <Paper variant="outlined">
        {loading && <LinearProgress />}
        <TableContainer sx={{ maxHeight: '65vh' }}>
          <Table stickyHeader size="small" aria-label="Employees">
            <TableHead>
              <TableRow>
                {COLUMNS.map((c) => (
                  <TableCell key={c.field} align={c.align} sortDirection={sortBy === c.field ? order : false}>
                    <Tooltip title={c.field === 'salary_usd' ? 'Sorted by USD equivalent' : ''}>
                      <TableSortLabel
                        active={sortBy === c.field}
                        direction={sortBy === c.field ? order : 'asc'}
                        onClick={() => sortOn(c.field)}
                      >
                        {c.label}
                      </TableSortLabel>
                    </Tooltip>
                  </TableCell>
                ))}
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items.map((e) => (
                <TableRow key={e.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      <Avatar sx={{ width: 32, height: 32, fontSize: 13 }}>{initials(e.full_name)}</Avatar>
                      <Box>
                        <Typography variant="body2">{e.full_name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {e.email}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>{e.job_title}</TableCell>
                  <TableCell>{e.department}</TableCell>
                  <TableCell>
                    <Tooltip title={countryNames[e.country] ?? e.country}>
                      <Chip size="small" label={e.country} variant="outlined" />
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{formatMoney(e.salary, e.currency)}</Typography>
                    {e.currency !== 'USD' && (
                      <Typography variant="caption" color="text.secondary">
                        ≈ {formatUsd(e.salary_usd)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{e.hire_date}</TableCell>
                  <TableCell align="right">
                    <IconButton aria-label={`Salary history of ${e.full_name}`} onClick={() => setHistoryOf(e)}>
                      <HistoryIcon fontSize="small" />
                    </IconButton>
                    <IconButton aria-label={`Edit ${e.full_name}`} onClick={() => setEditing(e)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton aria-label={`Delete ${e.full_name}`} onClick={() => setDeleting(e)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {data && data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length + 1} align="center" sx={{ py: 6 }}>
                    No employees match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={data?.total ?? 0}
          page={page}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[25, 50, 100]}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => {
            setPageSize(Number(e.target.value))
            setPage(0)
          }}
        />
      </Paper>

      {editing && (
        <EmployeeFormDialog
          meta={meta}
          employee={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => afterChange(editing === 'new' ? 'Employee added' : 'Changes saved')}
        />
      )}

      {importing && (
        <ImportDialog
          onClose={() => setImporting(false)}
          onImported={(count) => {
            setImporting(false)
            afterChange(`Imported ${count.toLocaleString()} employees`)
          }}
        />
      )}

      {historyOf && (
        <SalaryHistoryDialog employee={historyOf} onClose={() => setHistoryOf(null)} onChanged={load} />
      )}

      <Snackbar
        open={!!notice}
        autoHideDuration={3000}
        onClose={() => setNotice(null)}
        message={notice}
      />

      <Dialog open={!!deleting} onClose={() => setDeleting(null)}>
        <DialogTitle>Delete employee?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This permanently removes {deleting?.full_name} and their salary record.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)}>Cancel</Button>
          <Button
            color="error"
            onClick={() =>
              deleting &&
              api
                .deleteEmployee(deleting.id)
                .then(() => afterChange('Employee deleted'))
                .catch((e: Error) => {
                  setError(e.message)
                  setDeleting(null)
                })
            }
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
