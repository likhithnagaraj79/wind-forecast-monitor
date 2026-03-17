import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Label,
  Cell,
} from 'recharts'
import { formatDateTime, formatDateTick } from '../utils/dateUtils.js'

function ResidualTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const err = payload[0]?.value
  if (err == null) return null
  return (
    <div className="chart-tooltip">
      <p className="tooltip-time">{formatDateTime(label)}</p>
      <p className="tooltip-value" style={{ color: err >= 0 ? '#f97316' : '#2563eb' }}>
        Error: {err >= 0 ? '+' : ''}
        {Math.round(err).toLocaleString()} MW
      </p>
      <p className="tooltip-hint">{err >= 0 ? 'Overforecast' : 'Underforecast'}</p>
    </div>
  )
}

function downsample(data, maxPoints = 1500) {
  if (data.length <= maxPoints) return data
  const step = Math.ceil(data.length / maxPoints)
  return data.filter((_, i) => i % step === 0)
}

function fmtY(v) {
  if (v >= 1000 || v <= -1000) return `${(v / 1000).toFixed(0)}k`
  return `${v}`
}

export function ResidualChart({ data, horizon }) {
  if (!data?.length) return null

  const residuals = data
    .filter((d) => d.actual_generation != null && d.forecast_generation != null)
    .map((d) => ({
      start_time: d.start_time,
      error: parseFloat((d.forecast_generation - d.actual_generation).toFixed(1)),
    }))

  if (residuals.length === 0) return null

  const chartData = downsample(residuals)
  const tickInterval = Math.max(1, Math.floor(chartData.length / 12))

  return (
    <div className="chart-card">
      <div className="residual-title">
        Residuals &mdash; Forecast Error over Time ({horizon}h horizon)
        <span className="residual-legend">
          <span className="residual-dot" style={{ background: '#f97316' }} /> Over
          <span className="residual-dot" style={{ background: '#2563eb', marginLeft: '0.75rem' }} /> Under
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart
          data={chartData}
          margin={{ top: 8, right: 20, left: 10, bottom: 36 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d8" vertical={false} />
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
            width={56}
            tickFormatter={fmtY}
          >
            <Label
              value="Error (MW)"
              angle={-90}
              position="insideLeft"
              offset={10}
              style={{ fontSize: 11, fill: '#64748b', textAnchor: 'middle' }}
            />
          </YAxis>
          <Tooltip content={<ResidualTooltip />} />
          <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 2" />
          <Bar dataKey="error" maxBarSize={6} isAnimationActive={false}>
            {chartData.map((entry, i) => (
              <Cell
                key={`c-${i}`}
                fill={entry.error >= 0 ? '#f97316' : '#2563eb'}
                fillOpacity={0.65}
              />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
