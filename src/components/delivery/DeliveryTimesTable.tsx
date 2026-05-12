import { getTranslations } from 'next-intl/server'
import { Clock } from 'lucide-react'

export interface DeliveryTimeRow {
  id:             string
  customer_name:  string | null
  /** Kitchen-set ready timestamp (migration 117). Replaces the prior
   *  created_at column — created_at was just "order received", not
   *  "ready for the driver to pick up". */
  ready_at:       string | null
  picked_up_at:   string | null
  delivered_at:   string | null
  status:         string
}

interface Props {
  rows:   DeliveryTimeRow[]
  locale: string
}

// Pickup → delivered duration in whole minutes. Returns null when either
// timestamp is missing (e.g. still in transit, or status changed without
// timestamping due to legacy data).
function durationMinutes(pickedUpAt: string | null, deliveredAt: string | null): number | null {
  if (!pickedUpAt || !deliveredAt) return null
  const ms = new Date(deliveredAt).getTime() - new Date(pickedUpAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  return Math.round(ms / 60_000)
}

function durationTone(mins: number | null): string {
  if (mins === null) return 'text-brand-muted'
  if (mins <  30) return 'text-emerald-400'
  if (mins <= 45) return 'text-orange-400'
  return 'text-red-400'
}

function formatTime(iso: string | null, isAr: boolean): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString(isAr ? 'ar-BH' : 'en-GB', {
      hour:   '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return iso.slice(11, 16)
  }
}

export default async function DeliveryTimesTable({ rows, locale }: Props) {
  const isAr = locale === 'ar'
  const t = await getTranslations({ locale, namespace: 'deliveryTimes' })

  return (
    <section className="mt-6 rounded-2xl border border-brand-border bg-brand-surface overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-brand-border px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-brand-gold" aria-hidden="true" />
          <h2 className={`text-sm font-bold uppercase tracking-wider text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
            {t('title')}
          </h2>
        </div>
        <div className={`flex items-center gap-3 text-[11px] text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" />{t('legendUnder30')}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-400" />30 – 45</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400" />{t('legendOver45')}</span>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-brand-muted">
          {t('empty')}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border bg-brand-surface">
                <Th isAr={isAr}>{t('col.order')}</Th>
                <Th isAr={isAr}>{t('col.customer')}</Th>
                <Th isAr={isAr}>{t('col.readyForPickup')}</Th>
                <Th isAr={isAr}>{t('col.pickedUp')}</Th>
                <Th isAr={isAr}>{t('col.delivered')}</Th>
                <Th isAr={isAr}>{t('col.duration')}</Th>
                <Th isAr={isAr}>{t('col.status')}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const mins = durationMinutes(row.picked_up_at, row.delivered_at)
                const tone = durationTone(mins)
                return (
                  <tr key={row.id} className="border-b border-brand-border/50 last:border-0 hover:bg-brand-surface-2 transition-colors">
                    <Td>
                      <span className="font-satoshi font-bold text-brand-text tabular-nums">
                        #{row.id.slice(-6).toUpperCase()}
                      </span>
                    </Td>
                    <Td>
                      <span className={`text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                        {row.customer_name ?? '—'}
                      </span>
                    </Td>
                    <Td><span className="text-brand-muted tabular-nums">{formatTime(row.ready_at, isAr)}</span></Td>
                    <Td><span className="text-brand-muted tabular-nums">{formatTime(row.picked_up_at, isAr)}</span></Td>
                    <Td><span className="text-brand-muted tabular-nums">{formatTime(row.delivered_at, isAr)}</span></Td>
                    <Td>
                      <span className={`font-satoshi font-bold tabular-nums ${tone}`}>
                        {mins === null ? '—' : `${mins} ${t('minutesShort')}`}
                      </span>
                    </Td>
                    <Td>
                      <span className={`inline-flex items-center rounded-full border border-brand-border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                        row.status === 'delivered' || row.status === 'completed'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                          : 'text-brand-muted'
                      }`}>
                        {row.status}
                      </span>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Th({ children, isAr }: { children: React.ReactNode; isAr: boolean }) {
  return (
    <th
      scope="col"
      className={`px-3 py-2.5 text-start text-[11px] font-bold uppercase tracking-wider text-brand-muted whitespace-nowrap ${
        isAr ? 'font-cairo' : 'font-satoshi'
      }`}
    >
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-3 align-middle whitespace-nowrap">{children}</td>
}
