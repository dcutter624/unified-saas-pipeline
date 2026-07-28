import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import axios from 'axios'
import { loginRequest } from '../api/dashboardApi'
import { useAuth } from '../auth/AuthContext'

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({})
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  function validate(): boolean {
    const nextErrors: { username?: string; password?: string } = {}
    if (!username.trim()) {
      nextErrors.username = 'Username is required'
    }
    if (!password) {
      nextErrors.password = 'Password is required'
    }
    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!validate()) {
      return
    }

    setSubmitting(true)
    try {
      const data = await loginRequest(username.trim(), password)
      if (!data.token || !data.tenantId) {
        throw new Error('Login response was missing token or tenantId.')
      }

      login(data.token, data.tenantId)
      navigate('/', { replace: true })
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          setError('Invalid username or password.')
        } else if (!err.response) {
          setError('Unable to reach the API. Confirm the backend is running.')
        } else {
          setError(`Login failed (${err.response.status}).`)
        }
      } else {
        setError(err instanceof Error ? err.message : 'Login failed.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <Card elevation={2} sx={{ width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={1} sx={{ mb: 3 }}>
            <Typography variant="h4" component="h1">
              Sign in
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Unified SaaS Dashboard
            </Typography>
          </Stack>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Stack spacing={2}>
              <TextField
                label="Username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                error={Boolean(fieldErrors.username)}
                helperText={fieldErrors.username}
                fullWidth
                required
                disabled={submitting}
              />
              <TextField
                label="Password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={Boolean(fieldErrors.password)}
                helperText={fieldErrors.password}
                fullWidth
                required
                disabled={submitting}
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={submitting}
                startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : undefined}
              >
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Container>
  )
}
