import { getSession } from '@/lib/auth/session'
import { getMenuData } from '@/lib/menu.server'
import { getTranslations } from 'next-intl/server'
import { AlertCircle, ShoppingBag } from 'lucide-react'
import MenuItemDialog from '@/components/dashboard/menu/MenuItemDialog'
import MenuManager from '@/components/dashboard/menu/MenuManager'
import SyncMenuButton from '@/components/dashboard/menu/SyncMenuButton'
import ExportMenuButton from '@/components/dashboard/menu/ExportMenuButton'

// Auth-gated route — getSession() reads cookies, so static prerender is
// impossible. Marking dynamic up front silences the DYNAMIC_SERVER_USAGE
// warning that otherwise spams Vercel build logs on every deploy.
export const dynamic = 'force-dynamic'

export default async function MenuDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const [t, user, menuCategories] = await Promise.all([
    getTranslations('dashboard'),
    getSession(),
    getMenuData(),
  ])

  const isPrivileged = user?.role === 'owner' || user?.role === 'general_manager'
  // Sync-from-JSON is a developer escape hatch — it overwrites owner edits
  // with the static fixture. Gated behind an explicit env flag so the owner
  // never sees the button in production. Set NEXT_PUBLIC_ENABLE_MENU_SYNC=true
  // in your local .env to use it.
  const showSyncButton = isPrivileged && process.env.NEXT_PUBLIC_ENABLE_MENU_SYNC === 'true'

  const clientT = {
    add_item:                   t('add_item'),
    add_item_title:             t('add_item_title'),
    edit_item_title:            t('edit_item_title'),
    menu_item_form_description: t('menu_item_form_description'),
    item_slug:                  t('item_slug'),
    price:                      t('price'),
    name_ar:                    t('name_ar'),
    name_en:                    t('name_en'),
    description_ar:             t('description_ar'),
    description_en:             t('description_en'),
    category_id:                t('category_id'),
    kds_station:                t('kds_station'),
    image_url:                  t('image_url'),
    create:                     t('create'),
    save:                       t('save'),
    cancel:                     t('cancel'),
    delete:                     t('delete'),
    delete_item_title:          t('delete_item_title'),
    delete_item_description:    t('delete_item_description'),
    cannot_undo:                t('cannot_undo'),
    add_success:                t('add_success'),
    update_success:             t('update_success'),
    delete_success:             t('delete_success'),
    error:                      t('error'),
    items:                      t('items'),
  }

  const allItems       = menuCategories.flatMap((cat) => cat.items)
  const outOfStockCount = allItems.filter((i) => !i.available).length
  const hasAnalytics   = process.env.NEXT_PUBLIC_GA_ID && process.env.NEXT_PUBLIC_CLARITY_ID

  return (
    <div className="space-y-6 p-6">
      {/* Analytics alert — owners / GMs only */}
      {!hasAnalytics && isPrivileged && (
        <div className="rounded-xl border border-brand-gold/50 bg-brand-gold/10 p-4 flex items-center gap-3">
          <div className="rounded-full bg-brand-gold/20 p-2 text-brand-gold">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-brand-gold">
              {locale === 'ar'
                ? 'تنبيه: إعدادات التحليلات مفقودة'
                : 'Notice: Analytics Config Missing'}
            </h4>
            <p className="text-xs text-muted-foreground">
              {locale === 'ar'
                ? 'تتبع الأداء (GA4/Clarity) غير مفعّل. يرجى تزويد معرّفات الربط في إعدادات Vercel.'
                : 'Performance tracking (GA4/Clarity) is disabled. Please add the IDs in Vercel settings.'}
            </p>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-brand-gold/20 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-brand-gold">
            {t('menu_management')}
          </h1>
          <p className="text-muted-foreground">{t('manage_availability_description')}</p>
        </div>

        <div className="flex items-center gap-3">
          {showSyncButton && (
            <SyncMenuButton
              syncLabel={t('sync_data')}
              successMsg={t('sync_success')}
              errorMsg={t('sync_error')}
            />
          )}
          {isPrivileged && (
            <ExportMenuButton
              label={locale === 'ar' ? 'تصدير JSON' : 'Export JSON'}
              successMsg={locale === 'ar' ? 'تم تصدير القائمة' : 'Menu exported'}
              errorMsg={locale === 'ar' ? 'فشل التصدير' : 'Export failed'}
            />
          )}
          <MenuItemDialog mode="add" translations={clientT} locale={locale} />
        </div>
      </div>

      {/* Out-of-stock counter */}
      <div className="flex justify-end">
        <div className="flex min-w-[150px] items-center gap-3 rounded-xl border border-brand-gold/20 bg-muted/20 p-4">
          <div className="rounded-full bg-brand-error/10 p-2 text-brand-error">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t('out_of_stock')}</p>
            <p className="text-2xl font-bold">{outOfStockCount}</p>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {menuCategories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-gold/20 bg-muted/5 py-12">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="rounded-full bg-muted p-4">
              <ShoppingBag className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">{t('menu_empty_title')}</h3>
              <p className="text-muted-foreground max-w-xs">{t('menu_empty_description')}</p>
            </div>
            <div className="flex gap-4 pt-4">
              <MenuItemDialog mode="add" translations={clientT} locale={locale} />
            </div>
          </div>
        </div>
      ) : (
        <MenuManager
          initialCategories={menuCategories}
          locale={locale}
          translations={clientT}
        />
      )}
    </div>
  )
}
