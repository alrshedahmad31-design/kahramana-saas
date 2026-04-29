/**
 * render-for-supabase.ts
 *
 * Renders email templates to HTML with Supabase placeholder variables
 * so they can be pasted directly into Supabase Auth → Email Templates.
 *
 * Supabase variables:
 *   Invite:        {{ .ConfirmationURL }}
 *   Magic link:    {{ .ConfirmationURL }}
 *   Reset:         {{ .ConfirmationURL }}
 *
 * Usage:
 *   npx tsx emails/scripts/render-for-supabase.ts
 *
 * Output files are written to emails/rendered/
 */

import * as React from 'react'
import { render } from '@react-email/components'
import fs from 'fs'
import path from 'path'
import InviteStaff from '../templates/InviteStaff'
import MagicLink from '../templates/MagicLink'
import ResetPassword from '../templates/ResetPassword'

const OUT_DIR = path.join(process.cwd(), 'emails', 'rendered')
fs.mkdirSync(OUT_DIR, { recursive: true })

const SUPABASE_URL_PLACEHOLDER = '{{ .ConfirmationURL }}'

const templates: Array<{ name: string; element: React.ReactElement }> = [
  {
    name: 'invite-staff',
    element: InviteStaff({
      staffName: '{{ .Name }}',
      inviteUrl: SUPABASE_URL_PLACEHOLDER,
      role: undefined,
    }) as React.ReactElement,
  },
  {
    name: 'magic-link',
    element: MagicLink({
      magicLinkUrl: SUPABASE_URL_PLACEHOLDER,
    }) as React.ReactElement,
  },
  {
    name: 'reset-password',
    element: ResetPassword({
      resetUrl: SUPABASE_URL_PLACEHOLDER,
    }) as React.ReactElement,
  },
]

async function main() {
  for (const { name, element } of templates) {
    const html = await render(element)
    const outPath = path.join(OUT_DIR, `${name}.html`)
    fs.writeFileSync(outPath, html, 'utf-8')
    console.log(`✓ Written: emails/rendered/${name}.html`)
  }
  console.log('\nDone! Paste the HTML content into Supabase Dashboard → Auth → Email Templates.')
  console.log('Note: Supabase strips <html>/<head>/<body> tags — only the inner content is used.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
