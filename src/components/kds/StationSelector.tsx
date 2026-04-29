'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { KDSStation } from '@/lib/supabase/custom-types'
import { ALL_STATIONS } from '@/lib/kds/constants'

export { ALL_STATIONS }

interface Props {
  selected: KDSStation
}

export default function StationSelector({ selected }: Props) {
  const t      = useTranslations('kds.stations')
  const router = useRouter()
  const path   = usePathname()
  const params = useSearchParams()

  function select(station: KDSStation) {
    const next = new URLSearchParams(params.toString())
    next.set('station', station)
    router.push(`${path}?${next.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Kitchen station">
      {ALL_STATIONS.map((s) => {
        const active = s === selected
        return (
          <button
            key={s}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => select(s)}
            className={`font-satoshi font-bold text-sm rounded-lg
                        px-4 py-3 min-h-[48px] min-w-[80px]
                        transition-colors duration-150
                        ${active
                          ? 'bg-brand-gold text-brand-black'
                          : 'bg-brand-surface-2 text-brand-muted border border-brand-border hover:text-brand-text'
                        }`}
          >
            {t(s as Parameters<typeof t>[0])}
          </button>
        )
      })}
    </div>
  )
}
