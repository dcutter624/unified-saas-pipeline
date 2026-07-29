import { useState } from 'react'
import {
  Alert,
  Container,
  Grid2 as Grid,
  Skeleton,
  Snackbar,
  Typography,
} from '@mui/material'
import axios from 'axios'
import {
  createCustomerRequest,
  updateSubscriptionStatusRequest,
} from '../api/dashboardApi'
import { useAuth } from '../auth/AuthContext'
import { AddCustomerDialog } from '../components/dashboard/AddCustomerDialog'
import { CustomersDataGrid } from '../components/dashboard/CustomersDataGrid'
import { MetricCards } from '../components/dashboard/MetricCards'
import { SubscriptionPieChart } from '../components/dashboard/SubscriptionPieChart'
import { useDashboardData, type DashboardRow } from '../hooks/useDashboardData'

export default function DashboardPage() {
  const { currentUser, tenantSettings } = useAuth()
  const {
    dashboard,
    rows,
    summary,
    pieByStatus,
    pieByTier,
    loading,
    error,
    refresh,
    setError,
  } = useDashboardData()

  const showInitialSkeleton = loading && !dashboard

  const isAdmin = currentUser?.role === 'Admin'
  const [addOpen, setAddOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [snackMessage, setSnackMessage] = useState<string | null>(null)

  async function handleAddCustomer(payload: { name: string; email: string; tier: string }) {
    setSubmitting(true)
    try {
      await createCustomerRequest(payload)
      setAddOpen(false)
      setSnackMessage('Customer created.')
      refresh()
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ??
          'Failed to create customer.'
        : 'Failed to create customer.'
      setError(message)
      setSnackMessage(message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeactivate(row: DashboardRow) {
    if (!row.subscriptionId) {
      return
    }

    try {
      await updateSubscriptionStatusRequest(row.subscriptionId, 'Inactive')
      setSnackMessage(`${row.customerName} deactivated.`)
      refresh()
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ??
          'Failed to deactivate subscription.'
        : 'Failed to deactivate subscription.'
      setError(message)
      setSnackMessage(message)
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Overview
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {tenantSettings?.tenantName
          ? `${tenantSettings.tenantName} — customer and subscription metrics`
          : 'Customer and subscription metrics for the active tenant'}
      </Typography>

      <MetricCards
        loading={showInitialSkeleton}
        totalCustomers={summary.totalCustomers}
        activeSubscriptions={summary.activeSubscriptions}
        inactiveSubscriptions={summary.inactiveSubscriptions}
        estimatedMrr={summary.estimatedMrr}
      />

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {showInitialSkeleton ? (
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
            <CustomersDataGrid
              rows={rows}
              loading={loading}
              isAdmin={isAdmin}
              onRefresh={refresh}
              onAddCustomer={() => setAddOpen(true)}
              onDeactivate={handleDeactivate}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <SubscriptionPieChart
              title="Subscription Status"
              data={pieByStatus}
              emptyMessage="No subscriptions yet — add a customer to see the breakdown."
            />
          </Grid>
          {pieByTier.length > 0 && (
            <Grid size={{ xs: 12, md: 4 }}>
              <SubscriptionPieChart title="Plan Tiers" data={pieByTier} />
            </Grid>
          )}
        </Grid>
      )}

      <AddCustomerDialog
        open={addOpen}
        submitting={submitting}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddCustomer}
      />

      <Snackbar
        open={Boolean(snackMessage)}
        autoHideDuration={4000}
        onClose={() => setSnackMessage(null)}
        message={snackMessage ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  )
}
