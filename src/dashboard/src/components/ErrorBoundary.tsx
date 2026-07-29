import { Component, type ErrorInfo, type ReactNode } from 'react'
import {
  Box,
  Button,
  Container,
  CssBaseline,
  Stack,
  ThemeProvider,
  Typography,
  createTheme,
} from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  message: string | null
}

const fallbackTheme = createTheme({
  typography: {
    fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
  },
})

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: null,
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected rendering error occurred.',
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Dashboard ErrorBoundary caught an error:', error, info.componentStack)
  }

  handleReload = (): void => {
    window.location.assign('/')
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <ThemeProvider theme={fallbackTheme}>
        <CssBaseline />
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            bgcolor: 'grey.50',
          }}
        >
          <Container maxWidth="sm">
            <Stack spacing={2} alignItems="center" textAlign="center">
              <ErrorOutlineIcon color="error" sx={{ fontSize: 56 }} />
              <Typography variant="h4" component="h1">
                Something went wrong
              </Typography>
              <Typography variant="body1" color="text.secondary">
                The dashboard hit an unexpected error. You can reload to recover without leaving a
                blank screen.
              </Typography>
              {this.state.message && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    fontFamily: 'ui-monospace, monospace',
                    bgcolor: 'grey.100',
                    px: 1.5,
                    py: 1,
                    borderRadius: 1,
                    maxWidth: '100%',
                    wordBreak: 'break-word',
                  }}
                >
                  {this.state.message}
                </Typography>
              )}
              <Button variant="contained" size="large" onClick={this.handleReload}>
                Reload Dashboard
              </Button>
            </Stack>
          </Container>
        </Box>
      </ThemeProvider>
    )
  }
}
