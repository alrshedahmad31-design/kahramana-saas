'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  Search,
  Plus,
  Calendar,
  Users,
  Clock,
  Phone,
  MessageSquare,
  MoreVertical,
  CheckCircle2,
  XCircle,
  UserCheck,
  Timer,
  AlertCircle,
  Table as TableIcon,
  ChevronRight,
  ChevronLeft,
  Filter,
  ExternalLink,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import { format, isToday, parseISO, addMinutes, isAfter, isBefore } from 'date-fns'
import { motion, AnimatePresence } from 'motion/react'
import { toast } from '@/lib/toast'
import {
  type Reservation,
  type CreateReservationInput,
  createReservation,
  updateReservationStatus,
  findAvailableTables,
} from '@/app/[locale]/dashboard/reservations/actions'

const cn = (...classes: (string | undefined | boolean)[]) =>
  classes.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()

interface ReservationsClientProps {
  initialReservations: Reservation[]
  branchId: string
  branches: Array<{ id: string; nameAr: string; nameEn: string }>
  isGlobalAdmin: boolean
  locale: 'ar' | 'en'
}

function StatusPill({ status, locale: _locale }: { status: Reservation['status']; locale: 'ar' | 'en' }) {
  const t = useTranslations('dashboard.reservations.statuses')
  const styles = {
    pending:   'bg-brand-gold/10 text-brand-gold border-brand-gold/20',
    confirmed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    seated:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
    completed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    no_show:   'bg-brand-muted/10 text-brand-muted border-brand-border',
    cancelled: 'bg-brand-error/10 text-brand-error border-brand-error/20',
  }

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-colors',
      styles[status] || styles.pending
    )}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {t(status)}
    </span>
  )
}

function StatCard({ label, value, icon: Icon, trend, locale: _locale }: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  locale: 'ar' | 'en'
}) {
  return (
    <div className="bg-brand-surface border border-brand-border p-4 rounded-xl flex flex-col gap-1 transition-all hover:border-brand-gold/30 group">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-muted group-hover:text-brand-gold transition-colors">
          {label}
        </span>
        <Icon size={14} className="text-brand-muted group-hover:text-brand-gold transition-colors" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-cairo text-2xl font-black text-brand-text leading-none">
          {value}
        </span>
        {trend && (
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
            {trend}
          </span>
        )}
      </div>
    </div>
  )
}

