'use client'

import { motion, AnimatePresence } from 'motion/react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

interface PromptDialogProps {
  isOpen:        boolean
  title:         string
  message?:      string
  placeholder?:  string
  confirmLabel?: string
  cancelLabel?:  string
  onConfirm:     (value: string) => void
  onCancel:      () => void
}

export default function PromptDialog({
  isOpen,
  title,
  message,
  placeholder,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const tCommon = useTranslations('common')
  const locale  = useLocale()
  const isAr    = locale === 'ar'
  const dir     = isAr ? 'rtl' : 'ltr'
  const heading = isAr ? 'font-cairo'   : 'font-editorial'
  const body    = isAr ? 'font-almarai' : 'font-satoshi'

  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    setValue('')
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [isOpen])

  const submit = () => {
    const trimmed = value.trim()
    if (trimmed) onConfirm(trimmed)
  }

  const ok     = confirmLabel ?? tCommon('confirm')
  const cancel = cancelLabel  ?? tCommon('cancel')
  const ph     = placeholder  ?? tCommon('reasonPlaceholder')

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 bg-brand-black/80 z-[100]"
          />

          <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-brand-surface border-2 border-brand-gold w-full max-w-md rounded-2xl overflow-hidden pointer-events-auto"
              dir={dir}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  submit()
                }}
              >
                <div className="p-8">
                  <h3 className={`text-2xl font-black text-brand-gold mb-4 leading-tight ${heading}`}>
                    {title}
                  </h3>
                  {message && (
                    <p className={`text-brand-text text-base font-medium leading-relaxed mb-5 ${body}`}>
                      {message}
                    </p>
                  )}
                  <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={ph}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        onCancel()
                      }
                    }}
                    className={`w-full bg-brand-black text-brand-text placeholder:text-brand-muted border border-brand-border focus:border-brand-gold focus:outline-none rounded-lg px-4 py-3 text-base ${body}`}
                  />
                </div>

                <div className="flex border-t border-brand-gold/20">
                  <button
                    type="button"
                    onClick={onCancel}
                    className={`flex-1 p-5 text-brand-muted hover:bg-brand-surface-2 transition-colors font-bold text-lg border-e border-brand-gold/20 ${body}`}
                  >
                    {cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={!value.trim()}
                    className={`flex-1 p-5 bg-brand-gold text-brand-black hover:bg-brand-gold-light transition-colors font-black text-lg disabled:opacity-50 disabled:cursor-not-allowed ${body}`}
                  >
                    {ok}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
