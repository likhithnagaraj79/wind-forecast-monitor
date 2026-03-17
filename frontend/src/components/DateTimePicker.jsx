import { useState } from 'react'
import { MIN_DATETIME_LOCAL, nowUTCDatetimeLocal, daysAgoDatetimeLocal } from '../utils/dateUtils.js'

const PRESETS = [
  { label: '6 h',  getDates: () => ({ start: daysAgoDatetimeLocal(0.25), end: nowUTCDatetimeLocal() }) },
  { label: '1 d',  getDates: () => ({ start: daysAgoDatetimeLocal(1),    end: nowUTCDatetimeLocal() }) },
  { label: '7 d',  getDates: () => ({ start: daysAgoDatetimeLocal(7),    end: nowUTCDatetimeLocal() }) },
  { label: '30 d', getDates: () => ({ start: daysAgoDatetimeLocal(30),   end: nowUTCDatetimeLocal() }) },
]

export function DateTimePicker({ start, end, onChange }) {
  const [msg, setMsg] = useState('')
  const [activePreset, setActivePreset] = useState('7 d')

  function handleStartChange(e) {
    const val = e.target.value
    if (val > end) {
      setMsg('Start must be on or before end')
      return
    }
    setMsg('')
    setActivePreset(null)
    onChange({ start: val, end })
  }

  function handleEndChange(e) {
    const val = e.target.value
    const now = nowUTCDatetimeLocal()
    if (val > now) {
      setMsg('End time cannot be in the future')
      return
    }
    if (val < start) {
      setMsg('End must be on or after start')
      return
    }
    setMsg('')
    setActivePreset(null)
    onChange({ start, end: val })
  }

  return (
    <div className="dt-picker">
      <div className="dt-fields">
        <div className="dt-field">
          <span className="dt-label">Start Time (UTC)</span>
          <input
            type="datetime-local"
            value={start}
            min={MIN_DATETIME_LOCAL}
            max={end || nowUTCDatetimeLocal()}
            onChange={handleStartChange}
            className="dt-input"
          />
        </div>
        <div className="dt-field">
          <span className="dt-label">End Time (UTC)</span>
          <input
            type="datetime-local"
            value={end}
            min={start || MIN_DATETIME_LOCAL}
            max={nowUTCDatetimeLocal()}
            onChange={handleEndChange}
            className="dt-input"
          />
        </div>
      </div>
      {msg && <p className="validation-msg">{msg}</p>}
      <div className="preset-buttons">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className={`preset-btn${activePreset === p.label ? ' preset-btn--active' : ''}`}
            onClick={() => { setMsg(''); setActivePreset(p.label); onChange(p.getDates()) }}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
