/**
 * Schema.org JSON-LD builders for Kahramana Baghdad.
 *
 * SAFETY RULES:
 *  - Every value comes from src/constants/contact.ts or src/data/menu.json.
 *  - No invented address, geo, hours, ratings, reviews, awards.
 *  - Only ACTIVE branches appear as full LocalBusiness entries.
 *  - The "planned" branch (Al-Budayi) is published as a marker entity with
 *    name + description only — no phone/address/geo — so Google can pick up
 *    the brand expansion without ranking a non-functional location.
 */

import {
  BRANCH_LIST,
  BRANCHES,
  GENERAL_CONTACT,
  type Branch,
} from '@/constants/contact'

const SITE = GENERAL_CONTACT.website // https://kahramanat.com

type Locale = 'ar' | 'en'

const localized = <T,>(locale: Locale, ar: T, en: T): T =>
  locale === 'ar' ? ar : en

// ── Active vs. planned branches ─────────────────────────────────────────────

const activeBranches = BRANCH_LIST.filter((b) => b.status === 'active')
const plannedBranches = BRANCH_LIST.filter((b) => b.status === 'planned')

// Convert "19:00" / "01:00" to schema.org openingHoursSpecification
function buildOpeningHours(branch: Branch) {
  if (!branch.hours.opens || !branch.hours.closes) return undefined
  return [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
      opens:  branch.hours.opens,
      closes: branch.hours.closes,
    },
  ]
}

// ── LocalBusiness per active branch ────────────────────────────────────────

export function buildBranchLocalBusiness(branch: Branch, locale: Locale) {
  const url = `${SITE}/${locale === 'en' ? 'en/' : ''}branches`

  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': ['Restaurant', 'LocalBusiness'],
    '@id': `${SITE}/#branch-${branch.id}`,
    name: localized(locale, `كهرمانة بغداد - ${branch.nameAr}`, `Kahramana Baghdad - ${branch.nameEn}`),
    alternateName: localized(locale, `Kahramana Baghdad - ${branch.nameEn}`, `كهرمانة بغداد - ${branch.nameAr}`),
    url,
    telephone: branch.phone || undefined,
    servesCuisine: ['Iraqi', 'Middle Eastern', 'عراقي'],
    priceRange: '$$',
    currenciesAccepted: 'BHD',
    paymentAccepted: 'Cash, Credit Card, Benefit',
    address: {
      '@type': 'PostalAddress',
      streetAddress:    localized(locale, branch.addressAr, branch.addressEn),
      addressLocality:  localized(locale, branch.cityAr,    branch.cityEn),
      addressRegion:    localized(locale, branch.cityAr,    branch.cityEn),
      addressCountry:   'BH',
    },
    hasMap: branch.mapsUrl ?? undefined,
    menu: `${SITE}/${locale === 'en' ? 'en/' : ''}menu`,
    openingHoursSpecification: buildOpeningHours(branch),
  }

  if (branch.latitude !== null && branch.longitude !== null) {
    base.geo = {
      '@type': 'GeoCoordinates',
      latitude:  branch.latitude,
      longitude: branch.longitude,
    }
  }

  // Strip undefined values so the JSON-LD output is clean
  return Object.fromEntries(
    Object.entries(base).filter(([, v]) => v !== undefined),
  )
}

// ── Coming-soon branch marker ──────────────────────────────────────────────

export function buildPlannedBranchSchema(branch: Branch, locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE}/#branch-${branch.id}-planned`,
    name: localized(
      locale,
      `كهرمانة بغداد - ${branch.nameAr} (قريباً)`,
      `Kahramana Baghdad - ${branch.nameEn} (Coming Soon)`,
    ),
    description: localized(
      locale,
      'فرع جديد قيد الافتتاح — لم يبدأ تقديم الخدمة بعد.',
      'New branch coming soon — not yet open for service.',
    ),
    address: {
      '@type': 'PostalAddress',
      addressLocality: localized(locale, branch.cityAr, branch.cityEn),
      addressCountry:  'BH',
    },
    url: `${SITE}/${locale === 'en' ? 'en/' : ''}branches`,
  }
}

// ── Organization / Restaurant root for the homepage ────────────────────────

