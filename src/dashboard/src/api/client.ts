import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { API_BASE_URL } from '../config'
import { clearAuthStorage, getStoredToken } from '../auth/tokenStorage'

export type UnauthorizedHandler = (message?: string) => void
export type ErrorNotifyHandler = (message: string, severity?: 'error' | 'warning') => void

export interface ApiStatusHandlers {
  onRequestStart: () => void
  onRequestEnd: () => void
}

let unauthorizedHandler: UnauthorizedHandler | null = null
let errorNotifyHandler: ErrorNotifyHandler | null = null
let apiStatusHandlers: ApiStatusHandlers | null = null

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler
}

export function setErrorNotifyHandler(handler: ErrorNotifyHandler | null): void {
  errorNotifyHandler = handler
}

export function setApiStatusHandlers(handlers: ApiStatusHandlers | null): void {
  apiStatusHandlers = handlers
}

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipAuthRedirect?: boolean
    skipErrorToast?: boolean
    skipRetry?: boolean
    /** Internal retry counter — do not set from app code */
    __retryCount?: number
  }
}

const MAX_RETRIES = 3
const RETRYABLE_STATUS = new Set([408, 429, 502, 503, 504])

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryable(error: AxiosError): boolean {
  if (error.config?.skipRetry) {
    return false
  }

  if (!error.response) {
    return true
  }

  return RETRYABLE_STATUS.has(error.response.status)
}

function resolveErrorMessage(error: AxiosError): string {
  const apiMessage = (error.response?.data as { message?: string } | undefined)?.message
  if (apiMessage) {
    return apiMessage
  }

  const status = error.response?.status
  if (status === 401) {
    return 'Your session expired. Please sign in again.'
  }
  if (status === 403) {
    return 'You do not have permission to perform this action.'
  }
  if (status && status >= 500) {
    return 'The API server encountered an error. Please try again shortly.'
  }
  if (error.code === 'ECONNABORTED') {
    return 'The API request timed out. The server may still be warming up.'
  }
  if (!error.response) {
    return 'Unable to reach the API. The server may be starting up — please retry.'
  }
  return `Request failed (${status}).`
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  // Retries share the original in-flight counter so the warmup banner stays stable.
  if (!config.__retryCount) {
    apiStatusHandlers?.onRequestStart()
  }

  const token = getStoredToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => {
    apiStatusHandlers?.onRequestEnd()
    return response
  },
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      apiStatusHandlers?.onRequestEnd()
      return Promise.reject(error)
    }

    const config = error.config as InternalAxiosRequestConfig | undefined

    if (config && isRetryable(error)) {
      const retryCount = config.__retryCount ?? 0
      if (retryCount < MAX_RETRIES) {
        config.__retryCount = retryCount + 1
        const delayMs = Math.min(1000 * 2 ** retryCount, 8000)
        await sleep(delayMs)
        return apiClient.request(config)
      }
    }

    apiStatusHandlers?.onRequestEnd()

    const status = error.response?.status
    const skipRedirect = config?.skipAuthRedirect === true
    const skipToast = config?.skipErrorToast === true
    const url = config?.url ?? ''
    const isAuthRequest = url.includes('/api/auth/login') || url.includes('/api/auth/register')
    const apiMessage = (error.response?.data as { message?: string } | undefined)?.message

    const isDisabledTenant =
      status === 403 &&
      typeof apiMessage === 'string' &&
      apiMessage.toLowerCase().includes('tenant account is disabled')

    if (!skipRedirect && !isAuthRequest && (status === 401 || isDisabledTenant)) {
      clearAuthStorage()
      unauthorizedHandler?.(
        isDisabledTenant
          ? apiMessage
          : 'Your session expired. Please sign in again.',
      )
      return Promise.reject(error)
    }

    if (!skipToast && !isAuthRequest) {
      if (status === 403) {
        errorNotifyHandler?.(
          apiMessage ?? 'You do not have permission to perform this action.',
          'warning',
        )
      } else if (!error.response || (status !== undefined && status >= 500)) {
        errorNotifyHandler?.(resolveErrorMessage(error), 'error')
      }
    }

    return Promise.reject(error)
  },
)

/** Lightweight ping used to wake Render before auth / first data load. */
export async function wakeApiServer(): Promise<boolean> {
  try {
    await apiClient.get('/', {
      skipAuthRedirect: true,
      skipErrorToast: true,
      timeout: 45_000,
    })
    return true
  } catch {
    return false
  }
}
