'use client'

import { useState, useEffect } from 'react'
import { closeShift, getShiftSummary } from '@/app/[locale]/dashboard/shifts/actions'
import { toast } from '@/lib/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { Textarea } from '../../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Card, CardContent } from '../../ui/card'
import { Loader2, Calculator, ShieldAlert } from 'lucide-react'
import CinematicButton from '@/components/ui/CinematicButton'

interface Translations {
  close_shift: string
  close_shift_title: string
  close_shift_description: string
  shift_type: string
  morning: string
  evening: string
  night: string
  expected_cash: string
  actual_cash: string
  discrepancy: string
  explain_discrepancy: string
  notes: string
  optional_notes: string
  submit_closing: string
  fetch_summary_failed_toast: string
  shift_closed_success_toast: string
  close_shift_failed_toast: string
}

interface Props {
  branchId: string
  translations: Translations
}

export default function CloseShiftDialog({ branchId, translations: t }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState({ expectedCash: 0, orderCount: 0 })
  
  const [formData, setFormData] = useState({
    actual_cash: '',
    shift_type: 'morning' as 'morning' | 'evening' | 'night',
    notes: '',
    discrepancy_reason: ''
  })

  useEffect(() => {
    if (open) {
      const fetchSummary = async () => {
        try {
          const s = await getShiftSummary(branchId, new Date().toISOString().split('T')[0])
          if ('error' in s && s.error) {
            toast.error(t.fetch_summary_failed_toast)
            return
          }
          setSummary({ expectedCash: s.expectedCash, orderCount: s.orderCount })
        } catch (_err) {
          toast.error(t.fetch_summary_failed_toast)
        }
      }
      fetchSummary()
    }
  }, [open, branchId, t.fetch_summary_failed_toast])

  const actual = parseFloat(formData.actual_cash) || 0
  const diff = actual - summary.expectedCash
  const isDiscrepancy = Math.abs(diff) > 0.005

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const res = await closeShift({
        branch_id: branchId,
        shift_date: new Date().toISOString().split('T')[0],
        shift_type: formData.shift_type,
        actual_cash_bhd: actual,
        expected_cash_bhd: summary.expectedCash,
        total_orders: summary.orderCount,
        total_revenue_bhd: summary.expectedCash, // Simplified
        notes: formData.notes,
        discrepancy_reason: isDiscrepancy ? formData.discrepancy_reason : undefined
      })

      if (res.success) {
        toast.success(t.shift_closed_success_toast)
        setOpen(false)
      } else {
        toast.error(res.error || t.close_shift_failed_toast)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <CinematicButton 
          variant="primary" 
          showIcon={false}
          className="h-11 px-8 rounded-md shadow-[0_0_20px_rgba(200,146,42,0.2)]"
        >
          {t.close_shift}
        </CinematicButton>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] glass-surface border-brand-gold/30 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-bold font-cairo text-white text-glow">{t.close_shift_title}</DialogTitle>
            <DialogDescription className="text-brand-muted text-xs uppercase tracking-wider">{t.close_shift_description}</DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="shift_type" className="text-right">{t.shift_type}</Label>
              <Select 
                value={formData.shift_type} 
                onValueChange={(v) => setFormData({...formData, shift_type: v as 'morning' | 'evening' | 'night'})}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">{t.morning}</SelectItem>
                  <SelectItem value="evening">{t.evening}</SelectItem>
                  <SelectItem value="night">{t.night}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card className="bg-brand-gold/5 border border-brand-gold/20 rounded-lg overflow-hidden">
              <CardContent className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-brand-gold" />
                  <span className="text-[10px] font-bold tracking-widest text-brand-gold uppercase">{t.expected_cash}</span>
                </div>
                <span className="font-mono font-bold text-white text-lg">{summary.expectedCash.toFixed(3)} <span className="text-[10px] text-brand-gold opacity-60">BHD</span></span>
              </CardContent>
            </Card>

            <div className="grid gap-2">
              <Label htmlFor="actual_cash" className="text-[10px] font-bold tracking-widest text-brand-gold uppercase">{t.actual_cash}</Label>
              <div className="relative">
                <Input 
                  id="actual_cash" 
                  type="number" 
                  step="0.001"
                  required
                  placeholder="0.000"
                  value={formData.actual_cash}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, actual_cash: e.target.value})}
                  className={`text-base h-12 bg-brand-black/40 ${isDiscrepancy ? 'border-brand-error focus-visible:ring-brand-error text-brand-error' : 'border-brand-gold/30 focus-visible:ring-brand-gold text-white'}`}
                />
                <span className="absolute end-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-brand-gold/40">BHD</span>
              </div>
            </div>

            {isDiscrepancy && (
              <div className="grid gap-2 p-3 rounded-lg border border-brand-error/20 bg-brand-error/5">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert className="w-4 h-4 text-brand-error animate-pulse" />
                  <span className="text-[10px] font-bold tracking-widest text-brand-error uppercase">{t.discrepancy}: {diff.toFixed(3)} BHD</span>
                </div>
                <Textarea 
                  placeholder={t.explain_discrepancy}
                  required={isDiscrepancy}
                  value={formData.discrepancy_reason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({...formData, discrepancy_reason: e.target.value})}
                  className="text-base min-h-[80px] bg-brand-black/40 border-brand-error/30 focus-visible:ring-brand-error text-white"
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="notes">{t.notes}</Label>
              <Textarea 
                id="notes"
                placeholder={t.optional_notes}
                value={formData.notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({...formData, notes: e.target.value})}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <CinematicButton 
              type="submit" 
              disabled={loading} 
              variant="primary"
              showIcon={!loading}
              className="w-full h-12 rounded-lg text-sm font-bold shadow-[0_0_30px_rgba(200,146,42,0.1)]"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t.submit_closing}
            </CinematicButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
