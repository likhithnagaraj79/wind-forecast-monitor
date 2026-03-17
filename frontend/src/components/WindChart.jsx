import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Label,
} from 'recharts'
import { formatDateTime, formatDateTick } from '../utils/dateUtils.js'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  // filter out the internal band series from the tooltip
  const visible = payload.filter((p) => p.name !== '__band_low' && p.name !== '__band_diff')
  return (
    <div className="chart-tooltip">
      <p className="tooltip-time">{formatDateTime(label)}</p>
      {visible.map((p) => (
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

// Compute the Nth percentile of an array
function percentile(arr, p) {
  if (!arr.length) return null
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
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
        <p className="empty-hint">
          Try a different date range or check that data is available from Jan 2025.
        </p>
      </div>
    )
  }

  const raw = downsample(data)
  const totalPoints = data.length
  const forecastCount = data.filter((d) => d.has_forecast).length
  const coveragePct = Math.round((forecastCount / totalPoints) * 100)

  // Compute P10 of actual generation — 10th percentile reference line
  const actuals = data
    .filter((d) => d.actual_generation != null)
    .map((d) => d.actual_generation)
  const p10Value = actuals.length > 10 ? Math.round(percentile(actuals, 10)) : null

  // Augment each point with band shading fields (area between actual & forecast)
  const chartData = raw.map((d) => {
    const hasBoth = d.actual_generation != null && d.forecast_generation != null
    return {
      ...d,
      __band_low: hasBoth ? Math.min(d.actual_generation, d.forecast_generation) : null,
      __band_diff: hasBoth
        ? Math.abs(d.actual_generation - d.forecast_generation)
        : null,
    }
  })

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
          Showing {chartData.length.toLocaleString()} of {totalPoints.toLocaleString()}{' '}
          data points for performance.
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
            formatter={(value) => (value.startsWith('__band') ? null : value)}
          />

          {/* Shaded band between actual and forecast */}
          <Area
            type="monotone"
            dataKey="__band_low"
            fill="transparent"
            stroke="none"
            stackId="band"
            legendType="none"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="__band_diff"
            fill="rgba(20, 138, 56, 0.10)"
            stroke="none"
            stackId="band"
            legendType="none"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />

          {/* P10 reference line */}
          {p10Value != null && (
            <ReferenceLine
              y={p10Value}
              stroke="#94a3b8"
              strokeDasharray="4 2"
              strokeWidth={1}
              label={{
                value: `P10: ${p10Value.toLocaleString()} MW`,
                position: 'insideTopRight',
                fontSize: 10,
                fill: '#94a3b8',
              }}
            />
          )}

          <Line
            type="monotone"
            dataKey="actual_generation"
            name="Actual"
            stroke="#2563eb"
            dot={false}
            strokeWidth={1.5}
            connectNulls={false}
            isAnimationActive={false}
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
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
