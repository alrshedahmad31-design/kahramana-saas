import { NextResponse } from 'next/server'

// Deprecated: migration 077 already applied manually. Superseded by 079.
export async function GET() {
  return NextResponse.json({ ok: true, note: 'Migration 077 already applied. Superseded by 079.' })
}
