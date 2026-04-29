export function calcTotalHours(clockIn: string, clockOut: string, breakMins: number): number {
  const ms    = new Date(clockOut).getTime() - new Date(clockIn).getTime()
  const hours = ms / 3_600_000 - breakMins / 60
  return Math.max(0, Math.round(hours * 100) / 100)
}

export function calcOvertimeHours(totalHours: number, dailyLimit = 8): number {
  return Math.max(0, Math.round((totalHours - dailyLimit) * 100) / 100)
}

export function formatHours(h: number): string {
  const whole = Math.floor(h)
  const mins  = Math.round((h - whole) * 60)
  return mins > 0 ? `${whole}h ${mins}m` : `${whole}h`
}

export function formatTimeRange(start: string, end: string): string {
  const fmt = (t: string) => {
    const [hStr, mStr] = t.split(':')
    const h    = parseInt(hStr, 10)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12  = h % 12 || 12
    return `${h12}:${mStr} ${ampm}`
  }
  return `${fmt(start)} – ${fmt(end)}`
}

export function shiftDurationHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const startMins = sh * 60 + sm
  let   endMins   = eh * 60 + em
  if (endMins <= startMins) endMins += 24 * 60 // overnight
  return (endMins - startMins) / 60
}
