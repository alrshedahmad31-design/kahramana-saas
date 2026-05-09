// Minimal WebUSB ambient types — enough to compile without @types/w3c-web-usb.
// Drop these if @types/w3c-web-usb is added to devDependencies.
interface USBDeviceFilter {
  vendorId?:    number
  productId?:   number
  classCode?:   number
  subclassCode?: number
  protocolCode?: number
  serialNumber?: string
}
interface USBEndpoint {
  endpointNumber: number
  direction:      'in' | 'out'
  type:           'bulk' | 'interrupt' | 'isochronous'
}
interface USBAlternateInterface { endpoints: USBEndpoint[] }
interface USBInterface {
  interfaceNumber: number
  alternate:       USBAlternateInterface
}
interface USBConfiguration { interfaces: USBInterface[] }
interface USBDevice {
  opened:        boolean
  configuration: USBConfiguration | null
  open():                                   Promise<void>
  selectConfiguration(value: number):       Promise<void>
  claimInterface(interfaceNumber: number):  Promise<void>
  transferOut(endpointNumber: number, data: ArrayBuffer | ArrayBufferView): Promise<{ status: string; bytesWritten?: number }>
}
interface USB {
  requestDevice(options: { filters: USBDeviceFilter[] }): Promise<USBDevice>
  getDevices():                                             Promise<USBDevice[]>
}
declare global {
  interface Navigator { readonly usb: USB }
}

/**
 * ESC/POS receipt printer driver — WebUSB primary, HTML print fallback.
 *
 * Tested-against vendors (filter list in `requestPrinter`):
 *   - Epson TM-T20/T82/T88 (0x04b8)
 *   - Star TSP100/TSP650 (0x0519)
 *   - Bixolon SRP-275/350 (0x1504)
 *   - Citizen CT-S310/S4000 (0x1d90)
 *
 * Arabic note: many modern ESC/POS printers accept UTF-8 directly when the
 * "International character set" is left at default. Older printers that only
 * support CP864 / CP1256 will print question marks — fall back to HTML print
 * window in that case (handled by `printReceipt`).
 *
 * This entire module is client-only — it accesses `navigator.usb` and
 * `window`. Do not import it from server components.
 */

export interface ReceiptModifier {
  ar:    string
  en:    string
  price: number
}

export interface ReceiptItem {
  nameAr:       string
  nameEn:       string
  quantity:     number
  unitPriceBhd: number
  size?:        string | null
  variant?:     string | null
  modifiers?:   ReceiptModifier[]
  notes?:       string | null
}

export interface ReceiptOrder {
  restaurantNameAr: string
  branchNameAr:     string
  branchPhone:      string
  orderId:          string
  customerName?:    string
  customerPhone?:   string
  items:            ReceiptItem[]
  subtotalBhd:      number
  totalBhd:         number
  trackingUrl?:     string
  isAr?:            boolean
}

// ── ESC/POS command bytes ─────────────────────────────────────────────────────

const ESC = 0x1b
const GS  = 0x1d

const CMD_INIT          = new Uint8Array([ESC, 0x40])              // ESC @ — reset
const CMD_FONT_BIG      = new Uint8Array([GS, 0x21, 0x11])          // double size
const CMD_FONT_NORMAL   = new Uint8Array([GS, 0x21, 0x00])          // normal size
const CMD_ALIGN_CENTER  = new Uint8Array([ESC, 0x61, 0x01])
const CMD_ALIGN_LEFT    = new Uint8Array([ESC, 0x61, 0x00])
const CMD_BOLD_ON       = new Uint8Array([ESC, 0x45, 0x01])
const CMD_BOLD_OFF      = new Uint8Array([ESC, 0x45, 0x00])
const CMD_FEED_LINES    = (n: number) => new Uint8Array([ESC, 0x64, Math.max(0, Math.min(255, n))])
const CMD_CUT           = new Uint8Array([GS, 0x56, 0x42, 0x00])    // partial cut

const RECEIPT_WIDTH_CHARS = 32 // 80mm thermal printer default font A

const enc = new TextEncoder()
function line(s: string = ''): Uint8Array { return enc.encode(s + '\n') }

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

function shortId(orderId: string): string {
  return orderId.slice(-8).toUpperCase()
}

function pad(s: string, width: number, end = false): string {
  if (s.length >= width) return s.slice(0, width)
  const padding = ' '.repeat(width - s.length)
  return end ? s + padding : padding + s
}

function divider(): Uint8Array {
  return line('-'.repeat(RECEIPT_WIDTH_CHARS))
}

// ── Build the byte stream ─────────────────────────────────────────────────────

