import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'

/** Restricts nested routes to tenant Administrators. */
export default function AdminRoute() {
  const { currentUser, isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (currentUser?.role !== 'Admin') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
