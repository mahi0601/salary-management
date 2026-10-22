import GroupsIcon from '@mui/icons-material/Groups'
import PaidIcon from '@mui/icons-material/Paid'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import SortIcon from '@mui/icons-material/Sort'
import {
  Alert,
  Card,
  CardContent,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api/client'
import type { Band, Filters, GroupBy, GroupStats, Meta, SalaryStats } from '../api/types'
import { formatUsd, formatUsdCompact } from '../lib/format'

const GROUPINGS: { value: GroupBy; label: string }[] = [
  { value: 'country', label: 'Country' },
  { value: 'department', label: 'Department' },
  { value: 'job_title', label: 'Job title' },
]

export default function InsightsPage({ meta }: { meta: Meta }) {
  const theme = useTheme()
  const [scope, setScope] = useState<Filters>({})
  const [groupBy, setGroupBy] = useState<GroupBy>('country')
  const [stats, setStats] = useState<SalaryStats | null | undefined>(undefined)
  const [groups, setGroups] = useState<GroupStats[]>([])
  const [bands, setBands] = useState<Band[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.summary(scope), api.breakdown(groupBy, scope), api.distribution(scope, 25_000)])
      .then(([summary, breakdown, distribution]) => {
        if (cancelled) return
        setStats(summary.stats)
        setGroups(breakdown)
        setBands(distribution)
        setError(null)
      })
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [scope, groupBy])

  const scopeSelect = (key: 'country' | 'department', label: string, options: [string, string][]) => (
    <TextField
      select
      size="small"
      label={label}
      value={scope[key] ?? ''}
      onChange={(e) => setScope((s) => ({ ...s, [key]: e.target.value || undefined }))}
      sx={{ minWidth: 190 }}
    >
      <MenuItem value="">All</MenuItem>
      {options.map(([value, text]) => (
        <MenuItem key={value} value={value}>
          {text}
        </MenuItem>
      ))}
    </TextField>
  )

  const countryNames = Object.fromEntries(meta.countries.map((c) => [c.code, c.name]))
  const rows = groups.map((g) => ({ ...g, label: groupBy === 'country' ? (countryNames[g.key] ?? g.key) : g.key }))

  const kpis = stats
    ? [
        { label: 'Headcount', value: stats.headcount.toLocaleString(), icon: <GroupsIcon /> },
        { label: 'Total annual payroll', value: formatUsd(stats.total_usd), icon: <PaidIcon /> },
        { label: 'Average salary', value: formatUsd(stats.average_usd), icon: <ShowChartIcon /> },
        {
          label: 'Median salary',
          value: formatUsd(stats.median_usd),
          icon: <SortIcon />,
          hint: `Middle 50%: ${formatUsd(stats.p25_usd)} – ${formatUsd(stats.p75_usd)}`,
        },
      ]
    : []

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        {scopeSelect('country', 'Country', meta.countries.map((c) => [c.code, c.name]))}
        {scopeSelect('department', 'Department', meta.departments.map((d) => [d, d]))}
        <Typography variant="body2" color="text.secondary">
          All amounts are annual base salary converted to USD at fixed rates so countries are comparable.
        </Typography>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}
      {stats === null && <Alert severity="info">No employees match this scope.</Alert>}

      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {kpis.map((k) => (
          <Card key={k.label} variant="outlined" sx={{ flex: '1 1 200px', borderTop: 3, borderTopColor: 'primary.main' }}>
            <CardContent>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
                {k.icon}
                <Typography variant="body2">{k.label}</Typography>
              </Stack>
              <Typography variant="h5" component="p" sx={{ mt: 0.5 }}>
                {k.value}
              </Typography>
              {k.hint && (
                <Typography variant="caption" color="text.secondary">
                  {k.hint}
                </Typography>
              )}
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h2">
            Pay by {GROUPINGS.find((g) => g.value === groupBy)?.label.toLowerCase()}
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={groupBy}
            onChange={(_, v: GroupBy | null) => v && setGroupBy(v)}
            aria-label="Group by"
          >
            {GROUPINGS.map((g) => (
              <ToggleButton key={g.value} value={g.value}>
                {g.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>

        <div style={{ color: theme.palette.text.secondary }} role="img" aria-label={`Median salary in USD by ${groupBy}`}>
          <ResponsiveContainer width="100%" height={Math.max(220, groups.length * 30)}>
            <BarChart data={rows} layout="vertical" margin={{ left: 24, right: 24 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={formatUsdCompact} />
              <YAxis type="category" dataKey="label" width={150} interval={0} />
              <Tooltip formatter={(v) => formatUsd(Number(v))} />
              <Bar dataKey="median_usd" name="Median" fill={theme.palette.primary.main} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <Table size="small" sx={{ mt: 2 }} aria-label="Pay statistics">
          <TableHead>
            <TableRow>
              <TableCell>{GROUPINGS.find((g) => g.value === groupBy)?.label}</TableCell>
              {['Headcount', 'Min', '25th pct', 'Median', '75th pct', 'Max', 'Average'].map((h) => (
                <TableCell key={h} align="right">
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((g) => (
              <TableRow key={g.key}>
                <TableCell>{g.label}</TableCell>
                <TableCell align="right">{g.headcount.toLocaleString()}</TableCell>
                {[g.min_usd, g.p25_usd, g.median_usd, g.p75_usd, g.max_usd, g.average_usd].map((v, i) => (
                  <TableCell key={i} align="right">
                    {formatUsd(v)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
          Salary distribution (USD, $25K bands)
        </Typography>
        <div style={{ color: theme.palette.text.secondary }} role="img" aria-label="Number of employees per salary band">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={bands.map((b) => ({ ...b, label: `${formatUsdCompact(b.from_usd)}` }))}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip
                labelFormatter={(_, p) =>
                  p?.[0] ? `${formatUsd(p[0].payload.from_usd)} – ${formatUsd(p[0].payload.to_usd)}` : ''
                }
              />
              <Bar dataKey="count" name="Employees" fill={theme.palette.primary.main} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Paper>
    </Stack>
  )
}
