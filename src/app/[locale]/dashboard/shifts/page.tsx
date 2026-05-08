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
import Link from 'next/link'

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

  // Fetch branches for the selector
  const { data: branches } = await supabase.from('branches').select('id, name_ar, name_en')

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
      case 'approved': return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="me-1 h-3 w-3" /> {t('approved')}</Badge>
      case 'flagged':  return <Badge className="bg-red-100 text-red-700 border-red-200"><AlertTriangle className="me-1 h-3 w-3" /> {t('flagged')}</Badge>
      default:         return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">{t('pending')}</Badge>
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
          <h1 className="text-3xl font-bold tracking-tight">{t('shift_management')}</h1>
          <p className="text-muted-foreground">{t('manage_shifts_description')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {isGlobal && branches && (
            <div className="flex flex-wrap items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground me-1" />
              {branches.map((b) => (
                <Link 
                  key={b.id} 
                  href={`/${locale}/dashboard/shifts?branch=${b.id}`}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    activeBranchId === b.id 
                      ? 'bg-secondary text-secondary-foreground border-secondary font-bold' 
                      : 'bg-background hover:bg-muted border-input'
                  }`}
                >
                  {locale === 'ar' ? b.name_ar : b.name_en}
                </Link>
              ))}
            </div>
          )}

          {activeBranchId && (
            <CloseShiftDialog branchId={activeBranchId} translations={clientTranslations} />
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('total_revenue')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {shifts.reduce((sum: number, s: ShiftClosingData) => sum + Number(s.actual_cash_bhd ?? 0), 0).toFixed(3)} BHD
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('total_shifts')}</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{shifts.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('shift_history')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>{t('date')}</TableHead>
                  <TableHead>{t('branch')}</TableHead>
                  <TableHead>{t('closed_by')}</TableHead>
                  <TableHead>{t('expected')}</TableHead>
                  <TableHead>{t('actual')}</TableHead>
                  <TableHead>{t('difference')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift: ShiftClosingData) => (
                  <TableRow key={shift.id}>
                    <TableCell>
                      <div className="font-medium">{shift.shift_date}</div>
                      <div className="text-xs text-muted-foreground uppercase">{shift.shift_type}</div>
                    </TableCell>
                    <TableCell>{shift.branch_id}</TableCell>
                    <TableCell>
                      {locale === 'ar' ? shift.closed_by_staff?.name_ar : shift.closed_by_staff?.name_en}
                    </TableCell>
                    <TableCell>{Number(shift.expected_cash_bhd ?? 0).toFixed(3)}</TableCell>
                    <TableCell className="font-bold">{Number(shift.actual_cash_bhd ?? 0).toFixed(3)}</TableCell>
                    <TableCell className={Number(shift.difference_bhd) < 0 ? 'text-red-600' : Number(shift.difference_bhd) > 0 ? 'text-green-600' : ''}>
                      {Number(shift.difference_bhd ?? 0).toFixed(3)}
                    </TableCell>
                    <TableCell>{getStatusBadge(shift.status)}</TableCell>
                  </TableRow>
                ))}
                {!shifts.length && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      {t('no_shifts_found')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
