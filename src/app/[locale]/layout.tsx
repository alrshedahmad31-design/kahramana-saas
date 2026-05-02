import type { Metadata, Viewport } from 'next'
import { Cairo, Almarai } from 'next/font/google'
import localFont from 'next/font/local'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import Script from 'next/script'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { headers } from 'next/headers'
import { routing } from '@/i18n/routing'
import { tokens } from '@/lib/design-tokens'
import { SITE_URL } from '@/constants/contact'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import ConditionalFooter from '@/components/layout/ConditionalFooter'
import { CookieBanner } from '@/components/layout/CookieBanner'
import dynamic from 'next/dynamic'
const CartDrawer = dynamic(() => import('@/components/cart/CartDrawer'))
import '../globals.css'

// ── Arabic fonts via next/font/google (self-host when files available) ────────
const cairo = Cairo({
  subsets: ['arabic'],
  weight: ['800'],
  variable: '--cairo',
  display: 'swap',
  preload: true,
})

const almarai = Almarai({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--almarai',
  display: 'swap',
  preload: true,
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

export const metadata: Metadata = {
  title: {
    template: '%s | Kahramana Baghdad',
    default:  'Kahramana Baghdad',
  },
  metadataBase: new URL(SITE_URL),
  openGraph: {
    siteName: 'Kahramana Baghdad',
    type:     'website',
    images:   [{ url: '/assets/brand/og-image.webp', width: 1200, height: 630 }],
  },
  twitter: {
    card:   'summary_large_image',
    site:   '@kahramanat_b',
    images: ['/assets/brand/og-image.webp'],
  },
  icons: {
    icon:  '/assets/favicon/favicon.ico',
    apple: '/assets/favicon/apple-touch-icon.png',
  },
  verification: {
    other: { 'msvalidate.01': 'B17AC8B01413ADA36191E083B8C09562' },
  },
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

  const messages = await getMessages()
  const isRTL = locale === 'ar'
  const nonce = (await headers()).get('x-nonce') ?? undefined

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
      </head>
      <body className="bg-brand-black text-brand-text font-almarai antialiased min-h-screen flex flex-col">
        <NextIntlClientProvider messages={messages}>
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
              nonce={nonce}
            />
            <Script id="ga4-init" strategy="afterInteractive" nonce={nonce}>
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${process.env.NEXT_PUBLIC_GA_ID}');`}
            </Script>
          </>
        )}

        {process.env.NEXT_PUBLIC_CLARITY_ID && (
          <Script id="clarity-init" strategy="afterInteractive" nonce={nonce}>
            {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${process.env.NEXT_PUBLIC_CLARITY_ID}");`}
          </Script>
        )}

        <SpeedInsights />
      </body>
    </html>
  )
}
