/**
 * SINGLE SOURCE OF TRUTH for all branch contact data.
 * Do NOT hardcode phone numbers, WhatsApp links, or map URLs anywhere else.
 *
 * Source doc: docs/branches.md
 * Last verified: 2026-04-27 (live site audit)
 *
 * Warning: Phone numbers here are for build-time constants (wa.me links, schema.org).
 *     Runtime values (used in order flow) are fetched from Supabase branches table
 *     to allow updates without a redeploy.
 */

export type BranchId = 'riffa' | 'qallali' | 'badi'

export interface Branch {
  id: BranchId
  nameAr: string
  nameEn: string
  addressAr: string
  addressEn: string
  cityAr: string
  cityEn: string
  phone: string
  whatsapp: string
  waLink: string
  /** Google Maps URL — to be confirmed by restaurant */
  mapsUrl: string | null
  /** Branch GPS coordinates — used for driver distance/ETA calculations */
  latitude:  number | null
  longitude: number | null
  hours: {
    ar: string
    en: string
    opens: string  // HH:mm (24h)
    closes: string // HH:mm (24h) — "01:00" = next day
  }
  delivery: boolean
  dineIn: boolean
  status: 'active' | 'planned'
}

export const BRANCHES: Record<BranchId, Branch> = {
  riffa: {
    id: 'riffa',
    nameAr: 'فرع الرفاع',
    nameEn: 'Riffa Branch',
    addressAr: 'منطقة الحجيات، الرفاع، البحرين',
    addressEn: 'Al-Hijiyat Area, Riffa, Bahrain',
    cityAr: 'الرفاع',
    cityEn: 'Riffa',
    phone: '+97317131413',
    whatsapp: '+97317131413',
    waLink: 'https://wa.me/97317131413',
    mapsUrl: 'https://maps.app.goo.gl/J3CMk9AnhSqSBsGQA',
    latitude: 26.0667,
    longitude: 50.5577,
    hours: {
      ar: 'يومياً ٧:٠٠م – ١:٠٠ص',
      en: 'Daily 7:00 PM – 1:00 AM',
      opens: '19:00',
      closes: '01:00',
    },
    delivery: true,
    dineIn: true,
    status: 'active',
  },

  qallali: {
    id: 'qallali',
    nameAr: 'فرع قلالي',
    nameEn: 'Qallali Branch',
    addressAr: 'الشارع الرئيسي، قلالي، البحرين',
    addressEn: 'Main Street, Qallali, Bahrain',
    cityAr: 'المحرق',
    cityEn: 'qallali',
    phone: '+97317131213',
    whatsapp: '+97317131213',
    waLink: 'https://wa.me/97317131213',
    mapsUrl: 'https://maps.app.goo.gl/cVsYGpibZxy2rPEV8',
    latitude: 26.2172,
    longitude: 50.5865,
    hours: {
      ar: 'يومياً ١٢:٠٠م – ١:٠٠ص',
      en: 'Daily 12:00 PM – 1:00 AM',
      opens: '12:00',
      closes: '01:00',
    },
    delivery: true,
    dineIn: true,
    status: 'active',
  },

  badi: {
    id: 'badi',
    nameAr: 'فرع البديع',
    nameEn: 'Al-Badi\' Branch',
    addressAr: 'قريباً',
    addressEn: 'Coming Soon',
    cityAr: 'البديع',
    cityEn: 'Al-Badi\'',
    phone: '',
    whatsapp: '',
    waLink: '',
    mapsUrl: null,
    latitude: null,
    longitude: null,
    hours: {
      ar: 'قريباً',
      en: 'Coming Soon',
      opens: '00:00',
      closes: '00:00',
    },
    delivery: false,
    dineIn: false,
    status: 'planned',
  },
} as const

export const BRANCH_LIST = Object.values(BRANCHES)

/** Default branch for homepage hero CTA and pre-filled wa.me links */
export const DEFAULT_BRANCH_ID: BranchId = 'riffa'
export const DEFAULT_BRANCH = BRANCHES[DEFAULT_BRANCH_ID]
export const WHATSAPP_BASE_URL = 'https://wa.me'

export const GENERAL_CONTACT = {
  email: 'info@kahramanat.com',
  website: 'https://kahramanat.com',
  instagram: 'https://www.instagram.com/kahramanat_b',
  tiktok: 'https://www.tiktok.com/@kahramanat_b',
  snapchat: '@kahramanat_b',
  facebook: 'https://www.facebook.com/kahramanat1',
} as const

/**
 * Build a wa.me link with a pre-filled bilingual order message.
 * Used in Phase 1 before WhatsApp Business API (Phase 6).
 */
export function buildWaOrderLink(branchId: BranchId, locale: 'ar' | 'en' = 'ar'): string {
  const branch = BRANCHES[branchId]
  const message =
    locale === 'ar'
      ? `مرحباً، أريد الطلب من ${branch.nameAr}`
      : `Hello, I'd like to order from ${branch.nameEn}`
  return `${branch.waLink}?text=${encodeURIComponent(message)}`
}

export function buildWaLinkForPhone(phone: string, message?: string): string {
  const normalizedPhone = phone.replace(/\D/g, '')
  return message
    ? `${WHATSAPP_BASE_URL}/${normalizedPhone}?text=${encodeURIComponent(message)}`
    : `${WHATSAPP_BASE_URL}/${normalizedPhone}`
}
