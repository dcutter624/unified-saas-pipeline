import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import {
  fetchAnalyticsSummary,
  type AnalyticsPeriod,
  type AnalyticsSummaryResponse,
} from '../api/analyticsApi'
import { useAuth } from '../auth/AuthContext'

export function useAnalyticsSummary(period: AnalyticsPeriod) {
  const { tenantId, tenantSettings } = useAuth()
  const [data, setData] = useState<AnalyticsSummaryResponse | null>(null)
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
        const summary = await fetchAnalyticsSummary(period)
        if (!cancelled) {
          setData(summary)
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
              ? `Failed to load analytics (${err.response.status}).`
              : 'Unable to reach the API.'
            : err instanceof Error
              ? err.message
              : 'Failed to load analytics',
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
  }, [period, tenantId, tenantSettings?.status, refreshIndex])

  return { data, loading, error, refresh, setError }
}
