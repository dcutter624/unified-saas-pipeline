import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  clearAuthStorage,
  getStoredTenantId,
  getStoredToken,
  persistAuth,
} from './tokenStorage'

interface AuthContextValue {
  token: string | null
  tenantId: string | null
  isAuthenticated: boolean
  login: (token: string, tenantId: string) => void
  logout: () => void
  getAccessToken: () => string | null
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [tenantId, setTenantId] = useState<string | null>(() => getStoredTenantId())

  const login = useCallback((nextToken: string, nextTenantId: string) => {
    persistAuth(nextToken, nextTenantId)
    setToken(nextToken)
    setTenantId(nextTenantId)
  }, [])

  const logout = useCallback(() => {
    clearAuthStorage()
    setToken(null)
    setTenantId(null)
  }, [])

  const getAccessToken = useCallback(() => token ?? getStoredToken(), [token])

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      tenantId,
      isAuthenticated: Boolean(token),
      login,
      logout,
      getAccessToken,
    }),
    [token, tenantId, login, logout, getAccessToken],
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
