import Image from 'next/image'

interface MenuHeroProps {
  eyebrow: string
  title: string
  description: string
  itemCountLabel: string
  categoryCountLabel: string
  imageAlt: string
  isRTL: boolean
}

export default function MenuHero({
  eyebrow,
  title,
  description,
  itemCountLabel,
  categoryCountLabel,
  imageAlt,
  isRTL,
}: MenuHeroProps) {
  return (
    <section
      dir={isRTL ? 'rtl' : 'ltr'}
      className="relative isolate overflow-hidden bg-brand-black"
    >
      <div className="absolute inset-0 -z-10">
        <Image
          src="/assets/hero/hero-menu.webp"
          alt={imageAlt}
          fill
          priority
          className="object-cover opacity-45"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-black/60 via-brand-black/85 to-brand-black" />
      </div>

      <div className="mx-auto flex min-h-[420px] max-w-7xl flex-col justify-end ps-4 pe-4 pt-24 pb-10 sm:ps-6 sm:pe-6 lg:min-h-[520px]">
        <div className="max-w-3xl">
          <p
            className={`mb-4 text-xs font-bold uppercase tracking-[0.22em] text-brand-gold text-start ${
              isRTL ? 'font-almarai' : 'font-satoshi'
            }`}
          >
            {eyebrow}
          </p>
          <h1
            className={`text-balance text-4xl font-black leading-tight text-brand-text sm:text-6xl text-start ${
              isRTL ? 'font-cairo' : 'font-editorial'
            }`}
          >
            {title}
          </h1>
          <p
            className={`mt-5 max-w-2xl text-base leading-8 text-brand-muted sm:text-lg text-start ${
              isRTL ? 'font-almarai' : 'font-satoshi'
            }`}
          >
            {description}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <span className="rounded-lg border border-brand-border bg-brand-surface/80 ps-4 pe-4 pt-3 pb-3 font-satoshi text-sm font-bold tabular-nums text-brand-text">
              {itemCountLabel}
            </span>
            <span className="rounded-lg border border-brand-border bg-brand-surface/80 ps-4 pe-4 pt-3 pb-3 font-satoshi text-sm font-bold tabular-nums text-brand-text">
              {categoryCountLabel}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
