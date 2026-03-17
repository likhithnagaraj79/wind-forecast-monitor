import { Router } from 'express'
import {
  validateQueryDates,
  validateHorizon,
  toStartISO,
  toEndISO,
} from '../utils/dateUtils.js'
import { countActualsInRange } from '../models/actuals.model.js'
import { getForecastsForRange, countForecastsInRange } from '../models/forecasts.model.js'
import { ensureActuals, ensureForecasts, buildCombinedData } from '../services/forecast.service.js'

const router = Router()

// GET /api/actual-generation?start=...&end=...
// Returns half-hourly wind actuals for the range (fetches from BMRS if not cached).
// Accepts YYYY-MM-DD or YYYY-MM-DDTHH:MM for start/end.
router.get('/actual-generation', async (req, res) => {
  const { start, end } = req.query
  const dateErr = validateQueryDates(start, end)
  if (dateErr) return res.status(400).json(dateErr)

  try {
    const actuals = await ensureActuals(start, end)
    res.json({ count: actuals.length, data: actuals })
  } catch (e) {
    console.error('[/actual-generation]', e.message)
    res.status(502).json({ error: 'Failed to fetch generation data', detail: e.message })
  }
})

// GET /api/forecast-generation?start=...&end=...&horizon=4
// Returns forecasts (their startTime in the range), fetching from BMRS if needed.
router.get('/forecast-generation', async (req, res) => {
  const { start, end, horizon = '4' } = req.query
  const dateErr = validateQueryDates(start, end)
  if (dateErr) return res.status(400).json(dateErr)
  const horizonErr = validateHorizon(horizon)
  if (horizonErr) return res.status(400).json(horizonErr)

  try {
    await ensureForecasts(start, end)
    const startISO = toStartISO(start)
    const endISO = toEndISO(end)
    const forecasts = getForecastsForRange(startISO, endISO)
    res.json({ count: forecasts.length, horizon: Number(horizon), data: forecasts })
  } catch (e) {
    console.error('[/forecast-generation]', e.message)
    res.status(502).json({ error: 'Failed to fetch forecast data', detail: e.message })
  }
})

// GET /api/combined-data?start=...&end=...&horizon=4
// Main endpoint — actuals paired with the best matching forecast at the given horizon.
// Each record: { start_time, actual_generation, forecast_generation, has_forecast }
router.get('/combined-data', async (req, res) => {
  const { start, end, horizon = '4' } = req.query
  const dateErr = validateQueryDates(start, end)
  if (dateErr) return res.status(400).json(dateErr)
  const horizonErr = validateHorizon(horizon)
  if (horizonErr) return res.status(400).json(horizonErr)

  try {
    const [actuals] = await Promise.all([
      ensureActuals(start, end),
      ensureForecasts(start, end),
    ])

    const startISO = toStartISO(start)
    const endISO = toEndISO(end)
    const allForecasts = getForecastsForRange(startISO, endISO)

    const combined = buildCombinedData(actuals, Number(horizon), allForecasts)
    const forecastCount = combined.filter((r) => r.has_forecast).length

    res.json({
      count: combined.length,
      horizon: Number(horizon),
      forecast_coverage_pct: combined.length > 0
        ? Math.round((forecastCount / combined.length) * 100)
        : 0,
      data: combined,
    })
  } catch (e) {
    console.error('[/combined-data]', e.message)
    res.status(502).json({ error: 'Failed to fetch data', detail: e.message })
  }
})

// GET /api/data-availability?start=...&end=...
// Checks what's already in the DB — no external fetch.
router.get('/data-availability', (req, res) => {
  const { start, end } = req.query
  const dateErr = validateQueryDates(start, end)
  if (dateErr) return res.status(400).json(dateErr)

  const startISO = toStartISO(start)
  const endISO = toEndISO(end)

  const actualsCount = countActualsInRange(startISO, endISO)
  const forecastsCount = countForecastsInRange(startISO, endISO)

  res.json({
    range: { start, end },
    actuals: { count: actualsCount, available: actualsCount > 0 },
    forecasts: { count: forecastsCount, available: forecastsCount > 0 },
  })
})

export default router
