'use client'

import {
  TrendingUp, UtensilsCrossed, Users, Tag, Activity,
  Loader2, ChevronDown, ChevronUp,
} from 'lucide-react'
import type { ReportTemplate } from '@/lib/reports/templates'

interface Props {
  template:     ReportTemplate
  isActive:     boolean
  isGenerating: boolean
  isAr:         boolean
  onGenerate:   () => void
  onCollapse:   () => void
}

const ICON_MAP: Record<string, React.ElementType> = {
  TrendingUp,
  UtensilsCrossed,
  Users,
  Tag,
  Activity,
}

export default function ReportCard({
  template,
  isActive,
  isGenerating,
  isAr,
  onGenerate,
  onCollapse,
}: Props) {
  const Icon = ICON_MAP[template.icon] ?? TrendingUp

  return (
    <div
      className={`rounded-xl border transition-all ${
        isActive
          ? 'border-brand-gold/60 bg-brand-surface-2 shadow-[0_0_20px_rgba(200,146,42,0.08)]'
          : 'border-brand-border bg-brand-surface hover:border-brand-gold/30'
      }`}
    >
      <div className="p-5">
        {/* Icon + title */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className={`p-2 rounded-lg ${isActive ? 'bg-brand-gold/15' : 'bg-brand-surface-2'}`}>
            <Icon size={20} className={isActive ? 'text-brand-gold' : 'text-brand-muted'} />
          </div>
          {isActive && (
            <button
              onClick={onCollapse}
              className="text-brand-muted hover:text-brand-text transition-colors"
              aria-label="Collapse"
            >
              <ChevronUp size={16} />
            </button>
          )}
        </div>

        <h3 className={`font-semibold text-brand-text mb-1 ${isAr ? 'font-cairo text-base' : 'font-satoshi text-[0.95rem]'}`}>
          {isAr ? template.title_ar : template.title_en}
        </h3>

        <p className={`text-xs text-brand-muted leading-relaxed ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr ? template.desc_ar : template.desc_en}
        </p>
      </div>

      {/* Generate button */}
      <div className="px-5 pb-4">
        <button
          onClick={isActive ? onCollapse : onGenerate}
          disabled={isGenerating && isActive}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            isActive && !isGenerating
              ? 'bg-brand-gold/10 border border-brand-gold/30 text-brand-gold hover:bg-brand-gold/20'
              : 'bg-brand-surface-2 border border-brand-border text-brand-text hover:border-brand-gold/40 hover:text-brand-gold'
          } disabled:opacity-50`}
        >
          {isGenerating && isActive ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span className={isAr ? 'font-almarai' : 'font-satoshi'}>
                {isAr ? 'جاري التحليل...' : 'Analyzing data…'}
              </span>
            </>
          ) : isActive ? (
            <>
              <ChevronDown size={14} />
              <span className={isAr ? 'font-almarai' : 'font-satoshi'}>
                {isAr ? 'إخفاء التقرير' : 'Collapse report'}
              </span>
            </>
          ) : (
            <span className={isAr ? 'font-almarai' : 'font-satoshi'}>
              {isAr ? 'إنشاء التقرير' : 'Generate report'}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
