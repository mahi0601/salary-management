import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import DownloadIcon from '@mui/icons-material/Download'
import EditIcon from '@mui/icons-material/Edit'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
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

  // Typing in the search box shouldn't fire a request per keystroke.
  const debouncedFilters = { ...filters, search: useDebounced(filters.search) }
  const filterKey = JSON.stringify(debouncedFilters)

  const load = useCallback(() => {
    api
      .listEmployees({ filters: JSON.parse(filterKey), sortBy, order, page: page + 1, pageSize })
      .then((result) => {
        setData(result)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
  }, [filterKey, sortBy, order, page, pageSize])

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

  const afterChange = () => {
    setEditing(null)
    setDeleting(null)
    load()
    onDataChanged()
  }

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
        <Box sx={{ flexGrow: 1 }} />
        <Button
          startIcon={<DownloadIcon />}
          href={api.exportUrl(JSON.parse(filterKey), sortBy, order)}
          download
        >
          Export CSV
        </Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
          Add employee
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Paper variant="outlined">
        <TableContainer>
          <Table size="small" aria-label="Employees">
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
                    <Typography variant="body2">{e.full_name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {e.email}
                    </Typography>
                  </TableCell>
                  <TableCell>{e.job_title}</TableCell>
                  <TableCell>{e.department}</TableCell>
                  <TableCell>{e.country}</TableCell>
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
          onSaved={afterChange}
        />
      )}

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
                .then(afterChange)
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
