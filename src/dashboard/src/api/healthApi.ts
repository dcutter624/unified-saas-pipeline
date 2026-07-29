import { apiClient } from './client'
import { API_BASE_URL } from '../config'

export interface HealthDatabaseCheck {
  status: string
  canConnect: boolean
  latencyMs: number
  tenantCount: number
  error: string | null
}

export interface HealthWorkerCheck {
  status: string
  isRunning: boolean
  workerStartedAtUtc: string
  lastAttemptAtUtc: string | null
  lastSuccessAtUtc: string | null
  lastTrigger: string | null
  lastError: string | null
  successCount: number
  failureCount: number
}

export interface HealthRateLimitingCheck {
  status: string
  enabled: boolean
  globalPolicy: string
  authPolicy: string
}

export interface HealthSystemCheck {
  environment: string
  framework: string
  uptimeSeconds: number
  workingSetBytes: number
  managedMemoryBytes: number
  processorCount: number
  machineName: string
}

export interface HealthCheckResponse {
  status: string
  checkedAtUtc: string
  database: HealthDatabaseCheck
  backgroundWorker: HealthWorkerCheck
  rateLimiting: HealthRateLimitingCheck
  system: HealthSystemCheck
}

export async function fetchHealthz(): Promise<{ data: HealthCheckResponse; latencyMs: number; ok: boolean }> {
  const started = performance.now()
  try {
    const { data, status } = await apiClient.get<HealthCheckResponse>('/healthz', {
      skipAuthRedirect: true,
      skipErrorToast: true,
      skipRetry: true,
      baseURL: API_BASE_URL,
      validateStatus: (code) => code === 200 || code === 503,
    })
    return {
      data,
      latencyMs: Math.round(performance.now() - started),
      ok: status === 200,
    }
  } catch (error) {
    throw error
  }
}
