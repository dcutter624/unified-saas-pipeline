import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import {
  fetchBillingSubscription,
  type BillingSubscription,
} from '../api/billingApi'
import { useAuth } from '../auth/AuthContext'

export function useBillingSubscription(enabled: boolean) {
  const { tenantId } = useAuth()
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)

  const refresh = useCallback(() => {
    setRefreshIndex((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchBillingSubscription()
        if (!cancelled) {
          setSubscription(data)
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
              ? `Failed to load billing (${err.response.status}).`
              : 'Unable to reach the API.'
            : err instanceof Error
              ? err.message
              : 'Failed to load billing',
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
  }, [enabled, tenantId, refreshIndex])

  return { subscription, setSubscription, loading, error, refresh, setError }
}
