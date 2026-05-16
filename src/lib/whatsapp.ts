import { BRANCHES, buildWaLinkForPhone, type BranchId } from '@/constants/contact'
import { type CartItem, SIZE_LABELS, selectCartTotalFils, selectLineTotalFils } from '@/lib/cart'
import { formatPrice, formatPriceFils } from '@/lib/format'

// ── Message formatter — Arabic only (per PLAN.md) ────────────────────────────

const DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━━━'

export function formatOrderMessage(
  items: CartItem[],
  branchId: BranchId,
): string {
  if (items.length === 0) return ''

  const branch   = BRANCHES[branchId]
  const subtotalFils = selectCartTotalFils(items)

  const itemLines = items.flatMap((item) => {
    const sizeLabel    = item.selectedSize
      ? ` (${SIZE_LABELS[item.selectedSize]?.ar ?? item.selectedSize})`
      : ''
    const variantLabel = item.selectedVariant ? ` — ${item.selectedVariant}` : ''
    const lineTotal    = formatPriceFils(selectLineTotalFils(item), 'ar')
    const line = `• ${item.quantity}× ${item.nameAr}${sizeLabel}${variantLabel} — ${lineTotal}`
    return item.notes ? [line, `  ↳ ${item.notes}`] : [line]
  })

  return [
    'طلب جديد',
    DIVIDER,
    `الفرع: ${branch.nameAr}`,
    '',
    'الطلب:',
    ...itemLines,
    DIVIDER,
    `الإجمالي: ${formatPriceFils(subtotalFils, 'ar')}`,
  ].join('\n')
}

// ── Checkout message — includes customer details + order number ────────────────

export interface CheckoutMessageOptions {
  customerName?:  string
  customerPhone?: string
  address?:       string  // formatted delivery address or Maps link
  notes?:         string
  orderNumber?:   string  // short ID shown to customer, e.g. last 8 chars of UUID
  trackingUrl?:   string
}

export interface PricedWhatsAppItem {
  nameAr: string
  nameEn: string
  quantity: number
  selectedSize: string | null
  selectedVariant: string | null
  unitPriceBhd: number
  lineTotalBhd: number
  notes?: string | null
}

export interface PricedCheckoutMessageOptions {
  locale: string
  branchId: BranchId
  orderId: string
  orderNumber: string
  orderType: 'delivery' | 'pickup'
  customerName: string
  customerPhone: string
  address?: string | null
  notes?: string | null
  trackingUrl?: string
  subtotalBhd: number
  totalBhd: number
  // Restaurant template fields — all optional, plumbed from existing order data
  // at the call site (no new data sources, just exposing what's already known).
  source?: string | null
  paymentMethod?: string | null
  deliveryFeeBhd?: number | null
  discountBhd?: number | null
  customerNote?: string | null
  deliveryBlock?: string | null
  deliveryRoad?: string | null
  deliveryBuilding?: string | null
  deliveryFlat?: string | null
  deliveryLat?: number | null
  deliveryLng?: number | null
}

function formatPricedItemLines(
  items: PricedWhatsAppItem[],
  locale: string,
  includeNotes: boolean,
): string[] {
  const isAr = locale === 'ar'
  return items.flatMap((item) => {
    const name = isAr ? item.nameAr : item.nameEn
    const sizeLabel = item.selectedSize
      ? ` (${isAr ? SIZE_LABELS[item.selectedSize]?.ar ?? item.selectedSize : SIZE_LABELS[item.selectedSize]?.en ?? item.selectedSize})`
      : ''
    const variantLabel = item.selectedVariant ? ` — ${item.selectedVariant}` : ''
    const line = isAr
      ? `• ${item.quantity}× ${name}${sizeLabel}${variantLabel} = ${formatPrice(item.lineTotalBhd, locale)}`
      : `• ${item.quantity}x ${name}${sizeLabel}${variantLabel} = ${formatPrice(item.lineTotalBhd, locale)}`
    return includeNotes && item.notes ? [line, `  ↳ ${item.notes}`] : [line]
  })
}

