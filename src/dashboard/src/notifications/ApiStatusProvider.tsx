import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Alert, Box, Collapse, LinearProgress } from '@mui/material'
import { setApiStatusHandlers } from '../api/client'

interface ApiStatusContextValue {
  isWarmingUp: boolean
  pendingRequests: number
}

const ApiStatusContext = createContext<ApiStatusContextValue>({
  isWarmingUp: false,
  pendingRequests: 0,
})

const WARMUP_THRESHOLD_MS = 2500

export function ApiStatusProvider({ children }: { children: ReactNode }) {
  const [pendingRequests, setPendingRequests] = useState(0)
  const [isWarmingUp, setIsWarmingUp] = useState(false)
  const warmupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearWarmupTimer = useCallback(() => {
    if (warmupTimer.current) {
      clearTimeout(warmupTimer.current)
      warmupTimer.current = null
    }
  }, [])

  const onRequestStart = useCallback(() => {
    setPendingRequests((count) => {
      const next = count + 1
      if (next === 1) {
        clearWarmupTimer()
        warmupTimer.current = setTimeout(() => {
          setIsWarmingUp(true)
        }, WARMUP_THRESHOLD_MS)
      }
      return next
    })
  }, [clearWarmupTimer])

  const onRequestEnd = useCallback(() => {
    setPendingRequests((count) => {
      const next = Math.max(0, count - 1)
      if (next === 0) {
        clearWarmupTimer()
        setIsWarmingUp(false)
      }
      return next
    })
  }, [clearWarmupTimer])

  useEffect(() => {
    setApiStatusHandlers({ onRequestStart, onRequestEnd })
    return () => {
      setApiStatusHandlers(null)
      clearWarmupTimer()
    }
  }, [onRequestStart, onRequestEnd, clearWarmupTimer])

  const value = useMemo(
    () => ({
      isWarmingUp,
      pendingRequests,
    }),
    [isWarmingUp, pendingRequests],
  )

  return (
    <ApiStatusContext.Provider value={value}>
      <Collapse in={isWarmingUp}>
        <Box sx={{ position: 'sticky', top: 0, zIndex: (theme) => theme.zIndex.snackbar - 1 }}>
          <LinearProgress color="primary" />
          <Alert severity="info" variant="filled" sx={{ borderRadius: 0, py: 0.25 }}>
            Warming up API server… Render free-tier instances can take a moment on first request.
          </Alert>
        </Box>
      </Collapse>
      {children}
    </ApiStatusContext.Provider>
  )
}

export function useApiStatus(): ApiStatusContextValue {
  return useContext(ApiStatusContext)
}
