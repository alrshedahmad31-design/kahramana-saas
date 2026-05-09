'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Upload, Loader2, Trash2 } from 'lucide-react'
import { uploadMenuImage } from '@/app/[locale]/dashboard/menu/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/lib/toast'

const MAX_INPUT_BYTES = 5 * 1024 * 1024  // 5 MB pre-conversion ceiling
const MAX_DIMENSION   = 1600
const WEBP_QUALITY    = 0.85
const ACCEPTED        = 'image/webp,image/jpeg,image/png'

interface Props {
  /** Current image URL (relative path or https://). */
  value: string
  /** Called with the new URL when upload succeeds or the user edits the field. */
  onChange: (url: string) => void
  /** Optional label override. */
  label?: string
  /** Locale flag — currently only used to flip helper-text language. */
  isAr?: boolean
}

/**
 * Compress to WebP via Canvas API. Caps longest edge at MAX_DIMENSION and
 * preserves aspect ratio. Returns the original file unchanged if the browser
 * cannot encode WebP (older Safari etc.) — server still accepts JPEG/PNG.
 */
async function fileToWebp(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      try {
        const longest = Math.max(img.naturalWidth, img.naturalHeight)
        const scale   = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1
        const width   = Math.round(img.naturalWidth  * scale)
        const height  = Math.round(img.naturalHeight * scale)

        const canvas  = document.createElement('canvas')
        canvas.width  = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(url)
          resolve(file)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url)
            if (!blob) {
              resolve(file)
              return
            }
            resolve(blob)
          },
          'image/webp',
          WEBP_QUALITY,
        )
      } catch {
        URL.revokeObjectURL(url)
        resolve(file)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image_decode_failed'))
    }
    img.src = url
  })
}

export default function MenuImageInput({ value, onChange, label, isAr = true }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading]   = useState(false)
  const [progress, setProgress]     = useState(0)         // 0–100, simple visual marker
  const [localPreview, setLocalPrev] = useState<string>('')

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview)
    }
  }, [localPreview])

  const previewSrc = localPreview || value.trim()
  const isExternal = previewSrc.startsWith('http')

  async function handleFile(file: File) {
    if (file.size > MAX_INPUT_BYTES) {
      toast.error(isAr ? 'الملف أكبر من 5 ميغابايت' : 'File larger than 5 MB')
      return
    }

    setUploading(true)
    setProgress(15)

    // Show local preview immediately
    if (localPreview) URL.revokeObjectURL(localPreview)
    setLocalPrev(URL.createObjectURL(file))

    try {
      setProgress(40)
      const blob = await fileToWebp(file).catch(() => file)
      setProgress(70)

      // Final size guard (server enforces 2 MB; warn early on client)
      if (blob.size > 2 * 1024 * 1024) {
        toast.error(isAr ? 'حجم الصورة بعد الضغط لا يزال أكبر من 2 ميغابايت' : 'Compressed size still over 2 MB')
        setUploading(false)
        setProgress(0)
        return
      }

      const fd = new FormData()
      const upload = blob instanceof File
        ? blob
        : new File([blob], 'upload.webp', { type: blob.type || 'image/webp' })
      fd.set('file', upload)

      const res = await uploadMenuImage(fd)
      setProgress(100)

      if (!res.success) {
        toast.error(res.error)
        setUploading(false)
        setProgress(0)
        return
      }

      // Clear the blob preview so the Supabase URL is shown instead
      URL.revokeObjectURL(localPreview)
      setLocalPrev('')
      onChange(res.url)
      toast.success(isAr ? 'تم رفع الصورة' : 'Image uploaded')
    } catch (err) {
      console.error('[MenuImageInput] upload failed:', err)
      toast.error(isAr ? 'فشل رفع الصورة' : 'Upload failed')
    } finally {
      setUploading(false)
      // Reset the file input so re-uploading the same file fires onChange
      if (fileRef.current) fileRef.current.value = ''
      // Keep progress bar at 100 briefly, then clear
      setTimeout(() => setProgress(0), 600)
    }
  }

  function handleClear() {
    if (localPreview) {
      URL.revokeObjectURL(localPreview)
      setLocalPrev('')
    }
    onChange('')
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="menu-image-file">
        {label ?? (isAr ? 'صورة الصنف' : 'Item image')}
      </Label>

      <div className="flex items-start gap-3">
        {/* Preview */}
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-brand-gold/20 bg-brand-surface-2">
          {previewSrc ? (
            <Image
              src={previewSrc}
              alt=""
              fill
              sizes="80px"
              className="object-cover"
              unoptimized={isExternal || previewSrc.startsWith('blob:')}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-brand-muted">
              —
            </div>
          )}
        </div>

        {/* Upload + clear */}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              id="menu-image-file"
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleFile(f)
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="gap-1.5"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading
                ? (isAr ? 'جارٍ الرفع…' : 'Uploading…')
                : (isAr ? 'رفع صورة' : 'Upload image')}
            </Button>
            {value && !uploading && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-brand-muted hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Progress bar */}
          {uploading && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-surface-2">
              <div
                className="h-full bg-brand-gold transition-all"
                style={{ inlineSize: `${progress}%` }}
              />
            </div>
          )}

          {/* URL fallback */}
          <Input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={isAr ? 'أو الصق رابط https:// أو /assets/…' : 'Or paste https:// or /assets/…'}
            maxLength={500}
            className="font-mono text-xs"
          />
          <p className="text-xs text-brand-muted">
            {isAr
              ? 'WebP / JPEG / PNG — حتى 2 ميغابايت بعد الضغط'
              : 'WebP / JPEG / PNG — up to 2 MB after compression'}
          </p>
        </div>
      </div>
    </div>
  )
}
