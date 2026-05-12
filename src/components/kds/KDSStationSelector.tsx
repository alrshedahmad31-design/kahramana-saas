'use client'

import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useTranslations, useLocale } from 'next-intl'
import type { KDSStation } from '@/lib/supabase/custom-types'
import { STATION_CONFIG } from '@/constants/kds'
import { useRouter, usePathname } from 'next/navigation'

interface Props {
  // pending+preparing item counts per station (server-fetched).
  stationCounts?: Partial<Record<KDSStation, number>>
}

type StationEntry = [KDSStation, NonNullable<(typeof STATION_CONFIG)[KDSStation]>]

export function KDSStationSelector({ stationCounts = {} }: Props) {
  const t        = useTranslations('kds')
  const locale   = useLocale()
  const router   = useRouter()
  const pathname = usePathname()
  const isAr     = locale === 'ar'

  // Sort by current load descending so the busiest station is at the top
  // of the operator's eye line. Stations with zero work fall to the bottom.
  const stations = useMemo<StationEntry[]>(() => {
    const all = (Object.entries(STATION_CONFIG) as StationEntry[])
      .filter((entry): entry is StationEntry => !!entry[1])
    return all.sort((a, b) => (stationCounts[b[0]] ?? 0) - (stationCounts[a[0]] ?? 0))
  }, [stationCounts])

  const maxCount = Math.max(1, ...Object.values(stationCounts).map(n => n ?? 0))

  const handleSelect = (station: KDSStation) => {
    router.push(`${pathname}?station=${station}`)
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center ps-6 pe-6 py-12 bg-brand-black text-brand-text">
      <div className="text-center mb-10 max-w-xl">
        <h1 className={`text-4xl md:text-5xl font-bold mb-3 ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {t('selectStation')}
        </h1>
        <p className={`text-brand-muted text-base ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {t('selectStationDescription')}
        </p>
      </div>

      <div className="w-full max-w-2xl flex flex-col gap-2">
        {stations.map(([key, config], index) => {
          const count = stationCounts[key] ?? 0
          const load  = count / maxCount
          return (
            <motion.button
              key={key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              whileTap={{ scale: 0.99 }}
              onClick={() => handleSelect(key)}
              className="group relative flex items-center gap-5 ps-5 pe-5 py-4 rounded-xl border border-brand-border bg-brand-surface hover:border-brand-gold/60 transition-colors text-start"
            >
              <span className="text-4xl leading-none shrink-0">{config.icon}</span>

              <div className="flex-1 min-w-0">
                <div className={`text-xl font-black tracking-tight ${isAr ? 'font-cairo' : 'font-editorial'}`}>
                  {isAr ? config.label.ar : config.label.en}
                </div>
                {/* Load bar — width is share of the busiest station */}
                <div className="mt-2 h-1.5 w-full rounded-full bg-brand-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{
                      width:           `${Math.max(2, load * 100)}%`,
                      backgroundColor: count === 0 ? 'transparent' : config.color,
                    }}
                  />
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-center min-w-[3rem]">
                <span
                  className="text-3xl font-black tabular-nums leading-none"
                  style={{ color: count > 0 ? config.color : 'inherit', opacity: count > 0 ? 1 : 0.3 }}
                >
                  {count}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-brand-muted mt-1">
                  {t('activeOrders')}
                </span>
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
