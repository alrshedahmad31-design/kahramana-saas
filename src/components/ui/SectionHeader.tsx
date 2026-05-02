'use client'

import { motion } from 'framer-motion'
import { useLocale } from 'next-intl'

interface SectionHeaderProps {
  title: string
  subtitle: string
  className?: string
  align?: 'start' | 'center'
}

export default function SectionHeader({ 
  title, 
  subtitle, 
  className = '', 
  align = 'start' 
}: SectionHeaderProps) {
  const locale = useLocale()
  const isRTL = locale === 'ar'

  return (
    <div className={`section-header ${align === 'center' ? 'text-center mx-auto' : 'text-start'} ${className}`}>
      <motion.span
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="section-subtitle"
      >
        {subtitle}
      </motion.span>
      <motion.h2
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
        className={`section-title ${isRTL ? 'font-cairo' : 'font-editorial italic'}`}
      >
        {title}
      </motion.h2>
    </div>
  )
}
