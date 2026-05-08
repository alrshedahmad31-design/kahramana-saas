export interface POSSize {
  label:    string
  priceBhd: number
}

export interface POSVariant {
  labelAr:  string
  labelEn:  string
  priceBhd: number
}

export interface POSItem {
  id:        string
  nameAr:    string
  nameEn:    string
  image:     string
  available: boolean
  priceBhd:  number | null
  sizes:     POSSize[]
  variants:  POSVariant[]
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
}
