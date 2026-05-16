'use client'

import { motion, AnimatePresence } from 'motion/react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect } from 'react'

interface ConfirmModalProps {
  isOpen:        boolean
  title?:        string
  message:       string
  confirmLabel?: string
  cancelLabel?:  string
  variant?:      'default' | 'danger'
  onConfirm:     () => void
  onCancel:      () => void
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const tCommon = useTranslations('common')
  const locale  = useLocale()
  const isAr    = locale === 'ar'
  const dir     = isAr ? 'rtl' : 'ltr'
  const heading = isAr ? 'font-cairo'   : 'font-editorial'
  const body    = isAr ? 'font-almarai' : 'font-satoshi'

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onCancel])

  const ok     = confirmLabel ?? tCommon('confirm')
  const cancel = cancelLabel  ?? tCommon('cancel')

  const confirmBtnClass =
    variant === 'danger'
      ? 'flex-1 p-5 bg-brand-error text-brand-text hover:bg-brand-error/90 transition-colors font-black text-lg'
      : 'flex-1 p-5 bg-brand-gold text-brand-black hover:bg-brand-gold-light transition-colors font-black text-lg'

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
              role="alertdialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-brand-surface border-2 border-brand-gold w-full max-w-md rounded-2xl overflow-hidden pointer-events-auto"
              dir={dir}
            >
              <div className="p-8">
                {title && (
                  <h3 className={`text-2xl font-black text-brand-gold mb-4 leading-tight ${heading}`}>
                    {title}
                  </h3>
                )}
                <p className={`text-brand-text text-base font-medium leading-relaxed ${body}`}>
                  {message}
                </p>
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
                  type="button"
                  onClick={onConfirm}
                  autoFocus
                  className={`${confirmBtnClass} ${body}`}
                >
                  {ok}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
