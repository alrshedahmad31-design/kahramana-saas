export interface POSSize {
  label:    string
  priceBhd: number
}

export interface POSVariant {
  labelAr:  string
  labelEn:  string
  priceBhd: number
}

export interface POSModifierOption {
  id:             string
  nameAr:         string
  nameEn:         string
  priceModifier:  number
  isAvailable:    boolean
}

export interface POSModifierGroup {
  id:           string
  nameAr:       string
  nameEn:       string
  required:     boolean
  multiSelect:  boolean
  options:      POSModifierOption[]
}

export interface POSItem {
  id:              string
  nameAr:          string
  nameEn:          string
  image:           string
  available:       boolean
  priceBhd:        number | null
  // Pre-computed on the server (NormalizedMenuItem.fromPrice). Used as the
  // display "from" price so the client never re-derives it and risks
  // disagreeing with the SSR HTML.
  fromPriceBhd:    number
  sizes:           POSSize[]
  variants:        POSVariant[]
  modifierGroups:  POSModifierGroup[]
}

/**
 * Pure function to resolve the display "from" price for a POS item.
 * Used in lazy state initializers to prevent hydration mismatch while avoiding CLS.
 */
export function resolveMenuItemPrice(item: POSItem): number {
  if (typeof item.priceBhd === 'number' && item.priceBhd > 0) {
    return item.priceBhd
  }
  
  const prices: number[] = []
  if (item.sizes.length > 0) {
    prices.push(...item.sizes.map((s) => s.priceBhd))
  }
  if (item.variants.length > 0) {
    prices.push(...item.variants.map((v) => v.priceBhd))
  }
  
  if (prices.length > 0) {
    return Math.min(...prices)
  }
  
  return item.fromPriceBhd || 0
}

/** Snapshot of one selected option, persisted into order_items.modifiers JSONB. */
export interface CartModifier {
  group_id:        string
  group_name_ar:   string
  group_name_en:   string
  option_id:       string
  option_name_ar:  string
  option_name_en:  string
  price_modifier:  number
}

export interface POSCategory {
  id:     string
  nameAr: string
  nameEn: string
  items:  POSItem[]
}

export interface POSBranch {
  id:     string
  nameAr: string
  nameEn: string
}

export interface CartLine {
  key:           string
  itemId:        string
  nameAr:        string
  nameEn:        string
  size:          string | null
  variantAr:     string | null
  variantEn:     string | null
  unitPriceBhd:  number
  quantity:      number
  itemNotes:     string
  modifiers:     CartModifier[]
}