export function buildReceiptBytes(order: ReceiptOrder): Uint8Array {
  const isAr = order.isAr !== false
  const parts: Uint8Array[] = []

  parts.push(CMD_INIT)
  parts.push(CMD_ALIGN_CENTER)
  parts.push(CMD_FONT_BIG, CMD_BOLD_ON)
  parts.push(line(order.restaurantNameAr))
  parts.push(CMD_BOLD_OFF, CMD_FONT_NORMAL)
  parts.push(line(order.branchNameAr))
  parts.push(line(order.branchPhone))
  parts.push(line(new Date().toLocaleString(isAr ? 'ar-BH' : 'en-BH')))
  parts.push(divider())

  parts.push(CMD_BOLD_ON)
  parts.push(line(`#${shortId(order.orderId)}`))
  parts.push(CMD_BOLD_OFF)
  if (order.customerName) parts.push(line(order.customerName))
  if (order.customerPhone) parts.push(line(order.customerPhone))
  parts.push(divider())

  parts.push(CMD_ALIGN_LEFT)
  for (const it of order.items) {
    const name = isAr ? it.nameAr : it.nameEn
    const lineTotal = (it.unitPriceBhd * it.quantity).toFixed(3)
    parts.push(line(`${it.quantity}x ${name}`))
    if (it.size)    parts.push(line(`  (${it.size})`))
    if (it.variant) parts.push(line(`  ${it.variant}`))
    if (it.modifiers) {
      for (const m of it.modifiers) {
        const label = isAr ? m.ar : m.en
        const sign  = m.price >= 0 ? '+' : ''
        parts.push(line(`  + ${label}${m.price !== 0 ? ` ${sign}${m.price.toFixed(3)}` : ''}`))
      }
    }
    if (it.notes) parts.push(line(`  * ${it.notes}`))
    parts.push(line(pad(lineTotal, RECEIPT_WIDTH_CHARS, false)))
  }

  parts.push(divider())
  parts.push(CMD_BOLD_ON, CMD_FONT_BIG)
  parts.push(line(`${isAr ? 'الإجمالي' : 'TOTAL'}: ${order.totalBhd.toFixed(3)} BHD`))
  parts.push(CMD_BOLD_OFF, CMD_FONT_NORMAL)
  parts.push(divider())

  if (order.trackingUrl) {
    parts.push(CMD_ALIGN_CENTER)
    parts.push(line(isAr ? 'تتبع الطلب:' : 'Track your order:'))
    parts.push(line(order.trackingUrl))
  }

  parts.push(CMD_ALIGN_CENTER)
  parts.push(line(isAr ? 'شكراً لزيارتكم' : 'Thank you'))
  parts.push(CMD_FEED_LINES(4))
  parts.push(CMD_CUT)

  return concat(...parts)
}

// ── WebUSB connection ─────────────────────────────────────────────────────────

interface CachedDevice {
  device:    USBDevice
  endpoint:  number
}

let cached: CachedDevice | null = null

const PRINTER_FILTERS: USBDeviceFilter[] = [
  { vendorId: 0x04b8 }, // Epson
  { vendorId: 0x0519 }, // Star
  { vendorId: 0x1504 }, // Bixolon
  { vendorId: 0x1d90 }, // Citizen
  { classCode: 7 },     // USB Printer class
]

export function isWebUsbSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator
}

async function openDevice(device: USBDevice): Promise<CachedDevice> {
  if (!device.opened) await device.open()
  if (device.configuration === null) await device.selectConfiguration(1)

  // Find a bulk-out endpoint on the first interface
  const conf = device.configuration!
  for (const iface of conf.interfaces) {
    const alt = iface.alternate
    const out = alt.endpoints.find((e) => e.direction === 'out' && e.type === 'bulk')
    if (out) {
      try { await device.claimInterface(iface.interfaceNumber) } catch {}
      return { device, endpoint: out.endpointNumber }
    }
  }
  throw new Error('No bulk-out endpoint found on printer')
}

/** Prompts the user to pick a printer; caches the chosen device for future prints. */
export async function requestPrinter(): Promise<CachedDevice> {
  if (!isWebUsbSupported()) throw new Error('WebUSB not supported')
  const device = await navigator.usb.requestDevice({ filters: PRINTER_FILTERS })
  cached = await openDevice(device)
  return cached
}

/** Reuses a previously-paired printer if available — never prompts. */
async function getCachedPrinter(): Promise<CachedDevice | null> {
  if (cached) return cached
  if (!isWebUsbSupported()) return null
  const list = await navigator.usb.getDevices()
  if (list.length === 0) return null
  cached = await openDevice(list[0]!)
  return cached
}

/**
 * Print to a paired ESC/POS thermal printer over WebUSB.
 * Returns true on success, false if no printer is available; throws on USB errors.
 */
export async function printReceiptViaUsb(order: ReceiptOrder): Promise<boolean> {
  const printer = await getCachedPrinter()
  if (!printer) return false
  const data = buildReceiptBytes(order)
  await printer.device.transferOut(printer.endpoint, data)
  return true
}

