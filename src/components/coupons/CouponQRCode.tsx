'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { tokens } from '@/lib/design-tokens'

interface Props {
  code: string
}

export default function CouponQRCode({ code }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, code, {
        width: 160,
        margin: 2,
        color: {
          dark:  tokens.color.qrInk,
          light: tokens.color.qrPaper,
        },
      }, (err) => {
        if (err) console.error('QR Code error:', err)
      })
    }
  }, [code])

  return (
    <div
      className="flex flex-col items-center gap-3 p-6 rounded-3xl border border-brand-border shadow-inner"
      style={{ backgroundColor: tokens.color.qrPaper }}
    >
      <div className="bg-white p-2 rounded-xl shadow-md">
        <canvas ref={canvasRef} className="rounded-lg" />
      </div>
      <div className="text-center">
        <p className="text-[10px] font-black text-brand-black uppercase tracking-widest mb-0.5">Scan to Apply</p>
        <p className="text-sm font-black text-brand-black tracking-[0.2em]">{code}</p>
      </div>
    </div>
  )
}
