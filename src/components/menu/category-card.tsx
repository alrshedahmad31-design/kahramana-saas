import { Link } from '@/i18n/navigation'
import type { NormalizedMenuCategory } from '@/lib/menu'

interface CategoryCardProps {
  category: NormalizedMenuCategory
  itemCountLabel: string
  isRTL: boolean
}

export default function CategoryCard({
  category,
  itemCountLabel,
  isRTL,
}: CategoryCardProps) {
  return (
    <Link
      href={`/menu/${category.slug}`}
      aria-label={isRTL ? category.name.ar : category.name.en}
      dir={isRTL ? 'rtl' : 'ltr'}
      className="group flex min-h-[132px] flex-col justify-between rounded-lg border border-brand-border bg-brand-surface ps-4 pe-4 pt-4 pb-4 transition-colors duration-200 hover:border-brand-gold"
    >
      <div>
        <p
          className={`text-lg font-black leading-snug text-brand-text text-start ${
            isRTL ? 'font-cairo' : 'font-satoshi'
          }`}
        >
          {isRTL ? category.name.ar : category.name.en}
        </p>
        {category.description && (
          <p
            className={`mt-2 line-clamp-2 text-sm leading-6 text-brand-muted text-start ${
              isRTL ? 'font-almarai' : 'font-satoshi'
            }`}
          >
            {isRTL ? category.description.ar : category.description.en}
          </p>
        )}
      </div>
    </Link>
  )
}
