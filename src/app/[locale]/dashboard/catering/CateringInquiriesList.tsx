import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { BRANCHES, type BranchId } from '@/constants/contact'
import { buildCustomerContactLink } from '@/lib/whatsapp'
import {
  CATERING_OCCASION_TYPES,
  CATERING_SERVICE_TYPES,
  type CateringOccasionType,
  type CateringServiceType,
} from '@/lib/whatsapp-catering-message'

interface Props {
  locale:    'ar' | 'en'
  from?:     string
  to?:       string
  occasion?: string
  page:      number
}

const NEW_BADGE_WINDOW_MS = 24 * 60 * 60 * 1000
const PAGE_SIZE           = 25

function isBranchId(value: string | null): value is BranchId {
  if (!value) return false
  return value in BRANCHES
}

function isOccasionType(value: string | null): value is CateringOccasionType {
  return !!value && (CATERING_OCCASION_TYPES as readonly string[]).includes(value)
}

function isServiceType(value: string | null): value is CateringServiceType {
  return !!value && (CATERING_SERVICE_TYPES as readonly string[]).includes(value)
}

function formatDate(iso: string, locale: 'ar' | 'en'): string {
  // Bahrain calendar dates — event_date is a DATE column, no timezone shift needed.
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-BH' : 'en-GB', {
    year:  'numeric',
    month: 'short',
    day:   'numeric',
  }).format(d)
}

function formatDateTime(iso: string, locale: 'ar' | 'en'): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-BH' : 'en-GB', {
    year:   'numeric',
    month:  'short',
    day:    'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  }).format(d)
}

function formatTime(time: string | null, locale: 'ar' | 'en'): string | null {
  if (!time) return null
  // event_time is TIME (HH:MM:SS) — render as HH:MM via the locale.
  const [hh, mm] = time.split(':')
  const d = new Date()
  d.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0)
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-BH' : 'en-GB', {
    hour:   '2-digit',
    minute: '2-digit',
  }).format(d)
}

function shortRef(id: string): string {
  return id.slice(-8).toUpperCase()
}

function isFresh(createdAt: string): boolean {
  const ts = new Date(createdAt).getTime()
  if (Number.isNaN(ts)) return false
  return Date.now() - ts < NEW_BADGE_WINDOW_MS
}

