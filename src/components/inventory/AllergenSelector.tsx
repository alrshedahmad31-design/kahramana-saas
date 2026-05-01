'use client'

interface Props {
  selected: string[]
  onChange: (allergens: string[]) => void
  locale?: string
}

const ALLERGENS: { key: string; ar: string; en: string }[] = [
  { key: 'gluten',    ar: 'جلوتين',      en: 'Gluten' },
  { key: 'dairy',     ar: 'ألبان',       en: 'Dairy' },
  { key: 'eggs',      ar: 'بيض',         en: 'Eggs' },
  { key: 'nuts',      ar: 'مكسرات',      en: 'Tree Nuts' },
  { key: 'peanuts',   ar: 'فول سوداني',  en: 'Peanuts' },
  { key: 'soy',       ar: 'صويا',        en: 'Soy' },
  { key: 'fish',      ar: 'سمك',         en: 'Fish' },
  { key: 'shellfish', ar: 'محار',        en: 'Shellfish' },
  { key: 'sesame',    ar: 'سمسم',        en: 'Sesame' },
  { key: 'mustard',   ar: 'خردل',        en: 'Mustard' },
  { key: 'celery',    ar: 'كرفس',        en: 'Celery' },
  { key: 'lupin',     ar: 'لوبيا',       en: 'Lupin' },
  { key: 'molluscs',  ar: 'رخويات',      en: 'Molluscs' },
  { key: 'sulphites', ar: 'كبريتيت',     en: 'Sulphites' },
]

export default function AllergenSelector({ selected, onChange, locale = 'ar' }: Props) {
  const isAr = locale === 'ar'

  function toggle(key: string) {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key))
    } else {
      onChange([...selected, key])
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <p className="font-satoshi text-sm font-medium text-brand-text">
          {isAr ? 'المواد المسببة للحساسية' : 'Allergens'}
        </p>
        {selected.length > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-satoshi font-medium bg-brand-gold/10 text-brand-gold">
            {selected.length}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        {ALLERGENS.map((a) => {
          const checked = selected.includes(a.key)
          return (
            <label
              key={a.key}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors duration-150
                ${checked
                  ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                  : 'border-brand-border bg-brand-surface text-brand-muted hover:border-brand-gold/50'
                }`}
            >
              <input
                type="checkbox"
                name="allergens"
                value={a.key}
                checked={checked}
                onChange={() => toggle(a.key)}
                className="sr-only"
              />
              <span className="font-satoshi text-xs font-medium leading-tight">
                {isAr ? a.ar : a.en}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
