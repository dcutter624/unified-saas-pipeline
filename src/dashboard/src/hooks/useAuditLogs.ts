import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { fetchAuditLogs, type AuditLogItem } from '../api/auditApi'

export function useAuditLogs(enabled: boolean) {
  const [rows, setRows] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })
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
        const data = await fetchAuditLogs({
          page: paginationModel.page + 1,
          pageSize: paginationModel.pageSize,
          sortBy: 'timestamp',
          sortDir: 'desc',
        })
        if (!cancelled) {
          setRows(data.items)
          setTotalCount(data.totalCount)
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
              ? `Failed to load audit logs (${err.response.status}).`
              : 'Unable to reach the API.'
            : err instanceof Error
              ? err.message
              : 'Failed to load audit logs',
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
  }, [enabled, paginationModel.page, paginationModel.pageSize, refreshIndex])

  return {
    rows,
    loading,
    error,
    totalCount,
    paginationModel,
    setPaginationModel,
    refresh,
    setError,
  }
}
