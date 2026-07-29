import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Container,
  Grid2 as Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import {
  createCheckoutSession,
  postBillingWebhook,
} from '../api/billingApi'
import { getApiErrorMessage } from '../auth/AuthContext'
import { useBillingSubscription } from '../hooks/useBillingSubscription'
import { useAlert } from '../notifications/AlertProvider'
import { useSearchParams } from 'react-router-dom'

function formatMoney(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function statusColor(status: string): 'success' | 'warning' | 'default' | 'error' {
  const normalized = status.toLowerCase()
  if (normalized === 'active') return 'success'
  if (normalized === 'pastdue') return 'warning'
  if (normalized === 'canceled') return 'default'
  return 'default'
}

export default function BillingPage() {
  const { notifySuccess, notifyError, notifyInfo } = useAlert()
  const [searchParams, setSearchParams] = useSearchParams()
  const { subscription, setSubscription, loading, error, refresh, setError } =
    useBillingSubscription(true)
  const [busyTier, setBusyTier] = useState<string | null>(null)

  const currentTier = subscription?.subscriptionTier ?? 'Starter'

  const featureMatrix = useMemo(
    () =>
      subscription
        ? Object.entries(subscription.features).map(([key, enabled]) => ({
            key,
            enabled,
          }))
        : [],
    [subscription],
  )

  useEffect(() => {
    const checkout = searchParams.get('checkout')
    const tier = searchParams.get('tier')
    const customer = searchParams.get('customer')
    const sessionId = searchParams.get('session_id')

    if (checkout !== 'mock' || !tier) {
      return
    }

    const selectedTier = tier
    const selectedCustomer = customer
    const selectedSessionId = sessionId

    let cancelled = false

    async function completeMockCheckout() {
      setBusyTier(selectedTier)
      try {
        const updated = await postBillingWebhook({
          type: 'invoice.payment_succeeded',
          data: {
            object: {
              id: selectedSessionId ?? `cs_mock_${Date.now()}`,
              customer: selectedCustomer,
              subscription: `sub_mock_${selectedTier.toLowerCase()}`,
              status: 'paid',
              currentPeriodEnd: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
              metadata: {
                tier: selectedTier,
              },
            },
          },
        })
        if (!cancelled) {
          setSubscription(updated)
          notifySuccess(`Plan updated to ${updated.subscriptionTier}.`)
          setSearchParams({}, { replace: true })
        }
      } catch (err) {
        if (!cancelled) {
          notifyError(getApiErrorMessage(err, 'Failed to complete checkout'))
        }
      } finally {
        if (!cancelled) {
          setBusyTier(null)
        }
      }
    }

    void completeMockCheckout()

    return () => {
      cancelled = true
    }
  }, [notifyError, notifySuccess, searchParams, setSearchParams, setSubscription])

  async function handleSelectPlan(tier: string) {
    if (!subscription || tier === subscription.subscriptionTier) {
      return
    }

    setBusyTier(tier)
    try {
      const session = await createCheckoutSession({
        tier,
        successUrl: `${window.location.origin}/billing`,
        cancelUrl: `${window.location.origin}/billing`,
      })
      notifyInfo(session.message)
      // Mock mode: navigate to returned checkout URL which loops back with query params.
      window.location.assign(session.checkoutUrl)
    } catch (err) {
      notifyError(getApiErrorMessage(err, 'Failed to start checkout'))
      setBusyTier(null)
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1">
          Billing & Plans
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your workspace subscription tier and commercial entitlements
        </Typography>
      </Stack>

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading && !subscription ? (
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={96} />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Skeleton variant="rounded" height={320} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Skeleton variant="rounded" height={320} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Skeleton variant="rounded" height={320} />
            </Grid>
          </Grid>
        </Stack>
      ) : subscription ? (
        <>
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                spacing={2}
              >
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Current plan
                  </Typography>
                  <Typography variant="h5">
                    {subscription.subscriptionTier} · {formatMoney(subscription.monthlyPrice)}/mo
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Renews{' '}
                    {subscription.currentPeriodEnd
                      ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                      : '—'}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={subscription.subscriptionStatus}
                    color={statusColor(subscription.subscriptionStatus)}
                    variant="outlined"
                  />
                  <Button variant="outlined" onClick={refresh} disabled={Boolean(busyTier)}>
                    Refresh
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            {subscription.plans.map((plan) => {
              const isCurrent = plan.tier === currentTier
              const isUpgrade =
                ['Starter', 'Pro', 'Enterprise'].indexOf(plan.tier) >
                ['Starter', 'Pro', 'Enterprise'].indexOf(currentTier)

              return (
                <Grid key={plan.tier} size={{ xs: 12, md: 4 }}>
                  <Card
                    variant="outlined"
                    sx={{
                      height: '100%',
                      borderColor: isCurrent ? 'primary.main' : 'divider',
                      borderWidth: isCurrent ? 2 : 1,
                    }}
                  >
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="h6">{plan.tier}</Typography>
                        {isCurrent && <Chip size="small" color="primary" label="Current" />}
                      </Stack>
                      <Typography variant="h4" sx={{ my: 1 }}>
                        {formatMoney(plan.monthlyPrice)}
                        <Typography component="span" variant="body2" color="text.secondary">
                          /mo
                        </Typography>
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {plan.description}
                      </Typography>
                      <List dense>
                        {plan.features.map((feature) => (
                          <ListItem key={feature} disableGutters>
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              <CheckCircleOutlineIcon color="primary" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary={feature} />
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                    <CardActions sx={{ px: 2, pb: 2 }}>
                      <Button
                        fullWidth
                        variant={isCurrent ? 'outlined' : 'contained'}
                        disabled={isCurrent || busyTier === plan.tier}
                        onClick={() => void handleSelectPlan(plan.tier)}
                      >
                        {isCurrent
                          ? 'Current plan'
                          : busyTier === plan.tier
                            ? 'Processing…'
                            : isUpgrade
                              ? 'Upgrade Plan'
                              : 'Manage Subscription'}
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              )
            })}
          </Grid>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Feature entitlements
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {featureMatrix.map((feature) => (
                  <Chip
                    key={feature.key}
                    label={feature.key}
                    color={feature.enabled ? 'success' : 'default'}
                    variant={feature.enabled ? 'filled' : 'outlined'}
                    size="small"
                  />
                ))}
              </Stack>
            </CardContent>
          </Card>
        </>
      ) : null}
    </Container>
  )
}