export function formatCustomerPricedCheckoutMessage(
  items: PricedWhatsAppItem[],
  options: PricedCheckoutMessageOptions,
): string {
  const isAr = options.locale === 'ar'
  const branch = BRANCHES[options.branchId]
  return [
    isAr ? 'تأكيد طلب كهرمانة بغداد' : 'Kahramana Baghdad order confirmation',
    DIVIDER,
    `${isAr ? 'رقم الطلب' : 'Order ID'}: #${options.orderNumber}`,
    `${isAr ? 'الفرع' : 'Branch'}: ${isAr ? branch.nameAr : branch.nameEn}`,
    `${isAr ? 'نوع الطلب' : 'Order type'}: ${isAr ? (options.orderType === 'delivery' ? 'توصيل' : 'استلام') : options.orderType}`,
    '',
    isAr ? 'الأصناف:' : 'Items:',
    ...formatPricedItemLines(items, options.locale, false),
    DIVIDER,
    `${isAr ? 'المجموع الفرعي' : 'Subtotal'}: ${formatPrice(options.subtotalBhd, options.locale)}`,
    `${isAr ? 'التوصيل' : 'Delivery'}: ${isAr ? 'مجاني' : 'Free'}`,
    `${isAr ? 'الإجمالي' : 'Total'}: ${formatPrice(options.totalBhd, options.locale)}`,
    ...(options.trackingUrl ? ['', isAr ? 'تتبع الطلب:' : 'Track order:', options.trackingUrl] : []),
  ].join('\n')
}

// ── Restaurant new-order notification template (approved AR/EN format) ──────

const RESTAURANT_DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━━'

function formatBhdNumber(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
    useGrouping: false,
  }).format(amount)
}

function bhdAmount(amount: number, isAr: boolean): string {
  const n = formatBhdNumber(amount)
  return isAr ? `${n} د.ب` : `BHD ${n}`
}

function formatOrderTimestamp(isAr: boolean): { date: string; time: string } {
  const tz = 'Asia/Bahrain'
  const now = new Date()
  // Date stays en-GB in both locales so the digits are Latin and parsable
  // by operators at a glance.
  const date = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: tz,
  }).format(now)
  // Time uses the locale's preferred 12-hour form so the suffix lands
  // naturally: 'ص'/'م' in Arabic, 'AM'/'PM' in English. `-u-nu-latn` forces
  // Latin digits in Arabic (operators read the numbers regardless of
  // language).
  const timeLocale = isAr ? 'ar-BH-u-nu-latn' : 'en-BH-u-nu-latn'
  const time = new Intl.DateTimeFormat(timeLocale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: tz,
  }).format(now)
  return { date, time }
}

const SOURCE_LABELS: Record<string, { ar: string; en: string }> = {
  direct:   { ar: 'الموقع',     en: 'Website'  },
  website:  { ar: 'الموقع',     en: 'Website'  },
  whatsapp: { ar: 'واتساب',     en: 'WhatsApp' },
  pos:      { ar: 'نقطة البيع', en: 'POS'      },
  manual:   { ar: 'إدخال يدوي', en: 'Manual'   },
  waiter:   { ar: 'النادل',     en: 'Waiter'   },
  qr:       { ar: 'باركود',     en: 'QR Code'  },
  staff:    { ar: 'موظف',       en: 'Staff'    },
}

function localizedSource(source: string | null | undefined, isAr: boolean): string {
  if (!source) return isAr ? 'الموقع' : 'Website'
  const known = SOURCE_LABELS[source]
  return known ? (isAr ? known.ar : known.en) : source
}

function localizedPaymentMethod(method: string | null | undefined, isAr: boolean): string {
  if (!method) return isAr ? 'نقدي' : 'Cash'
  if (method === 'cod' || method === 'cash') return isAr ? 'نقد عند الاستلام' : 'Cash on Delivery'
  if (method === 'online') return isAr ? 'دفع إلكتروني' : 'Online'
  return method
}

function localizedOrderType(orderType: 'delivery' | 'pickup', isAr: boolean): string {
  if (isAr) return orderType === 'delivery' ? 'توصيل' : 'استلام'
  return orderType === 'delivery' ? 'Delivery' : 'Pickup'
}

function buildMapsUrl(lat: number | null | undefined, lng: number | null | undefined): string | null {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  return `https://www.google.com/maps?q=${lat},${lng}`
}

