import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchCombinedData } from '../services/api.js'

const HORIZONS = [4, 12, 24, 48]

export function useMultiHorizonData(start, end, enabled) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const fetchData = useCallback(async () => {
    if (!start || !end || !enabled) return

    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    setError(null)

    try {
      const results = await Promise.all(
        HORIZONS.map((h) => fetchCombinedData(start, end, h, abortRef.current.signal))
      )

      // Build a map keyed by start_time; each entry holds actual + 4 forecast columns
      const byTime = {}
      results[0].data.forEach((d) => {
        byTime[d.start_time] = { start_time: d.start_time, actual: d.actual_generation }
      })
      results.forEach((result, i) => {
        const key = `f${HORIZONS[i]}h`
        result.data.forEach((d) => {
          if (byTime[d.start_time]) {
            byTime[d.start_time][key] = d.forecast_generation
          }
        })
      })

      const merged = Object.values(byTime).sort((a, b) =>
        a.start_time.localeCompare(b.start_time)
      )
      setData(merged)
    } catch (e) {
      if (e.name === 'AbortError' || e.name === 'CanceledError') return
      setError(e.message || 'Failed to load multi-horizon data')
    } finally {
      setLoading(false)
    }
  }, [start, end, enabled])

  useEffect(() => {
    fetchData()
    return () => abortRef.current?.abort()
  }, [fetchData])

  return { data, loading, error }
}
