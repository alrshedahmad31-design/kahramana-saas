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
  /** Commercial district / area name — use for display and schema:addressLocality */
  cityAr: string
  cityEn: string
  /** Administrative governorate — use for schema:addressRegion only */
  governorateAr?: string
  governorateEn?: string
  phone: string
  whatsapp: string
  waLink: string
  /** Google Maps URL — used for clickable "Open in Maps" links */
  mapsUrl: string | null
  /** Official Google Maps embed src for iframe (pb= format) */
  embedSrc: string | null
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
    governorateAr: 'المحافظة الجنوبية',
    governorateEn: 'Southern Governorate',
    phone: '+97317131413',
    whatsapp: '+97317131413',
    waLink: 'https://wa.me/97317131413',
    mapsUrl: 'https://maps.google.com/?q=26.1358149,50.5748089',
    embedSrc: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3581.86897133457!2d50.5748089!3d26.1358149!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3e49ade2308e955b%3A0xdf55f7b304a4e8c9!2z2YXYt9i52YUg2YPZh9ix2YXYp9mG2Kkg2KjYutiv2KfYrw!5e0!3m2!1sar!2sbh!4v1777791402552!5m2!1sar!2sbh',
    latitude: 26.1366914,
    longitude: 50.5593132,
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
    cityAr: 'قلالي',
    cityEn: 'Qallali',
    governorateAr: 'محافظة المحرق',
    governorateEn: 'Muharraq Governorate',
    phone: '+97317131213',
    whatsapp: '+97317131213',
    waLink: 'https://wa.me/97317131213',
    mapsUrl: 'https://maps.google.com/?q=26.27678350000001,50.657156999999984',
    embedSrc: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3577.533999785344!2d50.657156999999984!3d26.27678350000001!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3e49a7003470c54d%3A0xb9fec402d4532c00!2sKahramant%20Baghdad%20restaurant!5e0!3m2!1sar!2sbh!4v1777786101591!5m2!1sar!2sbh',
    latitude: 26.269074,
    longitude: 50.6433552,
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
    embedSrc: null,
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

/**
 * Canonical production site URL for SEO, schema.org, sitemap, and OG metadata.
 * Canonicals must never point at a vercel.app preview domain.
 */
export const SITE_URL = 'https://kahramanat.com'

export const GENERAL_CONTACT = {
  email: 'info@kahramanat.com',
  website: SITE_URL,
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
