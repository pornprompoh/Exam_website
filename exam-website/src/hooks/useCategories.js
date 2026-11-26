import { useCallback, useEffect, useState } from 'react'
import { fetchAllPaginated, getTableExactCount } from '../lib/supabasePagination'

export default function useCategories({
  activeOnly = true,
  createdBy = null,
  includeQuestionCounts = false,
  enabled = true
} = {}) {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)

  const refetch = useCallback(async (overrides = {}) => {
    const filters = { activeOnly, createdBy, includeQuestionCounts, ...overrides }
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchAllPaginated(
        (client) => {
          let query = client.from('categories').select('*')
          if (filters.activeOnly) query = query.eq('is_active', true)
          if (filters.createdBy) query = query.eq('created_by', filters.createdBy)
          return query.order('name', { ascending: true })
        },
        { pageSize: 1000, orderColumn: 'id' }
      )

      if (!filters.includeQuestionCounts || rows.length === 0) {
        setCategories(rows)
        return rows
      }

      const questionCounts = await Promise.all(
        rows.map((category) =>
          getTableExactCount('questions', (q) => q.eq('category_id', category.id).eq('is_active', true))
        )
      )
      const categoriesWithCounts = rows.map((category, index) => ({
        ...category,
        questionCount: questionCounts[index]
      }))
      setCategories(categoriesWithCounts)
      return categoriesWithCounts
    } catch (loadError) {
      setError(loadError)
      throw loadError
    } finally {
      setLoading(false)
    }
  }, [activeOnly, createdBy, includeQuestionCounts])

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => {
      if (active && enabled) return refetch()
      return undefined
    }).catch((loadError) => console.error('ไม่สามารถโหลดหมวดหมู่ได้:', loadError))
    return () => {
      active = false
    }
  }, [enabled, refetch])

  return { categories, loading, error, refetch }
}
