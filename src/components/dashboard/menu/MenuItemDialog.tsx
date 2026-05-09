'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createMenuItem } from '@/app/[locale]/dashboard/menu/actions'
import { toast } from '@/lib/toast'
import { slugify } from '@/lib/menu'
import { MENU_CATEGORIES, getSlugPrefix, type MenuCategoryId } from '@/constants/menu-categories'
import { ALL_STATIONS } from '@/lib/kds/constants'
import { STATION_CONFIG } from '@/constants/kds'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus } from 'lucide-react'
import MenuImageInput from '@/components/dashboard/menu/MenuImageInput'
import type { KDSStation } from '@/lib/supabase/custom-types'

interface DialogTranslations {
  add_item:                   string
  add_item_title:             string
  menu_item_form_description: string
  item_slug:                  string
  price:                      string
  name_ar:                    string
  name_en:                    string
  description_ar:             string
  description_en:             string
  category_id:                string
  kds_station:                string
  image_url:                  string
  create:                     string
  add_success:                string
  error:                      string
}

interface Props {
  mode:         'add'
  translations: DialogTranslations
  locale:       string
}

const EMPTY_FORM = {
  name_ar:        '',
  name_en:        '',
  description_ar: '',
  description_en: '',
  price_bhd:      0,
  category:       '' as MenuCategoryId | '',
  image_url:      '',
  station:        'main' as KDSStation,
  is_available:   true,
}

export default function MenuItemDialog({ translations: t, locale }: Props) {
  const router  = useRouter()
  const isAr    = locale === 'ar'
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [slugOverride, setSlugOverride] = useState('')
  const [slugEditing, setSlugEditing]   = useState(false)

  const autoSlug = useMemo(() => {
    if (!formData.category || !formData.name_en.trim()) return ''
    return `${getSlugPrefix(formData.category)}-${slugify(formData.name_en)}`
  }, [formData.category, formData.name_en])

  const effectiveSlug = slugEditing && slugOverride ? slugOverride : autoSlug

  useEffect(() => {
    if (!open) {
      setFormData({ ...EMPTY_FORM })
      setSlugOverride('')
      setSlugEditing(false)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!effectiveSlug) return
    setLoading(true)
    try {
      const res = await createMenuItem({ ...formData, id: effectiveSlug })
      if (res.success) {
        toast.success(t.add_success)
        setOpen(false)
        router.refresh()
      } else {
        toast.error(res.error ?? t.error)
      }
    } catch {
      toast.error(t.error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-brand-gold hover:bg-brand-gold/90 text-brand-surface font-bold">
          <Plus className="me-2 h-4 w-4" />
          {t.add_item}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" dir={isAr ? 'rtl' : 'ltr'}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t.add_item_title}</DialogTitle>
            <DialogDescription>{t.menu_item_form_description}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Names */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name_ar">{t.name_ar}</Label>
                <Input
                  id="name_ar"
                  required
                  dir="rtl"
                  className="font-almarai"
                  value={formData.name_ar}
                  onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name_en">{t.name_en}</Label>
                <Input
                  id="name_en"
                  required
                  dir="ltr"
                  value={formData.name_en}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                />
              </div>
            </div>

            {/* Category + Price */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">{t.category_id}</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v as MenuCategoryId })}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {MENU_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {isAr ? cat.ar : cat.en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">{t.price} (BHD)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.001"
                  min="0"
                  required
                  className="text-brand-gold font-bold tabular-nums"
                  value={formData.price_bhd}
                  onChange={(e) => setFormData({ ...formData, price_bhd: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label>{t.item_slug} (ID)</Label>
              {!slugEditing ? (
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-md border border-brand-border bg-brand-surface-2 px-3 py-2 text-xs font-mono text-brand-muted truncate">
                    {effectiveSlug || '—'}
                  </code>
                  <button
                    type="button"
                    onClick={() => { setSlugOverride(effectiveSlug); setSlugEditing(true) }}
                    className="text-xs text-brand-gold hover:underline whitespace-nowrap"
                    disabled={!effectiveSlug}
                  >
                    {isAr ? 'تعديل' : 'Edit'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    value={slugOverride}
                    onChange={(e) => setSlugOverride(e.target.value)}
                    placeholder="item-slug-name"
                    className="font-mono text-xs"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => { setSlugEditing(false); setSlugOverride('') }}
                    className="text-xs text-brand-muted hover:underline whitespace-nowrap"
                  >
                    {isAr ? 'تلقائي' : 'Auto'}
                  </button>
                </div>
              )}
            </div>

            {/* Descriptions */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="description_ar">{t.description_ar}</Label>
                <Textarea
                  id="description_ar"
                  dir="rtl"
                  className="font-almarai"
                  value={formData.description_ar}
                  onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description_en">{t.description_en}</Label>
                <Textarea
                  id="description_en"
                  dir="ltr"
                  value={formData.description_en}
                  onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                />
              </div>
            </div>

            {/* Station */}
            <div className="space-y-2">
              <Label htmlFor="station">{t.kds_station}</Label>
              <Select
                value={formData.station}
                onValueChange={(v) => setFormData({ ...formData, station: v as KDSStation })}
              >
                <SelectTrigger id="station">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STATIONS.map((s) => {
                    const cfg = STATION_CONFIG[s] ?? STATION_CONFIG['main']!
                    return (
                      <SelectItem key={s} value={s}>
                        {`${cfg.icon}  ${isAr ? cfg.label.ar : cfg.label.en}`}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Image */}
            <MenuImageInput
              label={t.image_url}
              value={formData.image_url}
              onChange={(url) => setFormData({ ...formData, image_url: url })}
              isAr={isAr}
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={loading || !effectiveSlug}
              className="w-full bg-brand-gold text-brand-surface hover:bg-brand-gold/90"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
