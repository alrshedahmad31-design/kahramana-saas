import Link from 'next/link'

export default function RootNotFound() {
  return (
    <main className="min-h-screen bg-brand-black text-brand-text flex flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-satoshi text-6xl font-black text-brand-gold/30">404</p>
      <h1 className="font-cairo text-2xl font-black">الصفحة غير موجودة</h1>
      <Link
        href="/ar"
        aria-label="العودة للرئيسية"
        className="inline-flex items-center justify-center rounded-lg border border-white/10 px-8 py-3.5 text-base font-bold text-brand-text transition-all hover:bg-white/5"
      >
        العودة للرئيسية
      </Link>
    </main>
  )
}
