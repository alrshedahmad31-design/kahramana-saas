'use client'

import { useState, useRef } from 'react'
import NextImage from 'next/image'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'motion/react'
import { tokens } from '@/lib/design-tokens'
import { toast } from '@/lib/toast'
import { uploadDeliveryProof } from '@/app/[locale]/driver/actions'

interface Props {
  orderId: string
  onComplete: (url?: string) => void
  onSkip: () => void
  isOpen: boolean
}

export default function DeliveryProofCapture({ orderId, onComplete, onSkip, isOpen }: Props) {
  const t = useTranslations('driver.deliveryProof')
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 1. Show preview
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    // 2. Compress (async)
    try {
      const compressed = await compressImage(file)
      setImage(compressed)
    } catch (err) {
      console.error('Compression failed', err)
      setImage(file) // fallback
    }
  }

  const handleSubmit = async () => {
    if (!image) return
    setIsUploading(true)
    try {
      const res = await uploadDeliveryProof(orderId, image)
      if (res.success) {
        toast.success(t('success'))
        onComplete(res.url)
      } else {
        toast.error(res.error)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onSkip}
        />
        
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-md overflow-hidden rounded-xl border border-brand-gold/20 bg-brand-surface shadow-2xl"
          style={{ backgroundColor: tokens.color.surface }}
        >
          {/* Header */}
          <div className="border-b border-brand-gold/10 p-4">
            <h3 className="text-center text-lg font-bold text-brand-gold" style={{ fontFamily: tokens.font.arHeading }}>
              {t('title')}
            </h3>
            <p className="mt-1 text-center text-sm text-brand-muted" style={{ fontFamily: tokens.font.arBody }}>
              {t('instruction')}
            </p>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="relative aspect-square w-full overflow-hidden rounded-lg border-2 border-dashed border-brand-gold/20 bg-black/20">
              {preview ? (
                <NextImage
                  src={preview}
                  alt="Proof"
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 100vw, 400px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center space-y-3">
                  <div className="rounded-full bg-brand-gold/10 p-4">
                    <CameraIcon className="h-10 w-10 text-brand-gold" />
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-full bg-brand-gold px-6 py-2 text-sm font-bold text-brand-black active:scale-95"
                  >
                    {t('capture')}
                  </button>
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleCapture}
              />
            </div>

            {preview && !isUploading && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 w-full text-center text-sm text-brand-gold underline"
              >
                {t('retake')}
              </button>
            )}
          </div>

          {/* Footer */}
          <div className="flex border-t border-brand-gold/10 p-4">
            <button
              onClick={onSkip}
              disabled={isUploading}
              className="flex-1 rounded-lg py-3 text-sm font-bold text-brand-muted active:bg-white/5 disabled:opacity-50"
            >
              {t('skip')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!image || isUploading}
              className="flex-[2] rounded-lg bg-brand-gold py-3 text-sm font-bold text-brand-black active:bg-brand-gold-light disabled:opacity-50 disabled:grayscale"
            >
              {isUploading ? t('uploading') : t('confirm')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        const MAX_WIDTH = 1200
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width
          width = MAX_WIDTH
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], `proof-${Date.now()}.jpg`, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              })
              resolve(compressedFile)
            } else {
              reject(new Error('Canvas toBlob failed'))
            }
          },
          'image/jpeg',
          0.7
        )
      }
    }
    reader.onerror = (error) => reject(error)
  })
}
