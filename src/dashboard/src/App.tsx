import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import AuthSessionBridge from './auth/AuthSessionBridge'
import ProtectedRoute from './auth/ProtectedRoute'
import AppShell from './components/AppShell'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import TenantThemeProvider from './theme/TenantThemeProvider'

export default function App() {
  return (
    <AuthProvider>
      <TenantThemeProvider>
        <BrowserRouter>
          <AuthSessionBridge />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route element={<ProtectedRoute />}>
              <Route
                path="/"
                element={
                  <AppShell>
                    <DashboardPage />
                  </AppShell>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </TenantThemeProvider>
    </AuthProvider>
  )
}
