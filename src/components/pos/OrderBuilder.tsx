'use client'

import { useTranslations } from 'next-intl'
import type { CartLine, POSBranch } from './types'

type OrderType = 'dine_in' | 'pickup' | 'delivery' | 'phone'
type PaymentMethod = 'cash' | 'card' | 'tap'

interface Props {
  isAr:                 boolean
  branches:             POSBranch[]
  branchId:             string
  onBranchChange:       (id: string) => void
  branchLocked:         boolean
  orderType:            OrderType
  onOrderTypeChange:    (t: OrderType) => void
  customerName:         string
  onCustomerNameChange: (v: string) => void
  customerPhone:        string
  onCustomerPhoneChange: (v: string) => void
  cart:                 CartLine[]
  onChangeQty:          (key: string, delta: number) => void
  onRemove:             (key: string) => void
  onChangeLineNotes:    (key: string, value: string) => void
  notes:                string
  onNotesChange:        (v: string) => void
  paymentMethod:        PaymentMethod
  onPaymentMethodChange: (m: PaymentMethod) => void
  city:                 string
  block:                string
  road:                 string
  building:             string
  flat:                 string
  onCityChange:         (v: string) => void
  onBlockChange:        (v: string) => void
  onRoadChange:         (v: string) => void
  onBuildingChange:     (v: string) => void
  onFlatChange:         (v: string) => void
  deliveryLat?:         number | null
  deliveryLng?:         number | null
  onOpenMapPicker?:     () => void
  onClearMapPin?:       () => void
  subtotal:             number
  error:                string | null
  isSubmitting:         boolean
  onSubmit:             () => void
}

