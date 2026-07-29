import { useState, type ReactNode } from 'react'
import {
  AppBar,
  Avatar,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

interface AppShellProps {
  children: ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const { tenantSettings, currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const title = tenantSettings?.tenantName || 'Unified SaaS Dashboard'
  const initial = (currentUser?.username || title).charAt(0).toUpperCase()

  function handleLogout() {
    setAnchorEl(null)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      <AppBar position="sticky" elevation={1} color="primary">
        <Toolbar sx={{ gap: 1.5 }}>
          {tenantSettings?.logoUrl ? (
            <Box
              component="img"
              src={tenantSettings.logoUrl}
              alt={`${title} logo`}
              sx={{ height: 32, maxWidth: 120, objectFit: 'contain' }}
            />
          ) : null}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {title}
          </Typography>
          {currentUser && (
            <Typography
              variant="body2"
              sx={{ mr: 1, display: { xs: 'none', sm: 'block' }, opacity: 0.9 }}
            >
              {currentUser.username} · {currentUser.role}
            </Typography>
          )}
          <IconButton
            size="small"
            onClick={(event) => setAnchorEl(event.currentTarget)}
            aria-label="Account menu"
            sx={{ color: 'inherit' }}
          >
            <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.dark' }}>{initial}</Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box component="main">{children}</Box>
    </Box>
  )
}
