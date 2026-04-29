'use client'

import { useState, useMemo } from 'react'
import { useLocale } from 'next-intl'
import { toggleCouponPause } from './actions'
import CreateCouponWizard from '@/components/coupons/CreateCouponWizard'
import CouponStatsCards from '@/components/coupons/CouponStatsCards'
import CouponFilters, { type FilterState } from '@/components/coupons/CouponFilters'
import CouponCardGrid from '@/components/coupons/CouponCardGrid'
import CouponAnalyticsModal from '@/components/coupons/CouponAnalyticsModal'
import type { CouponRow, BranchRow } from '@/lib/supabase/custom-types'

interface Props {
  coupons: CouponRow[]
  branches: BranchRow[]
}

export default function CouponsClient({ coupons: initial, branches }: Props) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const [coupons, setCoupons] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<CouponRow | undefined>()
  const [analyticsTarget, setAnalyticsTarget] = useState<CouponRow | undefined>()
  
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: 'all',
    type: 'all',
    branchId: 'all',
    sort: 'newest'
  })

  const filteredCoupons = useMemo(() => {
    let result = [...coupons]

    // Search
    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(c => 
        c.code.toLowerCase().includes(q) || 
        (c.campaign_name && c.campaign_name.toLowerCase().includes(q)) ||
        (c.description_en && c.description_en.toLowerCase().includes(q)) ||
        (c.description_ar && c.description_ar.toLowerCase().includes(q))
      )
    }

    // Status
    if (filters.status !== 'all') {
      const now = new Date()
      result = result.filter(c => {
        const isExpired = c.valid_until && new Date(c.valid_until) < now
        const isScheduled = new Date(c.valid_from) > now
        if (filters.status === 'active') return c.is_active && !c.paused && !isExpired && !isScheduled
        if (filters.status === 'paused') return c.paused || !c.is_active
        if (filters.status === 'expired') return isExpired
        if (filters.status === 'scheduled') return isScheduled
        return true
      })
    }

    // Type
    if (filters.type !== 'all') {
      result = result.filter(c => {
        const t = c.discount_type || c.type
        if (filters.type === 'fixed') return t === 'fixed' || t === 'fixed_amount'
        return t === filters.type
      })
    }

    // Branch
    if (filters.branchId !== 'all') {
      result = result.filter(c => 
        !c.applicable_branches || 
        c.applicable_branches.length === 0 || 
        c.applicable_branches.includes(filters.branchId)
      )
    }

    // Sort
    result.sort((a, b) => {
      if (filters.sort === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (filters.sort === 'most_used') return (b.usage_count || 0) - (a.usage_count || 0)
      if (filters.sort === 'highest_impact') return (Number(b.total_revenue_impact) || 0) - (Number(a.total_revenue_impact) || 0)
      if (filters.sort === 'ending_soon') {
        if (!a.valid_until) return 1
        if (!b.valid_until) return -1
        return new Date(a.valid_until).getTime() - new Date(b.valid_until).getTime()
      }
      return 0
    })

    return result
  }, [coupons, filters])

  function openCreate() { setEditTarget(undefined); setShowForm(true) }
  function openEdit(c: CouponRow) { setEditTarget(c); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditTarget(undefined) }

  function onSaved() {
    closeForm()
    window.location.reload()
  }

  async function handleTogglePause(c: CouponRow) {
    const nextPaused = !c.paused
    // Optimistic update
    setCoupons(prev => prev.map(x => x.id === c.id ? { ...x, paused: nextPaused } : x))
    const res = await toggleCouponPause(c.id, nextPaused, locale)
    if (!res.success) {
      // Revert if failed
      setCoupons(prev => prev.map(x => x.id === c.id ? { ...x, paused: !nextPaused } : x))
    }
  }

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code)
  }

  return (
    <div className="flex flex-col gap-8 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className={`text-3xl font-black text-brand-text tracking-tight ${isAr ? 'font-cairo' : 'font-editorial'}`}>
            {isAr ? 'الكوبونات' : 'Coupons'}
          </h1>
          <p className={`text-sm text-brand-muted mt-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'إدارة حملاتك التسويقية والعروض الخاصة' : 'Manage your marketing campaigns and special offers'}
          </p>
        </div>
        <button
          onClick={openCreate}
          className={`bg-brand-gold text-brand-black font-black text-sm uppercase tracking-widest
                     px-6 py-3 rounded-2xl hover:bg-brand-gold-light transition-all transform active:scale-95 shadow-lg shadow-brand-gold/10 ${isAr ? 'font-almarai' : 'font-satoshi'}`}
        >
          {isAr ? '+ إنشاء حملة' : '+ Create Campaign'}
        </button>
      </div>

      {/* Stats */}
      <CouponStatsCards coupons={coupons} />

      {/* Filters */}
      <CouponFilters branches={branches} onFilterChange={setFilters} />

      {/* Grid */}
      <CouponCardGrid 
        coupons={filteredCoupons} 
        onEdit={openEdit} 
        onTogglePause={handleTogglePause}
        onCopy={handleCopy}
        onViewAnalytics={setAnalyticsTarget}
      />

      {showForm && (
        <CreateCouponWizard 
          coupon={editTarget} 
          branches={branches} 
          onClose={closeForm} 
          onSaved={onSaved} 
        />
      )}

      {analyticsTarget && (
        <CouponAnalyticsModal 
          coupon={analyticsTarget} 
          onClose={() => setAnalyticsTarget(undefined)} 
        />
      )}
    </div>
  )
}
