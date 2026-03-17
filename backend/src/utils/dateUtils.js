// Date validation and manipulation — plain Date, no external deps

export const MIN_DATE = '2025-01-01' // earliest available BMRS WINDFOR data

// Extract YYYY-MM-DD from any accepted date/datetime string
export function toDateStr(str) {
  return str.slice(0, 10)
}

export function isValidDateOrDatetime(str) {
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(str)) return false
  const iso = str.length === 10 ? `${str}T00:00:00.000Z` : `${str}:00.000Z`
  return !isNaN(new Date(iso).getTime())
}

// Returns an error object { error: string } or null if valid.
// Accepts both YYYY-MM-DD and YYYY-MM-DDTHH:MM formats.
export function validateQueryDates(start, end) {
  if (!start || !end) {
    return { error: 'start and end query params are required (YYYY-MM-DD or YYYY-MM-DDTHH:MM)' }
  }
  if (!isValidDateOrDatetime(start) || !isValidDateOrDatetime(end)) {
    return { error: 'Dates must be YYYY-MM-DD or YYYY-MM-DDTHH:MM format' }
  }
  if (toDateStr(start) < MIN_DATE) {
    return { error: `start cannot be before ${MIN_DATE} — that's when WINDFOR data begins` }
  }
  const todayDateStr = new Date().toISOString().slice(0, 10)
  if (toDateStr(end) > todayDateStr) {
    return { error: 'end date cannot be in the future' }
  }
  if (toStartISO(start) > toEndISO(end)) {
    return { error: 'start must be on or before end' }
  }
  const diffMs = new Date(toEndISO(end)).getTime() - new Date(toStartISO(start)).getTime()
  if (diffMs > 366 * 86400000) {
    return { error: 'Date range cannot exceed 1 year. Try a shorter range.' }
  }
  return null
}

export function validateHorizon(horizonStr) {
  if (horizonStr === undefined || horizonStr === null) {
    return { error: 'horizon query param is required (0–48)' }
  }
  const h = Number(horizonStr)
  if (isNaN(h) || h < 0 || h > 48) {
    return { error: 'horizon must be a number between 0 and 48' }
  }
  return null
}

// Convert input to a start-of-range ISO string (UTC):
//   'YYYY-MM-DD'       → 'YYYY-MM-DDT00:00:00.000Z'
//   'YYYY-MM-DDTHH:MM' → 'YYYY-MM-DDTHH:MM:00.000Z'
export function toStartISO(str) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return `${str}T00:00:00.000Z`
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(str)) return `${str}:00.000Z`
  return new Date(str).toISOString()
}

// Convert input to an end-of-range ISO string (UTC):
//   'YYYY-MM-DD'       → 'YYYY-MM-DDT23:59:59.999Z'
//   'YYYY-MM-DDTHH:MM' → 'YYYY-MM-DDTHH:MM:00.000Z'
export function toEndISO(str) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return `${str}T23:59:59.999Z`
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(str)) return `${str}:00.000Z`
  return new Date(str).toISOString()
}

// Subtract hours from an ISO datetime string, return ISO string
export function subtractHours(isoStr, hours) {
  return new Date(new Date(isoStr).getTime() - hours * 3600000).toISOString()
}

// Add hours to an ISO datetime string, return ISO string
export function addHours(isoStr, hours) {
  return new Date(new Date(isoStr).getTime() + hours * 3600000).toISOString()
}

// Get today's date as YYYY-MM-DD
export function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// Get yesterday's date as YYYY-MM-DD
export function yesterdayStr() {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10)
}
