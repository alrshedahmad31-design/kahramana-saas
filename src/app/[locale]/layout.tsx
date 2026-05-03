import type { Metadata, Viewport } from 'next'
import { Cairo, Almarai } from 'next/font/google'
import localFont from 'next/font/local'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import Script from 'next/script'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { routing } from '@/i18n/routing'
import { tokens } from '@/lib/design-tokens'
import { SITE_URL } from '@/constants/contact'
import { buildOrganizationSchema } from '@/lib/seo/schemas'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import ConditionalFooter from '@/components/layout/ConditionalFooter'
import { CookieBanner } from '@/components/layout/CookieBanner'
import CartDrawer from '@/components/cart/CartDrawerDynamic'
import '../globals.css'

// ── Arabic fonts via next/font/google (self-host when files available) ────────
const cairo = Cairo({
  subsets: ['arabic'],
  weight: ['800'],
  variable: '--cairo',
  display: 'swap',
  preload: true,
  // Adjusts fallback font metrics to minimise layout shift before Cairo loads
  adjustFontFallback: true,
  fallback: ['Tahoma', 'Arial', 'sans-serif'],
})

const almarai = Almarai({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--almarai',
  display: 'swap',
  preload: true,
  // Adjusts fallback font metrics to minimise layout shift before Almarai loads
  adjustFontFallback: true,
  fallback: ['Tahoma', 'Arial', 'sans-serif'],
})

// ── English fonts from /public/fonts (self-hosted) ────────────────────────────
const editorialNew = localFont({
  src: [
    { path: '../../../public/fonts/EditorialNew-Light.woff2', weight: '300', style: 'normal' },
    { path: '../../../public/fonts/EditorialNew-Bold.woff2',  weight: '700', style: 'normal' },
  ],
  variable: '--editorial',
  display: 'swap',
})

const satoshi = localFont({
  src: [
    { path: '../../../public/fonts/Satoshi-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../../public/fonts/Satoshi-Medium.woff2',  weight: '500', style: 'normal' },
  ],
  variable: '--satoshi',
  display: 'swap',
})

