import { Paper, Skeleton, Stack, Typography } from '@mui/material'

interface MetricCardsProps {
  loading: boolean
  totalCustomers: number
  activeSubscriptions: number
  inactiveSubscriptions: number
  estimatedMrr: number
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Paper sx={{ p: 2, flex: 1, minWidth: 140 }}>
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5">{value}</Typography>
    </Paper>
  )
}

export function MetricCards({
  loading,
  totalCustomers,
  activeSubscriptions,
  inactiveSubscriptions,
  estimatedMrr,
}: MetricCardsProps) {
  if (loading) {
    return (
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <Skeleton variant="rounded" height={88} sx={{ flex: 1 }} />
        <Skeleton variant="rounded" height={88} sx={{ flex: 1 }} />
        <Skeleton variant="rounded" height={88} sx={{ flex: 1 }} />
        <Skeleton variant="rounded" height={88} sx={{ flex: 1 }} />
      </Stack>
    )
  }

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
      <MetricCard label="Customers" value={totalCustomers} />
      <MetricCard label="Active Subs" value={activeSubscriptions} />
      <MetricCard label="Inactive / Other" value={inactiveSubscriptions} />
      <MetricCard
        label="Est. MRR"
        value={`$${estimatedMrr.toLocaleString()}`}
      />
    </Stack>
  )
}
