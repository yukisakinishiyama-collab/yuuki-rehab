'use client'
// ──────────────────────────────────────────────
// 来院カレンダー（患者さん1人分）
// 来院した日・キャンセルした日・これからの予約を月のカレンダーで見る。日を押すとその日の記録が下に出る。
// 元データの組み立ては lib/karte/visit-calendar.ts。予約は予約システムのフィード（連携キーがある端末だけ）
// ──────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react'
import type { AttendanceRecord, CancellationRecord, Evaluation, Intake, KartePhoto, Patient, SOAPNote } from '@/types/patient'
import type { YoyakuFeed } from '@/lib/yoyaku-cancel-sync'
import { buildVisitDays, monthShape, summarize, ymd, type VisitDay, type VisitEventKind } from '@/lib/karte/visit-calendar'

const FEED_KEY_STORAGE = 'yoyaku_feed_key'
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

type Props = {
  patient: Patient
  soapNotes: SOAPNote[]
  attendance?: AttendanceRecord[]
  cancellations?: CancellationRecord[]
  evaluations?: Evaluation[]
  intakes?: Intake[]
  photos?: KartePhoto[]
  /** SOAP の日を押したときに開く（タブの切り替えなど） */
  onOpenSoap?: (soapId: string) => void
  /** 最初から開いた状態にするか（既定: 開く） */
  defaultOpen?: boolean
}

