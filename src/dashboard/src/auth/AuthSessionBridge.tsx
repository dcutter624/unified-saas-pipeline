import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setUnauthorizedHandler } from '../api/client'
import { useAuth } from './AuthContext'

/**
 * Bridges Axios 401 handling to auth logout + login redirect.
 * Must render inside BrowserRouter and AuthProvider.
 */
export default function AuthSessionBridge() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout()
      navigate('/login', { replace: true })
    })

    return () => setUnauthorizedHandler(null)
  }, [logout, navigate])

  return null
}
