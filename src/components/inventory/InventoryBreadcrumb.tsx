import Link from 'next/link'

interface Props {
  prefix: string
  locale: string
}

export default function InventoryBreadcrumb({ prefix, locale }: Props) {
  const isAr = locale === 'ar'
  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-2 text-brand-muted font-satoshi text-xs">
      <Link href={`${prefix}/dashboard`} className="hover:text-brand-gold transition-colors duration-150">
        {isAr ? 'لوحة التحكم' : 'Dashboard'}
      </Link>
      <span className="opacity-40">/</span>
      <span className="text-brand-text">{isAr ? 'المخزون' : 'Inventory'}</span>
    </nav>
  )
}