export function buildOrganizationSchema(locale: Locale) {
  const contactPoints = activeBranches.map((b) => ({
    '@type': 'ContactPoint',
    telephone: b.phone,
    contactType: 'customer service',
    areaServed: 'BH',
    availableLanguage: ['Arabic', 'English'],
  }))

  return {
    '@context': 'https://schema.org',
    '@type': ['Restaurant', 'Organization'],
    '@id': `${SITE}/#organization`,
    name: 'كهرمانة بغداد',
    alternateName: 'Kahramana Baghdad',
    url: SITE,
    logo: `${SITE}/assets/brand/logo.svg`,
    image: `${SITE}/assets/brand/og-image.webp`,
    servesCuisine: ['Iraqi', 'Middle Eastern', 'عراقي'],
    priceRange: '$$',
    currenciesAccepted: 'BHD',
    hasMenu: `${SITE}/${locale === 'en' ? 'en/' : ''}menu`,
    contactPoint: contactPoints,
    sameAs: [
      GENERAL_CONTACT.instagram,
      GENERAL_CONTACT.tiktok,
      GENERAL_CONTACT.facebook,
    ].filter(Boolean),
    location: activeBranches.map((b) => ({
      '@id': `${SITE}/#branch-${b.id}`,
    })),
  }
}

// ── Branches page graph (LocalBusiness × N) ────────────────────────────────

export function buildBranchesPageGraph(locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      ...activeBranches.map((b) => buildBranchLocalBusiness(b, locale)),
      ...plannedBranches.map((b) => buildPlannedBranchSchema(b, locale)),
    ],
  }
}

// ── ContactPoints for the contact page ─────────────────────────────────────

export function buildContactPageSchema(locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: localized(
      locale,
      'تواصل معنا — كهرمانة بغداد',
      'Contact Us — Kahramana Baghdad',
    ),
    url: `${SITE}/${locale === 'en' ? 'en/' : ''}contact`,
    inLanguage: locale === 'ar' ? 'ar-BH' : 'en-BH',
    isPartOf: { '@id': `${SITE}/#organization` },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        email: GENERAL_CONTACT.email,
        contactType: 'customer support',
        areaServed: 'BH',
        availableLanguage: ['Arabic', 'English'],
      },
      ...activeBranches.map((b) => ({
        '@type': 'ContactPoint',
        telephone: b.phone,
        contactType: 'reservations',
        areaServed: localized(locale, b.cityAr, b.cityEn),
        availableLanguage: ['Arabic', 'English'],
      })),
    ],
  }
}

// ── BreadcrumbList helpers ─────────────────────────────────────────────────

interface Crumb {
  name: string
  url: string
}

export function buildBreadcrumb(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url.startsWith('http') ? c.url : `${SITE}${c.url}`,
    })),
  }
}

export function buildMenuBreadcrumb(locale: Locale) {
  const prefix = locale === 'en' ? '/en' : ''
  return buildBreadcrumb([
    { name: localized(locale, 'الرئيسية', 'Home'), url: `${prefix}/` },
    { name: localized(locale, 'المنيو',   'Menu'), url: `${prefix}/menu` },
  ])
}

export function buildCategoryBreadcrumb(
  locale: Locale,
  categoryName: string,
  categorySlug: string,
) {
  const prefix = locale === 'en' ? '/en' : ''
  return buildBreadcrumb([
    { name: localized(locale, 'الرئيسية', 'Home'), url: `${prefix}/` },
    { name: localized(locale, 'المنيو',   'Menu'), url: `${prefix}/menu` },
    { name: categoryName, url: `${prefix}/menu/${categorySlug}` },
  ])
}

export function buildDishBreadcrumb(
  locale: Locale,
  categoryName: string,
  categorySlug: string,
  dishName: string,
  dishSlug: string,
) {
  const prefix = locale === 'en' ? '/en' : ''
  return buildBreadcrumb([
    { name: localized(locale, 'الرئيسية', 'Home'), url: `${prefix}/` },
    { name: localized(locale, 'المنيو',   'Menu'), url: `${prefix}/menu` },
    { name: categoryName, url: `${prefix}/menu/${categorySlug}` },
    { name: dishName,     url: `${prefix}/menu/item/${dishSlug}` },
  ])
}

// ── MenuItem / Dish schema ─────────────────────────────────────────────────

interface DishSchemaInput {
  slug:          string
  nameAr:        string
  nameEn:        string
  descriptionAr?: string
  descriptionEn?: string
  imageUrl?:     string
  fromPrice?:    number
  available:     boolean
}

