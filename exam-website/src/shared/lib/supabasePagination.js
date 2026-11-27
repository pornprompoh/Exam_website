import { supabase } from './supabase'

export const DEFAULT_PAGINATION_PAGE_SIZE = 1000
export const DEFAULT_ID_BATCH_SIZE = 500

/**
 * Fetch ALL rows matching a query beyond Supabase PostgREST's 1,000-row ceiling.
 *
 * STRICT RULE: Always enforces deterministic unique ordering (default `id ASC`)
 * alongside `.range(from, to)` so rows are never duplicated or skipped across pages.
 *
 * @param {(client: typeof supabase) => any} buildQuery - Factory returning a fresh Supabase select query builder
 * @param {object} [options]
 * @param {number} [options.pageSize=1000] - Rows per `.range()` page (max 1000 on default PostgREST)
 * @param {number} [options.maxRows=Infinity] - Optional hard cap on total rows returned
 * @param {string} [options.orderColumn='id'] - Unique deterministic tie-breaker column
 * @param {boolean} [options.ascending=true] - Direction for `orderColumn`
 * @param {(info: { fetchedCount: number, pageIndex: number }) => void} [options.onProgress]
 * @returns {Promise<Array>}
 */
export async function fetchAllPaginated(buildQuery, options = {}) {
  const {
    pageSize = DEFAULT_PAGINATION_PAGE_SIZE,
    maxRows = Number.POSITIVE_INFINITY,
    orderColumn = 'id',
    ascending = true,
    onProgress = null
  } = options

  const safePageSize = Math.max(1, Math.min(1000, Number(pageSize) || DEFAULT_PAGINATION_PAGE_SIZE))
  const results = []
  let from = 0
  let pageIndex = 0

  while (results.length < maxRows) {
    const remaining = Number.isFinite(maxRows) ? maxRows - results.length : safePageSize
    const step = Math.min(safePageSize, remaining)
    const to = from + step - 1

    let query = buildQuery(supabase)
    if (orderColumn) {
      query = query.order(orderColumn, { ascending })
    }

    const { data, error } = await query.range(from, to)
    if (error) throw error

    const batch = data || []
    if (batch.length === 0) break

    results.push(...batch)
    pageIndex += 1
    onProgress?.({ fetchedCount: results.length, pageIndex })

    if (batch.length < step) break
    from += step
  }

  return results
}

/**
 * Fetch rows matching an array of IDs in safe chunks (`.in(idColumn, chunkIds)`).
 * Avoids PostgREST URL length limits and the 1,000-row ceiling even for 3,000-10,000+ IDs.
 *
 * @param {string} table
 * @param {string} selectColumns
 * @param {Array<string|number>} ids
 * @param {number|object} [batchSizeOrOptions=500]
 * @returns {Promise<Array>}
 */
export async function fetchByIdsInBatches(table, selectColumns, ids, batchSizeOrOptions = DEFAULT_ID_BATCH_SIZE) {
  if (!Array.isArray(ids) || ids.length === 0) return []

  const options = typeof batchSizeOrOptions === 'number'
    ? { batchSize: batchSizeOrOptions }
    : (batchSizeOrOptions || {})

  const {
    batchSize = DEFAULT_ID_BATCH_SIZE,
    idColumn = 'id',
    orderColumn = 'id',
    applyFilters = null,
    onProgress = null
  } = options

  const uniqueIds = [...new Set(ids.filter((val) => val !== null && val !== undefined && val !== ''))]
  if (uniqueIds.length === 0) return []

  // Keep `.in()` URL length safe (~36 chars/UUID * 250-500 <= URL limit)
  const safeBatchSize = Math.max(1, Math.min(500, Number(batchSize) || DEFAULT_ID_BATCH_SIZE))
  const allRows = []

  for (let i = 0; i < uniqueIds.length; i += safeBatchSize) {
    const chunkIds = uniqueIds.slice(i, i + safeBatchSize)

    // Use fetchAllPaginated inside each chunk so even non-unique FK lookups (e.g. mistake_bank.question_id)
    // can never be truncated at 1,000 rows!
    const chunkRows = await fetchAllPaginated(
      (client) => {
        let q = client.from(table).select(selectColumns).in(idColumn, chunkIds)
        if (typeof applyFilters === 'function') {
          q = applyFilters(q)
        }
        return q
      },
      {
        pageSize: 1000,
        orderColumn
      }
    )

    allRows.push(...chunkRows)
    onProgress?.({
      fetchedCount: allRows.length,
      processedIds: Math.min(uniqueIds.length, i + chunkIds.length),
      totalIds: uniqueIds.length
    })
  }

  return allRows
}

/**
 * Fetch exact row count from Supabase using `{ count: 'exact', head: true }`
 * without downloading row payloads into browser memory.
 *
 * Accepts either:
 *  - a query builder factory `(client) => client.from(...).select('id', { count: 'exact', head: true })...`
 *  - OR a table name + optional filter callback via `getTableExactCount(table, applyFilters)`
 */
export async function getExactCount(buildQuery) {
  const { count, error } = await buildQuery(supabase)
  if (error) throw error
  return count || 0
}

export async function getTableExactCount(table, applyFilters = null) {
  return getExactCount((client) => {
    let q = client.from(table).select('id', { count: 'exact', head: true })
    if (typeof applyFilters === 'function') {
      q = applyFilters(q)
    }
    return q
  })
}

/**
 * Execute write/mutation operations (`insert`, `upsert`, `update`, `delete`) in safe batches
 * so large submissions (e.g. 2,000+ rows) never exceed payload or URL limits.
 */
export async function runInBatches(items, batchSize, workerFn) {
  if (!Array.isArray(items) || items.length === 0) return
  const safeSize = Math.max(1, Number(batchSize) || 200)
  for (let i = 0; i < items.length; i += safeSize) {
    await workerFn(items.slice(i, i + safeSize), i)
  }
}