export default async function CateringInquiriesList({ locale, from, to, occasion, page }: Props) {
  const t = await getTranslations('dashboard.catering')
  const isAr = locale === 'ar'

  // Defense-in-depth (P0-10): the parent page guard already restricts the
  // route, but this component talks to the service-role client and bypasses
  // RLS. Re-verify the caller's role here so a refactor that drops the page
  // guard can't silently expose inquiries (with phone + budget) to other
  // staff roles.
  const session = await getSession()
  if (session?.role !== 'owner' && session?.role !== 'general_manager') {
    return (
      <div className="bg-brand-error/10 border border-brand-error/30 rounded-xl p-4 text-sm text-brand-error">
        {t('loadError')}
      </div>
    )
  }

  const supabase = createServiceClient()
  const fromIdx = (page - 1) * PAGE_SIZE
  const toIdx   = fromIdx + PAGE_SIZE - 1

  let query = supabase
    .from('catering_inquiries')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (from)     query = query.gte('event_date', from)
  if (to)       query = query.lte('event_date', to)
  if (occasion) query = query.eq('occasion_type', occasion)

  const { data, error, count } = await query.range(fromIdx, toIdx)

  if (error) {
    return (
      <div className="bg-brand-error/10 border border-brand-error/30 rounded-xl p-4 text-sm text-brand-error">
        {t('loadError')}
      </div>
    )
  }

  const inquiries = data ?? []
  const total     = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (inquiries.length === 0) {
    return (
      <div className="bg-brand-surface border border-brand-border rounded-xl p-8 text-center flex flex-col gap-2">
        <p className={`text-base font-bold text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
          {t('empty.title')}
        </p>
        <p className={`text-sm text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {t('empty.description')}
        </p>
      </div>
    )
  }

  // Preserve filter context across page jumps.
  const baseQs = new URLSearchParams()
  if (from)     baseQs.set('from', from)
  if (to)       baseQs.set('to', to)
  if (occasion) baseQs.set('occasion', occasion)
  const pageHref = (n: number) => {
    const qs = new URLSearchParams(baseQs)
    qs.set('page', String(n))
    return `?${qs.toString()}`
  }
  const showingFrom = fromIdx + 1
  const showingTo   = Math.min(fromIdx + inquiries.length, total)

  return (
    <div className="flex flex-col gap-4" dir={isAr ? 'rtl' : 'ltr'}>
    <ul className="flex flex-col gap-3">
      {inquiries.map((row) => {
        const fresh    = isFresh(row.created_at)
        const branchId = isBranchId(row.preferred_branch) ? row.preferred_branch : null
        const branch   = branchId ? BRANCHES[branchId] : null
        const branchName = branch
          ? (isAr ? branch.nameAr : branch.nameEn)
          : t('values.noBranch')
        const eventTime = formatTime(row.event_time, locale)

        // occasion_type / service_type are persisted as enum keys (see
        // src/lib/whatsapp-catering-message.ts). Translate via i18n;
        // unknown values are legacy locale-rendered strings written by
        // the form before the normalization fix — render those as-is.
        const occasionDisplay = isOccasionType(row.occasion_type)
          ? t(`occasionTypes.${row.occasion_type}`)
          : row.occasion_type
        const serviceDisplay = isServiceType(row.service_type)
          ? t(`serviceTypes.${row.service_type}`)
          : row.service_type

        const waMessage = isAr
          ? `السلام عليكم، بخصوص طلب التقديم الخارجي رقم #${shortRef(row.id)} — كهرمانة بغداد`
          : `Hello, regarding your catering inquiry #${shortRef(row.id)} — Kahramana Baghdad`
        const waLink = buildCustomerContactLink(row.phone, waMessage)

        return (
          <li
            key={row.id}
            className="bg-brand-surface border border-brand-border rounded-xl p-4 md:p-5 flex flex-col gap-3 transition-colors hover:border-brand-gold/30"
          >
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className={`text-base font-bold text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                    {row.name}
                  </h2>
                  {fresh && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-gold/15 text-brand-gold border border-brand-gold/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-gold" />
                      {t('badges.new')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-brand-muted font-mono">#{shortRef(row.id)}</p>
              </div>
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-brand-gold text-brand-black font-bold rounded-lg text-xs whitespace-nowrap hover:opacity-90 transition-opacity"
              >
                {t('whatsappCta')}
              </a>
            </header>

            <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 text-sm">
              <Field label={t('table.phone')} value={row.phone} mono />
              <Field label={t('table.occasion')} value={occasionDisplay} isAr={isAr} />
              <Field
                label={t('table.eventDate')}
                value={
                  eventTime
                    ? `${formatDate(row.event_date, locale)} · ${eventTime}`
                    : formatDate(row.event_date, locale)
                }
                isAr={isAr}
              />
              <Field
                label={t('table.guests')}
                value={new Intl.NumberFormat(locale === 'ar' ? 'ar-BH' : 'en-GB').format(row.guest_count)}
                isAr={isAr}
              />
              <Field label={t('table.serviceType')} value={serviceDisplay} isAr={isAr} />
              <Field label={t('table.area')} value={row.area} isAr={isAr} />
              <Field label={t('table.branch')} value={branchName} isAr={isAr} />
              <Field
                label={t('table.budget')}
                value={row.budget ?? t('values.noBudget')}
                isAr={isAr}
              />
            </dl>

            {row.notes && (
              <div className="border-t border-brand-border pt-3 flex flex-col gap-1">
                <p className={`text-[10px] uppercase tracking-wider font-bold text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {t('notesLabel')}
                </p>
                <p className={`text-sm text-brand-text whitespace-pre-line ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {row.notes}
                </p>
              </div>
            )}

            <footer className="text-[11px] text-brand-muted">
              {t('table.received')}: {formatDateTime(row.created_at, locale)}
            </footer>
          </li>
        )
      })}
    </ul>

    <nav
      aria-label={t('pagination.previous')}
      className="flex flex-wrap items-center justify-between gap-3 bg-brand-surface border border-brand-border rounded-xl px-4 py-3"
    >
      <p className={`text-xs text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
        {t('pagination.showing', { from: showingFrom, to: showingTo, total })}
      </p>

      <div className="flex items-center gap-2">
        {page > 1 ? (
          <a
            href={pageHref(page - 1)}
            className="min-h-[40px] flex items-center px-4 bg-brand-black/40 border border-brand-border text-brand-text font-bold rounded-lg text-xs hover:border-brand-gold/40 transition-colors"
          >
            {t('pagination.previous')}
          </a>
        ) : (
          <span
            aria-disabled="true"
            className="min-h-[40px] flex items-center px-4 bg-brand-black/40 border border-brand-border text-brand-muted/50 font-bold rounded-lg text-xs cursor-not-allowed"
          >
            {t('pagination.previous')}
          </span>
        )}

        {page < totalPages ? (
          <a
            href={pageHref(page + 1)}
            className="min-h-[40px] flex items-center px-4 bg-brand-black/40 border border-brand-border text-brand-text font-bold rounded-lg text-xs hover:border-brand-gold/40 transition-colors"
          >
            {t('pagination.next')}
          </a>
        ) : (
          <span
            aria-disabled="true"
            className="min-h-[40px] flex items-center px-4 bg-brand-black/40 border border-brand-border text-brand-muted/50 font-bold rounded-lg text-xs cursor-not-allowed"
          >
            {t('pagination.next')}
          </span>
        )}
      </div>
    </nav>
    </div>
  )
}

function Field({
  label,
  value,
  isAr = false,
  mono = false,
}: {
  label: string
  value: string
  isAr?: boolean
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <dt className={`text-[10px] uppercase tracking-wider font-bold text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
        {label}
      </dt>
      <dd
        className={`text-sm text-brand-text truncate ${
          mono ? 'font-mono' : isAr ? 'font-almarai' : 'font-satoshi'
        }`}
        title={value}
      >
        {value}
      </dd>
    </div>
  )
}
