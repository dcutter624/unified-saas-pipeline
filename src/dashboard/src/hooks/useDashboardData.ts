import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { fetchDashboard, type DashboardResponse } from '../api/dashboardApi'
import { useAuth } from '../auth/AuthContext'

export interface DashboardRow {
  id: string
  customerId: string
  customerName: string
  email: string
  subscriptionId: string | null
  subscriptionStatus: string
  subscriptionTier: string
  startDate: string | null
}

const TIER_MRR: Record<string, number> = {
  Starter: 29,
  'Pro Tier': 99,
  Pro: 99,
  Enterprise: 299,
}

export function useDashboardData() {
  const { tenantSettings, tenantId } = useAuth()
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)

  const refresh = useCallback(() => {
    setRefreshIndex((value) => value + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const data = await fetchDashboard()
        if (!cancelled) {
          setDashboard(data)
        }
      } catch (err) {
        if (cancelled) {
          return
        }
        if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403)) {
          return
        }
        setError(
          axios.isAxiosError(err)
            ? err.response
              ? `Failed to load dashboard (${err.response.status}).`
              : 'Unable to reach the API.'
            : err instanceof Error
              ? err.message
              : 'Failed to load dashboard',
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [tenantId, tenantSettings?.tenantName, tenantSettings?.primaryColor, tenantSettings?.status, refreshIndex])

  const rows = useMemo<DashboardRow[]>(() => {
    if (!dashboard) {
      return []
    }

    const subscriptionsByCustomer = new Map(
      (dashboard.subscriptions ?? []).map((subscription) => [subscription.customerId, subscription]),
    )

    return (dashboard.customers ?? []).map((customer) => {
      const subscription = subscriptionsByCustomer.get(customer.id)
      return {
        id: customer.id,
        customerId: customer.id,
        customerName: customer.name,
        email: customer.email,
        subscriptionId: subscription?.id ?? null,
        subscriptionStatus: subscription?.status ?? 'None',
        subscriptionTier: subscription?.tier ?? '—',
        startDate: subscription?.startDate ?? null,
      }
    })
  }, [dashboard])

  const summary = useMemo(() => {
    const active = rows.filter((row) => row.subscriptionStatus.toLowerCase() === 'active')
    const inactive = rows.filter((row) => {
      const status = row.subscriptionStatus.toLowerCase()
      return status === 'inactive' || status === 'cancelled' || status === 'none'
    })
    const pending = rows.filter((row) => row.subscriptionStatus.toLowerCase() === 'pending')

    const statusCounts = rows.reduce<Record<string, number>>((acc, row) => {
      const key = row.subscriptionStatus || 'Unknown'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})

    const tierCounts = rows.reduce<Record<string, number>>((acc, row) => {
      const key = row.subscriptionTier || '—'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})

    const estimatedMrr = active.reduce((sum, row) => {
      return sum + (TIER_MRR[row.subscriptionTier] ?? 49)
    }, 0)

    return {
      totalCustomers: rows.length,
      totalSubscriptions: rows.filter((row) => row.subscriptionId).length,
      activeSubscriptions: active.length,
      inactiveSubscriptions: inactive.length,
      pendingSubscriptions: pending.length,
      estimatedMrr,
      statusCounts,
      tierCounts,
    }
  }, [rows])

  const pieByStatus = useMemo(
    () =>
      Object.entries(summary.statusCounts).map(([label, value], index) => ({
        id: index,
        label,
        value,
      })),
    [summary.statusCounts],
  )

  const pieByTier = useMemo(
    () =>
      Object.entries(summary.tierCounts)
        .filter(([label]) => label !== '—')
        .map(([label, value], index) => ({
          id: index,
          label,
          value,
        })),
    [summary.tierCounts],
  )

  return {
    dashboard,
    rows,
    summary,
    pieByStatus,
    pieByTier,
    loading,
    error,
    refresh,
    setError,
  }
}
