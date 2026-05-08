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
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { Textarea } from '../../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Card, CardContent } from '../../ui/card'
import { Loader2, Calculator } from 'lucide-react'

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
          setSummary(s)
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
        <Button className="bg-brand-gold hover:bg-brand-gold/90 text-brand-surface font-bold">
          {t.close_shift}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t.close_shift_title}</DialogTitle>
            <DialogDescription>{t.close_shift_description}</DialogDescription>
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

            <Card className="bg-muted/50 border-none">
              <CardContent className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t.expected_cash}</span>
                </div>
                <span className="font-bold">{summary.expectedCash.toFixed(3)} BHD</span>
              </CardContent>
            </Card>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="actual_cash" className="text-right font-bold">{t.actual_cash}</Label>
              <div className="col-span-3 relative">
                <Input 
                  id="actual_cash" 
                  type="number" 
                  step="0.001"
                  required
                  placeholder="0.000"
                  value={formData.actual_cash}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, actual_cash: e.target.value})}
                  className={isDiscrepancy ? 'border-red-500' : ''}
                />
                <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">BHD</span>
              </div>
            </div>

            {isDiscrepancy && (
              <div className="grid gap-2">
                <div className="flex justify-between text-sm px-1">
                  <span className="text-red-600 font-bold">{t.discrepancy}: {diff.toFixed(3)} BHD</span>
                </div>
                <Textarea 
                  placeholder={t.explain_discrepancy}
                  required={isDiscrepancy}
                  value={formData.discrepancy_reason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({...formData, discrepancy_reason: e.target.value})}
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

          <DialogFooter>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.submit_closing}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
