import axios from 'axios'
import { API_BASE_URL } from '../config'
import { clearAuthStorage, getStoredToken } from '../auth/tokenStorage'

export type UnauthorizedHandler = (message?: string) => void

let unauthorizedHandler: UnauthorizedHandler | null = null

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler
}

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipAuthRedirect?: boolean
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error)
    }

    const status = error.response?.status
    const skipRedirect = error.config?.skipAuthRedirect === true
    const url = error.config?.url ?? ''
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
    }

    return Promise.reject(error)
  },
)
