'use server'

import { headers }             from 'next/headers'
import { createServiceClient } from '@/lib/supabase/server'
import { z }                   from 'zod'

const schema = z.object({
  name:      z.string().min(2).max(100),
  email:     z.string().email(),
  phone:     z.string().max(20).optional().or(z.literal('')),
  branch_id: z.string().optional().or(z.literal('')),
  message:   z.string().min(10).max(2000),
})

type Result = { success: true } | { success: false; error: 'rate_limit' | 'server_error' }

export async function submitContactMessage(payload: {
  name: string; email: string; phone: string
  branch_id: string; message: string; website: string
}): Promise<Result> {

  // Honeypot — bots fill this; real users leave it empty
  if (payload.website) return { success: true }

  const result = schema.safeParse(payload)
  if (!result.success) return { success: false, error: 'server_error' }

  // Sliding-window rate limit: 5 submits / IP / hour
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const [{ Ratelimit }, { Redis }] = await Promise.all([
      import('@upstash/ratelimit'),
      import('@upstash/redis'),
    ])
    const ratelimit = new Ratelimit({
      redis:   Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, '1 h'),
    })
    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim()
            ?? headersList.get('x-real-ip')
            ?? '127.0.0.1'

    const { success: allowed } = await ratelimit.limit(`contact:${ip}`)
    if (!allowed) return { success: false, error: 'rate_limit' }
  }

  const service = await createServiceClient()
  const { error } = await service.from('contact_messages').insert({
    name:      result.data.name,
    email:     result.data.email,
    phone:     result.data.phone || null,
    branch_id: result.data.branch_id || null,
    message:   result.data.message,
  })

  if (error) return { success: false, error: 'server_error' }
  return { success: true }
}
