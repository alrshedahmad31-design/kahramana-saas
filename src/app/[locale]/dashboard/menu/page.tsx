import { getMenuData } from '@/lib/menu.server'
import { getTranslations } from 'next-intl/server'
import AvailabilityToggle from '@/components/dashboard/menu/AvailabilityToggle'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Search, ShoppingBag, AlertCircle } from 'lucide-react'
import Image from 'next/image'

export default async function MenuDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('dashboard')
  
  const menuData = await getMenuData()
  
  // Flatten items for easier display/filter
  const allItems = menuData.flatMap(cat => cat.items)
  const outOfStockCount = allItems.filter(i => !i.available).length

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('menu_management')}</h1>
          <p className="text-muted-foreground">{t('manage_availability_description')}</p>
        </div>
        
        <div className="flex items-center gap-4">
          <form action={async () => {
            'use server'
            const { syncMenuItemsWithDatabase } = await import('./actions')
            await syncMenuItemsWithDatabase()
          }}>
            <button 
              type="submit"
              className="inline-flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80"
            >
              <ShoppingBag className="h-4 w-4" />
              {t('sync_data')}
            </button>
          </form>

          <Card className="min-w-[150px]">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-full bg-orange-100 p-2 text-orange-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('out_of_stock')}</p>
                <p className="text-2xl font-bold">{outOfStockCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute ps-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder={t('search_menu_items')} 
          className="ps-10" 
        />
      </div>

      <div className="grid gap-6">
        {menuData.map((category) => (
          <Card key={category.id} className="overflow-hidden">
            <CardHeader className="bg-muted/30">
              <CardTitle className="flex items-center justify-between">
                <span>{locale === 'ar' ? category.nameAR : category.nameEN}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {category.items.length} {t('items')}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {category.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="relative h-12 w-12 overflow-hidden rounded-md border bg-muted">
                        <Image
                          src={item.image}
                          alt={locale === 'ar' ? item.name.ar : item.name.en}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <p className="font-semibold">{locale === 'ar' ? item.name.ar : item.name.en}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.price_bhd?.toFixed(3)} BHD
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        item.available 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {item.available ? t('in_stock') : t('out_of_stock')}
                      </span>
                      <AvailabilityToggle slug={item.id} initialAvailable={item.available} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
