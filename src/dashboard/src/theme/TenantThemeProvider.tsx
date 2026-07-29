import { useMemo, type ReactNode } from 'react'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { useAuth } from '../auth/AuthContext'

const DEFAULT_PRIMARY = '#1976d2'

function normalizeColor(color?: string | null): string {
  if (!color) {
    return DEFAULT_PRIMARY
  }
  const trimmed = color.trim()
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed) ? trimmed : DEFAULT_PRIMARY
}

export default function TenantThemeProvider({ children }: { children: ReactNode }) {
  const { tenantSettings } = useAuth()

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          primary: {
            main: normalizeColor(tenantSettings?.primaryColor),
          },
        },
        typography: {
          fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
        },
      }),
    [tenantSettings?.primaryColor],
  )

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}
