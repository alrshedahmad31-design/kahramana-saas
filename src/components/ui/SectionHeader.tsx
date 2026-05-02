'use client'

import { motion } from 'framer-motion'
import { useLocale } from 'next-intl'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  className?: string
}

export default function SectionHeader({ 
  title, 
  subtitle, 
  className = '',
}: SectionHeaderProps) {
  const locale = useLocale()
  const isRTL = locale === 'ar'

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, delay: 0.05, ease: 'easeOut' }}
      className={`section-header ${className}`}
    >
      {subtitle && (
        <span className="section-subtitle">
          {subtitle}
        </span>
      )}
      <h2 className={`section-title ${isRTL ? 'font-cairo' : 'font-editorial italic'}`}>
        {title}
      </h2>
    </motion.div>
  )
}
