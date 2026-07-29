import { useEffect, useRef } from 'react'
import { wakeApiServer } from '../api/client'

/**
 * Fires a lightweight health ping once on mount so Render cold starts
 * begin warming before the user submits login/register or loads data.
 */
export default function ApiWarmup() {
  const started = useRef(false)

  useEffect(() => {
    if (started.current) {
      return
    }
    started.current = true
    void wakeApiServer()
  }, [])

  return null
}
