import { KDSStation, KDSItemStatus } from '@/lib/supabase/custom-types'
import { tokens } from '@/lib/design-tokens'

// Canonical 5-station taxonomy + explicit unassigned queue (migration 093/094).
// Legacy stations (shawarma, bakery, appetizer_drinks, main, fry, salads,
// packing) are intentionally NOT listed here — they only appear on legacy
// in-flight rows and fall through to `unassigned` via getStationConfig().
export const STATION_CONFIG: Partial<Record<KDSStation, {
  icon: string
  color: string
  label: { ar: string; en: string }
}>> = {
  mains: {
    icon: '🥘',
    color: tokens.color.kdsAmber,
    label: { ar: 'الأطباق الرئيسية', en: 'Mains' },
  },
  grill: {
    icon: '🔥',
    color: tokens.color.kdsOrange,
    label: { ar: 'المشاوي', en: 'Grill' },
  },
  shawarma: {
    icon: '🌯',
    color: tokens.color.kdsBlue,
    label: { ar: 'الشاورما والسندويشات', en: 'Shawarma' },
  },
  pizza: {
    icon: '🍕',
    color: tokens.color.gold,
    label: { ar: 'البيتزا والفطائر', en: 'Pizza' },
  },
  cold: {
    icon: '🥗',
    color: tokens.color.success,
    label: { ar: 'المقبلات والحلويات', en: 'Cold' },
  },
  unassigned: {
    icon: '❓',
    color: tokens.color.muted,
    label: { ar: 'غير مُعيَّن', en: 'Unassigned' },
  },
}

// Type-safe accessor — always returns a valid config, falling back to
// 'unassigned' for legacy/unknown stations so the UI never crashes.
export function getStationConfig(station: KDSStation) {
  return STATION_CONFIG[station] ?? STATION_CONFIG['unassigned']!
}

export const ITEM_STATUS_CONFIG: Record<KDSItemStatus, {
  color: string
  label: { ar: string; en: string }
}> = {
  pending: {
    color: tokens.color.muted,
    label: { ar: 'بانتظار التحضير', en: 'Pending' },
  },
  preparing: {
    color: tokens.color.gold,
    label: { ar: 'قيد التحضير', en: 'Preparing' },
  },
  ready: {
    color: tokens.color.success,
    label: { ar: 'جاهز', en: 'Ready' },
  },
  completed: {
    color: tokens.color.text,
    label: { ar: 'مكتمل', en: 'Completed' },
  },
}