export function formatRestaurantPricedCheckoutMessage(
  items: PricedWhatsAppItem[],
  options: PricedCheckoutMessageOptions,
): string {
  const isAr = options.locale === 'ar'
  const branch = BRANCHES[options.branchId]
  const branchName = isAr ? branch.nameAr : branch.nameEn
  const { date, time } = formatOrderTimestamp(isAr)

  const subtotal   = options.subtotalBhd
  const grandTotal = options.totalBhd
  const deliveryFee = options.deliveryFeeBhd ?? 0
  // Caller may pass discount explicitly; otherwise derive from totals.
  // (subtotal + deliveryFee - grandTotal) collapses to 0 when no discount applied.
  const discount = options.discountBhd ?? Math.max(0, subtotal + deliveryFee - grandTotal)

  const qtyLabel   = isAr ? 'الكمية'    : 'Qty'
  const priceLabel = isAr ? 'السعر'     : 'Price'
  const totalLabel = isAr ? 'المجموع'   : 'Total'
  const noteLabel  = isAr ? 'ملاحظة'    : 'Note'

  const itemLines = items.flatMap((item, idx) => {
    const name = isAr ? item.nameAr : item.nameEn
    const sizeLabel = item.selectedSize
      ? ` (${isAr ? SIZE_LABELS[item.selectedSize]?.ar ?? item.selectedSize : SIZE_LABELS[item.selectedSize]?.en ?? item.selectedSize})`
      : ''
    const variantLabel = item.selectedVariant ? ` — ${item.selectedVariant}` : ''
    const fullName = `${name}${sizeLabel}${variantLabel}`
    const priceStr = bhdAmount(item.unitPriceBhd, isAr)
    const totalStr = bhdAmount(item.lineTotalBhd, isAr)
    const lines: string[] = [
      `${idx + 1}. ${fullName}`,
      `   ${qtyLabel}: ${item.quantity} | ${priceLabel}: ${priceStr} | ${totalLabel}: ${totalStr}`,
    ]
    const note = item.notes?.trim()
    if (note) lines.push(`   ${noteLabel}: ${note}`)
    return lines
  })

  const mapsUrl =
    options.orderType === 'delivery'
      ? buildMapsUrl(options.deliveryLat, options.deliveryLng)
      : null
  const deliveryNote = options.customerNote?.trim() || options.notes?.trim() || null

  const hasStructuredAddress =
    options.orderType === 'delivery' &&
    Boolean(options.deliveryBlock || options.deliveryRoad || options.deliveryBuilding)

  const lines: string[] = [
    isAr ? '*طلب جديد — كهرمانة بغداد*' : '*New Order — Kahramana Baghdad*',
    `${isAr ? 'رقم الطلب' : 'Order No'}: ${options.orderNumber}`,
    `${isAr ? 'الحالة' : 'Status'}: ${isAr ? 'جديد' : 'New'}`,
    `${isAr ? 'الفرع' : 'Branch'}: ${branchName}`,
    `${isAr ? 'المصدر' : 'Source'}: ${localizedSource(options.source, isAr)}`,
    `${isAr ? 'الوقت' : 'Time'}: ${date} — ${time}`,
    RESTAURANT_DIVIDER,
    isAr ? '*تفاصيل الطلب*' : '*Order Details*',
    ...itemLines,
    RESTAURANT_DIVIDER,
    isAr ? '*الإجمالي*' : '*Order Summary*',
    `${isAr ? 'المجموع الفرعي' : 'Subtotal'}: ${bhdAmount(subtotal, isAr)}`,
    `${isAr ? 'رسوم التوصيل' : 'Delivery Fee'}: ${bhdAmount(deliveryFee, isAr)}`,
    `${isAr ? 'الخصم' : 'Discount'}: ${bhdAmount(discount, isAr)}`,
    `${isAr ? 'الإجمالي النهائي' : 'Grand Total'}: ${bhdAmount(grandTotal, isAr)}`,
    RESTAURANT_DIVIDER,
    isAr ? '*بيانات العميل*' : '*Customer Details*',
    `${isAr ? 'الاسم' : 'Name'}: ${options.customerName}`,
    `${isAr ? 'الهاتف' : 'Phone'}: ${options.customerPhone}`,
    `${isAr ? 'نوع الطلب' : 'Order Type'}: ${localizedOrderType(options.orderType, isAr)}`,
    `${isAr ? 'طريقة الدفع' : 'Payment Method'}: ${localizedPaymentMethod(options.paymentMethod, isAr)}`,
  ]

  if (hasStructuredAddress) {
    const block    = options.deliveryBlock?.trim()    || '—'
    const road     = options.deliveryRoad?.trim()     || '—'
    const building = options.deliveryBuilding?.trim() || '—'
    const flat     = options.deliveryFlat?.trim()     || '—'
    lines.push(
      isAr
        ? `بلوك: ${block} | الطريق: ${road} | المبنى: ${building} | الشقة: ${flat}`
        : `Block: ${block} | Road: ${road} | Building: ${building} | Flat: ${flat}`,
    )
  }
  if (mapsUrl) {
    lines.push(mapsUrl)
  }
  if (deliveryNote) {
    lines.push(`${isAr ? 'ملاحظات التوصيل' : 'Delivery Note'}: ${deliveryNote}`)
  }

  lines.push(
    RESTAURANT_DIVIDER,
    isAr
      ? '_التوفر والأسعار النهائية تُؤكَّد من قِبَل المطعم_'
      : '_Availability and final pricing are subject to restaurant confirmation_',
    isAr ? 'شكراً لاختياركم *كهرمانة بغداد*' : 'Thank you for choosing *Kahramana Baghdad*',
    isAr ? '_سفير المذاق البغدادي في البحرين_' : "_Bahrain's Ambassador of Baghdadi Flavour_",
  )

  return lines.join('\n')
}

