import {
  Box,
  Chip,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import type { AnalyticsKpis } from '../../api/analyticsApi'

interface AnalyticsKpiCardsProps {
  loading: boolean
  kpis: AnalyticsKpis | null
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function TrendChip({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) {
    return (
      <Chip
        size="small"
        icon={<TrendingFlatIcon />}
        label="No prior period"
        variant="outlined"
      />
    )
  }

  const positive = value > 0
  const flat = value === 0
  return (
    <Chip
      size="small"
      icon={flat ? <TrendingFlatIcon /> : positive ? <TrendingUpIcon /> : <TrendingDownIcon />}
      label={`${positive ? '+' : ''}${value}%`}
      color={flat ? 'default' : positive ? 'success' : 'error'}
      variant="outlined"
    />
  )
}

function KpiCard({
  label,
  value,
  trend,
}: {
  label: string
  value: string
  trend?: number | null
}) {
  return (
    <Paper sx={{ p: 2, flex: 1, minWidth: 160 }}>
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" sx={{ mb: 1 }}>
        {value}
      </Typography>
      {trend !== undefined && <TrendChip value={trend} />}
    </Paper>
  )
}

export function AnalyticsKpiCards({ loading, kpis }: AnalyticsKpiCardsProps) {
  if (loading || !kpis) {
    return (
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <Skeleton variant="rounded" height={110} sx={{ flex: 1 }} />
        <Skeleton variant="rounded" height={110} sx={{ flex: 1 }} />
        <Skeleton variant="rounded" height={110} sx={{ flex: 1 }} />
        <Skeleton variant="rounded" height={110} sx={{ flex: 1 }} />
      </Stack>
    )
  }

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }} useFlexGap flexWrap="wrap">
      <KpiCard label="Total MRR" value={formatCurrency(kpis.totalMrr)} trend={kpis.mrrTrendPercent} />
      <KpiCard label="ARPU" value={formatCurrency(kpis.arpu)} />
      <KpiCard
        label="Active Customers"
        value={String(kpis.activeCustomers)}
        trend={kpis.customerTrendPercent}
      />
      <Box sx={{ flex: 1, minWidth: 160 }}>
        <Paper sx={{ p: 2, height: '100%' }}>
          <Typography variant="overline" color="text.secondary">
            Churn / Inactive
          </Typography>
          <Typography variant="h5" sx={{ mb: 1 }}>
            {kpis.churnRate.toFixed(1)}%
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {kpis.activeSubscriptions} active · {kpis.totalSubscriptions} total subs
          </Typography>
        </Paper>
      </Box>
    </Stack>
  )
}
