'use client'
// ──────────────────────────────────────────────
// 日報（/yoyaku/daily?date=YYYY-MM-DD。日付が無ければ今日）
// 中身は components/clinic/DailyReport.tsx。2026-11-27 院長「1日ごとの予約などを日報として」「印刷できるようにも」
// ──────────────────────────────────────────────
import { useSyncExternalStore } from 'react'
import DailyReport from '@/components/clinic/DailyReport'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function readDate(): string {
  const date = new URLSearchParams(window.location.search).get('date') ?? ''
  return DATE_RE.test(date) ? date : ''
}

export default function DailyReportPage() {
  // アドレスの ?date= は端末の側で読む（カルテ・予約の連携キーは端末にあるので、どのみち端末で描く）
  const date = useSyncExternalStore(() => () => {}, readDate, () => null)
  if (date === null) return null
  return <DailyReport initialDate={date} />
}
