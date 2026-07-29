import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import axios from 'axios'
import {
  fetchTenantSettings,
  loginRequest,
  registerTenantRequest,
  updateTenantSettingsRequest,
} from '../api/dashboardApi'
import type {
  CurrentUser,
  RegisterTenantRequest,
  TenantSettings,
  UpdateTenantSettingsRequest,
} from '../types/tenant'
import { isTenantDisabled } from '../types/tenant'
import { parseUserFromToken } from './jwt'
import {
  clearAuthStorage,
  getStoredSettings,
  getStoredTenantId,
  getStoredToken,
  getStoredUser,
  persistSession,
  persistSettings,
} from './tokenStorage'

interface AuthContextValue {
  token: string | null
  tenantId: string | null
  currentUser: CurrentUser | null
  tenantSettings: TenantSettings | null
  isAuthenticated: boolean
  isTenantDisabled: boolean
  authNotice: string | null
  clearAuthNotice: () => void
  login: (username: string, password: string) => Promise<void>
  register: (payload: RegisterTenantRequest) => Promise<void>
  logout: () => void
  updateSettings: (payload: UpdateTenantSettingsRequest) => Promise<TenantSettings>
  refreshSettings: () => Promise<TenantSettings | null>
  getAccessToken: () => string | null
  setAuthNotice: (message: string | null) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function hydrateSession(token: string, tenantId: string) {
  const user = parseUserFromToken(token)
  persistSession(token, tenantId, user, getStoredSettings())
  const settings = await fetchTenantSettings()
  persistSession(token, tenantId, user, settings)
  return { user, settings }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [tenantId, setTenantId] = useState<string | null>(() => getStoredTenantId())
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => getStoredUser())
  const [tenantSettings, setTenantSettings] = useState<TenantSettings | null>(() => getStoredSettings())
  const [authNotice, setAuthNotice] = useState<string | null>(null)

  const clearAuthNotice = useCallback(() => setAuthNotice(null), [])

  const logout = useCallback(() => {
    clearAuthStorage()
    setToken(null)
    setTenantId(null)
    setCurrentUser(null)
    setTenantSettings(null)
  }, [])

  const applySession = useCallback(async (nextToken: string, nextTenantId: string) => {
    const { user, settings } = await hydrateSession(nextToken, nextTenantId)
    setToken(nextToken)
    setTenantId(nextTenantId)
    setCurrentUser(user)
    setTenantSettings(settings)

    if (isTenantDisabled(settings.status)) {
      clearAuthStorage()
      setToken(null)
      setTenantId(null)
      setCurrentUser(null)
      setTenantSettings(null)
      throw new Error('Tenant account is disabled. Please contact support.')
    }
  }, [])

  const login = useCallback(
    async (username: string, password: string) => {
      const data = await loginRequest(username, password)
      if (!data.token || !data.tenantId) {
        throw new Error('Login response was missing token or tenantId.')
      }

      if (isTenantDisabled(data.tenantStatus)) {
        throw new Error(data.message || 'Tenant account is disabled. Please contact support.')
      }

      await applySession(data.token, data.tenantId)
    },
    [applySession],
  )

  const register = useCallback(
    async (payload: RegisterTenantRequest) => {
      const data = await registerTenantRequest(payload)
      if (!data.token || !data.tenantId) {
        throw new Error('Registration response was missing token or tenantId.')
      }
      await applySession(data.token, data.tenantId)
    },
    [applySession],
  )

  const refreshSettings = useCallback(async () => {
    if (!getStoredToken()) {
      return null
    }
    const settings = await fetchTenantSettings()
    persistSettings(settings)
    setTenantSettings(settings)
    return settings
  }, [])

  const updateSettings = useCallback(async (payload: UpdateTenantSettingsRequest) => {
    const settings = await updateTenantSettingsRequest(payload)
    persistSettings(settings)
    setTenantSettings(settings)
    return settings
  }, [])

  const getAccessToken = useCallback(() => token ?? getStoredToken(), [token])

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      tenantId,
      currentUser,
      tenantSettings,
      isAuthenticated: Boolean(token),
      isTenantDisabled: isTenantDisabled(tenantSettings?.status),
      authNotice,
      clearAuthNotice,
      login,
      register,
      logout,
      updateSettings,
      refreshSettings,
      getAccessToken,
      setAuthNotice,
    }),
    [
      token,
      tenantId,
      currentUser,
      tenantSettings,
      authNotice,
      clearAuthNotice,
      login,
      register,
      logout,
      updateSettings,
      refreshSettings,
      getAccessToken,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function useTenant() {
  const {
    tenantId,
    tenantSettings,
    updateSettings,
    refreshSettings,
    isTenantDisabled: disabled,
  } = useAuth()
  return {
    tenantId,
    tenantSettings,
    updateSettings,
    refreshSettings,
    isTenantDisabled: disabled,
  }
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const apiMessage = (err.response?.data as { message?: string } | undefined)?.message
    if (apiMessage) {
      return apiMessage
    }
    if (err.response?.status === 401) {
      return 'Invalid username or password.'
    }
    if (!err.response) {
      return 'Unable to reach the API. Confirm the backend is running.'
    }
    return `${fallback} (${err.response.status}).`
  }
  return err instanceof Error ? err.message : fallback
}
