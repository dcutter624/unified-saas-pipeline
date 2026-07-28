import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Container,
  Grid2 as Grid,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { PieChart } from '@mui/x-charts/PieChart'
import axios from 'axios'
import { fetchMetrics, fetchTenants, type Tenant } from '../api/dashboardApi'

interface CustomerRow {
  id: string
  tenantName: string
  customerName: string
  email: string
  subscriptionStatus: string
  subscriptionTier: string
}

const columns: GridColDef<CustomerRow>[] = [
  { field: 'tenantName', headerName: 'Tenant', flex: 1, minWidth: 140 },
  { field: 'customerName', headerName: 'Customer', flex: 1, minWidth: 140 },
  { field: 'email', headerName: 'Email', flex: 1.2, minWidth: 180 },
  { field: 'subscriptionStatus', headerName: 'Status', width: 120 },
  { field: 'subscriptionTier', headerName: 'Tier', width: 120 },
]

export default function DashboardPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [metricTotals, setMetricTotals] = useState({
    totalCustomers: 0,
    totalSubscriptions: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [snackOpen, setSnackOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      setLoading(true)
      setError(null)

      try {
        const [tenantData, metrics] = await Promise.all([fetchTenants(), fetchMetrics()])
        if (cancelled) {
          return
        }

        setTenants(tenantData)
        setMetricTotals({
          totalCustomers: metrics.totalCustomers,
          totalSubscriptions: metrics.totalSubscriptions,
        })
      } catch (err) {
        if (cancelled) {
          return
        }

        // 401 is handled by the API interceptor (logout + redirect).
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          return
        }

        const message = axios.isAxiosError(err)
          ? err.response
            ? `Failed to load dashboard (${err.response.status}).`
            : 'Unable to reach the API.'
          : err instanceof Error
            ? err.message
            : 'Failed to load dashboard'

        setError(message)
        setSnackOpen(true)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadDashboard()

    return () => {
      cancelled = true
    }
  }, [])

  const metrics = useMemo(() => {
    const subscriptions = tenants.flatMap((tenant) => tenant.subscriptions ?? [])
    const statusCounts = subscriptions.reduce<Record<string, number>>((acc, sub) => {
      const key = sub.status || 'Unknown'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})

    return {
      totalTenants: tenants.length,
      totalCustomers: metricTotals.totalCustomers || tenants.flatMap((t) => t.customers ?? []).length,
      totalSubscriptions: metricTotals.totalSubscriptions || subscriptions.length,
      statusCounts,
    }
  }, [tenants, metricTotals])

  const customerRows = useMemo<CustomerRow[]>(() => {
    const subscriptionsByCustomer = new Map(
      tenants
        .flatMap((tenant) => tenant.subscriptions ?? [])
        .map((subscription) => [subscription.customerId, subscription]),
    )

    return tenants.flatMap((tenant) =>
      (tenant.customers ?? []).map((customer) => {
        const subscription = subscriptionsByCustomer.get(customer.id)
        return {
          id: customer.id,
          tenantName: tenant.name,
          customerName: customer.name,
          email: customer.email,
          subscriptionStatus: subscription?.status ?? 'None',
          subscriptionTier: subscription?.tier ?? '—',
        }
      }),
    )
  }, [tenants])

  const pieData = useMemo(
    () =>
      Object.entries(metrics.statusCounts).map(([label, value], index) => ({
        id: index,
        label,
        value,
      })),
    [metrics.statusCounts],
  )

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Overview
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Tenant and subscription overview
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        {loading ? (
          <>
            <Skeleton variant="rounded" height={88} sx={{ flex: 1 }} />
            <Skeleton variant="rounded" height={88} sx={{ flex: 1 }} />
            <Skeleton variant="rounded" height={88} sx={{ flex: 1 }} />
          </>
        ) : (
          <>
            <Paper sx={{ p: 2, flex: 1 }}>
              <Typography variant="overline" color="text.secondary">
                Total Tenants
              </Typography>
              <Typography variant="h5">{metrics.totalTenants}</Typography>
            </Paper>
            <Paper sx={{ p: 2, flex: 1 }}>
              <Typography variant="overline" color="text.secondary">
                Total Customers
              </Typography>
              <Typography variant="h5">{metrics.totalCustomers}</Typography>
            </Paper>
            <Paper sx={{ p: 2, flex: 1 }}>
              <Typography variant="overline" color="text.secondary">
                Subscriptions
              </Typography>
              <Typography variant="h5">{metrics.totalSubscriptions}</Typography>
            </Paper>
          </>
        )}
      </Stack>

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Skeleton variant="rounded" height={420} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Skeleton variant="rounded" height={420} />
          </Grid>
        </Grid>
      ) : (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper sx={{ height: 420, width: '100%', p: 1 }}>
              <DataGrid
                rows={customerRows}
                columns={columns}
                pageSizeOptions={[5, 10]}
                initialState={{
                  pagination: { paginationModel: { pageSize: 5, page: 0 } },
                }}
                disableRowSelectionOnClick
                loading={loading}
              />
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ height: 420, width: '100%', p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Subscription Status
              </Typography>
              {pieData.length === 0 ? (
                <Box sx={{ display: 'flex', alignItems: 'center', height: 320 }}>
                  <Typography color="text.secondary">No subscription data yet.</Typography>
                </Box>
              ) : (
                <PieChart
                  series={[
                    {
                      data: pieData,
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
          </Grid>
        </Grid>
      )}

      <Snackbar
        open={snackOpen}
        autoHideDuration={5000}
        onClose={() => setSnackOpen(false)}
        message={error ?? 'Something went wrong'}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  )
}
