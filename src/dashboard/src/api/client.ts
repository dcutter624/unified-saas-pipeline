import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { API_BASE_URL } from '../config'
import { clearAuthStorage, getStoredToken } from '../auth/tokenStorage'

export type UnauthorizedHandler = () => void

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

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getStoredToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status
    const skipRedirect = error.config?.skipAuthRedirect === true
    const isLoginRequest = error.config?.url?.includes('/api/auth/login')

    if (status === 401 && !skipRedirect && !isLoginRequest) {
      clearAuthStorage()
      unauthorizedHandler?.()
    }

    return Promise.reject(error)
  },
)
