'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

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
          dark: '#110b05',
          light: '#f4ecd8'
        }
      }, (err) => {
        if (err) console.error('QR Code error:', err)
      })
    }
  }, [code])

  return (
    <div className="flex flex-col items-center gap-3 p-6 bg-[#f4ecd8] rounded-3xl border border-brand-border shadow-inner">
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
