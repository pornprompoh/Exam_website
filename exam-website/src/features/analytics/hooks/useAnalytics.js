import { useCallback, useEffect, useState } from 'react'
import { fetchUserAnalytics, INITIAL_ANALYTICS } from '../services/analyticsService'

export default function useAnalytics() {
  const [analytics, setAnalytics] = useState(INITIAL_ANALYTICS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const nextData = await fetchUserAnalytics()
      setAnalytics(nextData)
    } catch (loadError) {
      setError(loadError)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => {
      if (active) return refresh()
      return undefined
    })
    return () => {
      active = false
    }
  }, [refresh])

  return { ...analytics, loading, error, refresh }
}
