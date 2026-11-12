'use client'
// ──────────────────────────────────────────────
// 次の予約を調べる（今日の画面）
// お名前・フリガナ・電話番号を入れると、その方の今後の予約（日付・時刻・メニュー）を出す。
// 予約システムのフィード（/api/yoyaku/feed）を、連携キー（この端末に保存）で読むだけ。書き込みはしない。
// ──────────────────────────────────────────────
import { useRef, useState } from 'react'
import { CalendarSearch, Loader2 } from 'lucide-react'
import type { YoyakuFeed } from '@/lib/yoyaku-cancel-sync'
import { dateLabelJa, daysFromToday, findReservations, type ReservationHit } from '@/lib/karte/next-reservation'
import { Panel } from './Panel'

const FEED_KEY_STORAGE = 'yoyaku_feed_key'
/** 何日先まで見るか（予約システム側の上限が 14 日のままなら 14 日分だけ返る） */
const LOOKAHEAD_DAYS = 90

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function NextReservationCard() {
  const [query, setQuery] = useState('')
  const [feed, setFeed] = useState<YoyakuFeed | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'nokey' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const loadedFor = useRef<string | null>(null)

  // 入力が始まったら一度だけフィードを読む（開いただけでは読まない）
  function ensureLoaded() {
    if (loadedFor.current) return
    const key = typeof localStorage !== 'undefined' ? localStorage.getItem(FEED_KEY_STORAGE) || '' : ''
    if (!key) { loadedFor.current = 'nokey'; setState('nokey'); return }
    loadedFor.current = key
    setState('loading')
    fetch(`/api/yoyaku/feed?key=${encodeURIComponent(key)}&days=${LOOKAHEAD_DAYS}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((data: YoyakuFeed) => {
        if (data?.ok) { setFeed(data); setState('ready') }
        else { setError(data?.error === 'unauthorized' ? '連携キーが一致しません。「今日の予約」で設定し直してください。' : data?.error || '予約を読み取れませんでした'); setState('error') }
      })
      .catch(() => { setError('予約システムに届きませんでした。少し待ってからもう一度お試しください。'); setState('error') })
  }

  const today = todayKey()
  const hits = state === 'ready' ? findReservations(feed, query, today) : []
  const coveredDays = feed?.days?.length ?? 0
  const trimmed = query.trim()

  return (
    <Panel title="次の予約を調べる" icon={CalendarSearch}>
      <label htmlFor="next-reservation-query" className="sr-only">お名前・フリガナ・電話番号</label>
      <input
        id="next-reservation-query"
        value={query}
        onChange={e => { setQuery(e.target.value); if (e.target.value.trim()) ensureLoaded() }}
        placeholder="お名前・フリガナ・電話番号の一部"
        autoComplete="off"
        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm placeholder:text-slate-500 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
      />

      <div className="mt-3 space-y-2" aria-live="polite">
        {!trimmed && <p className="text-xs text-slate-500">お名前を入れると、その方の今後の予約（日付・時刻・メニュー）が出ます。</p>}
        {trimmed && state === 'loading' && (
          <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />予約を読み込んでいます…</p>
        )}
        {trimmed && state === 'nokey' && (
          <p className="text-sm text-amber-800">予約との連携キーがこの端末に設定されていません。上の「今日の予約」で管理者パスワードを入れると使えます。</p>
        )}
        {trimmed && state === 'error' && <p className="text-sm text-red-700">{error}</p>}
        {trimmed && state === 'ready' && hits.length === 0 && (
          <p className="text-sm text-slate-600">「{trimmed}」の予約は、今日から{coveredDays}日の間にありません。</p>
        )}
        {hits.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {hits.slice(0, 20).map(h => <HitRow key={`${h.reservationNo}-${h.date}-${h.time}`} hit={h} today={today} />)}
          </ul>
        )}
        {hits.length > 20 && <p className="text-xs text-slate-500">他 {hits.length - 20} 件。お名前をもう少し詳しく入れてください。</p>}
        {trimmed && state === 'ready' && (
          <p className="text-xs text-slate-500">今日から {coveredDays} 日分の予約を見ています。</p>
        )}
      </div>
    </Panel>
  )
}

function HitRow({ hit, today }: { hit: ReservationHit; today: string }) {
  const n = daysFromToday(hit.date, today)
  const when = n === 0 ? '今日' : n === 1 ? '明日' : `${n}日後`
  const pending = /仮|要確認|未確定/.test(hit.status)
  return (
    <li className="px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm font-bold text-slate-900 tabular-nums">{dateLabelJa(hit.date)} {hit.time}</span>
        <span className="text-xs text-teal-800">{when}</span>
        {pending && <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800">{hit.status}</span>}
      </div>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm text-slate-800">
        <span className="font-medium">{hit.name}</span>
        {hit.kana ? <span className="text-xs text-slate-500">{hit.kana}</span> : null}
        <span className="text-xs text-slate-600">{[hit.kubun, hit.visitType, hit.staff].filter(Boolean).join(' · ')}</span>
      </div>
    </li>
  )
}
