import { useState, useRef, useEffect } from 'react'
import { DateTimePicker } from './components/DateTimePicker.jsx'
import { ForecastHorizonSlider } from './components/ForecastHorizonSlider.jsx'
import { WindChart } from './components/WindChart.jsx'
import { ErrorMetrics } from './components/ErrorMetrics.jsx'
import { ResidualChart } from './components/ResidualChart.jsx'
import { MultiHorizonChart } from './components/MultiHorizonChart.jsx'
import { useWindData } from './hooks/useWindData.js'
import { useMultiHorizonData } from './hooks/useMultiHorizonData.js'
import { daysAgoDatetimeLocal, nowUTCDatetimeLocal } from './utils/dateUtils.js'
import './App.css'

const DEFAULT_HORIZON = 4

function formatLastUpdated(date) {
  if (!date) return null
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${pad(date.getUTCDate())} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][date.getUTCMonth()]} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`
  )
}

function exportCSV(data, horizon, start, end) {
  if (!data?.length) return
  const headers = ['start_time', 'actual_MW', `forecast_${horizon}h_MW`, 'error_MW']
  const rows = data.map((d) => [
    d.start_time,
    d.actual_generation ?? '',
    d.forecast_generation ?? '',
    d.actual_generation != null && d.forecast_generation != null
      ? (d.forecast_generation - d.actual_generation).toFixed(1)
      : '',
  ])
  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `wind_data_${horizon}h_${start.slice(0, 10)}_${end.slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function App() {
  const [dateRange, setDateRange] = useState({
    start: daysAgoDatetimeLocal(30),
    end: nowUTCDatetimeLocal(),
  })

  const [horizon, setHorizon] = useState(DEFAULT_HORIZON)
  const [debouncedHorizon, setDebouncedHorizon] = useState(DEFAULT_HORIZON)
  const horizonTimerRef = useRef(null)

  const [compareMode, setCompareMode] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  function handleHorizonChange(val) {
    setHorizon(val)
    clearTimeout(horizonTimerRef.current)
    horizonTimerRef.current = setTimeout(() => setDebouncedHorizon(val), 500)
  }

  const { data, loading, error, refetch } = useWindData(
    dateRange.start,
    dateRange.end,
    debouncedHorizon
  )

  const {
    data: multiData,
    loading: multiLoading,
    error: multiError,
  } = useMultiHorizonData(dateRange.start, dateRange.end, compareMode)

  // Track when data was last refreshed
  useEffect(() => {
    if (data && !loading) setLastUpdated(new Date())
  }, [data, loading])

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="header-brand">
            <img src="/REint_green-1.webp" alt="REint AI logo" className="header-logo" />
            <div className="header-titles">
              <h1>Wind Forecast Monitor</h1>
              <p className="subtitle">GB wind generation — actual vs forecast (BMRS data)</p>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">
        {/* Controls */}
        <div className="controls-card">
          <DateTimePicker
            start={dateRange.start}
            end={dateRange.end}
            onChange={setDateRange}
          />
          <div className="controls-divider" />
          <ForecastHorizonSlider
            value={horizon}
            onChange={handleHorizonChange}
            disabled={compareMode}
          />
          <div className="controls-actions">
            <button
              className={`mode-btn ${compareMode ? 'mode-btn--active' : ''}`}
              onClick={() => setCompareMode((v) => !v)}
              title="Toggle multi-horizon comparison view"
            >
              {compareMode ? 'Single Horizon' : 'Compare Horizons'}
            </button>
            <button
              className="export-btn"
              onClick={() =>
                exportCSV(data?.data, debouncedHorizon, dateRange.start, dateRange.end)
              }
              disabled={!data?.data?.length || loading}
              title="Download visible data as CSV"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button className="retry-btn" onClick={refetch}>Retry</button>
          </div>
        )}
        {multiError && (
          <div className="error-banner">
            <span>Multi-horizon: {multiError}</span>
          </div>
        )}

        {/* Single Horizon view */}
        {!compareMode && (
          <>
            <section className="chart-card">
              <WindChart
                data={data?.data}
                horizon={debouncedHorizon}
                loading={loading}
              />
            </section>

            {data && !loading && (
              <>
                <ErrorMetrics data={data.data} horizon={debouncedHorizon} />
                <ResidualChart data={data.data} horizon={debouncedHorizon} />
              </>
            )}
          </>
        )}

        {/* Multi-Horizon Compare view */}
        {compareMode && (
          <section className="chart-card">
            <div className="section-title">
              Multi-Horizon Comparison — 4h / 12h / 24h / 48h
            </div>
            <MultiHorizonChart data={multiData} loading={multiLoading} />
          </section>
        )}

        {/* Stats bar */}
        {data && !loading && (
          <div className="stats-bar">
            <span>
              <strong>{data.count.toLocaleString()}</strong> half-hour periods
            </span>
            <span>
              Forecast coverage: <strong>{data.forecast_coverage_pct}%</strong>
            </span>
            {!compareMode && (
              <span>
                Horizon: <strong>{debouncedHorizon}h</strong>
              </span>
            )}
            <span>
              {dateRange.start.replace('T', ' ')} → {dateRange.end.replace('T', ' ')} UTC
            </span>
            {lastUpdated && (
              <span className="stats-updated">
                Last updated: <strong>{formatLastUpdated(lastUpdated)}</strong>
              </span>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