export function buildDishSchema(dish: DishSchemaInput, locale: Locale) {
  const itemUrl = `${SITE}/${locale === 'en' ? 'en/' : ''}menu/item/${dish.slug}`

  const out: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MenuItem',
    name:          localized(locale, dish.nameAr, dish.nameEn),
    alternateName: localized(locale, dish.nameEn, dish.nameAr),
    url: itemUrl,
    inLanguage: locale === 'ar' ? 'ar-BH' : 'en-BH',
    isPartOf: { '@id': `${SITE}/#organization` },
  }

  const description = locale === 'ar' ? dish.descriptionAr : dish.descriptionEn
  if (description) out.description = description

  if (dish.imageUrl) out.image = dish.imageUrl

  if (dish.fromPrice && dish.fromPrice > 0) {
    out.offers = {
      '@type': 'Offer',
      price: dish.fromPrice.toFixed(3),
      priceCurrency: 'BHD',
      availability: dish.available
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: itemUrl,
    }
  }

  return out
}

// ── FAQPage schema (only confirmed answers) ────────────────────────────────

interface FAQ {
  question: string
  answer:   string
}

export function buildFAQSchema(faqs: FAQ[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }
}

// Curated, owner-confirmable FAQ content — derived ONLY from existing copy
// and constants. Update via translations once content is finalized.
export function buildHomepageFAQ(locale: Locale): FAQ[] {
  const riffa   = BRANCHES.riffa
  const qallali = BRANCHES.qallali

  if (locale === 'ar') {
    return [
      {
        question: 'أين يقع مطعم كهرمانة بغداد في البحرين؟',
        answer:
          `لمطعم كهرمانة بغداد فرعان نشطان في البحرين: ${riffa.nameAr} في ${riffa.cityAr}، و${qallali.nameAr} في ${qallali.cityAr}، إضافة إلى فرع البديع قيد الافتتاح قريباً.`,
      },
      {
        question: 'كيف يمكنني الطلب من كهرمانة بغداد؟',
        answer:
          'يمكنك الطلب من خلال موقعنا الإلكتروني، أو عبر واتساب مع الفرع الأقرب إليك، أو من تطبيقي طلبات وكيتا في البحرين.',
      },
      {
        question: 'ما نوع الطعام الذي يقدمه كهرمانة بغداد؟',
        answer:
          'نتخصص في المطبخ العراقي الأصيل: مشاوي الفحم، مسكوف، قوزي، دولمة، تشريب، ومجموعة من الأطباق العراقية التقليدية.',
      },
      {
        question: 'هل يقدم كهرمانة بغداد خدمة تموين المناسبات؟',
        answer:
          'نعم، يقدم كهرمانة بغداد خدمة تموين المناسبات والأعراس في البحرين. يمكنك التواصل معنا عبر صفحة التموين لطلب عرض سعر مخصص.',
      },
      {
        question: 'ما هي أوقات عمل كهرمانة بغداد؟',
        answer:
          `${riffa.nameAr}: ${riffa.hours.ar}. ${qallali.nameAr}: ${qallali.hours.ar}.`,
      },
    ]
  }

  return [
    {
      question: 'Where is Kahramana Baghdad located in Bahrain?',
      answer:
        `Kahramana Baghdad has two active branches in Bahrain: ${riffa.nameEn} in ${riffa.cityEn}, and ${qallali.nameEn} in ${qallali.cityEn}, with an Al-Budayi branch coming soon.`,
    },
    {
      question: 'How can I order from Kahramana Baghdad?',
      answer:
        'You can order through our website, via WhatsApp directly with the branch nearest to you, or through Talabat and Keeta in Bahrain.',
    },
    {
      question: 'What kind of food does Kahramana Baghdad serve?',
      answer:
        'We specialise in authentic Iraqi cuisine: charcoal grills, masgouf, quzi, dolma, tashreeb, and a curated selection of traditional Iraqi dishes.',
    },
    {
      question: 'Does Kahramana Baghdad offer catering?',
      answer:
        'Yes, Kahramana Baghdad offers catering for events and weddings in Bahrain. Visit the Catering page to request a custom quote.',
    },
    {
      question: 'What are Kahramana Baghdad opening hours?',
      answer:
        `${riffa.nameEn}: ${riffa.hours.en}. ${qallali.nameEn}: ${qallali.hours.en}.`,
    },
  ]
}
