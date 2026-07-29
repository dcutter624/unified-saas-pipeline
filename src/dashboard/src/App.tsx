import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AdminRoute from './auth/AdminRoute'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import AppShell from './components/AppShell'
import { AlertProvider } from './notifications/AlertProvider'
import { ApiStatusProvider } from './notifications/ApiStatusProvider'
import ApiWarmup from './notifications/ApiWarmup'
import NotificationBridge from './notifications/NotificationBridge'
import AuditTrailPage from './pages/AuditTrailPage'
import AnalyticsPage from './pages/AnalyticsPage'
import BillingPage from './pages/BillingPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import TenantThemeProvider from './theme/TenantThemeProvider'

function AppShellLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <TenantThemeProvider>
          <AlertProvider>
            <ApiStatusProvider>
              <BrowserRouter>
                <NotificationBridge />
                <ApiWarmup />
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route element={<ProtectedRoute />}>
                    <Route element={<AppShellLayout />}>
                      <Route path="/" element={<DashboardPage />} />
                      <Route path="/analytics" element={<AnalyticsPage />} />
                      <Route element={<AdminRoute />}>
                        <Route path="/audit" element={<AuditTrailPage />} />
                        <Route path="/billing" element={<BillingPage />} />
                      </Route>
                    </Route>
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </BrowserRouter>
            </ApiStatusProvider>
          </AlertProvider>
        </TenantThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