// ── HTML print fallback ───────────────────────────────────────────────────────

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildReceiptHtml(order: ReceiptOrder): string {
  const isAr = order.isAr !== false
  const itemsHtml = order.items.map((it) => {
    const name = htmlEscape(isAr ? it.nameAr : it.nameEn)
    const total = (it.unitPriceBhd * it.quantity).toFixed(3)
    const meta: string[] = []
    if (it.size)    meta.push(`(${htmlEscape(it.size)})`)
    if (it.variant) meta.push(htmlEscape(it.variant))
    const modsHtml = (it.modifiers ?? [])
      .map((m) => {
        const label = htmlEscape(isAr ? m.ar : m.en)
        const sign  = m.price >= 0 ? '+' : ''
        const price = m.price !== 0 ? ` ${sign}${m.price.toFixed(3)}` : ''
        return `<div class="mod">+ ${label}${price}</div>`
      })
      .join('')
    const notesHtml = it.notes ? `<div class="note">* ${htmlEscape(it.notes)}</div>` : ''
    return `
      <div class="line">
        <div class="row"><span>${it.quantity}x ${name}</span><span>${total}</span></div>
        ${meta.length ? `<div class="meta">${meta.join(' ')}</div>` : ''}
        ${modsHtml}
        ${notesHtml}
      </div>
    `
  }).join('')

  return `<!doctype html>
<html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}">
<head>
  <meta charset="utf-8">
  <title>${htmlEscape(order.restaurantNameAr)} — #${htmlEscape(order.orderId.slice(-8).toUpperCase())}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    @media print { body { margin: 0 } }
    body {
      width: 72mm;
      margin: 4mm auto;
      font-family: 'Almarai', 'Segoe UI', system-ui, sans-serif;
      font-size: 12px;
      color: #000;
      background: #fff;
    }
    .center { text-align: center; }
    .big { font-size: 16px; font-weight: 800; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; gap: 8px; }
    .meta { padding-inline-start: 12px; color: #444; font-size: 11px; }
    .mod  { padding-inline-start: 12px; color: #444; font-size: 11px; }
    .note { padding-inline-start: 12px; color: #444; font-style: italic; font-size: 11px; }
    .line { margin-block: 4px; }
    .total { font-size: 14px; font-weight: 800; }
  </style>
</head>
<body>
  <div class="center big">${htmlEscape(order.restaurantNameAr)}</div>
  <div class="center">${htmlEscape(order.branchNameAr)}</div>
  <div class="center">${htmlEscape(order.branchPhone)}</div>
  <div class="center">${htmlEscape(new Date().toLocaleString(isAr ? 'ar-BH' : 'en-BH'))}</div>
  <div class="divider"></div>
  <div class="center big">#${htmlEscape(order.orderId.slice(-8).toUpperCase())}</div>
  ${order.customerName ? `<div class="center">${htmlEscape(order.customerName)}</div>` : ''}
  ${order.customerPhone ? `<div class="center">${htmlEscape(order.customerPhone)}</div>` : ''}
  <div class="divider"></div>
  ${itemsHtml}
  <div class="divider"></div>
  <div class="row total">
    <span>${isAr ? 'الإجمالي' : 'TOTAL'}</span>
    <span>${order.totalBhd.toFixed(3)} BHD</span>
  </div>
  <div class="divider"></div>
  ${order.trackingUrl ? `<div class="center">${isAr ? 'تتبع الطلب' : 'Track your order'}<br>${htmlEscape(order.trackingUrl)}</div>` : ''}
  <div class="center" style="margin-top:8px">${isAr ? 'شكراً لزيارتكم' : 'Thank you'}</div>
  <script>
    window.addEventListener('load', () => { window.focus(); window.print(); });
  </script>
</body>
</html>`
}

/** Open a print window with browser-rendered receipt — works for any printer. */
export function printReceiptViaWindow(order: ReceiptOrder): boolean {
  if (typeof window === 'undefined') return false
  const w = window.open('', '_blank', 'width=320,height=600')
  if (!w) return false
  w.document.open()
  w.document.write(buildReceiptHtml(order))
  w.document.close()
  return true
}

/**
 * Try WebUSB first, fall back to a print window. Returns the path used.
 * Throws only on unrecoverable USB errors when WebUSB is paired.
 */
export async function printReceipt(
  order: ReceiptOrder,
): Promise<'usb' | 'window' | 'unsupported'> {
  if (isWebUsbSupported()) {
    try {
      const ok = await printReceiptViaUsb(order)
      if (ok) return 'usb'
    } catch (err) {
      console.warn('[receipt-printer] USB path failed, falling back to print window:', err)
    }
  }
  const ok = printReceiptViaWindow(order)
  return ok ? 'window' : 'unsupported'
}
