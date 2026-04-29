export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// 40 km/h average speed for Bahrain urban delivery
export function estimateETA(distanceKm: number): number {
  return Math.ceil((distanceKm / 40) * 60)
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

export function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function mapsDirectionsUrl(destination: string, origin?: string): string {
  const base = 'https://www.google.com/maps/dir/?api=1'
  const dest = `&destination=${encodeURIComponent(destination)}`
  const orig = origin ? `&origin=${encodeURIComponent(origin)}` : ''
  return `${base}${orig}${dest}`
}
