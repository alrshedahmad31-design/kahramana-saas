// Benefit Pay QR generator
// Phase 6: static QR encoding order reference + amount
// Phase 7+: replace with Benefit Pay API dynamic payment link

import QRCode from 'qrcode'
import { colors } from '@/lib/design-tokens'

export function buildQRReference(orderId: string, amountBHD: number): string {
  const short = orderId.slice(-8).toUpperCase()
  return `KAHRAMANA-${short}-${amountBHD.toFixed(3)}BD`
}

export async function generateStaticQR(
  orderId:   string,
  amountBHD: number,
): Promise<string> {
  const data = buildQRReference(orderId, amountBHD)
  return QRCode.toDataURL(data, {
    width:                300,
    margin:               2,
    errorCorrectionLevel: 'M',
    color: {
      dark:  colors.qrInk,
      light: colors.qrPaper,
    },
  })
}

