import { BRANCHES } from '@/lib/constants/branches'

const SITE_URL = 'https://kahramanat.com'

export function generateRestaurantSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': ['Restaurant', 'LocalBusiness'],
    '@id': `${SITE_URL}/#restaurant`,
    name: 'كهرمانة بغداد',
    alternateName: 'Kahramana Baghdad',
    description:
      'مطعم عراقي متخصص في المطبخ البغدادي الأصيل. تأسس عام 2018 في البحرين يقدم أكثر من 168 طبقا عراقيا في فرعين بالرفاع وقلالي.',
    url: SITE_URL,
    logo: `${SITE_URL}/assets/logo.svg`,
    image: `${SITE_URL}/assets/hero/hero-poster.webp`,
    telephone: BRANCHES[0].phone,
    foundingDate: '2018',
    servesCuisine: ['Iraqi', 'Baghdadi', 'Middle Eastern'],
    priceRange: '$$',
    currenciesAccepted: 'BHD',
    paymentAccepted: 'Cash',
    menu: `${SITE_URL}/ar/menu`,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'قائمة كهرمانة بغداد',
    },
    sameAs: [
      'https://www.instagram.com/kahramanat_b',
      'https://www.facebook.com/kahramanat1',
      'https://www.tiktok.com/@kahramanat_b',
    ],
    location: BRANCHES.filter((branch) => branch.status === 'active').map((branch) => ({
      '@type': 'Place',
      name: branch.name_ar,
      telephone: branch.phone,
      address: {
        '@type': 'PostalAddress',
        streetAddress: branch.area_ar,
        addressLocality: branch.city_ar,
        addressCountry: 'BH',
      },
      hasMap: branch.googleMaps,
      openingHoursSpecification: {
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
        opens: branch.opens,
        closes: branch.closes,
      },
    })),
  }
}

export function generateMenuItemSchema(item: {
  name_ar: string
  name_en: string
  description_ar: string
  price: number
  image_url: string
  slug: string
  category_ar: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'MenuItem',
    name: item.name_ar,
    alternateName: item.name_en,
    description: item.description_ar,
    image: item.image_url.startsWith('http')
      ? item.image_url
      : `${SITE_URL}${item.image_url}`,
    url: `${SITE_URL}/ar/menu/item/${item.slug}`,
    offers: {
      '@type': 'Offer',
      price: item.price.toFixed(3),
      priceCurrency: 'BHD',
      availability: 'https://schema.org/InStock',
    },
    suitableForDiet: 'https://schema.org/HalalDiet',
    inMenu: {
      '@type': 'Menu',
      name: 'قائمة كهرمانة بغداد',
      url: `${SITE_URL}/ar/menu`,
    },
  }
}

export function generateFAQSchema(
  faqs: { question: string; answer: string }[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

export function generateBreadcrumbSchema(
  items: { name: string; url: string }[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}
