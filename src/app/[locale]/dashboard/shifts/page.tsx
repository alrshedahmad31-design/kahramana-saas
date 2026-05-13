import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import CloseShiftDialog from '@/components/dashboard/shifts/CloseShiftDialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Wallet, TrendingUp, AlertTriangle, CheckCircle2, Building2 } from 'lucide-react'
import CinematicButton from '@/components/ui/CinematicButton'

interface ShiftClosingData {
  id: string
  shift_date: string
  shift_type: 'morning' | 'evening' | 'night'
  branch_id: string
  actual_cash_bhd: number
  expected_cash_bhd: number
  difference_bhd: number
  status: string
  closed_by_staff?: {
    name_ar: string
    name_en: string
  }
}

export default async function ShiftsPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ locale: string }>,
  searchParams: Promise<{ branch?: string }> 
}) {
  const { locale } = await params
  const { branch: selectedBranchId } = await searchParams
  const t = await getTranslations('dashboard')
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ''
  const { data: staff } = await supabase
    .from('staff_basic')
    .select('branch_id, role')
    .eq('id', userId)
    .single()
  const branchId: string | null = staff?.branch_id ?? null
  const isGlobal = ['owner', 'general_manager'].includes(staff?.role ?? '')

  // For global users, use the selected branch from URL or the staff branch
  const activeBranchId = isGlobal ? (selectedBranchId || branchId) : branchId

  const { getActiveBranches } = await import('@/lib/branches/queries')
  const branches = await getActiveBranches()

  let query = supabase.from('shift_closings').select(`
    *,
    closed_by_staff:closed_by (name_ar, name_en),
    approved_by_staff:approved_by (name_ar, name_en)
  `).order('created_at', { ascending: false })

  if (!isGlobal && branchId) {
    query = query.eq('branch_id', branchId)
  } else if (activeBranchId) {
    query = query.eq('branch_id', activeBranchId)
  }

  const { data: shiftsData } = await query
  const shifts = (shiftsData as unknown as ShiftClosingData[]) ?? []

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': 
        return (
          <Badge className="bg-brand-success/15 text-brand-success border-brand-success/20">
            <CheckCircle2 className="me-1.5 h-3.5 w-3.5" /> 
            {t('approved')}
          </Badge>
        )
      case 'flagged':  
        return (
          <Badge className="bg-brand-error/15 text-brand-error border-brand-error/20">
            <AlertTriangle className="me-1.5 h-3.5 w-3.5" /> 
            {t('flagged')}
          </Badge>
        )
      default:         
        return (
          <Badge variant="outline" className="bg-brand-muted/10 text-brand-muted border-brand-muted/20">
            {t('pending')}
          </Badge>
        )
    }
  }

  const clientTranslations = {
    close_shift:                t('close_shift'),
    close_shift_title:          t('close_shift_title'),
    close_shift_description:    t('close_shift_description'),
    shift_type:                 t('shift_type'),
    morning:                    t('morning'),
    evening:                    t('evening'),
    night:                      t('night'),
    expected_cash:              t('expected_cash'),
    actual_cash:                t('actual_cash'),
    discrepancy:                t('discrepancy'),
    explain_discrepancy:        t('explain_discrepancy'),
    notes:                      t('notes'),
    optional_notes:             t('optional_notes'),
    submit_closing:             t('submit_closing'),
    fetch_summary_failed_toast: t('fetch_summary_failed_toast'),
    shift_closed_success_toast: t('shift_closed_success_toast'),
    close_shift_failed_toast:   t('close_shift_failed_toast'),
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight font-cairo text-white text-glow mb-2">{t('shift_management')}</h1>
          <p className="text-brand-gold uppercase tracking-[0.2em] text-[10px] font-bold opacity-80">{t('manage_shifts_description')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {isGlobal && branches && (
            <div className="flex flex-wrap items-center gap-2">
              <Building2 className="h-4 w-4 text-brand-muted me-1" />
              {branches.map((b) => (
                <CinematicButton 
                  key={b.id} 
                  href={`/dashboard/shifts?branch=${b.id}`}
                  variant={activeBranchId === b.id ? 'primary' : 'secondary'}
                  showIcon={false}
                  className={`h-11 px-6 rounded-md text-xs font-bold ${
                    activeBranchId === b.id ? 'shadow-[0_0_15px_rgba(200,146,42,0.3)]' : ''
                  }`}
                >
                  {locale === 'ar' ? b.name_ar : b.name_en}
                </CinematicButton>
              ))}
            </div>
          )}

          {activeBranchId && (
            <CloseShiftDialog branchId={activeBranchId} translations={clientTranslations} />
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="glass-surface border-brand-gold/20 shadow-[0_0_30px_rgba(200,146,42,0.05)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-bold tracking-widest text-brand-gold uppercase">{t('total_revenue')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-brand-gold text-glow" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {shifts.reduce((sum: number, s: ShiftClosingData) => sum + Number(s.actual_cash_bhd ?? 0), 0).toFixed(3)} <span className="text-xs text-brand-gold ms-1">BHD</span>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-surface border-brand-gold/20 shadow-[0_0_30px_rgba(200,146,42,0.05)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-bold tracking-widest text-brand-gold uppercase">{t('total_shifts')}</CardTitle>
            <Wallet className="h-4 w-4 text-brand-gold text-glow" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{shifts.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="glass-surface border-brand-gold/10 rounded-xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-brand-gold/10 flex items-center justify-between bg-brand-gold/5">
          <h2 className="text-sm font-bold tracking-widest text-brand-gold uppercase">{t('shift_history')}</h2>
          <div className="h-px flex-1 bg-brand-gold/10 mx-6 hidden md:block" />
        </div>
        <Table>
          <TableHeader className="bg-brand-black/50">
            <TableRow className="border-brand-gold/10 hover:bg-transparent">
              <TableHead className="text-brand-gold/70 font-bold uppercase text-[10px] tracking-wider py-4">{t('date')}</TableHead>
              <TableHead className="text-brand-gold/70 font-bold uppercase text-[10px] tracking-wider">{t('branch')}</TableHead>
              <TableHead className="text-brand-gold/70 font-bold uppercase text-[10px] tracking-wider">{t('closed_by')}</TableHead>
              <TableHead className="text-brand-gold/70 font-bold uppercase text-[10px] tracking-wider">{t('expected')}</TableHead>
              <TableHead className="text-brand-gold/70 font-bold uppercase text-[10px] tracking-wider">{t('actual')}</TableHead>
              <TableHead className="text-brand-gold/70 font-bold uppercase text-[10px] tracking-wider">{t('difference')}</TableHead>
              <TableHead className="text-brand-gold/70 font-bold uppercase text-[10px] tracking-wider text-end">{t('status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shifts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-48 text-center text-brand-muted italic">
                  <div className="flex flex-col items-center gap-2">
                    <Wallet className="w-8 h-8 opacity-20 mb-2" />
                    {t('no_shifts_found')}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              shifts.map((shift: ShiftClosingData) => (
                <TableRow key={shift.id} className="border-brand-gold/5 hover:bg-brand-gold/5 transition-colors group">
                  <TableCell className="py-5">
                    <div className="font-bold text-white group-hover:text-brand-gold transition-colors">{shift.shift_date}</div>
                    <div className="text-[10px] text-brand-muted uppercase tracking-tighter">{shift.shift_type}</div>
                  </TableCell>
                  <TableCell className="text-brand-text/60 font-mono text-xs">{shift.branch_id}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-brand-gold/20 flex items-center justify-center text-[10px] text-brand-gold font-bold border border-brand-gold/30">
                        {shift.closed_by_staff?.name_ar?.charAt(0) || shift.closed_by_staff?.name_en?.charAt(0) || 'U'}
                      </div>
                      <span className="text-sm font-medium text-brand-text/90">
                        {locale === 'ar' ? shift.closed_by_staff?.name_ar : shift.closed_by_staff?.name_en}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-brand-text/50 text-xs">{Number(shift.expected_cash_bhd ?? 0).toFixed(3)}</TableCell>
                  <TableCell className="font-mono font-bold text-white">{Number(shift.actual_cash_bhd ?? 0).toFixed(3)}</TableCell>
                  <TableCell className={`font-mono font-bold ${Number(shift.difference_bhd) < 0 ? 'text-brand-error' : Number(shift.difference_bhd) > 0 ? 'text-brand-success' : 'text-brand-gold/40'}`}>
                    {Number(shift.difference_bhd ?? 0).toFixed(3)}
                  </TableCell>
                  <TableCell className="text-end">{getStatusBadge(shift.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
