import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { isTenantDisabled } from '../types/tenant'

export default function ProtectedRoute() {
  const { isAuthenticated, tenantSettings, logout, setAuthNotice, refreshSettings } = useAuth()
  const location = useLocation()
  const [checking, setChecking] = useState(isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated) {
      setChecking(false)
      return
    }

    let cancelled = false
    setChecking(true)

    void refreshSettings()
      .then((settings) => {
        if (cancelled) {
          return
        }
        if (settings && isTenantDisabled(settings.status)) {
          logout()
          setAuthNotice('Tenant account is disabled. Please contact support.')
        }
      })
      .catch(() => {
        // 401/disabled handled by axios interceptor + NotificationBridge
      })
      .finally(() => {
        if (!cancelled) {
          setChecking(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, logout, refreshSettings, setAuthNotice])

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (checking) {
    return null
  }

  if (isTenantDisabled(tenantSettings?.status)) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
