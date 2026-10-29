import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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
      let query = supabase.from('categories').select('*')
      if (filters.activeOnly) query = query.eq('is_active', true)
      if (filters.createdBy) query = query.eq('created_by', filters.createdBy)
      const { data, error: categoriesError } = await query.order('name')
      if (categoriesError) throw categoriesError

      const rows = data || []
      if (!filters.includeQuestionCounts || rows.length === 0) {
        setCategories(rows)
        return rows
      }

      const questionCounts = await Promise.all(rows.map(async (category) => {
        const { count, error: questionError } = await supabase
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .eq('category_id', category.id)
          .eq('is_active', true)
        if (questionError) throw questionError
        return count || 0
      }))
      const categoriesWithCounts = rows.map((category, index) => ({ ...category, questionCount: questionCounts[index] }))
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
