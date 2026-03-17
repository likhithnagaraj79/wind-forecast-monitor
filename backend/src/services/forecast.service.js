import { subtractHours, toStartISO, toEndISO, toDateStr } from '../utils/dateUtils.js'
import { getActualsByDateRange, upsertActuals } from '../models/actuals.model.js'
import { getForecastsForRange, upsertForecasts } from '../models/forecasts.model.js'
import { fetchActualGeneration, fetchWindForecasts } from './bmrs.service.js'

// Ensure actuals are cached for the date range.
// If nothing is in the DB for this range, fetch from BMRS and store.
// BMRS API uses YYYY-MM-DD settlement dates; DB queries use full ISO strings.
export async function ensureActuals(startInput, endInput) {
  const startISO = toStartISO(startInput)
  const endISO = toEndISO(endInput)

  const existing = getActualsByDateRange(startISO, endISO)

  if (existing.length === 0) {
    const records = await fetchActualGeneration(toDateStr(startInput), toDateStr(endInput))
    if (records.length > 0) {
      upsertActuals(records)
    }
    return getActualsByDateRange(startISO, endISO)
  }

  return existing
}

// Ensure forecasts are cached for the date range.
// Fetches forecasts published in [startInput - 48h, endInput] so that all
// possible forecast horizons (0–48h) are covered for every actual.
export async function ensureForecasts(startInput, endInput) {
  const startISO = toStartISO(startInput)
  const endISO = toEndISO(endInput)

  const existing = getForecastsForRange(startISO, endISO)

  if (existing.length === 0) {
    // publishTime window: a forecast for startInput could have been published
    // up to 48 hours earlier — so we go back 48h to cover max horizon
    const publishFrom = subtractHours(startISO, 48)
    const publishTo = endISO

    const records = await fetchWindForecasts(publishFrom, publishTo)
    if (records.length > 0) {
      upsertForecasts(records)
    }
    return getForecastsForRange(startISO, endISO)
  }

  return existing
}

// WINDFOR publishes at 1-hour startTime resolution; FUELHH actuals are 30-min.
// For a :30 actual (e.g. 14:30Z), we look up the :00 forecast (14:00Z) because
// the hourly WINDFOR entry covers both the :00 and :30 half-hour slots.
function toHourKey(isoStr) {
  const d = new Date(isoStr)
  d.setUTCMinutes(0, 0, 0)
  return d.toISOString()
}

// Match each actual to the best forecast at the given horizon.
//
// "Best forecast" for a given startTime T at horizon H = the most recently
// published forecast where:
//   - forecast.start_time targets the same hour as T  (WINDFOR is hourly)
//   - forecast.publish_time <= T - H  (was published at least H hours earlier)
//
// Done in-memory (one DB read for all forecasts, then group + match) to avoid N+1.
export function buildCombinedData(actuals, horizonHours, allForecasts) {
  if (actuals.length === 0) return []

  // Group forecasts by their hourly startTime key for O(1) lookup
  const forecastMap = new Map()
  for (const f of allForecasts) {
    const key = toHourKey(f.start_time)
    if (!forecastMap.has(key)) {
      forecastMap.set(key, [])
    }
    forecastMap.get(key).push(f)
  }

  return actuals.map((actual) => {
    const cutoff = subtractHours(actual.start_time, horizonHours)
    const hourKey = toHourKey(actual.start_time)

    // All forecasts for this hour that were published before the cutoff
    const candidates = (forecastMap.get(hourKey) || []).filter(
      (f) => f.publish_time <= cutoff
    )

    let forecast = null
    if (candidates.length > 0) {
      // pick the most recently published one — it has the most information
      forecast = candidates.reduce((best, curr) =>
        curr.publish_time > best.publish_time ? curr : best
      )
    }

    return {
      start_time: actual.start_time,
      actual_generation: actual.generation,
      forecast_generation: forecast?.generation ?? null,
      forecast_publish_time: forecast?.publish_time ?? null,
      has_forecast: forecast !== null,
    }
  })
}
