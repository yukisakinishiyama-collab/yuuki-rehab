'use client'
/** 文字起こし → 患者さんの情報だけに整理（/api/voice/organize を呼ぶ。画面用） */
import type { VoiceMemoResult, VoiceSoapResult } from './soap-fields'
import { FAILED_MARK } from './use-dictation'

export function organizeTranscript(mode: 'soap', transcript: string): Promise<VoiceSoapResult>
export function organizeTranscript(mode: 'memo', transcript: string): Promise<VoiceMemoResult>
export async function organizeTranscript(mode: 'soap' | 'memo', transcript: string): Promise<VoiceSoapResult | VoiceMemoResult> {
  // 文字にできなかった部分の印は、AIには渡さない
  const text = transcript
    .split('\n')
    .filter((line) => line.trim() && line !== FAILED_MARK)
    .join('\n')
  const res = await fetch('/api/voice/organize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, transcript: text }),
  })
  const data = (await res.json().catch(() => ({}))) as { result?: VoiceSoapResult | VoiceMemoResult; error?: string }
  if (!res.ok || !data.result) throw new Error(data.error ?? `AIで整理できませんでした（HTTP ${res.status}）`)
  return data.result
}