const todayKey = () => {
  const d = new Date()
  return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

const EVENT_STYLE: Record<VisitEventKind, { dot: string; chip: string; text: string }> = {
  visit: { dot: 'bg-teal-600', chip: 'bg-teal-50 text-teal-800 border-teal-200', text: '来院' },
  reservation: { dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-800 border-sky-200', text: '予約' },
  cancel: { dot: 'bg-red-500', chip: 'bg-red-50 text-red-800 border-red-200', text: 'キャンセル' },
  intake: { dot: 'bg-violet-400', chip: 'bg-violet-50 text-violet-800 border-violet-200', text: '問診' },
  evaluation: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-800 border-amber-200', text: '評価' },
  photo: { dot: 'bg-slate-500', chip: 'bg-slate-100 text-slate-700 border-slate-200', text: '写真' },
}

export default function VisitCalendar({ patient, soapNotes, attendance, cancellations, evaluations, intakes, photos, onOpenSoap, defaultOpen = true }: Props) {
  const today = todayKey()
  const [open, setOpen] = useState(defaultOpen)
  const [cursor, setCursor] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }))
  const [selected, setSelected] = useState<string | null>(null)
  const [feed, setFeed] = useState<YoyakuFeed | null>(null)

  // これからの予約（連携キーがある端末だけ。無ければ黙って出さない）
  useEffect(() => {
    let cancelled = false
    const key = typeof localStorage !== 'undefined' ? localStorage.getItem(FEED_KEY_STORAGE) || '' : ''
    if (!key) return
    fetch(`/api/yoyaku/feed?key=${encodeURIComponent(key)}&days=14`, { cache: 'no-store' })
      .then(r => r.json())
      .then((data: YoyakuFeed) => { if (!cancelled && data?.ok) setFeed(data) })
      .catch(() => { /* 予約は補助情報。取れなくてもカレンダーは出す */ })
    return () => { cancelled = true }
  }, [patient.id])

  const days = useMemo(
    () => buildVisitDays({ patient, soapNotes, attendance, cancellations, evaluations, intakes, photos, feed, today }),
    [patient, soapNotes, attendance, cancellations, evaluations, intakes, photos, feed, today],
  )
  const summary = useMemo(() => summarize(days, today), [days, today])
  const { firstDow, daysInMonth } = monthShape(cursor.year, cursor.month)
  const monthKey = `${cursor.year}-${String(cursor.month).padStart(2, '0')}`
  const monthVisits = [...days.values()].filter(d => d.visited && d.date.startsWith(monthKey)).length

  function move(delta: number) {
    setCursor(c => {
      const m = c.month + delta
      if (m < 1) return { year: c.year - 1, month: 12 }
      if (m > 12) return { year: c.year + 1, month: 1 }
      return { year: c.year, month: m }
    })
    setSelected(null)
  }

  const selectedDay: VisitDay | null = selected ? days.get(selected) ?? { date: selected, events: [], visited: false, cancelled: false, reserved: false } : null
  const cells: Array<number | null> = [...Array<null>(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* 見出しとまとめ */}
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3 text-left max-lg:min-h-10">
        <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">📅 来院カレンダー</span>
        <span className="text-xs text-gray-500 truncate">
          通算 {summary.total}回
          {summary.lastVisit ? ` · 最後の来院 ${summary.lastVisit.slice(5).replace('-', '/')}${summary.daysSince !== null ? `（${summary.daysSince}日前）` : ''}` : ''}
          {summary.nextReservation ? ` · 次の予約 ${summary.nextReservation.slice(5).replace('-', '/')}` : ''}
        </span>
        <span className="ml-auto text-xs text-slate-500">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-3 pb-4">
          {/* 月の切り替え */}
          <div className="flex items-center justify-between px-1 pb-2">
            <button type="button" onClick={() => move(-1)} aria-label="前の月" className="px-3 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100 max-lg:min-h-10">‹ 前の月</button>
            <div className="text-center">
              <span className="text-sm font-semibold text-gray-800">{cursor.year}年{cursor.month}月</span>
              <span className="ml-2 text-xs text-gray-500">来院 {monthVisits}回</span>
            </div>
            <button type="button" onClick={() => move(1)} aria-label="次の月" className="px-3 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100 max-lg:min-h-10">次の月 ›</button>
          </div>

          {/* カレンダー本体 */}
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`text-center text-xs font-medium py-1 ${i === 0 ? 'text-red-600' : i === 6 ? 'text-sky-700' : 'text-gray-500'}`}>{w}</div>
            ))}
            {cells.map((day, idx) => {
              if (day === null) return <div key={`e${idx}`} />
              const date = ymd(cursor.year, cursor.month, day)
              const info = days.get(date)
              const isToday = date === today
              const isSelected = date === selected
              const dow = idx % 7
              const base = info?.visited
                ? 'bg-teal-700 text-white font-semibold'
                : info?.reserved
                  ? 'bg-sky-100 text-sky-900 border border-sky-300 font-semibold'
                  : info?.cancelled
                    ? 'bg-red-50 text-red-800 border border-red-200'
                    : dow === 0 ? 'text-red-600' : dow === 6 ? 'text-sky-700' : 'text-gray-800'
              const extra = (info?.events ?? []).filter(e => e.kind !== 'visit' && e.kind !== 'reservation' && !(e.kind === 'cancel' && !e.muted))
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelected(s => (s === date ? null : date))}
                  className={`relative flex flex-col items-center justify-center rounded-lg text-sm aspect-square max-lg:min-h-10 transition-colors ${base} ${isSelected ? 'ring-2 ring-teal-500 ring-offset-1' : ''} ${isToday && !info?.visited ? 'outline outline-1 outline-gray-400' : ''}`}
                  aria-label={`${cursor.month}月${day}日${info?.visited ? ' 来院' : ''}${info?.reserved ? ' 予約' : ''}${info?.cancelled ? ' キャンセル' : ''}`}
                >
                  <span>{day}</span>
                  {extra.length > 0 && (
                    <span className="absolute bottom-0.5 flex gap-0.5">
                      {extra.slice(0, 3).map((e, i) => <span key={i} className={`h-1 w-1 rounded-full ${info?.visited ? 'bg-white/80' : EVENT_STYLE[e.kind].dot}`} />)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* 凡例 */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 pt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-teal-700" />来院</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-sky-100 border border-sky-300" />予約</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-50 border border-red-200" />キャンセル</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-violet-400" />問診</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />評価</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-slate-500" />写真</span>
          </div>

          {/* 選んだ日の記録 */}
          {selectedDay && (
            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">{selectedDay.date.replace(/-/g, '/')}</p>
              {selectedDay.events.length === 0 ? (
                <p className="text-xs text-gray-500">この日の記録はありません</p>
              ) : (
                <ul className="space-y-1.5">
                  {selectedDay.events.map((e, i) => {
                    const st = EVENT_STYLE[e.kind]
                    const content = (
                      <>
                        <span className={`shrink-0 rounded border px-1.5 py-0.5 text-xs ${st.chip} ${e.muted ? 'opacity-60' : ''}`}>{st.text}</span>
                        <span className={`text-sm text-gray-800 ${e.muted ? 'text-gray-500' : ''}`}>{e.label}</span>
                      </>
                    )
                    return (
                      <li key={i} className="flex items-center gap-2">
                        {e.soapId && onOpenSoap ? (
                          <button type="button" onClick={() => onOpenSoap(e.soapId!)} className="flex items-center gap-2 text-left hover:underline max-lg:min-h-10">
                            {content}
                            <span className="text-xs text-teal-700">カルテを見る ›</span>
                          </button>
                        ) : content}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
