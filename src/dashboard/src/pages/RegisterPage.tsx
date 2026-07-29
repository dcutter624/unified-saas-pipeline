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

export default function RegisterPage() {
  const { isAuthenticated, register } = useAuth()
  const navigate = useNavigate()

  const [tenantName, setTenantName] = useState('')
  const [adminUsername, setAdminUsername] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!tenantName.trim()) next.tenantName = 'Tenant name is required'
    if (!adminUsername.trim()) next.adminUsername = 'Admin username is required'
    if (!adminEmail.trim()) next.adminEmail = 'Admin email is required'
    if (!adminPassword) next.adminPassword = 'Admin password is required'
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (!validate()) {
      return
    }

    setSubmitting(true)
    try {
      await register({
        tenantName: tenantName.trim(),
        adminUsername: adminUsername.trim(),
        adminEmail: adminEmail.trim(),
        adminPassword,
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(getApiErrorMessage(err, 'Registration failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', py: 4 }}>
      <Card elevation={2} sx={{ width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={1} sx={{ mb: 3 }}>
            <Typography variant="h4" component="h1">
              Register tenant
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Provision a new workspace and admin account
            </Typography>
          </Stack>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Stack spacing={2}>
              <TextField
                label="Tenant name"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                error={Boolean(fieldErrors.tenantName)}
                helperText={fieldErrors.tenantName}
                fullWidth
                required
                disabled={submitting}
              />
              <TextField
                label="Admin username"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                error={Boolean(fieldErrors.adminUsername)}
                helperText={fieldErrors.adminUsername}
                fullWidth
                required
                disabled={submitting}
              />
              <TextField
                label="Admin email"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                error={Boolean(fieldErrors.adminEmail)}
                helperText={fieldErrors.adminEmail}
                fullWidth
                required
                disabled={submitting}
              />
              <TextField
                label="Admin password"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                error={Boolean(fieldErrors.adminPassword)}
                helperText={fieldErrors.adminPassword}
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
                {submitting ? 'Creating tenant…' : 'Create tenant'}
              </Button>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Already have an account?{' '}
                <Link component={RouterLink} to="/login">
                  Sign in
                </Link>
              </Typography>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Container>
  )
}
