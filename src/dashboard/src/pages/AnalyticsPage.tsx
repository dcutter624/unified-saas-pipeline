import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Container,
  FormControl,
  Grid2 as Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import { BarChart } from '@mui/x-charts/BarChart'
import { LineChart } from '@mui/x-charts/LineChart'
import { PieChart } from '@mui/x-charts/PieChart'
import RefreshIcon from '@mui/icons-material/Refresh'
import type { AnalyticsPeriod } from '../api/analyticsApi'
import { AnalyticsKpiCards } from '../components/analytics/AnalyticsKpiCards'
import { useAnalyticsSummary } from '../hooks/useAnalyticsSummary'
import { useAuth } from '../auth/AuthContext'

const PERIOD_OPTIONS: Array<{ value: AnalyticsPeriod; label: string }> = [
  { value: '30d', label: 'Last 30 days' },
  { value: '6m', label: 'Last 6 months' },
  { value: '12m', label: 'Last 12 months' },
]

export default function AnalyticsPage() {
  const { tenantSettings } = useAuth()
  const [period, setPeriod] = useState<AnalyticsPeriod>('6m')
  const { data, loading, error, refresh, setError } = useAnalyticsSummary(period)

  const showSkeleton = loading && !data
  const hasSeriesSignal = Boolean(
    data?.series.some((point) => point.mrr > 0 || point.newCustomers > 0 || point.cumulativeCustomers > 0),
  )
  const statusPie = useMemo(
    () =>
      (data?.statusDistribution ?? [])
        .filter((item) => item.count > 0)
        .map((item, index) => ({
          id: index,
          label: item.status,
          value: item.count,
        })),
    [data?.statusDistribution],
  )

  const xLabels = data?.series.map((point) => point.label) ?? []
  const mrrValues = data?.series.map((point) => point.mrr) ?? []
  const customerValues = data?.series.map((point) => point.newCustomers) ?? []

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Analytics
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {tenantSettings?.tenantName
              ? `${tenantSettings.tenantName} — MRR, growth, and subscription health`
              : 'Tenant-scoped MRR, growth, and subscription health'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="analytics-period-label">Period</InputLabel>
            <Select
              labelId="analytics-period-label"
              label="Period"
              value={period}
              onChange={(event) => setPeriod(event.target.value as AnalyticsPeriod)}
            >
              {PERIOD_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button startIcon={<RefreshIcon />} onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      <AnalyticsKpiCards loading={showSkeleton} kpis={data?.kpis ?? null} />

      {error && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          onClose={() => setError(null)}
          action={
            error.toLowerCase().includes('tier') || error.toLowerCase().includes('pro') ? (
              <Button color="inherit" size="small" component={RouterLink} to="/billing">
                Upgrade
              </Button>
            ) : undefined
          }
        >
          {error}
        </Alert>
      )}

      {showSkeleton ? (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Skeleton variant="rounded" height={360} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Skeleton variant="rounded" height={360} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Skeleton variant="rounded" height={320} />
          </Grid>
        </Grid>
      ) : (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper sx={{ p: 2, height: 360 }}>
              <Typography variant="h6" gutterBottom>
                MRR over time
              </Typography>
              {!hasSeriesSignal ? (
                <EmptyChart message="No MRR history yet for this period. Add customers to start the trend." />
              ) : (
                <LineChart
                  xAxis={[{ data: xLabels, scaleType: 'point' }]}
                  series={[
                    {
                      data: mrrValues,
                      label: 'MRR ($)',
                      area: true,
                      showMark: period !== '30d',
                    },
                  ]}
                  height={290}
                />
              )}
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 2, height: 360 }}>
              <Typography variant="h6" gutterBottom>
                Subscription status
              </Typography>
              {statusPie.length === 0 ? (
                <EmptyChart message="No subscriptions to chart yet." />
              ) : (
                <PieChart
                  series={[
                    {
                      data: statusPie,
                      innerRadius: 45,
                      outerRadius: 95,
                      paddingAngle: 2,
                      cornerRadius: 4,
                    },
                  ]}
                  height={290}
                />
              )}
            </Paper>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 2, height: 340 }}>
              <Typography variant="h6" gutterBottom>
                New customer sign-ups
              </Typography>
              {!hasSeriesSignal ? (
                <EmptyChart message="No customer sign-ups in this period yet." />
              ) : (
                <BarChart
                  xAxis={[{ data: xLabels, scaleType: 'band' }]}
                  series={[{ data: customerValues, label: 'New customers' }]}
                  height={270}
                />
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Container>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <Box
      sx={{
        height: 280,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
      }}
    >
      <Typography color="text.secondary" textAlign="center">
        {message}
      </Typography>
    </Box>
  )
}
