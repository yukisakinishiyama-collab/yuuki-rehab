import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { DEFAULT_CLINIC_PROFILE } from '@/lib/marketing/clinic'
import { generateVariants } from '@/lib/marketing/generate-server'
import { CHANNEL_LABELS, type Channel } from '@/lib/marketing/types'

export const maxDuration = 120

// ── 入力検証 ─────────────────────────────────────────────────────
const RequestSchema = z.object({
  objective: z.string().min(1),
  theme: z.string().min(1),
  audience: z.string().optional().default(''),
  keyMessage: z.string().optional().default(''),
  evidence: z.string().optional().default(''),
  cta: z.string().optional().default(''),
  tone: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  channels: z.array(z.string()).min(1),
  clinicProfile: z.record(z.string(), z.string()).optional(),
  mock: z.boolean().optional().default(false),
})

export async function POST(request: NextRequest) {
  let parsed
  try {
    parsed = RequestSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: '入力内容が不正です' }, { status: 400 })
  }

  const profile = { ...DEFAULT_CLINIC_PROFILE, ...(parsed.clinicProfile ?? {}) }
  const channels = parsed.channels.filter((c): c is Channel => c in CHANNEL_LABELS)
  if (channels.length === 0) {
    return NextResponse.json({ error: '対応していない媒体です' }, { status: 400 })
  }

  // 生成・表現チェックの本体は generate-server.ts（自動下書きと共通）
  const { mode, variants, errors } = await generateVariants({ ...parsed, channels, profile })
  return NextResponse.json({ ok: true, mode, variants, errors })
}
