import { useEffect } from 'react'
import { setErrorNotifyHandler, setUnauthorizedHandler } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useAlert } from './AlertProvider'
import { useNavigate } from 'react-router-dom'

/**
 * Bridges Axios auth/error handlers into Auth + Alert contexts.
 * Must render under BrowserRouter, AuthProvider, and AlertProvider.
 */
export default function NotificationBridge() {
  const { logout, setAuthNotice } = useAuth()
  const { notifyError, notifyWarning } = useAlert()
  const navigate = useNavigate()

  useEffect(() => {
    setUnauthorizedHandler((message) => {
      const text = message ?? 'Your session expired. Please sign in again.'
      logout()
      setAuthNotice(text)
      notifyWarning(text)
      navigate('/login', { replace: true })
    })

    setErrorNotifyHandler((message, severity) => {
      if (severity === 'warning') {
        notifyWarning(message)
      } else {
        notifyError(message)
      }
    })

    return () => {
      setUnauthorizedHandler(null)
      setErrorNotifyHandler(null)
    }
  }, [logout, navigate, notifyError, notifyWarning, setAuthNotice])

  return null
}
