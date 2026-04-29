export interface Coordinates {
  lat: number
  lng: number
}

export type UrgencyLevel = 'critical' | 'urgent' | 'normal'

// Haversine — object-based API (complements distance.ts raw-arg API)
export function calculateDistance(from: Coordinates, to: Coordinates): number {
  const R    = 6371
  const dLat = (to.lat - from.lat) * Math.PI / 180
  const dLng = (to.lng - from.lng) * Math.PI / 180
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Traffic-aware ETA — Bahrain peak hours
export function calculateETA(distanceKm: number, now = new Date()): number {
  const h      = now.getHours()
  const isPeak = (h >= 7 && h <= 9) || (h >= 12 && h <= 14) || (h >= 17 && h <= 20)
  return Math.ceil((distanceKm / (isPeak ? 25 : 40)) * 60) + 3
}

// Urgency based on expected delivery time
export function getUrgencyLevel(expectedAt: Date, now = new Date()): UrgencyLevel {
  const mins = (expectedAt.getTime() - now.getTime()) / 60_000
  if (mins < 10) return 'critical'
  if (mins < 20) return 'urgent'
  return 'normal'
}

// Google Maps driving directions deep link
export function mapsNavUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
}

export function fmtDistance(km: number, isRTL: boolean): string {
  if (km < 1) return isRTL ? `${Math.round(km * 1000)} م` : `${Math.round(km * 1000)} m`
  return isRTL ? `${km.toFixed(1)} كم` : `${km.toFixed(1)} km`
}

export function fmtETA(mins: number, isRTL: boolean): string {
  return isRTL ? `${mins} د` : `${mins} min`
}

// Expected delivery time: use DB field or fallback to created_at + 45min
export function resolveExpectedAt(createdAt: string, expectedDeliveryTime: string | null): Date {
  if (expectedDeliveryTime) return new Date(expectedDeliveryTime)
  return new Date(new Date(createdAt).getTime() + 45 * 60_000)
}
