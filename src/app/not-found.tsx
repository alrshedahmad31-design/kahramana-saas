import Link from 'next/link'

// App-root not-found. Rendered when notFound() bubbles past
// [locale]/layout.tsx (e.g. when an unknown locale segment fails the
// routing.locales check before [locale]/not-found.tsx can take over).
//
// This file MUST render its own <html>/<body> because the bare
// app/layout.tsx is `return children` and the [locale] layout — which
// owns the html/body in normal routes — was bypassed.
export default function RootNotFound() {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-brand-black text-brand-text antialiased min-h-screen">
        <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="font-satoshi text-6xl font-black text-brand-gold/30">404</p>
          <h1 className="font-cairo text-2xl font-black">الصفحة غير موجودة</h1>
          <Link
            href="/"
            aria-label="العودة للرئيسية"
            className="inline-flex items-center justify-center rounded-lg border border-white/10 px-8 py-3.5 text-base font-bold text-brand-text transition-all hover:bg-white/5"
          >
            العودة للرئيسية
          </Link>
        </main>
      </body>
    </html>
  )
}
