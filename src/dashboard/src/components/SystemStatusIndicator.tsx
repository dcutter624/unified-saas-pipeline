import { useCallback, useEffect, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { fetchHealthz, type HealthCheckResponse } from '../api/healthApi'

function statusColor(status?: string): 'success' | 'warning' | 'error' | 'default' {
  const normalized = (status ?? '').toLowerCase()
  if (normalized === 'healthy') return 'success'
  if (normalized === 'degraded') return 'warning'
  if (normalized === 'unhealthy') return 'error'
  return 'default'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatUptime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hrs = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hrs > 0) return `${hrs}h ${mins}m`
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

export default function SystemStatusIndicator() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [health, setHealth] = useState<HealthCheckResponse | null>(null)
  const [apiLatencyMs, setApiLatencyMs] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchHealthz()
      setHealth(result.data)
      setApiLatencyMs(result.latencyMs)
    } catch {
      setHealth(null)
      setApiLatencyMs(null)
      setError('Unable to reach /healthz')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), 60_000)
    return () => window.clearInterval(id)
  }, [refresh])

  useEffect(() => {
    if (open) {
      void refresh()
    }
  }, [open, refresh])

  const chipStatus = error ? 'Unhealthy' : health?.status ?? 'Unknown'

  return (
    <>
      <Tooltip title="System diagnostics">
        <Chip
          size="small"
          clickable
          onClick={() => setOpen(true)}
          color={statusColor(chipStatus)}
          variant="outlined"
          label={
            loading && !health
              ? 'Checking…'
              : apiLatencyMs != null
                ? `${chipStatus} · ${apiLatencyMs}ms`
                : chipStatus
          }
          sx={{
            color: 'inherit',
            borderColor: 'rgba(255,255,255,0.5)',
            display: { xs: 'none', md: 'inline-flex' },
          }}
        />
      </Tooltip>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>System Diagnostics</DialogTitle>
        <DialogContent dividers>
          {error && (
            <Typography color="error" sx={{ mb: 2 }}>
              {error}
            </Typography>
          )}
          {health ? (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle1">Overall</Typography>
                <Chip size="small" label={health.status} color={statusColor(health.status)} />
                {apiLatencyMs != null && (
                  <Typography variant="body2" color="text.secondary">
                    API round-trip {apiLatencyMs} ms
                  </Typography>
                )}
              </Stack>

              <Divider />

              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography variant="subtitle2">Database</Typography>
                  <Chip
                    size="small"
                    label={health.database.status}
                    color={statusColor(health.database.status)}
                    variant="outlined"
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Latency {health.database.latencyMs} ms · Tenants {health.database.tenantCount}
                  {health.database.error ? ` · ${health.database.error}` : ''}
                </Typography>
              </Box>

              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography variant="subtitle2">Background worker</Typography>
                  <Chip
                    size="small"
                    label={health.backgroundWorker.status}
                    color={statusColor(health.backgroundWorker.status)}
                    variant="outlined"
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Running: {health.backgroundWorker.isRunning ? 'yes' : 'no'} · Trigger:{' '}
                  {health.backgroundWorker.lastTrigger ?? '—'} · Successes:{' '}
                  {health.backgroundWorker.successCount} · Failures:{' '}
                  {health.backgroundWorker.failureCount}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Last success:{' '}
                  {health.backgroundWorker.lastSuccessAtUtc
                    ? new Date(health.backgroundWorker.lastSuccessAtUtc).toLocaleString()
                    : '—'}
                </Typography>
                {health.backgroundWorker.lastError && (
                  <Typography variant="body2" color="error">
                    {health.backgroundWorker.lastError}
                  </Typography>
                )}
              </Box>

              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography variant="subtitle2">Rate limiting</Typography>
                  <Chip
                    size="small"
                    label={health.rateLimiting.status}
                    color={statusColor(health.rateLimiting.status)}
                    variant="outlined"
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {health.rateLimiting.globalPolicy} · {health.rateLimiting.authPolicy}
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  System
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Env {health.system.environment} · .NET {health.system.framework} · Uptime{' '}
                  {formatUptime(health.system.uptimeSeconds)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Working set {formatBytes(health.system.workingSetBytes)} · Managed{' '}
                  {formatBytes(health.system.managedMemoryBytes)} · CPUs{' '}
                  {health.system.processorCount}
                </Typography>
              </Box>
            </Stack>
          ) : (
            !error && <Typography color="text.secondary">Loading diagnostics…</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => void refresh()} disabled={loading}>
            Refresh
          </Button>
          <Button variant="contained" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
