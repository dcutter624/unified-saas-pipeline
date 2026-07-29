import { useState, type FormEvent } from 'react'
import { Link as RouterLink, Navigate, useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { getApiErrorMessage, useAuth } from '../auth/AuthContext'

export default function LoginPage() {
  const { isAuthenticated, login, authNotice, clearAuthNotice } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
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
    clearAuthNotice()

    if (!validate()) {
      return
    }

    setSubmitting(true)
    try {
      await login(username.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(getApiErrorMessage(err, 'Login failed'))
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

          {(authNotice || error) && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              onClose={() => {
                setError(null)
                clearAuthNotice()
              }}
            >
              {error ?? authNotice}
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
              <Typography variant="body2" color="text.secondary" textAlign="center">
                New tenant?{' '}
                <Link component={RouterLink} to="/register">
                  Register
                </Link>
              </Typography>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Container>
  )
}
