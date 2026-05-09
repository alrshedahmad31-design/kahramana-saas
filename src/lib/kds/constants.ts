import type { KDSStation } from '@/lib/supabase/custom-types'
import { STATION_CONFIG } from '@/constants/kds'

// STATION_CONFIG (src/constants/kds.ts) is the single source of truth.
// ALL_STATIONS is derived from its keys — do not hardcode this list elsewhere.
export const ALL_STATIONS: KDSStation[] = Object.keys(STATION_CONFIG) as KDSStation[]
