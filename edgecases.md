# Edge Cases Handled

This document describes every edge case handled beyond the minimum requirements of the brief. Grouped by concern, with the relevant file and code reference for each.

---

## 1. API Reliability

### Retry with exponential backoff
**File:** `backend/src/services/bmrs.service.js` — `fetchWithRetry()`

The Elexon BMRS API intermittently rate-limits (HTTP 429) and returns transient server errors (5xx). Rather than failing immediately, the client retries up to 3 times:
- **429 Rate limited** — waits 5s, 10s, 15s (linear backoff to respect the limit)
- **5xx Server error** — waits 1s, 2s, 4s (exponential backoff)
- **4xx (except 429)** — not retried; these indicate a bad request that won't improve with retrying

The spec simply says "call the API."

### 30-second request timeout
**File:** `backend/src/services/bmrs.service.js`

Every Axios request includes `timeout: 30000`. Without this the app hangs indefinitely on a slow or unresponsive BMRS endpoint, blocking the Express thread.

### Unexpected response shape guard
**File:** `backend/src/services/bmrs.service.js`

After each BMRS call we check `Array.isArray(data)`. If the API returns an error object or HTML (e.g. a Cloudflare error page), we throw a descriptive error immediately rather than silently returning an empty array.

---

## 2. Data Correctness

### Resolution mismatch — WINDFOR (1h) vs FUELHH (30min)
**File:** `backend/src/services/forecast.service.js` — `toHourKey()`

FUELHH actuals are published at 30-minute resolution (`:00` and `:30`), but WINDFOR forecasts use 1-hour resolution (`:00` only). Without normalisation, every `:30` actual would silently get no forecast, halving forecast coverage.

`toHourKey()` floors any timestamp to the `:00` boundary so both `:00` and `:30` actuals map to the same hourly forecast key.

### Negative horizon filter
**File:** `backend/src/services/bmrs.service.js` — `fetchWindForecasts()`

BMRS occasionally publishes correction records where `publishTime > startTime`, giving a negative horizon. These are not real forecasts — they are retro-corrections applied after the fact. We discard any record where `horizon < 0`.

### Horizon cap at 48 hours
**File:** `backend/src/services/bmrs.service.js` — `fetchWindForecasts()`

The brief says to consider only forecasts with a 0–48h horizon. Records outside this window are filtered during ingestion so they never enter the database.

### Defensive `fuelType=WIND` re-filter
**File:** `backend/src/services/bmrs.service.js` — `fetchActualGeneration()`

We send `fuelType=WIND` as a query parameter, but we also filter again after the response. The BMRS API has been observed returning mixed fuel types in some responses. Without the post-filter, non-wind generation (gas, solar, etc.) could corrupt the actuals.

### Upsert instead of insert
**File:** `backend/src/models/actuals.model.js`, `forecasts.model.js`

Both models use `INSERT OR REPLACE` (SQLite upsert). If the same date range is requested again (e.g. cron refresh, user re-opens the same view), rows are updated rather than duplicated. Without this, repeated fetches would grow the database unboundedly and return duplicate data points.

### Forecast publish window extended by 48h
**File:** `backend/src/services/forecast.service.js` — `ensureForecasts()`

When fetching forecasts for a date range `[start, end]`, we fetch forecasts published from `start − 48h` to `end`. This ensures that forecasts made up to 48 hours before the range starts are available for the horizon-matching logic. Without this, short-horizon forecasts for the first day of the range would be missing.

---

## 3. Input Validation (Backend)

**File:** `backend/src/utils/dateUtils.js` — `validateQueryDates()`, `validateHorizon()`

All validation happens server-side before any DB or BMRS call is made.

| Check | Why |
|---|---|
| `start` and `end` required | Prevents a DB full-table scan or an unconstrained BMRS request |
| `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM` format enforced | Accepts both date pickers and datetime pickers; rejects garbage input |
| `start >= 2025-01-01` | WINDFOR data only exists from Jan 2025; earlier requests would always return nothing |
| `end <= today` | The API has no future actuals; requesting them wastes an external API call |
| `start <= end` | Prevents inverted ranges that would return 0 records |
| Max 366-day range | A multi-year range would pull a huge BMRS response and likely time out. The 1-year cap keeps requests safe |
| `horizon` between 0 and 48 | Matches the brief's stated range; out-of-range values would always yield 0 matched forecasts |

---

## 4. Horizon Matching Logic

**File:** `backend/src/services/forecast.service.js` — `buildCombinedData()`

### In-memory O(1) lookup
All forecasts for the range are loaded in one DB query. They are grouped into a `Map` keyed by hourly `startTime`. Each actual then does a single Map lookup — O(1) — rather than a DB query per point. This avoids N+1 queries on long date ranges (e.g. 30 days = 1,440 actuals).

