import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  CircularProgress,
  Container,
  Grid2 as Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { PieChart } from '@mui/x-charts/PieChart'

const API_TENANTS_URL = 'http://localhost:5000/api/tenants'

interface Subscription {
  id: string
  tenantId: string
  customerId: string
  status: string
  tier: string
  startDate: string
  endDate: string | null
  createdAt: string
}

interface Customer {
  id: string
  tenantId: string
  email: string
  name: string
  createdAt: string
  subscriptions?: Subscription[]
}

interface Tenant {
  id: string
  name: string
  slug: string
  createdAt: string
  customers: Customer[]
  subscriptions: Subscription[]
}

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

export default function App() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadTenants() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(API_TENANTS_URL)
        if (!response.ok) {
          throw new Error(`Failed to fetch tenants (${response.status})`)
        }

        const data: Tenant[] = await response.json()
        if (cancelled) {
          return
        }

        setTenants(data)
        setCustomers(data.flatMap((tenant) => tenant.customers ?? []))
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load tenants')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadTenants()

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
      totalCustomers: customers.length,
      totalSubscriptions: subscriptions.length,
      statusCounts,
    }
  }, [tenants, customers])

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
        Unified SaaS Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Tenant and subscription overview
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
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
      </Stack>

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error}. Start the API and seed data to populate this view.
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
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
              />
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ height: 420, width: '100%', p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Subscription Status
              </Typography>
              {pieData.length === 0 ? (
                <Typography color="text.secondary">No subscription data yet.</Typography>
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
    </Container>
  )
}
