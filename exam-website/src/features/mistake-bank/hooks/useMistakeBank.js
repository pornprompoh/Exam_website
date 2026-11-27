import { useCallback, useEffect, useState } from 'react'
import { fetchUnresolvedMistakes, markMistakeResolved } from '../services/mistakeBankService'

export default function useMistakeBank() {
  const [mistakes, setMistakes] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchUnresolvedMistakes()
      setMistakes(data.mistakes)
      setCategories(data.categories)
    } catch (loadError) {
      setError(loadError)
    } finally {
      setLoading(false)
    }
  }, [])

  const resolveMistake = useCallback(async (item) => {
    try {
      await markMistakeResolved(item)
      setMistakes((current) => current.filter((mistake) => mistake.id !== item.id))
      setError(null)
    } catch (resolveError) {
      setError(resolveError)
      throw resolveError
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

  return { mistakes, categories, loading, error, refresh, resolveMistake }
}
