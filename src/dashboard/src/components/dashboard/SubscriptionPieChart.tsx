import { Box, Paper, Typography } from '@mui/material'
import { PieChart } from '@mui/x-charts/PieChart'

interface PieSlice {
  id: number
  label: string
  value: number
}

interface SubscriptionPieChartProps {
  title: string
  data: PieSlice[]
  emptyMessage?: string
}

export function SubscriptionPieChart({
  title,
  data,
  emptyMessage = 'No subscription data yet.',
}: SubscriptionPieChartProps) {
  return (
    <Paper sx={{ height: 420, width: '100%', p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {data.length === 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320 }}>
          <Typography color="text.secondary" textAlign="center">
            {emptyMessage}
          </Typography>
        </Box>
      ) : (
        <PieChart
          series={[
            {
              data,
              innerRadius: 40,
              outerRadius: 100,
              paddingAngle: 2,
              cornerRadius: 4,
            },
          ]}
          height={320}
        />
      )}
    </Paper>
  )
}
