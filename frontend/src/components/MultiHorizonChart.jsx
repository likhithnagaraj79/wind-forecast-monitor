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

const HORIZONS = [
  { key: 'f4h',  label: '4h forecast',  stroke: '#22c55e', dash: '6 3' },
  { key: 'f12h', label: '12h forecast', stroke: '#f59e0b', dash: '6 3' },
  { key: 'f24h', label: '24h forecast', stroke: '#f97316', dash: '6 3' },
  { key: 'f48h', label: '48h forecast', stroke: '#ef4444', dash: '6 3' },
]

function downsample(data, maxPoints = 1500) {
  if (data.length <= maxPoints) return data
  const step = Math.ceil(data.length / maxPoints)
  return data.filter((_, i) => i % step === 0)
}

function fmtMW(v) {
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`
  return `${v}`
}

function MultiTooltip({ active, payload, label }) {
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

export function MultiHorizonChart({ data, loading }) {
  if (loading) {
    return (
      <div className="chart-placeholder-box">
        <div className="loading-spinner" />
        <p>Loading all four horizons — this may take a moment…</p>
      </div>
    )
  }

  if (!data?.length) {
    return (
      <div className="chart-placeholder-box chart-empty">
        <p>No multi-horizon data for this range.</p>
      </div>
    )
  }

  const chartData = downsample(data)

  return (
    <div className="chart-wrapper">
      <p className="downsample-note">
        Shorter horizons (green) are generally more accurate. Each dashed line is a
        different forecast lead time.
      </p>
      <ResponsiveContainer width="100%" height={460}>
        <ComposedChart
          data={chartData}
          margin={{ top: 8, right: 20, left: 10, bottom: 36 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d8" />
          <XAxis
            dataKey="start_time"
            tickFormatter={formatDateTick}
            interval="preserveStartEnd"
            minTickGap={70}
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
            tickFormatter={fmtMW}
          >
            <Label
              value="Power (MW)"
              angle={-90}
              position="insideLeft"
              offset={10}
              style={{ fontSize: 11, fill: '#64748b', textAnchor: 'middle' }}
            />
          </YAxis>
          <Tooltip content={<MultiTooltip />} />
          <Legend
            verticalAlign="top"
            height={36}
            wrapperStyle={{ fontSize: '12px', paddingBottom: '4px' }}
          />
          {/* Actual generation — solid blue, drawn last so it sits on top */}
          {HORIZONS.map(({ key, label, stroke, dash }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={label}
              stroke={stroke}
              strokeDasharray={dash}
              strokeWidth={1.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
          <Line
            type="monotone"
            dataKey="actual"
            name="Actual"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
