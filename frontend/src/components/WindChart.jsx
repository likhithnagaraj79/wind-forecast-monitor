import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Label,
} from 'recharts'
import { formatDateTime, formatDateTick } from '../utils/dateUtils.js'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p className="tooltip-time">{formatDateTime(label)}</p>
      {payload.map((p) => (
        <p key={p.name} className="tooltip-value" style={{ color: p.color }}>
          {p.name}:{' '}
          {p.value != null ? `${Math.round(p.value).toLocaleString()} MW` : 'No data'}
        </p>
      ))}
    </div>
  )
}

// Thin out dense datasets — recharts handles 2k points fine, >5k gets slow
function downsample(data, maxPoints = 2000) {
  if (data.length <= maxPoints) return data
  const step = Math.ceil(data.length / maxPoints)
  return data.filter((_, i) => i % step === 0)
}

// Format Y-axis ticks: 5000 → "5k", 500 → "500"
function formatMW(v) {
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`
  return `${v}`
}

export function WindChart({ data, horizon, loading }) {
  if (loading) {
    return (
      <div className="chart-placeholder-box">
        <div className="loading-spinner" />
        <p>Fetching wind data — this may take a moment on first load…</p>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="chart-placeholder-box chart-empty">
        <p>No data for this range.</p>
        <p className="empty-hint">Try a different date range or check that data is available from Jan 2025.</p>
      </div>
    )
  }

  const chartData = downsample(data)
  const totalPoints = data.length
  const forecastCount = data.filter((d) => d.has_forecast).length
  const coveragePct = Math.round((forecastCount / totalPoints) * 100)

  // ~12 x-axis ticks maximum
  const tickInterval = Math.max(1, Math.floor(chartData.length / 12))

  return (
    <div className="chart-wrapper">
      {coveragePct < 80 && (
        <div className="coverage-warning">
          Forecast coverage is {coveragePct}% — fewer than 80% of half-hours have a
          forecast at <strong>{horizon}h</strong> horizon. Try a smaller horizon.
        </div>
      )}
      {chartData.length < data.length && (
        <p className="downsample-note">
          Showing {chartData.length.toLocaleString()} of {totalPoints.toLocaleString()} data points for performance.
        </p>
      )}

      <ResponsiveContainer width="100%" height={420}>
        <ComposedChart
          data={chartData}
          margin={{ top: 8, right: 20, left: 10, bottom: 36 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d8" />
          <XAxis
            dataKey="start_time"
            tickFormatter={formatDateTick}
            interval={tickInterval}
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
          >
            <Label
              value="Target Time (UTC)"
              offset={-24}
              position="insideBottom"
              style={{ fontSize: 11, fill: '#64748b' }}
            />
          </XAxis>
          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={formatMW}
          >
            <Label
              value="Power (MW)"
              angle={-90}
              position="insideLeft"
              offset={10}
              style={{ fontSize: 11, fill: '#64748b', textAnchor: 'middle' }}
            />
          </YAxis>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            height={32}
            wrapperStyle={{ fontSize: '13px', paddingBottom: '4px' }}
          />
          <Line
            type="monotone"
            dataKey="actual_generation"
            name="Actual"
            stroke="#2563eb"
            dot={false}
            strokeWidth={1.5}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="forecast_generation"
            name={`Forecast (${horizon}h ahead)`}
            stroke="#148a38"
            strokeDasharray="6 3"
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload } = props
              if (payload.forecast_generation == null) return <g key={`fd-${cx}`} />
              return (
                <circle
                  key={`fd-${cx}`}
                  cx={cx}
                  cy={cy}
                  r={1.5}
                  fill="#148a38"
                  stroke="none"
                />
              )
            }}
            activeDot={{ r: 4, fill: '#148a38' }}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
