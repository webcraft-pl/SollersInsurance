import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.json({
    ai: !!process.env.ANTHROPIC_API_KEY,
    aiKeyPrefix: process.env.ANTHROPIC_API_KEY?.slice(0, 12) ?? null,
    supabaseUrl: !!process.env.VITE_SUPABASE_URL,
    supabaseKey: !!process.env.VITE_SUPABASE_ANON_KEY,
    ts: new Date().toISOString(),
  })
}
