'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, FilterX } from 'lucide-react'
import Image from 'next/image'
import AvailabilityToggle from './AvailabilityToggle'
import EditMenuItemDialog from './EditMenuItemDialog'
import DeleteMenuItemConfirm from './DeleteMenuItemConfirm'
import { getStationConfig } from '@/constants/kds'
import type { KDSStation } from '@/lib/supabase/custom-types'

interface MenuItem {
  id:               string
  name:             { ar: string; en: string }
  description?:     { ar: string; en: string }
  price_bhd?:       number | null
  fromPrice?:       number
  hasMultiplePrices?: boolean
  available:        boolean
  image:            string
  station?:         string
}

interface MenuCategory {
  id:      string
  nameAR:  string
  nameEN?: string
  items:   MenuItem[]
}

interface MenuTranslations {
  add_item:                   string
  add_item_title:             string
  edit_item_title:            string
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
  save:                       string
  cancel:                     string
  delete:                     string
  delete_item_title:          string
  delete_item_description:    string
  cannot_undo:                string
  add_success:                string
  update_success:             string
  delete_success:             string
  error:                      string
  items:                      string
}

interface Props {
  initialCategories: MenuCategory[]
  locale:            string
  translations:      MenuTranslations
}

export default function MenuManager({ initialCategories, locale, translations: t }: Props) {
  const router = useRouter()
  const isAr   = locale === 'ar'

  const [search, setSearch]               = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const filteredData = useMemo(() => {
    return initialCategories
      .map((cat) => {
        if (categoryFilter !== 'all' && cat.id !== categoryFilter) {
          return { ...cat, items: [] }
        }
        const q = search.toLowerCase()
        const filteredItems = cat.items.filter((item) => {
          const nameAr = item.name.ar.toLowerCase()
          const nameEn = item.name.en.toLowerCase()
          const descAr = (item.description?.ar ?? '').toLowerCase()
          const descEn = (item.description?.en ?? '').toLowerCase()
          return (
            nameAr.includes(q) ||
            nameEn.includes(q) ||
            descAr.includes(q) ||
            descEn.includes(q) ||
            item.id.toLowerCase().includes(q)
          )
        })
        return { ...cat, items: filteredItems }
      })
      .filter((cat) => cat.items.length > 0)
  }, [initialCategories, search, categoryFilter])

  function onMutationSuccess() {
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Filters bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-muted/30 p-4 rounded-xl border border-brand-gold/10">
        <div className="relative flex-1 w-full">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={isAr ? 'بحث عن صنف...' : 'Search items...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-10 border-brand-gold/20 focus:ring-brand-gold"
          />
        </div>

        <div className="w-full md:w-[200px]">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="border-brand-gold/20">
              <FilterX className="me-2 h-4 w-4 text-brand-gold" />
              <SelectValue placeholder={isAr ? 'كل الفئات' : 'All Categories'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isAr ? 'كل الفئات' : 'All Categories'}</SelectItem>
              {initialCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {isAr ? cat.nameAR : (cat.nameEN ?? cat.nameAR)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredData.length === 0 ? (
        <div className="py-20 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted">
            <Search className="h-8 w-8 text-muted-foreground opacity-20" />
          </div>
          <p className="text-muted-foreground italic">
            {isAr ? 'لا توجد نتائج تطابق بحثك' : 'No results found for your search'}
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredData.map((category) => (
            <Card key={category.id} className="overflow-hidden border-brand-gold/20">
              <CardHeader className="bg-muted/50 border-b border-brand-gold/10">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold">
                      {isAr ? category.nameAR : (category.nameEN ?? category.nameAR)}
                    </CardTitle>
                    <CardDescription>
                      {category.items.length} {t.items}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="divide-y divide-brand-gold/10">
                  {category.items.map((item) => {
                    const stationKey    = (item.station ?? 'unassigned') as KDSStation
                    const stationCfg    = getStationConfig(stationKey)
                    const description   = isAr ? item.description?.ar ?? '' : item.description?.en ?? ''
                    const descPreview   = description.length > 50 ? `${description.slice(0, 50).trim()}…` : description

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-muted/10 transition-colors"
                      >
                        {/* Item info */}
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-brand-gold/20 bg-muted shadow-sm">
                            <Image
                              src={item.image}
                              alt={isAr ? item.name.ar : item.name.en}
                              fill
                              sizes="56px"
                              className="object-cover transition-transform hover:scale-110"
                              unoptimized={item.image.startsWith('http')}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-lg leading-tight truncate">
                              {isAr ? item.name.ar : item.name.en}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                              <span className="font-black text-brand-gold tabular-nums">
                                {item.hasMultiplePrices ? (isAr ? 'من ' : 'From ') : ''}
                                {(item.fromPrice ?? item.price_bhd ?? 0).toFixed(3)} BHD
                              </span>
                              <span
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border"
                                style={{
                                  color:       stationCfg.color,
                                  borderColor: `${stationCfg.color}55`,
                                  background:  `${stationCfg.color}1a`,
                                }}
                              >
                                <span aria-hidden="true">{stationCfg.icon}</span>
                                {isAr ? stationCfg.label.ar : stationCfg.label.en}
                              </span>
                            </div>
                            {descPreview && (
                              <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                                {descPreview}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <div className="flex items-center gap-1 sm:border-s sm:ps-3 border-brand-gold/10">
                            <EditMenuItemDialog
                              item={{
                                id:             item.id,
                                name_ar:        item.name.ar,
                                name_en:        item.name.en,
                                description_ar: item.description?.ar ?? '',
                                description_en: item.description?.en ?? '',
                                price_bhd:      item.price_bhd ?? item.fromPrice ?? 0,
                                category:       category.id,
                                image_url:      item.image ?? '',
                                station:        stationKey,
                                is_available:   item.available,
                              }}
                              locale={isAr ? 'ar' : 'en'}
                              onSuccess={onMutationSuccess}
                            />
                            <DeleteMenuItemConfirm
                              id={item.id}
                              name={isAr ? item.name.ar : item.name.en}
                              translations={t}
                              onSuccess={onMutationSuccess}
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border ${
                                item.available
                                  ? 'bg-brand-success/10 text-brand-success border-brand-success/20'
                                  : 'bg-brand-error/10 text-brand-error border-brand-error/20'
                              }`}
                            >
                              {item.available
                                ? (isAr ? 'متوفر' : 'In Stock')
                                : (isAr ? 'نفذ' : 'Sold Out')}
                            </span>
                            <AvailabilityToggle
                              slug={item.id}
                              initialAvailable={item.available}
                              onSuccess={onMutationSuccess}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
