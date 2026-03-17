import { useMemo } from 'react'

function computeMetrics(data) {
  if (!data?.length) return null
  const pairs = data.filter(
    (d) => d.actual_generation != null && d.forecast_generation != null
  )
  if (pairs.length === 0) return null

  const errors = pairs.map((d) => d.forecast_generation - d.actual_generation)
  const absErrors = errors.map(Math.abs)

  const mae = absErrors.reduce((s, v) => s + v, 0) / pairs.length
  const rmse = Math.sqrt(errors.reduce((s, v) => s + v * v, 0) / pairs.length)
  const bias = errors.reduce((s, v) => s + v, 0) / pairs.length

  // P10 Accuracy: % of periods where |error| ≤ 10% of actual generation
  const within10pct = pairs.filter(
    (d, i) => absErrors[i] <= 0.1 * Math.max(d.actual_generation, 1)
  ).length
  const p10Coverage = (within10pct / pairs.length) * 100

  const coverage = (pairs.length / data.length) * 100

  return {
    mae,
    rmse,
    bias,
    p10Coverage,
    coverage,
    pairedCount: pairs.length,
    totalCount: data.length,
  }
}

function KPICard({ label, value, unit, hint, color }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color: color || '#1e293b' }}>
        {value}
        <span className="kpi-unit">{unit}</span>
      </div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  )
}

export function ErrorMetrics({ data, horizon }) {
  const m = useMemo(() => computeMetrics(data), [data])
  if (!m) return null

  const biasSign = m.bias >= 0 ? '+' : ''
  const biasColor =
    Math.abs(m.bias) < 50
      ? '#148a38'
      : Math.abs(m.bias) < 150
      ? '#d97706'
      : '#dc2626'
  const biasHint = m.bias > 5 ? 'overforecast' : m.bias < -5 ? 'underforecast' : 'near-neutral'

  return (
    <div className="metrics-section">
      <h2 className="metrics-title">
        Forecast Error Metrics &mdash; {horizon}h horizon
      </h2>
      <div className="kpi-grid">
        <KPICard
          label="MAE"
          value={Math.round(m.mae).toLocaleString()}
          unit=" MW"
          hint="Mean absolute error"
        />
        <KPICard
          label="RMSE"
          value={Math.round(m.rmse).toLocaleString()}
          unit=" MW"
          hint="Root mean square error"
        />
        <KPICard
          label="Bias"
          value={`${biasSign}${Math.round(m.bias).toLocaleString()}`}
          unit=" MW"
          hint={biasHint}
          color={biasColor}
        />
        <KPICard
          label="P10 Accuracy"
          value={Math.round(m.p10Coverage)}
          unit="%"
          hint="Forecasts within ±10% of actual"
          color={m.p10Coverage >= 40 ? '#148a38' : '#d97706'}
        />
        <KPICard
          label="Coverage"
          value={Math.round(m.coverage)}
          unit="%"
          hint={`${m.pairedCount.toLocaleString()} of ${m.totalCount.toLocaleString()} periods`}
        />
      </div>
    </div>
  )
}
