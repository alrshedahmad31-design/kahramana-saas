'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Pencil, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { updateMenuItem } from '@/app/[locale]/dashboard/menu/actions'
import { toast } from '@/lib/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { STATION_CONFIG } from '@/constants/kds'
import { MENU_CATEGORIES, type MenuCategoryId } from '@/constants/menu-categories'
import type { KDSStation } from '@/lib/supabase/custom-types'

const STATIONS: KDSStation[] = ['main', 'grill', 'shawarma', 'bakery', 'appetizer_drinks']

interface EditableItem {
  id:             string
  name_ar:        string
  name_en:        string
  description_ar: string
  description_en: string
  price_bhd:      number
  category:       string
  image_url:      string
  station:        string
}

interface Props {
  item:   EditableItem
  locale: 'ar' | 'en'
}

export default function EditMenuItemDialog({ item, locale }: Props) {
  const t = useTranslations('dashboard')
  const isAr = locale === 'ar'
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'ar' | 'en'>(isAr ? 'ar' : 'en')

  const [form, setForm] = useState<EditableItem>(item)

  useEffect(() => {
    if (open) {
      setForm(item)
      setTab(isAr ? 'ar' : 'en')
    }
  }, [open, item, isAr])

  const stationKey = (STATIONS.includes(form.station as KDSStation)
    ? form.station
    : 'main') as KDSStation
  const stationCfg = STATION_CONFIG[stationKey] ?? STATION_CONFIG['main']!

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name_ar.trim() || !form.name_en.trim()) {
      toast.error(t('error'))
      return
    }
    if (!Number.isFinite(form.price_bhd) || form.price_bhd <= 0) {
      toast.error(t('error'))
      return
    }

    setLoading(true)
    try {
      const result = await updateMenuItem(form.id, {
        name_ar:        form.name_ar.trim(),
        name_en:        form.name_en.trim(),
        description_ar: form.description_ar.trim(),
        description_en: form.description_en.trim(),
        price_bhd:      Number(form.price_bhd),
        category:       form.category,
        image_url:      form.image_url.trim(),
        station:        stationKey,
      })

      if (result.success) {
        toast.success(t('update_success'))
        setOpen(false)
      } else {
        toast.error(result.error ?? t('error'))
      }
    } catch (err) {
      console.error(err)
      toast.error(t('error'))
    } finally {
      setLoading(false)
    }
  }

  const previewSrc = form.image_url.trim()
  const isExternalImage = previewSrc.startsWith('http')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 border-brand-gold/40 text-brand-gold hover:bg-brand-gold/10 hover:text-brand-gold"
          aria-label={t('edit_item_title')}
        >
          <Pencil className="h-4 w-4" />
          <span className="hidden sm:inline">{isAr ? 'تعديل' : 'Edit'}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="text-brand-gold">{t('edit_item_title')}</DialogTitle>
            <DialogDescription>{t('menu_item_form_description')}</DialogDescription>
          </DialogHeader>

          {/* Slug — read-only after creation. Changing it would break URLs. */}
          <div className="space-y-1">
            <Label htmlFor="slug-readonly" className="text-xs text-brand-muted">
              {t('item_slug')} (ID)
            </Label>
            <Input
              id="slug-readonly"
              value={form.id}
              disabled
              readOnly
              className="font-mono text-xs"
            />
            <p className="text-xs text-brand-muted">
              {isAr
                ? 'لا يمكن تغيير المعرف بعد الإنشاء'
                : 'Slug cannot be changed after creation'}
            </p>
          </div>

          {/* Category — editable Select */}
          <div className="space-y-2">
            <Label htmlFor="category">{t('category_id')}</Label>
            <select
              id="category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as MenuCategoryId })}
              className="flex h-10 w-full items-center rounded-md border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text shadow-sm focus:outline-none focus:border-brand-gold/40 focus:ring-1 focus:ring-brand-gold/40"
            >
              {!MENU_CATEGORIES.some((c) => c.id === form.category) && (
                <option value={form.category}>{form.category}</option>
              )}
              {MENU_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {isAr ? cat.ar : cat.en}
                </option>
              ))}
            </select>
          </div>

          {/* Locale switcher */}
          <div className="inline-flex gap-1 rounded-lg border border-brand-gold/20 bg-brand-surface-2 p-1 self-start">
            <button
              type="button"
              onClick={() => setTab('ar')}
              className={`min-h-[32px] rounded-md px-3 text-sm font-medium transition-colors font-almarai ${
                tab === 'ar'
                  ? 'bg-brand-gold text-brand-surface'
                  : 'text-brand-muted hover:text-brand-text'
              }`}
            >
              العربية
            </button>
            <button
              type="button"
              onClick={() => setTab('en')}
              className={`min-h-[32px] rounded-md px-3 text-sm font-medium transition-colors ${
                tab === 'en'
                  ? 'bg-brand-gold text-brand-surface'
                  : 'text-brand-muted hover:text-brand-text'
              }`}
            >
              English
            </button>
          </div>

          {/* Locale-scoped fields */}
          {tab === 'ar' ? (
            <div className="flex flex-col gap-3" dir="rtl">
              <div className="space-y-2">
                <Label htmlFor="name_ar">{t('name_ar')}</Label>
                <Input
                  id="name_ar"
                  required
                  maxLength={120}
                  className="font-almarai"
                  value={form.name_ar}
                  onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description_ar">{t('description_ar')}</Label>
                <Textarea
                  id="description_ar"
                  rows={3}
                  maxLength={2000}
                  className="font-almarai"
                  value={form.description_ar}
                  onChange={(e) => setForm({ ...form, description_ar: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3" dir="ltr">
              <div className="space-y-2">
                <Label htmlFor="name_en">{t('name_en')}</Label>
                <Input
                  id="name_en"
                  required
                  maxLength={120}
                  value={form.name_en}
                  onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description_en">{t('description_en')}</Label>
                <Textarea
                  id="description_en"
                  rows={3}
                  maxLength={2000}
                  value={form.description_en}
                  onChange={(e) => setForm({ ...form, description_en: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Price (full width) */}
          <div className="space-y-2">
            <Label htmlFor="price">{t('price')} (BHD)</Label>
            <Input
              id="price"
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              required
              className="text-brand-gold font-bold tabular-nums"
              value={form.price_bhd}
              onChange={(e) =>
                setForm({ ...form, price_bhd: Number.parseFloat(e.target.value) || 0 })
              }
            />
          </div>

          {/* Station (full width) */}
          <div className="space-y-2">
            <Label htmlFor="station">{t('kds_station')}</Label>
            <select
              id="station"
              value={stationKey}
              onChange={(e) => setForm({ ...form, station: e.target.value })}
              className="flex h-10 w-full items-center rounded-md border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text shadow-sm focus:outline-none focus:border-brand-gold/40 focus:ring-1 focus:ring-brand-gold/40"
            >
              {STATIONS.map((s) => {
                const cfg = STATION_CONFIG[s] ?? STATION_CONFIG['main']!
                return (
                  <option key={s} value={s}>
                    {`${cfg.icon}  ${isAr ? cfg.label.ar : cfg.label.en}`}
                  </option>
                )
              })}
            </select>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border"
              style={{
                color:        stationCfg.color,
                borderColor:  `${stationCfg.color}55`,
                background:   `${stationCfg.color}1a`,
              }}
            >
              <span aria-hidden="true">{stationCfg.icon}</span>
              {isAr ? stationCfg.label.ar : stationCfg.label.en}
            </span>
          </div>

          {/* Image URL + preview (full width) */}
          <div className="space-y-2">
            <Label htmlFor="image_url">{t('image_url')}</Label>
            <div className="flex items-start gap-3">
              <Input
                id="image_url"
                placeholder="/assets/gallery/image.webp"
                maxLength={500}
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              />
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-brand-gold/20 bg-brand-surface-2">
                {previewSrc ? (
                  <Image
                    src={previewSrc}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                    unoptimized={isExternalImage}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-brand-gold text-brand-surface hover:bg-brand-gold/90"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
