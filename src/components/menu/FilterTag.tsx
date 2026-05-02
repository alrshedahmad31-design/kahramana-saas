'use client'

import { tokens } from '@/lib/design-tokens'

// Centralized tag config — import anywhere
const TAG_CONFIG = {
  vegetarian: { labelAR: 'نباتي',        labelEN: 'Vegetarian', bg: tokens.color.success,  text: tokens.color.black },
  spicy:      { labelAR: 'حار',          labelEN: 'Spicy',      bg: tokens.color.error,    text: tokens.color.text  },
  new:        { labelAR: 'جديد',         labelEN: 'New',        bg: tokens.color.gold,     text: tokens.color.black },
  popular:    { labelAR: 'الأكثر طلباً', labelEN: 'Popular',    bg: tokens.color.surface2, text: tokens.color.goldLight },
} as const

export type TagType = keyof typeof TAG_CONFIG

interface FilterTagProps {
  tag: TagType
  locale?: string
}

export function FilterTag({ tag, locale = 'ar' }: FilterTagProps) {
  const config = TAG_CONFIG[tag]
  if (!config) return null
  
  return (
    <span
      className="text-[10px] font-almarai font-bold rounded px-1.5 py-0.5 leading-none transition-transform duration-200 group-hover:scale-105"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      {locale === 'ar' ? config.labelAR : config.labelEN}
    </span>
  )
}
