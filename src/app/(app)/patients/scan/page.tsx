'use client'
// ──────────────────────────────────────────────
// 問診票を撮って登録（/patients/scan）・カルテの基本情報を入れる・直す（/patients/scan?id=カルテのID）
// 中身は components/rehab-management/IntakeScanFlow.tsx
// ──────────────────────────────────────────────
import { useSyncExternalStore } from 'react'
import IntakeScanFlow from '@/components/rehab-management/IntakeScanFlow'

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/

function readId(): string {
  const id = new URLSearchParams(window.location.search).get('id') ?? ''
  return ID_RE.test(id) ? id : ''
}

export default function IntakeScanPage() {
  // アドレスの ?id= は端末の側で読む（サーバーでは空。カルテは端末にあるので、どのみち端末で描く）
  const id = useSyncExternalStore(() => () => {}, readId, () => null)
  if (id === null) return null
  return <IntakeScanFlow key={id} patientId={id || undefined} />
}
