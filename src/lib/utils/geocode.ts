/**
 * Free geocoding via Nominatim (OpenStreetMap).
 * No API key required. Rate limit: 1 req/s — safe for server-side order creation.
 *
 * Usage policy: https://operations.osmfoundation.org/policies/nominatim/
 * We comply: server-side only, one request per order, no bulk geocoding.
 */

interface Coords {
  lat: number
  lng: number
}

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  importance: number
}

/**
 * Geocode a Bahraini address (block / road / building) using Nominatim.
 * Returns null silently on any failure — caller should treat as "no coordinates".
 */
export async function geocodeBahrainAddress(params: {
  block:    string | null | undefined
  road:     string | null | undefined
  building: string | null | undefined
}): Promise<Coords | null> {
  const { block, road, building } = params

  // Need at least block + road to form a meaningful query
  if (!block?.trim() || !road?.trim()) return null

  // Build structured query in English — Nominatim handles this better than Arabic shorthand
  const parts: string[] = []
  if (building?.trim()) parts.push(`Building ${building.trim()}`)
  parts.push(`Road ${road.trim()}`)
  parts.push(`Block ${block.trim()}`)
  parts.push('Bahrain')

  const q = parts.join(', ')

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', q)
    url.searchParams.set('format', 'json')
    url.searchParams.set('countrycodes', 'bh')
    url.searchParams.set('limit', '1')
    url.searchParams.set('addressdetails', '0')

    const res = await fetch(url.toString(), {
      headers: {
        // Nominatim policy: must identify the application
        'User-Agent': 'KahramanaBaghdad/1.0 (restaurant delivery app; bahrain)',
        'Accept-Language': 'en',
      },
      // 5-second timeout — don't block order creation if Nominatim is slow
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) return null

    const data: NominatimResult[] = await res.json()
    if (!data.length) return null

    const top = data[0]
    const lat = parseFloat(top.lat)
    const lng = parseFloat(top.lon)

    // Sanity check — Bahrain bounding box
    if (lat < 25.5 || lat > 26.4 || lng < 50.3 || lng > 50.8) return null

    return { lat, lng }
  } catch {
    // Network error, timeout, parse error — fail silently
    return null
  }
}