export function buildPricedCheckoutWhatsAppLinks(
  items: PricedWhatsAppItem[],
  options: PricedCheckoutMessageOptions,
): { customerLink: string; restaurantLink: string } {
  const branch = BRANCHES[options.branchId]
  return {
    customerLink: buildWaLinkForPhone(
      options.customerPhone,
      formatCustomerPricedCheckoutMessage(items, options),
    ),
    restaurantLink: buildWaLinkForPhone(
      branch.whatsapp,
      formatRestaurantPricedCheckoutMessage(items, options),
    ),
  }
}

export function formatCheckoutMessage(
  items: CartItem[],
  branchId: BranchId,
  options: CheckoutMessageOptions = {},
): string {
  if (items.length === 0) return ''

  const branch   = BRANCHES[branchId]
  const subtotalFils = selectCartTotalFils(items)

  const itemLines = items.flatMap((item) => {
    const sizeLabel    = item.selectedSize
      ? ` (${SIZE_LABELS[item.selectedSize]?.ar ?? item.selectedSize})`
      : ''
    const variantLabel = item.selectedVariant ? ` — ${item.selectedVariant}` : ''
    const lineTotal    = formatPriceFils(selectLineTotalFils(item), 'ar')
    const line = `• ${item.quantity}× ${item.nameAr}${sizeLabel}${variantLabel} — ${lineTotal}`
    return item.notes ? [line, `  ↳ ${item.notes}`] : [line]
  })

  const lines: string[] = [
    'طلب جديد',
    DIVIDER,
    `الفرع: ${branch.nameAr}`,
  ]

  if (options.orderNumber) lines.push(`رقم الطلب: #${options.orderNumber}`)
  if (options.customerName)  lines.push(`الاسم: ${options.customerName}`)
  if (options.customerPhone) lines.push(`الهاتف: ${options.customerPhone}`)
  if (options.address)       lines.push(`العنوان: ${options.address}`)

  lines.push('', 'الطلب:', ...itemLines, DIVIDER, `الإجمالي: ${formatPriceFils(subtotalFils, 'ar')}`)

  if (options.notes) {
    lines.push('', `ملاحظات: ${options.notes}`)
  }
  if (options.trackingUrl) {
    lines.push('', 'تتبع طلبك:', options.trackingUrl)
  }

  return lines.join('\n')
}

// ── Link builders ─────────────────────────────────────────────────────────────

export function buildWhatsAppOrderLink(
  items: CartItem[],
  branchId: BranchId,
): string {
  const branch  = BRANCHES[branchId]
  const message = formatOrderMessage(items, branchId)
  return buildWaLinkForPhone(branch.whatsapp, message)
}

export function buildWhatsAppCheckoutLink(
  items: CartItem[],
  branchId: BranchId,
  options: CheckoutMessageOptions = {},
): string {
  const branch  = BRANCHES[branchId]
  const message = formatCheckoutMessage(items, branchId, options)
  return buildWaLinkForPhone(branch.whatsapp, message)
}

// ── Customer contact link (dynamic phone from order data) ─────────────────────

export function buildCustomerContactLink(customerPhone: string, message?: string): string {
  return buildWaLinkForPhone(customerPhone, message)
}

export function buildOrderTrackingUrl(
  orderId: string,
  locale: string,
  accessToken?: string | null,
): string {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '')
  const localePrefix = locale === 'en' ? '/en' : ''
  const path = `${localePrefix}/order/${orderId}${accessToken ? `?t=${encodeURIComponent(accessToken)}` : ''}`
  return siteUrl ? `${siteUrl}${path}` : path
}
