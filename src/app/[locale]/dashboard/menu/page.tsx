import { getMenuData } from '@/lib/menu.server'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import AvailabilityToggle from '@/components/dashboard/menu/AvailabilityToggle'
import MenuItemDialog from '@/components/dashboard/menu/MenuItemDialog'
import EditMenuItemDialog from '@/components/dashboard/menu/EditMenuItemDialog'
import DeleteMenuItemConfirm from '@/components/dashboard/menu/DeleteMenuItemConfirm'
import Image from 'next/image'
import { AlertCircle, ShoppingBag } from 'lucide-react'
import { STATION_CONFIG } from '@/constants/kds'
import type { KDSStation } from '@/lib/supabase/custom-types'

export default async function MenuDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations('dashboard')
  const menuCategories = await getMenuData()

  // Prepare translations for client components
  const clientT = {
    add_item: t('add_item'),
    add_item_title: t('add_item_title'),
    edit_item_title: t('edit_item_title'),
    menu_item_form_description: t('menu_item_form_description'),
    item_slug: t('item_slug'),
    price: t('price'),
    name_ar: t('name_ar'),
    name_en: t('name_en'),
    description_ar: t('description_ar'),
    description_en: t('description_en'),
    category_id: t('category_id'),
    kds_station: t('kds_station'),
    image_url: t('image_url'),
    create: t('create'),
    save: t('save'),
    cancel: t('cancel'),
    delete: t('delete'),
    delete_item_title: t('delete_item_title'),
    delete_item_description: t('delete_item_description'),
    cannot_undo: t('cannot_undo'),
    add_success: t('add_success'),
    update_success: t('update_success'),
    delete_success: t('delete_success'),
    error: t('error')
  }

  const allItems = menuCategories.flatMap(cat => cat.items)
  const outOfStockCount = allItems.filter(i => !i.available).length

  return (
    <div className="space-y-6 p-6">
      {/* Custom Header since SectionHeader is limited */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-brand-gold/20 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-brand-gold">{t('menu_management')}</h1>
          <p className="text-muted-foreground">
            {t('manage_availability_description')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form action={async () => {
            'use server'
            const { syncMenuItemsWithDatabase } = await import('./actions')
            await syncMenuItemsWithDatabase()
          }}>
            <button 
              type="submit"
              className="inline-flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80 h-10 border border-brand-gold/20"
            >
              <ShoppingBag className="h-4 w-4 text-brand-gold" />
              {t('sync_data')}
            </button>
          </form>
          <MenuItemDialog mode="add" translations={clientT} />
        </div>
      </div>

      <div className="flex justify-end">
        <Card className="min-w-[150px] border-brand-gold/20 bg-muted/20">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-full bg-brand-error/10 p-2 text-brand-error">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('out_of_stock')}</p>
              <p className="text-2xl font-bold">{outOfStockCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {menuCategories.length === 0 ? (
        <Card className="border-dashed border-brand-gold/20 bg-muted/5 py-12">
          <CardContent className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="rounded-full bg-muted p-4">
              <ShoppingBag className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">قائمة الطعام فارغة</h3>
              <p className="text-muted-foreground max-w-xs">
                لا توجد أصناف في قاعدة البيانات حالياً. يمكنك مزامنة البيانات من الملف الأساسي أو إضافة أصناف يدوياً.
              </p>
            </div>
            <div className="flex gap-4 pt-4">
              <form action={async () => {
                'use server'
                const { syncMenuItemsWithDatabase } = await import('./actions')
                await syncMenuItemsWithDatabase()
              }}>
                <button 
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-md bg-brand-gold px-6 py-2 text-sm font-medium text-brand-surface hover:bg-brand-gold/90 transition-colors"
                >
                  <ShoppingBag className="h-4 w-4" />
                  {t('sync_data')}
                </button>
              </form>
              <MenuItemDialog mode="add" translations={clientT} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {menuCategories.map((category) => (
            <Card key={category.id} className="overflow-hidden border-brand-gold/20">
              <CardHeader className="bg-muted/50 border-b border-brand-gold/10">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold">
                      {locale === 'ar' ? category.nameAR : category.nameEN}
                    </CardTitle>
                    <CardDescription>
                      {category.items.length} {t('items')}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-brand-gold/10 text-brand-gold border-brand-gold/20">
                    {category.id}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-brand-gold/10">
                  {category.items.map((item) => {
                    const stationKey = (item.station ?? 'main') as KDSStation
                    const stationCfg = STATION_CONFIG[stationKey] ?? STATION_CONFIG['main']!
                    const description = locale === 'ar'
                      ? item.description?.ar ?? ''
                      : item.description?.en ?? ''
                    const descriptionPreview = description.length > 50
                      ? `${description.slice(0, 50).trim()}…`
                      : description

                    return (
                      <div key={item.id} className="flex items-center justify-between gap-4 p-4 hover:bg-muted/10 transition-colors">
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-brand-gold/20 bg-muted">
                            <Image
                              src={item.image}
                              alt={locale === 'ar' ? item.name.ar : item.name.en}
                              fill
                              sizes="48px"
                              className="object-cover"
                              unoptimized={item.image.startsWith('http')}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold truncate">
                              {locale === 'ar' ? item.name.ar : item.name.en}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                              <span className="font-bold text-brand-gold tabular-nums">
                                {item.price_bhd?.toFixed(3)} BHD
                              </span>
                              <span
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border"
                                style={{
                                  color:        stationCfg.color,
                                  borderColor:  `${stationCfg.color}55`,
                                  background:   `${stationCfg.color}1a`,
                                }}
                              >
                                <span aria-hidden="true">{stationCfg.icon}</span>
                                {locale === 'ar' ? stationCfg.label.ar : stationCfg.label.en}
                              </span>
                            </div>
                            {descriptionPreview && (
                              <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                                {descriptionPreview}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-1 border-s ps-3 border-brand-gold/10">
                            <EditMenuItemDialog
                              item={{
                                id:             item.id,
                                name_ar:        item.name.ar,
                                name_en:        item.name.en,
                                description_ar: item.description?.ar ?? '',
                                description_en: item.description?.en ?? '',
                                price_bhd:      item.price_bhd ?? 0,
                                category:       category.id,
                                image_url:      item.image ?? '',
                                station:        stationKey,
                              }}
                              locale={locale === 'ar' ? 'ar' : 'en'}
                            />
                            <DeleteMenuItemConfirm
                              id={item.id}
                              name={locale === 'ar' ? item.name.ar : item.name.en}
                              translations={clientT}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                              item.available
                                ? 'bg-brand-success/10 text-brand-success'
                                : 'bg-brand-error/10 text-brand-error'
                            }`}>
                              {item.available ? t('in_stock') : t('out_of_stock')}
                            </span>
                            <AvailabilityToggle slug={item.id} initialAvailable={item.available} />
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
