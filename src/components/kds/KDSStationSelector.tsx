'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { useTranslations, useLocale } from 'next-intl'
import { KDSStation } from '@/lib/supabase/custom-types'
import { STATION_CONFIG } from '@/constants/kds'
import { tokens } from '@/lib/design-tokens'
import { useRouter, usePathname } from 'next/navigation'

export function KDSStationSelector() {
  const t = useTranslations('kds')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const isAr = locale === 'ar'

  const stations = (Object.entries(STATION_CONFIG) as [KDSStation, typeof STATION_CONFIG['main']][])
    .filter(([_, config]) => !!config)

  const handleSelect = (station: KDSStation) => {
    router.push(`${pathname}?station=${station}`)
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 bg-black text-white">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl md:text-5xl font-bold mb-4 font-ar-heading">
          {t('selectStation')}
        </h1>
        <p className="text-muted text-lg">
          {t('selectStationDescription')}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl w-full">
        {stations.map(([key, config], index) => (
          <motion.button
            key={key}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02, backgroundColor: tokens.color.surface2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSelect(key)}
            className="group relative flex flex-col items-center justify-center p-8 rounded-xl border border-border bg-surface transition-all overflow-hidden"
          >
            {/* Status Indicator Bar */}
            <div 
              className="absolute top-0 inset-x-0 h-1.5 transition-all group-hover:h-3"
              style={{ backgroundColor: config!.color }}
            />

            <span className="text-6xl mb-4 group-hover:scale-110 transition-transform">
              {config!.icon}
            </span>

            <h2 className="text-2xl font-bold mb-1">
              {isAr ? config!.label.ar : config!.label.en}
            </h2>
            
            <div className="flex items-center gap-2 mt-4 text-sm font-medium uppercase tracking-wider opacity-60 group-hover:opacity-100 transition-opacity">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: config!.color }} />
              {t('viewBoard')}
            </div>

            {/* Subtle Gradient Backdrop */}
            <div 
              className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none"
              style={{ background: `radial-gradient(circle at center, ${config!.color} 0%, transparent 70%)` }}
            />
          </motion.button>
        ))}
      </div>
    </div>
  )
}
