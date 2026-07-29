import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setUnauthorizedHandler } from '../api/client'
import { useAuth } from './AuthContext'

export default function AuthSessionBridge() {
  const { logout, setAuthNotice } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    setUnauthorizedHandler((message) => {
      logout()
      setAuthNotice(message ?? 'Your session expired. Please sign in again.')
      navigate('/login', { replace: true })
    })

    return () => setUnauthorizedHandler(null)
  }, [logout, navigate, setAuthNotice])

  return null
}
