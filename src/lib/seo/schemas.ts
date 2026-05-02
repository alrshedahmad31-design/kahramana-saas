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
import type { CategoryWithItems } from '@/lib/menu'

// Resolved at module load from NEXT_PUBLIC_SITE_URL → preview vs prod domain
const SITE = GENERAL_CONTACT.website

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
  const url = `${SITE}/${locale === 'en' ? 'en/' : ''}branches/${branch.id}`

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

// ── WebSite Schema for Search Box ───────────────────────────────────────────
export function buildWebSiteSchema(locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE}/#website`,
    url: SITE,
    name: 'كهرمانة بغداد',
    alternateName: 'Kahramana Baghdad',
    inLanguage: locale === 'ar' ? 'ar-BH' : 'en-BH',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE}/${locale === 'en' ? 'en/' : ''}menu?q={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  }
}

// ── SiteNavigationElement for better Sitelinks ──────────────────────────────
export function buildNavigationSchema(locale: Locale) {
  const prefix = locale === 'en' ? '/en' : ''
  const navItems = [
    { name: localized(locale, 'المنيو', 'Menu'), url: `${prefix}/menu` },
    { name: localized(locale, 'الفروع', 'Branches'), url: `${prefix}/branches` },
    { name: localized(locale, 'من نحن', 'About Us'), url: `${prefix}/about` },
    { name: localized(locale, 'المناسبات', 'Catering'), url: `${prefix}/catering` },
    { name: localized(locale, 'تواصل معنا', 'Contact'), url: `${prefix}/contact` },
  ]

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: localized(locale, 'قائمة التنقل', 'Main Navigation'),
    itemListElement: navItems.map((item, i) => ({
      '@type': 'SiteNavigationElement',
      position: i + 1,
      name: item.name,
      url: `${SITE}${item.url}`
    }))
  }
}

// ── Organization / Restaurant root for the homepage ────────────────────────

