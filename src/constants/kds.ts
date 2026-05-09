import { KDSStation, KDSItemStatus } from '@/lib/supabase/custom-types'
import { tokens } from '@/lib/design-tokens'

export const STATION_CONFIG: Partial<Record<KDSStation, {
  icon: string
  color: string
  label: { ar: string; en: string }
}>> = {
  shawarma: {
    icon: '🥙',
    color: tokens.color.gold,
    label: { ar: 'الشاورما', en: 'Shawarma' },
  },
  bakery: {
    icon: '🥖',
    color: tokens.color.kdsOrange,
    label: { ar: 'البيتزا والمعجنات', en: 'Pizza & Pastry' },
  },
  appetizer_drinks: {
    icon: '🥗',
    color: tokens.color.success,
    label: { ar: 'المقبلات والمشروبات', en: 'Starters & Drinks' },
  },
  grill: {
    icon: '🔥',
    color: tokens.color.kdsAmber,
    label: { ar: 'المشاوي', en: 'Grill' },
  },
  main: {
    icon: '🍽️',
    color: tokens.color.kdsBlue,
    label: { ar: 'الأطباق الرئيسية', en: 'Main Dishes' },
  },
}

// Type-safe accessor — always returns a valid config, falling back to 'main'.
export function getStationConfig(station: KDSStation) {
  return STATION_CONFIG[station] ?? STATION_CONFIG['main']!
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
