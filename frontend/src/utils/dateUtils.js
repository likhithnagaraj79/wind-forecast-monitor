export const MIN_DATE = '2025-01-01'
export const MIN_DATETIME_LOCAL = '2025-01-01T00:00'

// Current UTC time as YYYY-MM-DDTHH:MM (for datetime-local default value)
export function nowUTCDatetimeLocal() {
  return new Date().toISOString().slice(0, 16)
}

// N days ago in UTC as YYYY-MM-DDTHH:MM (for datetime-local default value)
export function daysAgoDatetimeLocal(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 16)
}

// Format ISO string for chart tooltip — UTC time
export function formatDateTime(isoStr) {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    const pad = (n) => String(n).padStart(2, '0')
    return (
      `${pad(d.getUTCDate())} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]} ` +
      `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
    )
  } catch {
    return isoStr
  }
}

// HH:MM tick for x-axis; prepends dd/mm when it's exactly midnight
export function formatDateTick(isoStr) {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    const hh = String(d.getUTCHours()).padStart(2, '0')
    const mm = String(d.getUTCMinutes()).padStart(2, '0')
    if (hh === '00' && mm === '00') {
      const day = String(d.getUTCDate()).padStart(2, '0')
      const mon = String(d.getUTCMonth() + 1).padStart(2, '0')
      return `${day}/${mon} 00:00`
    }
    return `${hh}:${mm}`
  } catch {
    return isoStr
  }
}

// How many milliseconds between two ISO / YYYY-MM-DDTHH:MM strings
export function msBetween(start, end) {
  return new Date(end).getTime() - new Date(start).getTime()
}
