import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Alert, Snackbar } from '@mui/material'

export type AlertSeverity = 'success' | 'info' | 'warning' | 'error'

export interface NotifyOptions {
  severity?: AlertSeverity
  autoHideDuration?: number | null
}

interface AlertState {
  open: boolean
  message: string
  severity: AlertSeverity
  autoHideDuration: number | null
}

interface AlertContextValue {
  notify: (message: string, options?: NotifyOptions) => void
  notifySuccess: (message: string) => void
  notifyError: (message: string) => void
  notifyWarning: (message: string) => void
  notifyInfo: (message: string) => void
  closeAlert: () => void
}

const AlertContext = createContext<AlertContextValue | undefined>(undefined)

const DEFAULT_DURATION = 4500

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<AlertState>({
    open: false,
    message: '',
    severity: 'info',
    autoHideDuration: DEFAULT_DURATION,
  })

  const closeAlert = useCallback(() => {
    setAlert((prev) => ({ ...prev, open: false }))
  }, [])

  const notify = useCallback((message: string, options?: NotifyOptions) => {
    if (!message.trim()) {
      return
    }

    setAlert({
      open: true,
      message: message.trim(),
      severity: options?.severity ?? 'info',
      autoHideDuration:
        options?.autoHideDuration === undefined ? DEFAULT_DURATION : options.autoHideDuration,
    })
  }, [])

  const notifySuccess = useCallback(
    (message: string) => notify(message, { severity: 'success' }),
    [notify],
  )
  const notifyError = useCallback(
    (message: string) => notify(message, { severity: 'error', autoHideDuration: 6000 }),
    [notify],
  )
  const notifyWarning = useCallback(
    (message: string) => notify(message, { severity: 'warning' }),
    [notify],
  )
  const notifyInfo = useCallback(
    (message: string) => notify(message, { severity: 'info' }),
    [notify],
  )

  const value = useMemo(
    () => ({
      notify,
      notifySuccess,
      notifyError,
      notifyWarning,
      notifyInfo,
      closeAlert,
    }),
    [notify, notifySuccess, notifyError, notifyWarning, notifyInfo, closeAlert],
  )

  return (
    <AlertContext.Provider value={value}>
      {children}
      <Snackbar
        open={alert.open}
        autoHideDuration={alert.autoHideDuration ?? undefined}
        onClose={(_, reason) => {
          if (reason === 'clickaway') {
            return
          }
          closeAlert()
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={closeAlert}
          severity={alert.severity}
          variant="filled"
          elevation={6}
          sx={{ width: '100%' }}
        >
          {alert.message}
        </Alert>
      </Snackbar>
    </AlertContext.Provider>
  )
}

export function useAlert(): AlertContextValue {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider')
  }
  return context
}
