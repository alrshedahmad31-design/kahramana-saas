'use client'

import { Search, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface MenuSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  clearLabel: string
  isRTL: boolean
}

export default function MenuSearch({
  value,
  onChange,
  placeholder,
  clearLabel,
  isRTL,
}: MenuSearchProps) {
  return (
    <div className="group relative w-full">
      <Search
        className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-muted transition-colors duration-300 group-focus-within:text-brand-gold"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        dir={isRTL ? 'rtl' : 'ltr'}
        className={`min-h-[52px] w-full rounded-xl border border-brand-border bg-brand-surface-2 ps-12 pe-12 text-base text-brand-text placeholder:text-brand-muted/60 focus:border-brand-gold focus:bg-brand-surface-2 focus:outline-none focus:ring-1 focus:ring-brand-gold/20 transition-all duration-300 text-start ${
          isRTL ? 'font-almarai' : 'font-satoshi'
        }`}
      />
      
      {/* Decorative focus glow */}
      <div className="absolute inset-0 -z-10 rounded-xl bg-brand-gold/5 opacity-0 blur-xl transition-opacity duration-300 group-focus-within:opacity-100" />

      <AnimatePresence>
        {value.trim().length > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, x: isRTL ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: isRTL ? 4 : -4 }}
            type="button"
            aria-label={clearLabel}
            onClick={() => onChange('')}
            className="absolute end-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-brand-muted transition-colors duration-150 hover:bg-brand-surface hover:text-brand-text active:scale-90"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