export default function ReservationsClient({
  initialReservations,
  branchId,
  branches: _branches,
  isGlobalAdmin: _isGlobalAdmin,
  locale,
}: ReservationsClientProps) {
  const t = useTranslations('dashboard.reservations')
  const isAr = locale === 'ar'

  const [reservations, setReservations] = useState<Reservation[]>(initialReservations)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<Reservation['status'] | 'all'>('all')
  const [isAdding, setIsAdding] = useState(false)
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  const stats = useMemo(() => {
    const today = reservations.filter(r => isToday(parseISO(r.reserved_for)) && r.status !== 'cancelled')
    const totalCoversToday = today.reduce((sum, r) => sum + (r.party_size || 0), 0)
    const now = new Date()
    const oneHourFromNow = addMinutes(now, 60)
    const upcoming = today.filter(r => {
      const date = parseISO(r.reserved_for)
      return isAfter(date, now) && isBefore(date, oneHourFromNow) && (r.status === 'pending' || r.status === 'confirmed')
    })

    return {
      totalCoversToday,
      upcomingCount: upcoming.length,
      activeTables: today.filter(r => r.status === 'seated').length,
      pendingCount: today.filter(r => r.status === 'pending').length,
    }
  }, [reservations])

  const filtered = useMemo(() => {
    return reservations.filter((r) => {
      const matchSearch = 
        r.guest_name.toLowerCase().includes(search.toLowerCase()) ||
        r.phone.includes(search)
      const matchStatus = filterStatus === 'all' || r.status === filterStatus
      return matchSearch && matchStatus
    })
  }, [reservations, search, filterStatus])

  async function handleStatusUpdate(id: string, newStatus: Reservation['status']) {
    setLoading(id)
    try {
      await updateReservationStatus(id, newStatus)
      setReservations(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r))
      toast.success(t('notifications.statusUpdated'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-col gap-6" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-1">
        <div>
          <h1 className="font-cairo text-3xl font-black text-brand-text mb-1">
            {t('title')}
          </h1>
          <p className="text-brand-muted text-sm font-medium">
            {t('subtitle')}
          </p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center justify-center gap-2 bg-brand-gold hover:bg-brand-gold/90 text-brand-black px-6 py-2.5 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(200,146,42,0.2)] hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus size={18} />
          <span>{t('addNew')}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-1">
        <StatCard label={t('stats.covers')} value={stats.totalCoversToday} icon={Users} locale={locale} />
        <StatCard label={t('stats.upcoming')} value={stats.upcomingCount} icon={Timer} locale={locale} trend={stats.upcomingCount > 0 ? t('stats.active') : undefined} />
        <StatCard label={t('stats.occupied')} value={stats.activeTables} icon={TableIcon} locale={locale} />
        <StatCard label={t('stats.pending')} value={stats.pendingCount} icon={AlertCircle} locale={locale} />
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-center bg-brand-surface border border-brand-border p-3 rounded-xl mx-1">
        <div className="relative flex-1 w-full">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-brand-muted" size={18} />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-brand-black border border-brand-border rounded-lg ps-10 pe-4 py-2 text-sm text-brand-text focus:border-brand-gold outline-none transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <Filter size={16} className="text-brand-muted hidden lg:block" />
          <div className="flex gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-hide">
            {(['all', 'pending', 'confirmed', 'seated', 'completed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  'whitespace-nowrap px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border',
                  filterStatus === s ? 'bg-brand-gold text-brand-black border-brand-gold' : 'bg-brand-black text-brand-muted border-brand-border hover:border-brand-gold/50'
                )}
              >
                {s === 'all' ? t('filterAll') : t(`statuses.${s}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile card list (<sm) */}
      <div className="flex flex-col gap-3 mx-1 sm:hidden">
        <AnimatePresence mode="popLayout">
          {filtered.map((res) => (
            <motion.button
              layout
              key={res.id}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={() => setSelectedRes(res)}
              className="flex flex-col gap-3 text-start min-h-[44px] rounded-2xl border border-brand-border bg-brand-surface p-4 active:bg-brand-surface-2 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-cairo text-base font-bold text-brand-text">{res.guest_name}</span>
                    {res.source === 'website' && <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase border border-blue-500/20">Web</span>}
                    {res.party_size >= 6 && <span className="text-[9px] bg-brand-gold/10 text-brand-gold px-1.5 py-0.5 rounded font-bold uppercase border border-brand-gold/20">Group</span>}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-brand-muted mt-0.5">
                    <Phone size={10} />
                    <span className="font-satoshi" dir="ltr">{res.phone}</span>
                  </div>
                </div>
                <StatusPill status={res.status} locale={locale} />
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-1.5 text-brand-text">
                  <Clock size={12} className="text-brand-muted" />
                  <span className="font-satoshi font-bold">{format(parseISO(res.reserved_for), 'HH:mm')}</span>
                  <span className="text-brand-muted">·</span>
                  <span className="text-brand-muted font-satoshi">{format(parseISO(res.reserved_for), 'MMM dd')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 text-brand-text">
                    <Users size={12} className="text-brand-muted" />
                    <span className="font-satoshi font-bold">{res.party_size}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-brand-muted">
                    <TableIcon size={12} />
                    <span className="font-satoshi">{res.table_id ? `#${res.table_id.slice(0, 4)}` : t('table.unassigned')}</span>
                  </span>
                </div>
              </div>
              {(res.status === 'pending' || res.status === 'confirmed' || (res.status !== 'cancelled' && res.status !== 'completed')) && (
                <div className="flex items-center gap-2 pt-2 border-t border-brand-border" onClick={(e) => e.stopPropagation()}>
                  {res.status === 'pending' && (
                    <button
                      onClick={() => handleStatusUpdate(res.id, 'confirmed')}
                      disabled={loading === res.id}
                      className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold active:bg-emerald-500 active:text-brand-black transition-colors"
                    >
                      <CheckCircle2 size={14} />
                      {t('statuses.confirmed')}
                    </button>
                  )}
                  {res.status === 'confirmed' && (
                    <button
                      onClick={() => handleStatusUpdate(res.id, 'seated')}
                      disabled={loading === res.id}
                      className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold active:bg-amber-500 active:text-brand-black transition-colors"
                    >
                      <UserCheck size={14} />
                      {t('statuses.seated')}
                    </button>
                  )}
                  {res.status !== 'cancelled' && res.status !== 'completed' && (
                    <button
                      onClick={() => handleStatusUpdate(res.id, 'cancelled')}
                      disabled={loading === res.id}
                      className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg bg-brand-error/10 text-brand-error border border-brand-error/20"
                      aria-label={t('drawer.cancel')}
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                </div>
              )}
            </motion.button>
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-brand-surface border border-brand-border rounded-2xl">
            <div className="w-16 h-16 rounded-full bg-brand-surface-2 flex items-center justify-center mb-4 border border-brand-border"><Calendar size={32} className="text-brand-muted" /></div>
            <h3 className="font-cairo text-lg font-bold text-brand-text mb-1">{t('table.noResults')}</h3>
            <p className="text-brand-muted text-sm max-w-xs">{t('table.noResultsDesc')}</p>
          </div>
        )}
      </div>

      {/* Desktop table (sm+) */}
      <div className="hidden sm:block bg-brand-surface border border-brand-border rounded-2xl overflow-hidden mx-1">
        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse">
            <thead>
              <tr className="bg-brand-surface-2 border-b border-brand-border">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-muted text-start">{t('table.time')}</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-muted text-start">{t('table.guest')}</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-muted text-center">{t('table.size')}</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-muted text-center">{t('table.table')}</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-muted text-center">{t('table.status')}</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-muted text-end">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/50">
              <AnimatePresence mode="popLayout">
                {filtered.map((res) => (
                  <motion.tr
                    layout
                    key={res.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group hover:bg-brand-surface-2/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedRes(res)}
                  >
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="font-satoshi text-sm font-bold text-brand-text">{format(parseISO(res.reserved_for), 'HH:mm')}</span>
                        <span className="text-[10px] text-brand-muted uppercase font-bold tracking-tight">{format(parseISO(res.reserved_for), 'MMM dd')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-cairo text-sm font-bold text-brand-text">{res.guest_name}</span>
                          {res.source === 'website' && <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase border border-blue-500/20">Web</span>}
                          {res.party_size >= 6 && <span className="text-[9px] bg-brand-gold/10 text-brand-gold px-1.5 py-0.5 rounded font-bold uppercase border border-brand-gold/20">Group</span>}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-brand-muted">
                          <Phone size={10} />
                          <span className="font-satoshi">{res.phone}</span>
                          {res.seating_type && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-brand-border" />
                              <span className="text-brand-gold/80">{t(`seatingType.${res.seating_type}`)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-black border border-brand-border font-satoshi text-sm font-black text-brand-text">{res.party_size}</div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="text-xs font-bold text-brand-muted group-hover:text-brand-gold transition-colors">{res.table_id ? `#${res.table_id.slice(0, 4)}` : t('table.unassigned')}</span>
                    </td>
                    <td className="px-6 py-5 text-center"><StatusPill status={res.status} locale={locale} /></td>
                    <td className="px-6 py-5 text-end" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {res.status === 'pending' && <button onClick={() => handleStatusUpdate(res.id, 'confirmed')} disabled={loading === res.id} className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-brand-black transition-all border border-emerald-500/20"><CheckCircle2 size={16} /></button>}
                        {res.status === 'confirmed' && <button onClick={() => handleStatusUpdate(res.id, 'seated')} disabled={loading === res.id} className="p-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-brand-black transition-all border border-amber-500/20"><UserCheck size={16} /></button>}
                        {res.status !== 'cancelled' && res.status !== 'completed' && <button onClick={() => handleStatusUpdate(res.id, 'cancelled')} disabled={loading === res.id} className="p-2 rounded-lg bg-brand-error/10 text-brand-error hover:bg-brand-error hover:text-brand-black transition-all border border-brand-error/20"><XCircle size={16} /></button>}
                        <button onClick={() => setSelectedRes(res)} className="p-2 rounded-lg bg-brand-surface-2 text-brand-muted hover:text-brand-gold transition-all border border-brand-border"><MoreVertical size={16} /></button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-brand-surface-2 flex items-center justify-center mb-4 border border-brand-border"><Calendar size={32} className="text-brand-muted" /></div>
            <h3 className="font-cairo text-lg font-bold text-brand-text mb-1">{t('table.noResults')}</h3>
            <p className="text-brand-muted text-sm max-w-xs">{t('table.noResultsDesc')}</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedRes && (
          <DetailDrawer res={selectedRes} onClose={() => setSelectedRes(null)} locale={locale} onStatusChange={handleStatusUpdate} loading={loading === selectedRes?.id} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isAdding && (
          <AddReservationDrawer isOpen={isAdding} onClose={() => setIsAdding(false)} branchId={branchId} locale={locale} />
        )}
      </AnimatePresence>
    </div>
  )
}

function DetailDrawer({ res, onClose, locale, onStatusChange, loading }: { res: Reservation | null; onClose: () => void; locale: 'ar' | 'en'; onStatusChange: (id: string, s: Reservation['status']) => void; loading: boolean; }) {
  const t = useTranslations('dashboard.reservations')
  if (!res) return null
  const isAr = locale === 'ar'
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-brand-black/60 backdrop-blur-sm" />
      <motion.div initial={{ x: isAr ? '-100%' : '100%' }} animate={{ x: 0 }} exit={{ x: isAr ? '-100%' : '100%' }} className="relative w-full max-w-md h-full bg-brand-surface border-s border-brand-border shadow-2xl flex flex-col">
        <div className="p-6 border-b border-brand-border flex items-center justify-between">
          <div className="flex flex-col"><span className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-1">{t('drawer.details')}</span><h2 className="font-cairo text-xl font-black text-brand-text">{res.guest_name}</h2></div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-brand-surface-2 transition-colors">{isAr ? <ChevronRight size={24} /> : <ChevronLeft size={24} />}</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-brand-black border border-brand-border p-4 rounded-xl space-y-1">
              <div className="flex items-center gap-2 text-brand-muted"><Clock size={14} /><span className="text-[10px] font-bold uppercase">{t('drawer.time')}</span></div>
              <p className="font-satoshi font-bold text-brand-text">{format(parseISO(res.reserved_for), 'HH:mm')}</p>
            </div>
            <div className="bg-brand-black border border-brand-border p-4 rounded-xl space-y-1">
              <div className="flex items-center gap-2 text-brand-muted"><Users size={14} /><span className="text-[10px] font-bold uppercase">{t('drawer.size')}</span></div>
              <p className="font-satoshi font-bold text-brand-text">{t('drawer.guestsCount', { count: res.party_size })}</p>
            </div>
          </div>
          <div className="space-y-6">
            <InfoRow icon={Phone} label={t('drawer.phone')} value={res.phone} />
            <InfoRow icon={Calendar} label={t('drawer.date')} value={format(parseISO(res.reserved_for), 'PPP')} />
            <InfoRow icon={TableIcon} label={t('drawer.table')} value={res.table_id ? `#${res.table_id.slice(0, 8)}` : t('drawer.unassigned')} />
            {res.seating_type && (
              <InfoRow icon={TableIcon} label={t('seatingType.label')} value={t(`seatingType.${res.seating_type}`)} />
            )}
            <InfoRow icon={ExternalLink} label={t('drawer.source')} value={res.source} isCapitalized />
          </div>
          {res.special_requests && (
            <div className="bg-brand-gold/5 border border-brand-gold/20 p-4 rounded-xl space-y-2"><div className="flex items-center gap-2 text-brand-gold"><MessageSquare size={16} /><span className="text-xs font-bold uppercase">{t('drawer.specialRequests')}</span></div><p className="text-sm text-brand-text leading-relaxed">{res.special_requests}</p></div>
          )}
        </div>
        <div className="p-6 bg-brand-surface-2 border-t border-brand-border grid grid-cols-2 gap-3">
          {res.status === 'pending' && <button disabled={loading} onClick={() => onStatusChange(res.id, 'confirmed')} className="col-span-2 bg-brand-gold text-brand-black font-bold py-3 rounded-xl flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18} />}{t('drawer.confirm')}</button>}
          {res.status === 'confirmed' && <button disabled={loading} onClick={() => onStatusChange(res.id, 'seated')} className="col-span-2 bg-amber-500 text-brand-black font-bold py-3 rounded-xl flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" /> : <UserCheck size={18} />}{t('drawer.seat')}</button>}
          {res.status !== 'cancelled' && res.status !== 'completed' && <button disabled={loading} onClick={() => onStatusChange(res.id, 'no_show')} className="bg-brand-black text-brand-muted border border-brand-border font-bold py-3 rounded-xl">{t('drawer.noShow')}</button>}
          {res.status !== 'cancelled' && res.status !== 'completed' && <button disabled={loading} onClick={() => onStatusChange(res.id, 'cancelled')} className="bg-brand-black text-brand-muted border border-brand-border font-bold py-3 rounded-xl">{t('drawer.cancel')}</button>}
        </div>
      </motion.div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, isCapitalized }: { icon: LucideIcon; label: string; value: string; isCapitalized?: boolean }) {
  return (
    <div className="flex items-center gap-4 group">
      <div className="w-10 h-10 rounded-lg bg-brand-black border border-brand-border flex items-center justify-center text-brand-muted"><Icon size={18} /></div>
      <div className="flex flex-col"><span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">{label}</span><span className={cn("text-sm font-medium text-brand-text", isCapitalized && 'capitalize')}>{value}</span></div>
    </div>
  )
}

function AddReservationDrawer({ isOpen: _isOpen, onClose, branchId, locale }: { isOpen: boolean; onClose: () => void; branchId: string; locale: 'ar' | 'en'; }) {
  const t = useTranslations('dashboard.reservations')
  const isAr = locale === 'ar'
  const [formData, setFormData] = useState<{
    guest_name: string;
    phone: string;
    party_size: number;
    reserved_for: string;
    special_requests: string;
    seating_type: string | null;
  }>({ 
    guest_name: '', 
    phone: '+973', 
    party_size: 2, 
    reserved_for: format(new Date(), "yyyy-MM-dd'T'HH:mm"), 
    special_requests: '',
    seating_type: null,
  })

  const seatingOptions = useMemo(() => {
    if (branchId === 'qallali') return ['outdoor', 'indoor']
    return ['family_section', 'arabic_seating', 'outdoor', 'indoor']
  }, [branchId])

  const [loading, setLoading] = useState(false)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    try {
      const tables = await findAvailableTables({ branch_id: branchId, party_size: formData.party_size, reserved_for: new Date(formData.reserved_for).toISOString(), duration_minutes: 90 })
      await createReservation({ 
        ...formData, 
        branch_id: branchId, 
        reserved_for: new Date(formData.reserved_for).toISOString(), 
        table_id: tables[0]?.table_id || null, 
        source: 'staff',
        duration_minutes: 90,
        seating_type: formData.seating_type as CreateReservationInput['seating_type']
      })
      toast.success(t('notifications.addSuccess'));
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false) 
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-brand-black/60 backdrop-blur-sm" />
      <motion.div initial={{ x: isAr ? '-100%' : '100%' }} animate={{ x: 0 }} exit={{ x: isAr ? '-100%' : '100%' }} className="relative w-full max-w-md h-full bg-brand-surface border-s border-brand-border flex flex-col p-8">
        <div className="flex items-center justify-between mb-8"><h2 className="font-cairo text-2xl font-black text-brand-text">{t('add.title')}</h2><button onClick={onClose} className="p-2 rounded-lg hover:bg-brand-surface-2 transition-colors"><XCircle size={24} className="text-brand-muted" /></button></div>
        <form onSubmit={handleSubmit} className="space-y-6 flex-1 flex flex-col">
          <div className="space-y-2"><label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{t('add.guestName')}</label><input required className="w-full bg-brand-black border border-brand-border rounded-xl px-4 py-3 text-brand-text" value={formData.guest_name} onChange={e => setFormData({...formData, guest_name: e.target.value})} /></div>
          <div className="space-y-2"><label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{t('add.phone')}</label><input required className="w-full bg-brand-black border border-brand-border rounded-xl px-4 py-3 text-brand-text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{t('add.partySize')}</label><input type="number" required className="w-full bg-brand-black border border-brand-border rounded-xl px-4 py-3 text-brand-text" value={formData.party_size} onChange={e => setFormData({...formData, party_size: parseInt(e.target.value)})} /></div>
            <div className="space-y-2"><label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{t('add.dateTime')}</label><input type="datetime-local" required className="w-full bg-brand-black border border-brand-border rounded-xl px-4 py-3 text-brand-text font-satoshi" value={formData.reserved_for} onChange={e => setFormData({...formData, reserved_for: e.target.value})} /></div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
              {t('add.seatingType')}
            </label>
            <select
              className="w-full bg-brand-black border border-brand-border rounded-xl px-4 py-3 text-brand-text appearance-none"
              value={formData.seating_type || ''}
              onChange={e => setFormData({ ...formData, seating_type: e.target.value || null })}
            >
              <option value="">{t('seatingType.any')}</option>
              {seatingOptions.map(opt => (
                <option key={opt} value={opt}>
                  {t(`seatingType.${opt}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
              {t('add.specialRequests')}
            </label>
            <textarea 
              className="w-full bg-brand-black border border-brand-border rounded-xl px-4 py-3 text-brand-text h-32 resize-none" 
              value={formData.special_requests} 
              onChange={e => setFormData({...formData, special_requests: e.target.value})} 
            />
          </div>
          <div className="mt-auto pt-6 border-t border-brand-border"><button type="submit" disabled={loading} className="w-full bg-brand-gold text-brand-black font-black py-4 rounded-xl flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />}{t('add.submit')}</button></div>
        </form>
      </motion.div>
    </div>
  )
}
