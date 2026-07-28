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
  const { tenantId, logout } = useAuth()
  const navigate = useNavigate()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  function handleLogout() {
    setAnchorEl(null)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      <AppBar position="sticky" elevation={1} color="default">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Unified SaaS Dashboard
          </Typography>
          {tenantId && (
            <Typography variant="body2" color="text.secondary" sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}>
              Tenant {tenantId.slice(0, 8)}…
            </Typography>
          )}
          <IconButton
            size="small"
            onClick={(event) => setAnchorEl(event.currentTarget)}
            aria-label="Account menu"
          >
            <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main' }}>A</Avatar>
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