export function buildOrganizationSchema(locale: Locale) {
  const primaryBranch = BRANCHES.riffa

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
    description: localized(
      locale,
      'سفير المذاق البغدادي في البحرين. نقدم أشهى الأطباق العراقية الأصيلة والمشاوي على الفحم منذ عام ٢٠١٨.',
      'Ambassador of Baghdadi taste in Bahrain. Serving authentic Iraqi cuisine and charcoal grills since 2018.'
    ),
    url: SITE,
    telephone: primaryBranch.phone,
    foundingDate: '2018',
    address: {
      '@type': 'PostalAddress',
      streetAddress:   localized(locale, primaryBranch.addressAr,  primaryBranch.addressEn),
      addressLocality: localized(locale, primaryBranch.cityAr,     primaryBranch.cityEn),
      addressRegion:   localized(locale, primaryBranch.cityAr,     primaryBranch.cityEn),
      addressCountry:  'BH',
    },
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

  // These should ideally match the keys in messages/{locale}.json home.faq.items
  if (locale === 'ar') {
    return [
      {
        question: 'أين يقع مطعم كهرمانة بغداد في البحرين؟',
        answer:
          `لمطعم كهرمانة بغداد فرعان نشطان في البحرين: ${riffa.nameAr} في ${riffa.cityAr}، و${qallali.nameAr} في ${qallali.cityAr}، إضافة إلى فرع البديع قيد الافتتاح قريباً.`,
      },
      {
        question: 'ما الذي يجعل كهرمانة أفضل مطعم عراقي في البحرين؟',
        answer: 'التزامنا بالتراث العراقي، واستخدام تقنيات الشواء التقليدية على الفحم، والوصفات المتوارثة من أجيال من الطهاة البغداديين، يجعلنا الوجهة الأولى للمذاق العراقي الأصيل في الرفاع وقلالي.'
      },
      {
        question: 'هل يقدم المطعم المسكوف العراقي الأصيل؟',
        answer: 'نعم، نحن نتخصص في سمك المسكوف العراقي الأصيل المحضر بالطريقة التقليدية لضمان نكهة بغداد المدخنة في قلب البحرين.'
      },
      {
        question: 'كيف يمكنني الطلب من كهرمانة بغداد؟',
        answer:
          'يمكنك الطلب من خلال موقعنا الإلكتروني، أو عبر واتساب مع الفرع الأقرب إليك، أو من تطبيقي طلبات وكيتا في البحرين.',
      },
      {
        question: 'هل يقدم كهرمانة بغداد خدمة تموين المناسبات؟',
        answer:
          'نعم، يقدم كهرمانة بغداد خدمات تموين فاخرة للأعراس، والفعاليات، والولائم الخاصة في جميع أنحاء البحرين مع التركيز على الضيافة العراقية الفاخرة.',
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
      question: 'What makes Kahramana the best Iraqi restaurant in Bahrain?',
      answer: 'Our commitment to heritage, using traditional charcoal grilling techniques and recipes passed down by generations of Baghdadi chefs, makes us the destination for authentic Iraqi taste in Riffa and Qallali.'
    },
    {
      question: 'Do you serve authentic Iraqi Masgouf?',
      answer: 'Yes, we specialize in authentic Iraqi Masgouf fish, prepared using traditional techniques to ensure the smoky flavor of Baghdad in the heart of Bahrain.'
    },
    {
      question: 'How can I order from Kahramana Baghdad?',
      answer:
        'You can order through our website, via WhatsApp directly with the branch nearest to you, or through Talabat and Keeta in Bahrain.',
    },
    {
      question: 'Does Kahramana Baghdad offer catering for weddings in Bahrain?',
      answer:
        'Yes, Kahramana Baghdad offers premium catering services for weddings, corporate events, and private feasts across Bahrain with a focus on luxury Iraqi hospitality.',
    },
  ]
}

// ── Menu-specific Schemas ──────────────────────────────────────────────────

/**
 * Builds a comprehensive Menu schema with sections and top items.
 */
export function buildFullMenuSchema(categories: CategoryWithItems[], locale: Locale) {
  const SITE = GENERAL_CONTACT.website
  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    '@id': `${SITE}/${locale === 'en' ? 'en/' : ''}menu#menu`,
    name: localized(locale, 'منيو كهرمانة بغداد', 'Kahramana Baghdad Menu'),
    description: localized(
      locale,
      'تصفح قائمتنا الكاملة من الأطباق العراقية الأصيلة، المشاوي على الفحم، والحلويات البغدادية.',
      'Browse our full menu of authentic Iraqi dishes, charcoal grills, and Baghdadi desserts.'
    ),
    url: `${SITE}/${locale === 'en' ? 'en/' : ''}menu`,
    inLanguage: localized(locale, 'ar-BH', 'en-BH'),
    isPartOf: { '@id': `${SITE}/#organization` },
    hasMenuSection: categories.map((cat) => ({
      '@type': 'MenuSection',
      name: localized(locale, cat.nameAR, cat.nameEN ?? cat.nameAR),
      hasMenuItem: cat.items.slice(0, 8).map((item) => ({
        '@type': 'MenuItem',
        name: localized(locale, item.name.ar, item.name.en),
        description: localized(locale, item.description?.ar, item.description?.en),
        offers: {
          '@type': 'Offer',
          price: item.fromPrice,
          priceCurrency: 'BHD',
          availability: item.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
        },
        image: item.image
      }))
    }))
  }
}

/**
 * Builds a WebPage schema specifically for the Menu page.
 */
export function buildMenuWebPageSchema(locale: Locale) {
  const SITE = GENERAL_CONTACT.website
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${SITE}/${locale === 'en' ? 'en/' : ''}menu#webpage`,
    url: `${SITE}/${locale === 'en' ? 'en/' : ''}menu`,
    name: localized(locale, 'قائمة الطعام - كهرمانة بغداد', 'Menu - Kahramana Baghdad'),
    description: localized(
      locale,
      'اكتشف المذاق العراقي الأصيل في البحرين. تصفح قائمتنا الكاملة من المشاوي والمسكوف والقوزي.',
      'Discover authentic Iraqi taste in Bahrain. Browse our full menu of grills, masgouf, and quzi.'
    ),
    breadcrumb: { '@id': `${SITE}/${locale === 'en' ? 'en/' : ''}menu#breadcrumb` },
    about: { '@id': `${SITE}/#organization` },
    isPartOf: { '@id': `${SITE}/#website` }
  }
}