export default function OrderBuilder(props: Props) {
  const t = useTranslations('pos')
  const tC = useTranslations('common')
  const { isAr, cart, subtotal, orderType } = props

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-brand-border">
        <h2 className={`text-lg font-black text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
          {t('title')}
        </h2>
        <p className="text-xs text-brand-muted mt-0.5">{t('subtitle')}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
        {/* Branch */}
        {props.branches.length > 1 && !props.branchLocked && (
          <Field label={t('branch')}>
            <select
              value={props.branchId}
              onChange={(e) => props.onBranchChange(e.target.value)}
              className="w-full min-h-[44px] rounded-lg bg-brand-surface-2 border border-brand-border px-3 font-satoshi text-base text-brand-text focus:outline-none focus:border-brand-gold/40"
            >
              {props.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {isAr ? b.nameAr : b.nameEn}
                </option>
              ))}
            </select>
          </Field>
        )}

        {/* Order type */}
        <Field label={t('orderType')}>
          <div className="grid grid-cols-2 gap-2">
            {(['dine_in', 'pickup', 'phone', 'delivery'] as OrderType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => props.onOrderTypeChange(type)}
                className={`min-h-[44px] rounded-lg font-satoshi text-xs font-medium transition-colors border
                  ${orderType === type
                    ? 'bg-brand-gold/10 text-brand-gold border-brand-gold/40'
                    : 'bg-brand-surface-2 text-brand-muted border-brand-border hover:text-brand-text'
                  }`}
              >
                {type === 'dine_in' ? t('dineIn')
                  : type === 'pickup' ? t('pickup')
                  : type === 'phone' ? t('phone')
                  : t('delivery')}
              </button>
            ))}
          </div>
        </Field>

        {/* Customer */}
        <Field label={t('customer')}>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={props.customerName}
              onChange={(e) => props.onCustomerNameChange(e.target.value)}
              placeholder={t('customerName')}
              className="w-full min-h-[44px] rounded-lg bg-brand-surface-2 border border-brand-border px-3 font-satoshi text-base text-brand-text placeholder:text-brand-muted focus:outline-none focus:border-brand-gold/40"
            />
            <input
              type="tel"
              value={props.customerPhone}
              onChange={(e) => props.onCustomerPhoneChange(e.target.value)}
              placeholder={t('customerPhone')}
              dir="ltr"
              className="w-full min-h-[44px] rounded-lg bg-brand-surface-2 border border-brand-border px-3 font-satoshi text-base text-brand-text placeholder:text-brand-muted tabular-nums focus:outline-none focus:border-brand-gold/40"
            />
          </div>
        </Field>

        {/* Cart items */}
        <Field label={t('items')}>
          {cart.length === 0 ? (
            <div className="rounded-lg border border-dashed border-brand-border bg-brand-surface-2/50 px-4 py-8 text-center">
              <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mx-auto mb-2 text-brand-muted/60">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293A1 1 0 005.414 17H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className={`text-sm text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {t('addItems')}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {cart.map((line) => (
                <li
                  key={line.key}
                  className="flex flex-col gap-2 rounded-lg border border-brand-border bg-brand-surface-2 p-2.5"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm text-brand-text leading-snug ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                        {isAr ? line.nameAr : line.nameEn}
                      </p>
                      {(line.size || line.variantAr) && (
                        <p className="text-[11px] text-brand-muted mt-0.5">
                          {[line.size, isAr ? line.variantAr : line.variantEn]
                            .filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <p className="text-xs text-brand-muted tabular-nums mt-1">
                        {line.unitPriceBhd.toFixed(3)} × {line.quantity} ={' '}
                        <span className="text-brand-gold font-bold">
                          {(line.unitPriceBhd * line.quantity).toFixed(3)}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <QtyButton
                        ariaLabel="−"
                        onClick={() => props.onChangeQty(line.key, -1)}
                      >−</QtyButton>
                      <span className="font-satoshi text-sm tabular-nums w-6 text-center">
                        {line.quantity}
                      </span>
                      <QtyButton
                        ariaLabel="+"
                        onClick={() => props.onChangeQty(line.key, 1)}
                      >+</QtyButton>
                      <button
                        type="button"
                        onClick={() => props.onRemove(line.key)}
                        aria-label={t('remove')}
                        className="ms-1 inline-flex items-center justify-center w-11 h-11 rounded-lg text-brand-muted hover:text-brand-error hover:bg-brand-error/10 transition-colors"
                      >
                        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={line.itemNotes}
                    onChange={(e) => props.onChangeLineNotes(line.key, e.target.value)}
                    placeholder={t('itemNotesPlaceholder')}
                    maxLength={200}
                    className={`w-full min-h-[36px] rounded-md bg-brand-surface border border-brand-border px-2.5 text-xs text-brand-text placeholder:text-brand-muted focus:outline-none focus:border-brand-gold/40 ${isAr ? 'font-almarai' : 'font-satoshi'}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </Field>

        {/* Delivery address */}
        {orderType === 'delivery' && (
          <Field label={t('deliveryAddress')}>
            <div className="flex flex-col gap-2">
              {/* City */}
              <select
                value={props.city}
                onChange={(e) => props.onCityChange(e.target.value)}
                className="min-h-[44px] rounded-lg bg-brand-surface-2 border border-brand-border px-3 font-satoshi text-base text-brand-text focus:outline-none focus:border-brand-gold/40 w-full"
              >
                <option value="">{isAr ? 'اختر المنطقة' : 'Select Area'}</option>
                {/* ── المنامة وضواحيها ── */}
                <optgroup label={isAr ? 'المنامة' : 'Manama'}>
                  <option value="Manama">{isAr ? 'المنامة' : 'Manama'}</option>
                  <option value="Seef">{isAr ? 'السيف' : 'Seef'}</option>
                  <option value="Adliya">{isAr ? 'العدلية' : 'Adliya'}</option>
                  <option value="Zinj">{isAr ? 'الزنج' : 'Zinj'}</option>
                  <option value="Salmaniya">{isAr ? 'السلمانية' : 'Salmaniya'}</option>
                  <option value="Hoora">{isAr ? 'الحورة' : 'Hoora'}</option>
                  <option value="Gudaibiya">{isAr ? 'الغدير' : 'Gudaibiya'}</option>
                  <option value="Juffair">{isAr ? 'الجفير' : 'Juffair'}</option>
                  <option value="Umm Al Hassam">{isAr ? 'أم الحصم' : 'Umm Al Hassam'}</option>
                  <option value="Tubli">{isAr ? 'توبلي' : 'Tubli'}</option>
                </optgroup>
                {/* ── المحافظة الشمالية ── */}
                <optgroup label={isAr ? 'المحافظة الشمالية' : 'Northern Governorate'}>
                  <option value="Muharraq">{isAr ? 'المحرق' : 'Muharraq'}</option>
                  <option value="Arad">{isAr ? 'عراد' : 'Arad'}</option>
                  <option value="Hidd">{isAr ? 'الحد' : 'Hidd'}</option>
                  <option value="Amwaj Islands">{isAr ? 'جزر أمواج' : 'Amwaj Islands'}</option>
                  <option value="Sanabis">{isAr ? 'السنابس' : 'Sanabis'}</option>
                  <option value="Jidhafs">{isAr ? 'جدحفص' : 'Jidhafs'}</option>
                  <option value="Budaiya">{isAr ? 'البديع' : 'Budaiya'}</option>
                  <option value="Saar">{isAr ? 'سار' : 'Saar'}</option>
                  <option value="Barbar">{isAr ? 'بربار' : 'Barbar'}</option>
                  <option value="Diraz">{isAr ? 'دراز' : 'Diraz'}</option>
                  <option value="Janabiya">{isAr ? 'الجنبية' : 'Janabiya'}</option>
                  <option value="Hamala">{isAr ? 'حمالة' : 'Hamala'}</option>
                  <option value="Bani Jamra">{isAr ? 'بني جمرة' : 'Bani Jamra'}</option>
                  <option value="Karbabad">{isAr ? 'كرباباد' : 'Karbabad'}</option>
                  <option value="Malkiya">{isAr ? 'الملكية' : 'Malkiya'}</option>
                </optgroup>
                {/* ── المحافظة الجنوبية ── */}
                <optgroup label={isAr ? 'المحافظة الجنوبية' : 'Southern Governorate'}>
                  <option value="Riffa">{isAr ? 'الرفاع' : 'Riffa'}</option>
                  <option value="East Riffa">{isAr ? 'الرفاع الشرقي' : 'East Riffa'}</option>
                  <option value="West Riffa">{isAr ? 'الرفاع الغربي' : 'West Riffa'}</option>
                  <option value="Zallaq">{isAr ? 'الزلاق' : 'Zallaq'}</option>
                  <option value="Askar">{isAr ? 'عسكر' : 'Askar'}</option>
                  <option value="Jaw">{isAr ? 'جو' : 'Jaw'}</option>
                  <option value="Durrat Al Bahrain">{isAr ? 'درة البحرين' : 'Durrat Al Bahrain'}</option>
                </optgroup>
                {/* ── المحافظة الوسطى ── */}
                <optgroup label={isAr ? 'المحافظة الوسطى' : 'Central Governorate'}>
                  <option value="Isa Town">{isAr ? 'مدينة عيسى' : 'Isa Town'}</option>
                  <option value="Hamad Town">{isAr ? 'مدينة حمد' : 'Hamad Town'}</option>
                  <option value="Sitra">{isAr ? 'سترة' : 'Sitra'}</option>
                  <option value="Jau">{isAr ? 'جاو' : 'Jau'}</option>
                  <option value="Sanad">{isAr ? 'سند' : 'Sanad'}</option>
                  <option value="Nuwaidrat">{isAr ? 'النويدرات' : 'Nuwaidrat'}</option>
                  <option value="Mahooz">{isAr ? 'الماحوز' : 'Mahooz'}</option>
                  <option value="Eker">{isAr ? 'عكر' : 'Eker'}</option>
                  <option value="Shahrakan">{isAr ? 'شهركان' : 'Shahrakan'}</option>
                  <option value="Al Dair">{isAr ? 'الدير' : 'Al Dair'}</option>
                </optgroup>
                <option value="Other">{isAr ? 'منطقة أخرى' : 'Other Area'}</option>
              </select>
              {/* Map pin button */}
              <button
                type="button"
                onClick={props.onOpenMapPicker}
                className={`w-full min-h-[44px] rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2
                  ${props.deliveryLat != null
                    ? 'border-brand-success/50 bg-brand-success/10 text-brand-success'
                    : 'border-brand-gold/40 bg-brand-gold/5 text-brand-gold hover:bg-brand-gold/10'
                  }`}
              >
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className={isAr ? 'font-cairo' : 'font-satoshi'}>
                  {props.deliveryLat != null
                    ? (isAr ? 'تم تحديد الموقع على الخريطة' : 'Location pinned on map')
                    : (isAr ? 'تحديد الموقع على الخريطة' : 'Pin on Map')}
                </span>
              </button>

              {/* Show pinned coords + clear button */}
              {props.deliveryLat != null && props.deliveryLng != null && (
                <div className="flex items-center justify-between rounded-lg bg-brand-surface-2 border border-brand-border px-3 py-1.5">
                  <span className="font-satoshi text-[11px] text-brand-muted tabular-nums">
                    {props.deliveryLat.toFixed(5)}, {props.deliveryLng.toFixed(5)}
                  </span>
                  <button
                    type="button"
                    onClick={props.onClearMapPin}
                    className="text-[11px] text-brand-muted hover:text-brand-error transition-colors ms-2"
                  >
                    {isAr ? 'إزالة' : 'Clear'}
                  </button>
                </div>
              )}

              {/* Block / Road / Building / Flat */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={props.block}
                  onChange={(e) => props.onBlockChange(e.target.value)}
                  placeholder={t('block')}
                  className="min-h-[44px] rounded-lg bg-brand-surface-2 border border-brand-border px-3 font-satoshi text-base text-brand-text placeholder:text-brand-muted focus:outline-none focus:border-brand-gold/40"
                />
                <input
                  type="text"
                  value={props.road}
                  onChange={(e) => props.onRoadChange(e.target.value)}
                  placeholder={t('road')}
                  className="min-h-[44px] rounded-lg bg-brand-surface-2 border border-brand-border px-3 font-satoshi text-base text-brand-text placeholder:text-brand-muted focus:outline-none focus:border-brand-gold/40"
                />
                <input
                  type="text"
                  value={props.building}
                  onChange={(e) => props.onBuildingChange(e.target.value)}
                  placeholder={t('building')}
                  className="min-h-[44px] rounded-lg bg-brand-surface-2 border border-brand-border px-3 font-satoshi text-base text-brand-text placeholder:text-brand-muted focus:outline-none focus:border-brand-gold/40"
                />
                <input
                  type="text"
                  value={props.flat}
                  onChange={(e) => props.onFlatChange(e.target.value)}
                  placeholder={t('flat')}
                  className="min-h-[44px] rounded-lg bg-brand-surface-2 border border-brand-border px-3 font-satoshi text-base text-brand-text placeholder:text-brand-muted focus:outline-none focus:border-brand-gold/40"
                />
              </div>
            </div>
          </Field>
        )}

        {/* Notes */}
        <Field label={t('notes')}>
          <textarea
            value={props.notes}
            onChange={(e) => props.onNotesChange(e.target.value)}
            placeholder={t('notesPlaceholder')}
            rows={2}
            className="w-full min-h-[80px] rounded-lg bg-brand-surface-2 border border-brand-border px-3 py-2 font-satoshi text-base text-brand-text placeholder:text-brand-muted focus:outline-none focus:border-brand-gold/40 resize-none"
          />
        </Field>

        {/* Payment method */}
        <Field label={t('paymentMethod')}>
          <div className="grid grid-cols-3 gap-2">
            {(['cash', 'card', 'tap'] as PaymentMethod[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => props.onPaymentMethodChange(m)}
                className={`min-h-[40px] rounded-lg font-satoshi text-xs font-medium transition-colors border
                  ${props.paymentMethod === m
                    ? 'bg-brand-gold/10 text-brand-gold border-brand-gold/40'
                    : 'bg-brand-surface-2 text-brand-muted border-brand-border hover:text-brand-text'
                  }`}
              >
                {m === 'cash' ? t('cash') : m === 'card' ? t('card') : t('tap')}
              </button>
            ))}
          </div>
        </Field>
      </div>

      {/* Sticky footer: totals + submit */}
      <div className="border-t border-brand-border bg-brand-surface px-4 py-4 flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className={`text-sm text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('subtotal')}
          </span>
          <span className="font-satoshi text-sm text-brand-text tabular-nums">
            {subtotal.toFixed(3)} <span className="text-xs text-brand-muted">{tC('currency')}</span>
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className={`text-base font-bold text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
            {t('total')}
          </span>
          <span className="font-satoshi text-2xl font-black text-brand-gold tabular-nums">
            {subtotal.toFixed(3)} <span className="text-sm font-normal text-brand-muted">{tC('currency')}</span>
          </span>
        </div>

        {props.error && (
          <div className="rounded-lg border border-brand-error/40 bg-brand-error/10 px-3 py-2 text-sm text-brand-error">
            {props.error}
          </div>
        )}

        <button
          type="button"
          disabled={props.isSubmitting || cart.length === 0}
          onClick={props.onSubmit}
          className="w-full min-h-[52px] rounded-lg bg-brand-gold text-brand-black font-satoshi text-base font-bold hover:bg-brand-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {props.isSubmitting ? (
            <>
              <Spinner />
              {t('creating')}
            </>
          ) : (
            t('createOrder')
          )}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-brand-muted font-satoshi font-bold mb-2">
        {label}
      </p>
      {children}
    </div>
  )
}

function QtyButton({ onClick, ariaLabel, children }: { onClick: () => void; ariaLabel: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="w-11 h-11 rounded-md border border-brand-border bg-brand-surface flex items-center justify-center text-base font-bold text-brand-text hover:border-brand-gold/40 transition-colors"
    >
      {children}
    </button>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path fill="currentColor" opacity="0.75" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}
