'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface KDSDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel?: () => void
}

export default function KDSDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'حسناً',
  cancelLabel,
  onConfirm,
  onCancel,
}: KDSDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel || onConfirm}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
          />

          {/* Dialog */}
          <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#0F0F0F] border-2 border-[#C8922A] w-full max-w-md rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(200,146,42,0.2)] pointer-events-auto"
              dir="rtl"
            >
              <div className="p-8">
                <h3 className="text-2xl font-black text-[#C8922A] mb-4 font-[Cairo] leading-tight">
                  {title}
                </h3>
                <p className="text-gray-300 text-lg font-medium leading-relaxed">
                  {message}
                </p>
              </div>

              <div className="flex border-t border-[#C8922A]/20">
                {cancelLabel && (
                  <button
                    onClick={onCancel}
                    className="flex-1 p-5 text-gray-400 hover:bg-white/5 transition-colors font-bold text-lg border-e border-[#C8922A]/20"
                  >
                    {cancelLabel}
                  </button>
                )}
                <button
                  onClick={onConfirm}
                  className="flex-1 p-5 bg-[#C8922A] text-black hover:bg-[#E8B86D] transition-colors font-black text-lg"
                >
                  {confirmLabel}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
