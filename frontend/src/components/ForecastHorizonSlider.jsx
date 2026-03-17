export function ForecastHorizonSlider({ value, onChange }) {
  return (
    <div className="horizon-slider">
      <p className="control-label">
        Forecast Horizon: <strong>{value}h</strong>
      </p>
      <div className="slider-row">
        <span className="slider-tick">0h</span>
        <input
          type="range"
          min={0}
          max={48}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="range-input"
          aria-label="Forecast horizon in hours"
        />
        <span className="slider-tick">48h</span>
      </div>
      <p className="horizon-hint">
        Shows the forecast published at least <strong>{value}h</strong> before each half-hour
      </p>
    </div>
  )
}
