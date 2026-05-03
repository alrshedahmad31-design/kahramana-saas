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
import { BRANCH_EXTENDED_DATA } from '@/lib/branches'
import type { CategoryWithItems } from '@/lib/menu'

// Resolved at module load from NEXT_PUBLIC_SITE_URL → preview vs prod domain
const SITE = GENERAL_CONTACT.website

type Locale = 'ar' | 'en'

const localized = <T,>(locale: Locale, ar: T, en: T): T =>
  locale === 'ar' ? ar : en

// ── Active vs. planned branches ─────────────────────────────────────────────

const activeBranches = BRANCH_LIST.filter((b) => b.status === 'active')
const plannedBranches = BRANCH_LIST.filter((b) => b.status === 'planned')

// Verified Google Business Profile ratings (source: GBP dashboard 2026-05)
const BRANCH_RATINGS: Partial<Record<string, { ratingValue: string; reviewCount: string; bestRating: string; worstRating: string }>> = {
  riffa:   { ratingValue: '4.5', reviewCount: '1531', bestRating: '5', worstRating: '1' },
  qallali: { ratingValue: '4.4', reviewCount: '120',  bestRating: '5', worstRating: '1' },
}

// Schema.org requires "25:00" format when closing time crosses midnight.
function schemaClosesTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  if (h < 6) return `${h + 24}:${String(m).padStart(2, '0')}`
  return time
}

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
      closes: schemaClosesTime(branch.hours.closes),
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
      addressRegion:    branch.governorateEn
        ? localized(locale, branch.governorateAr ?? branch.cityAr, branch.governorateEn)
        : localized(locale, branch.cityAr, branch.cityEn),
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

  const rating = BRANCH_RATINGS[branch.id]
  if (rating) {
    base.aggregateRating = {
      '@type': 'AggregateRating',
      ...rating,
    }
  }

  const extData = BRANCH_EXTENDED_DATA[branch.id]
  if (extData) {
    base.description = localized(locale, extData.descriptionAr, extData.descriptionEn)
    if (extData.imageUrl) {
      base.image = `${SITE}${extData.imageUrl}`
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

// ── Founder Person schema ──────────────────────────────────────────────────

export function buildFounderSchema() {
  return {
    '@type': 'Person',
    '@id': `${SITE}/#founder`,
    name: 'Eng. Asaad Al-Jubouri',
    alternateName: 'م. أسعد الجبوري',
    jobTitle: 'Founder',
    worksFor: { '@id': `${SITE}/#organization` },
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
      'كهرمانة بغداد مطعم عراقي أصيل في البحرين، تأسس على يد المهندس أسعد الجبوري في أغسطس 2018. يقدم المطعم أكثر من 168 طبقاً بغدادياً أصيلاً في فرعين: الرفاع (منطقة الحجيات، يومياً من ٧ مساءً حتى ١ صباحاً) وقلالي (محافظة المحرق، يومياً من ١٢ ظهراً حتى ١ صباحاً). تشمل أبرز الأطباق: سمك المسگوف المشوي على الفحم، القوزي، المشاوي العراقية، والإفطار البغدادي. تقييم ٤٫٥ من ٥ بناءً على أكثر من ١٥٣١ تقييم على جوجل في فرع الرفاع. التوصيل متاح عبر واتساب في جميع أنحاء البحرين. متوفر جلسات عائلية وكبائن خاصة وخدمة التموين للمناسبات.',
      'Kahramana Baghdad is an authentic Iraqi restaurant in Bahrain, founded by Eng. Asaad Al-Jubouri in August 2018. The restaurant serves over 168 traditional Baghdadi dishes across two branches in Riffa (Al-Hijiyat Area, daily 7 PM–1 AM) and Qallali (Muharraq Governorate, daily 12 PM–1 AM). Signature dishes include Masgouf (traditional Mesopotamian charcoal-grilled fish), Quzi (slow-cooked lamb), Iraqi kebab, and Baghdadi breakfast. Rated 4.5 stars from 1,531 Google reviews at the Riffa branch. Delivery available via WhatsApp across Bahrain. Family seating, private cabins, and event catering services available.'
    ),
    url: SITE,
    telephone: primaryBranch.phone,
    foundingDate: '2018-08-01',
    address: {
      '@type': 'PostalAddress',
      streetAddress:   localized(locale, primaryBranch.addressAr,  primaryBranch.addressEn),
      addressLocality: localized(locale, primaryBranch.cityAr,     primaryBranch.cityEn),
      addressRegion:   primaryBranch.governorateEn
        ? localized(locale, primaryBranch.governorateAr ?? primaryBranch.cityAr, primaryBranch.governorateEn)
        : localized(locale, primaryBranch.cityAr, primaryBranch.cityEn),
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
      'https://www.talabat.com/ar/bahrain/kahramanat-baghdad-restaurant',
    ].filter(Boolean),
    location: activeBranches.map((b) => ({
      '@id': `${SITE}/#branch-${b.id}`,
    })),
    founder: buildFounderSchema(),
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
  return {
    ...buildBreadcrumb([
      { name: localized(locale, 'الرئيسية', 'Home'), url: `${prefix}/` },
      { name: localized(locale, 'المنيو',   'Menu'), url: `${prefix}/menu` },
    ]),
    '@id': `${SITE}${prefix}/menu#breadcrumb`,
  }
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
    suitableForDiet: 'https://schema.org/HalalDiet',
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
  if (locale === 'ar') {
    return [
      {
        question: 'أين أجد مطعمًا عراقيًا أصيلًا في البحرين؟',
        answer: 'مطعم كهرمانة بغداد يقدم تجربة طعام عراقية أصيلة في البحرين، تشمل المشاوي العراقية، الأطباق التراثية، المقبلات الشرقية، وأجواء ضيافة مناسبة للعائلات والضيوف.',
      },
      {
        question: 'ما الذي يميز المشاوي العراقية في كهرمانة بغداد؟',
        answer: 'تتميز مشاوي كهرمانة بغداد بتتبيلات عراقية غنية، وتحضير يهتم بالنكهة والقوام، مع خيارات مثل الكباب العراقي، التكة، الشيش طاووق، وتشكيلات المشاوي المناسبة للأفراد والعائلات.',
      },
      {
        question: 'هل يتوفر سمك المسكوف العراقي في كهرمانة بغداد؟',
        answer: 'نعم، يتوفر سمك المسكوف العراقي ضمن أطباق كهرمانة بغداد، ويُنصح بالتواصل مع الفرع قبل الزيارة للتأكد من التوفر أو الحجز المسبق، خصوصًا في أوقات الذروة.',
      },
      {
        question: 'هل كهرمانة بغداد مناسب للعائلات والجلسات الخاصة؟',
        answer: 'نعم، كهرمانة بغداد مناسب للعائلات، وتتوفر جلسات وكبائن خاصة تمنح الضيوف تجربة أكثر راحة وخصوصية، خصوصًا عند الحجز المسبق.',
      },
      {
        question: 'هل يمكن طلب التوصيل من كهرمانة بغداد؟',
        answer: 'نعم، تتوفر خدمة التوصيل حسب الفرع والمنطقة، ويمكن طلب الأطباق العراقية والمشاوي عبر قنوات الطلب المتاحة أو التواصل مع الفرع المناسب.',
      },
      {
        question: 'هل تقدمون ولائم أو بوفيهات للمناسبات والعزائم؟',
        answer: 'نعم، يوفر كهرمانة بغداد خيارات للولائم، العزائم، والمناسبات الخاصة، مع إمكانية تنسيق قائمة طعام عراقية تشمل المشاوي والأطباق المناسبة لعدد الضيوف ونوع المناسبة.',
      },
      {
        question: 'أين تقع فروع كهرمانة بغداد في البحرين؟',
        answer: 'تتوفر فروع كهرمانة بغداد في الرفاع وقلالي، ويمكن الوصول إلى تفاصيل كل فرع من خلال صفحة الفروع، بما في ذلك الموقع على خرائط Google، أوقات العمل، وطرق التواصل.',
      },
    ]
  }

  return [
    {
      question: 'Where can I find an authentic Iraqi restaurant in Bahrain?',
      answer: 'Kahramana Baghdad offers an authentic Iraqi dining experience in Bahrain, featuring traditional Iraqi grills, heritage dishes, oriental appetizers, and family-friendly hospitality.',
    },
    {
      question: 'What makes the Iraqi grills at Kahramana Baghdad unique?',
      answer: "Kahramana Baghdad's grills are distinguished by rich Iraqi marinades and careful preparation focused on flavor and texture, with options including Iraqi kebab, tikka, shish tawook, and mixed grill platters for individuals and families.",
    },
    {
      question: 'Is Iraqi Masgouf fish available at Kahramana Baghdad?',
      answer: 'Yes, Iraqi Masgouf is available at Kahramana Baghdad. We recommend contacting the branch before your visit to confirm availability or for advance booking, especially during peak hours.',
    },
    {
      question: 'Is Kahramana Baghdad suitable for families and private gatherings?',
      answer: 'Yes, Kahramana Baghdad is family-friendly and offers private seating and cabins for a more comfortable and personal experience, especially when booked in advance.',
    },
    {
      question: 'Can I order delivery from Kahramana Baghdad?',
      answer: 'Yes, delivery is available depending on the branch and area. You can order Iraqi dishes and grills through available ordering channels or by contacting your nearest branch.',
    },
    {
      question: 'Do you offer banquets or buffets for events and gatherings?',
      answer: 'Yes, Kahramana Baghdad offers options for banquets, private gatherings, and special occasions, with the ability to coordinate a customized Iraqi menu including grills and dishes suited to your guest count and occasion type.',
    },
    {
      question: 'Where are Kahramana Baghdad branches located in Bahrain?',
      answer: 'Kahramana Baghdad has branches in Riffa and Qallali. Full details for each branch — including Google Maps location, opening hours, and contact methods — are available on the branches page.',
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
  const prefix = locale === 'en' ? '/en' : ''
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${SITE}${prefix}/menu#webpage`,
    url: `${SITE}${prefix}/menu`,
    name: localized(locale, 'قائمة الطعام - كهرمانة بغداد', 'Menu - Kahramana Baghdad'),
    description: localized(
      locale,
      'اكتشف المذاق العراقي الأصيل في البحرين. تصفح قائمتنا الكاملة من المشاوي والمسكوف والقوزي.',
      'Discover authentic Iraqi taste in Bahrain. Browse our full menu of grills, masgouf, and quzi.'
    ),
    breadcrumb: { '@id': `${SITE}${prefix}/menu#breadcrumb` },
    about: { '@id': `${SITE}/#organization` },
    isPartOf: { '@id': `${SITE}/#website` }
  }
}