// ── Metadata — global fallback; each page defines its own canonical/hreflang ──

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> }
): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === "ar";
  const BASE = SITE_URL;

  return {
    // metadataBase resolves all relative URLs in metadata against the production domain,
    // preventing vercel.app from leaking into canonical/OG URLs on preview deployments
    metadataBase: new URL(BASE),
    title: {
      default: isAr
        ? "كهرمانة بغداد | أفضل مطعم عراقي في البحرين"
        : "Kahramana Baghdad | Authentic Iraqi Restaurant in Bahrain",
      template: isAr
        ? "%s | كهرمانة بغداد"
        : "%s | Kahramana Baghdad — Iraqi Restaurant Bahrain"
    },
    description: isAr
      ? "اكتشف نكهات بغداد الأصيلة في البحرين. 168 طبقا عراقيا: مسكوف قوزي دولمة مشاوي. فرعان في الرفاع وقلالي. اطلب الآن عبر واتساب."
      : "Kahramana Baghdad — Bahrain's authentic Iraqi restaurant. 168+ dishes: Masgouf, grills, Quzi, Baghdadi breakfast, Iraqi shawarma. Branches in Riffa and Qallali.",
    keywords: isAr
      ? [
          "مطعم عراقي البحرين", "كهرمانة بغداد", "مسكوف البحرين",
          "مشاوي عراقية", "قوزي عراقي", "فطور بغدادي", "شاورما عراقية",
          "مطاعم البحرين", "مطعم الرفاع", "مطعم قلالي",
          "أكل عراقي البحرين", "مطبخ عراقي", "دولمة بغدادية",
          "كباب عراقي", "أفضل مطاعم البحرين", "وجبات البحرين"
        ]
      : [
          "Iraqi restaurant Bahrain", "Kahramana Baghdad", "Masgouf Bahrain",
          "Iraqi grills Bahrain", "Iraqi Quzi", "Baghdadi breakfast",
          "Iraqi shawarma", "restaurants Bahrain", "Riffa restaurant",
          "Qallali restaurant", "Iraqi food Bahrain", "best restaurant Bahrain",
          "Middle Eastern food Bahrain", "halal restaurant Bahrain",
          "food delivery Bahrain", "Bahrain dining"
        ],
    authors: [{ name: "Kahramana Baghdad", url: BASE }],
    creator: "Kahramana Baghdad",
    publisher: "Kahramana Baghdad",
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      type: "website",
      locale: isAr ? "ar_BH" : "en_BH",
      alternateLocale: isAr ? "en_BH" : "ar_BH",
      siteName: isAr ? "كهرمانة بغداد" : "Kahramana Baghdad",
      title: isAr
        ? "كهرمانة بغداد | مطعم عراقي أصيل في البحرين"
        : "Kahramana Baghdad | Authentic Iraqi Restaurant in Bahrain",
      description: isAr
        ? "168 طبقاً عراقياً أصيلاً في البحرين — مسكوف، مشاوي، قوزي، فطور بغدادي"
        : "168 authentic Iraqi dishes in Bahrain — Masgouf, grills, Quzi, Baghdadi breakfast",
      url: locale === 'ar' ? BASE : `${BASE}/en`,
      images: [
        {
          url: `${BASE}/assets/hero/hero-poster.webp`,
          width: 1200,
          height: 630,
          alt: isAr
            ? "مطعم كهرمانة بغداد — أشهى الأطباق العراقية في البحرين"
            : "Kahramana Baghdad — Authentic Iraqi Food in Bahrain",
          type: "image/webp",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: isAr
        ? "كهرمانة بغداد | مطعم عراقي البحرين"
        : "Kahramana Baghdad | Iraqi Restaurant Bahrain",
      description: isAr
        ? "168 طبقاً عراقياً أصيلاً — فروع الرفاع وقلالي"
        : "168 authentic Iraqi dishes — Riffa & Qallali branches",
      images: [`${BASE}/assets/hero/hero-poster.webp`],
    },
    icons: {
      icon:  '/assets/favicon/favicon.ico',
      apple: '/assets/favicon/apple-touch-icon.png',
    },
    verification: {
      other: { 'msvalidate.01': 'B17AC8B01413ADA36191E083B8C09562' },
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export const viewport: Viewport = {
  themeColor:        tokens.color.gold,
  colorScheme:       'dark',
  width:             'device-width',
  initialScale:      1,
}

// ── Root Layout ───────────────────────────────────────────────────────────────

interface LayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params

  if (!routing.locales.includes(locale as 'ar' | 'en')) {
    notFound()
  }

  setRequestLocale(locale)

  const messages = await getMessages()
  const isRTL = locale === 'ar'

  const fontVariables = [
    cairo.variable,
    almarai.variable,
    editorialNew.variable,
    satoshi.variable,
  ].join(' ')

  return (
    <html
      lang={locale}
      dir={isRTL ? 'rtl' : 'ltr'}
      className={fontVariables}
    >
      <head>
        {process.env.NEXT_PUBLIC_GA_ID && (
          <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="anonymous" />
        )}
        {process.env.NEXT_PUBLIC_CLARITY_ID && (
          <link rel="preconnect" href="https://www.clarity.ms" crossOrigin="anonymous" />
        )}
        {/* hreflang is handled by metadata.alternates.languages below —
            duplicate <link> tags here were causing canonical/hreflang conflicts */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildOrganizationSchema(locale as 'ar' | 'en')),
          }}
        />
        {/* DNS prefetch for WhatsApp */}
        <link rel="dns-prefetch" href="https://wa.me" />
      </head>
      <body className="bg-brand-black text-brand-text font-almarai antialiased min-h-screen flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Header />
          <main className="flex-1 pt-20 md:pt-24">
            {children}
          </main>
          <ConditionalFooter>
            <Footer />
          </ConditionalFooter>
          <CartDrawer />
          <CookieBanner />
        </NextIntlClientProvider>

        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${process.env.NEXT_PUBLIC_GA_ID}');`}
            </Script>
          </>
        )}

        {process.env.NEXT_PUBLIC_CLARITY_ID && (
          <Script id="clarity-init" strategy="afterInteractive">
            {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${process.env.NEXT_PUBLIC_CLARITY_ID}");`}
          </Script>
        )}

        <SpeedInsights />
      </body>
    </html>
  )
}
