'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useLocale, useTranslations } from 'next-intl'

interface KDSDialogProps {
  isOpen:        boolean
  title:         string
  message:       string
  confirmLabel?: string
  cancelLabel?:  string
  onConfirm:     () => void
  onCancel?:     () => void
}

export default function KDSDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: KDSDialogProps) {
  const t      = useTranslations('kds.dialog')
  const locale = useLocale()
  const isAr   = locale === 'ar'
  const dir    = isAr ? 'rtl' : 'ltr'
  const font   = isAr ? 'font-cairo' : 'font-editorial'
  const body   = isAr ? 'font-almarai' : 'font-satoshi'

  const ok     = confirmLabel ?? t('ok')
  const cancel = cancelLabel  ?? (onCancel ? t('cancel') : undefined)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel || onConfirm}
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
              <div className="p-8">
                <h3 className={`text-2xl font-black text-brand-gold mb-4 leading-tight ${font}`}>
                  {title}
                </h3>
                <p className={`text-brand-text text-lg font-medium leading-relaxed ${body}`}>
                  {message}
                </p>
              </div>

              <div className="flex border-t border-brand-gold/20">
                {cancel && (
                  <button
                    onClick={onCancel}
                    className={`flex-1 p-5 text-brand-muted hover:bg-brand-surface-2 transition-colors font-bold text-lg border-e border-brand-gold/20 ${body}`}
                  >
                    {cancel}
                  </button>
                )}
                <button
                  onClick={onConfirm}
                  className={`flex-1 p-5 bg-brand-gold text-brand-black hover:bg-brand-gold-light transition-colors font-black text-lg ${body}`}
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
