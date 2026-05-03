export const BH_TIMEZONE = 'Asia/Bahrain'

/**
 * Returns current Bahrain time as "HH:mm" (24-hour).
 * Uses formatToParts to avoid the "24:00" edge case present in some ICU versions
 * when using toLocaleTimeString with hour12:false at midnight.
 */
export function getCurrentBHTime(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BH_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())

  const hour   = parts.find((p) => p.type === 'hour')?.value   ?? '00'
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00'

  // Some ICU builds emit "24" for midnight; normalise to "00"
  return `${hour === '24' ? '00' : hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
}

/**
 * Returns true if the branch is currently open in Bahrain time.
 * Handles overnight shifts (e.g. opens 19:00, closes 01:00).
 *
 * @param opens  "HH:mm" 24-hour opening time
 * @param closes "HH:mm" 24-hour closing time
 */
export function isBranchOpen(opens: string | null, closes: string | null): boolean {
  if (!opens || !closes) return false

  const current = getCurrentBHTime()

  // Overnight case: closes before opens (e.g. 19:00 → 01:00)
  if (closes < opens) {
    return current >= opens || current < closes
  }

  return current >= opens && current < closes
}