### Most-recent valid forecast wins
Among all forecasts that satisfy `publish_time <= actual_start_time − horizon_hours`, we select the one with the **latest** `publish_time`. This is the forecast with the most information available at that horizon — identical to how a real operator would choose.

### `has_forecast` flag per point
Every output record carries `has_forecast: true/false`. The frontend uses this to render actual gaps in the forecast line rather than connecting unrelated points with a misleading straight line.

---

## 5. Frontend UX

### AbortController on fetch
**File:** `frontend/src/hooks/useWindData.js`, `useMultiHorizonData.js`

Every API request is tied to an `AbortController`. When the user changes the date range or horizon before the response arrives, the in-flight request is cancelled. Without this, a slow response from a previous range could overwrite the results for the current range.

### 500ms debounced horizon slider
**File:** `frontend/src/App.jsx` — `handleHorizonChange()`

Dragging the slider from 4 to 24 fires ~20 intermediate values. Each would trigger a full API round-trip. The 500ms debounce fires only once, on the final resting value.

### Downsampling to 2,000 points
**File:** `frontend/src/components/WindChart.jsx`

A 30-day range has 2,880 half-hour points × 2 lines = 5,760 SVG elements. Recharts re-renders synchronously and becomes visibly sluggish above ~5,000 points. We thin the dataset to 2,000 points while preserving shape (peaks, troughs, and ramp rates are retained).

### Forecast coverage warning at < 80%
**File:** `frontend/src/components/WindChart.jsx`

At high horizons (e.g. 48h) BMRS has sparse forecast data, so the green line appears broken. Without a warning, users may think the app is broken. The banner reads "Forecast coverage: X% — sparse at this horizon" so the cause is clear.

### Active preset button state
**File:** `frontend/src/components/DateTimePicker.jsx`

Preset buttons (1d / 7d / 30d) are visually highlighted when active. If the user manually edits either date field, the active state is cleared — the preset no longer applies.

### Graceful empty and loading states
**File:** `frontend/src/components/WindChart.jsx`

Three distinct states are rendered: loading spinner (request in progress), empty state (request succeeded but returned 0 records), and the chart (data present). Without this, all three states would show a blank area, giving no feedback.

### Error banner + Retry button
**File:** `frontend/src/App.jsx`

When the backend returns an error, the error message is surfaced in a visible banner with a Retry button. The backend's `detail` field is included so the user sees a meaningful message (e.g. "end date cannot be in the future") rather than a generic failure.

### Last updated timestamp
**File:** `frontend/src/App.jsx` — `formatLastUpdated()`

The stats bar shows the UTC timestamp of the last successful data load. Users working across sessions can see at a glance how fresh the chart data is.

### CSV export
**File:** `frontend/src/App.jsx` — `exportCSV()`

One-click download of the currently displayed data as a CSV (`start_time`, `actual_MW`, `forecast_Nh_MW`, `error_MW`). The button is disabled when there is no data or a fetch is in progress.

---

## 6. Background Data Freshness

**File:** `backend/src/server.js`

A `node-cron` job runs every 6 hours (configurable via `CRON_SCHEDULE` env var). It refreshes actuals and forecasts for the last 2 days — keeping the chart current without requiring a manual cache-bust.

Cron failures are caught and logged but do not crash the server. The most recent successfully cached data continues to be served.

---

## 7. CORS Security

**File:** `backend/src/server.js`

Rather than `Access-Control-Allow-Origin: *`, the CORS policy allows:
- Any `*.vercel.app` subdomain (covers Vercel preview deployments, which each get a unique subdomain)
- `http://localhost:*` for local development
- Any additional origins listed in `FRONTEND_URL` env var (comma-separated)

All other origins receive a `403`. This prevents other sites from making cross-origin requests to the backend.

---

## 8. Analysis Notebooks

**Files:** `analysis/notebooks/`

### MAPE suppressed for near-zero actuals
**File:** `forecast_error_analysis.ipynb`

MAPE = `|error| / actual × 100`. When `actual` is near zero (calm period), MAPE inflates to thousands of percent and is statistically meaningless. MAPE is only computed when `actual > 100 MW`.

### Q-Q plot sampled for performance
**File:** `forecast_error_analysis.ipynb`

The full dataset can be millions of merged pairs. The Q-Q normality plot samples up to 5,000 points (random seed fixed for reproducibility) to keep rendering fast while still being statistically representative.

### P10 chosen over Gaussian lower bound
**File:** `wind_reliability_analysis.ipynb`

The reliability recommendation uses the P10 percentile (exceeded 90% of the time) rather than `mean − 2σ`. Wind generation is right-skewed — a Gaussian lower bound underestimates tail risk. The P10 is distribution-free and is the IEC 61400-12 industry standard for wind resource assessment.
