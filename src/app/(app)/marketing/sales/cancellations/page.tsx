'use client'
/**
 * キャンセル分析 — 院長のみ・経営メニュー（隠しモード）の中（2026-11-20 院長「キャンセル率を下げる対策を」）
 *
 * どこに手を打つと効くかを見るための画面。
 * - 予約システム（集計の行だけ・お名前は来ない）：予約日が過ぎた予約のキャンセル率を、月・初めて/2回目以降・曜日・
 *   予約を受けてから予約日までの日数・流入元ごとに（/api/marketing/cancel-stats）
 * - カルテのキャンセルの記録（この端末）：予約日前・当日・無断、理由、何日前の連絡か、くり返しキャンセルの方、LINE 連携の有無
 * 計算は lib/cancel-analysis.ts（単体テストあり）。名前はこの画面（院内）だけで、外には送らない
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useMarketingRole } from '@/lib/marketing/use-role'
import { getCancellations, getPatients, initPatientStore } from '@/lib/patient-store'
import { useLineLinks } from '@/lib/line-link-client'
import type { CancellationRecord, Patient } from '@/types/patient'
import {
  cancelInsights,
  karteCancelStats,
  KIND_LABELS,
  MIN_GROUP,
  type BookingCancelStats,
  type RateCell,
} from '@/lib/cancel-analysis'

const md = (d: string) => (d ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : '')
const jstDay = (offsetDays = 0) => new Date(Date.now() + 9 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10)

function RateBars({ cells, overall }: { cells: RateCell[]; overall: number | null }) {
  const max = Math.max(20, ...cells.map((c) => c.rate ?? 0))
  return (
    <ul className="mt-2 space-y-1.5">
      {cells.map((c) => {
        const few = c.total < MIN_GROUP
        return (
          <li key={c.key} className="grid grid-cols-[7.5rem_1fr_7rem] items-center gap-2 text-sm">
            <span className="truncate text-slate-700">{c.label}</span>
            <span className="h-3 rounded bg-slate-100" aria-hidden>
              <span
                className={`block h-3 rounded ${few ? 'bg-slate-300' : overall !== null && (c.rate ?? 0) >= overall + 5 ? 'bg-orange-500' : 'bg-teal-600'}`}
                style={{ width: `${Math.min(100, ((c.rate ?? 0) / max) * 100)}%` }}
              />
            </span>
            <span className="text-right tabular-nums text-slate-800">
              {c.rate ?? 0}%<span className="ml-1 text-xs text-slate-500">({c.cancelled}/{c.total})</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function CountBars({ items, total }: { items: Array<{ label: string; count: number }>; total: number }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[7.5rem_1fr_6rem] items-center gap-2 text-sm">
          <span className="truncate text-slate-700">{i.label}</span>
          <span className="h-3 rounded bg-slate-100" aria-hidden>
            <span className="block h-3 rounded bg-teal-600" style={{ width: `${total ? (i.count / total) * 100 : 0}%` }} />
          </span>
          <span className="text-right tabular-nums text-slate-800">
            {i.count}件<span className="ml-1 text-xs text-slate-500">({total ? Math.round((i.count / total) * 100) : 0}%)</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export default function CancellationAnalysisPage() {
  const { isAdmin } = useMarketingRole()
  const [booking, setBooking] = useState<BookingCancelStats | null>(null)
  const [bookingState, setBookingState] = useState<'loading' | 'ok' | 'none' | 'error'>('loading')
  const [records, setRecords] = useState<CancellationRecord[] | null>(null)
  const [patients, setPatients] = useState<Patient[]>([])
  const { links, linkFor } = useLineLinks()

  useEffect(() => {
    let alive = true
    void fetch('/api/marketing/cancel-stats', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { ok?: boolean; stats?: BookingCancelStats | null }) => {
        if (!alive) return
        if (d.ok && d.stats) {
          setBooking(d.stats)
          setBookingState('ok')
        } else setBookingState(d.ok ? 'none' : 'error')
      })
      .catch(() => alive && setBookingState('error'))
    // カルテ（この端末）。読んでから state に入れる（effect の中で同期に setState しないように）
    void Promise.resolve().then(() => {
      if (!alive) return
      initPatientStore()
      setPatients(getPatients())
      setRecords(getCancellations())
    })
    return () => {
      alive = false
    }
  }, [])

  // カルテの記録は、予約システムと同じ範囲（無ければ過去120日〜昨日）で数える
  const range = useMemo(() => ({ from: booking?.from || jstDay(-120), to: booking?.to || jstDay(-1) }), [booking])
  const karte = useMemo(() => {
    if (!records || !links) return null
    const byId = new Map(patients.map((p) => [p.id, p]))
    return karteCancelStats(
      records,
      (id) => byId.get(id)?.name ?? '（カルテが見つかりません）',
      (id) => {
        const p = byId.get(id)
        return Boolean(p && linkFor(p))
      },
      range.from,
      range.to,
    )
  }, [records, links, patients, linkFor, range])
  const insights = useMemo(() => cancelInsights(booking, karte), [booking, karte])

  if (!isAdmin) return <p className="text-sm text-slate-600">この画面は院長だけが使えます。</p>

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-slate-900">キャンセル分析</h1>
        <p className="text-xs text-slate-500">
          どこに手を打つと効くかを見る画面です。予約日が過ぎた予約（{md(range.from)}〜{md(range.to)}）で数えます。名前はこの画面（院内）だけで、外には送りません。
        </p>
      </div>

      {/* 気づき */}
      <section className="rounded-xl border border-teal-200 bg-teal-50/50 p-4">
        <h2 className="font-bold text-slate-900">気づき</h2>
        {insights.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">まだ目立った傾向は出ていません（くらべるには、1つの組に{MIN_GROUP}件以上の予約が要ります）。</p>
        ) : (
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800">
            {insights.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-slate-600">
          数字の並びを言葉にしただけで、理由を決めつけるものではありません。明日の予約で前日のお知らせが届かない方は、「今日」の画面の「前日のお知らせが届かない方」に出ます。
        </p>
      </section>

      {/* 予約システム */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold text-slate-900">予約のキャンセル率（予約システム）</h2>
        {bookingState === 'loading' && <p className="mt-1 text-sm text-slate-500">読み込んでいます…</p>}
        {bookingState === 'none' && <p className="mt-1 text-sm text-slate-600">予約システムの数字を読めませんでした（つなぐ設定がまだ、または予約システムが古い）。</p>}
        {bookingState === 'error' && <p className="mt-1 text-sm text-red-700">予約システムの数字を読み込めませんでした。少しあとでもう一度開いてください。</p>}
        {booking && (
          <>
            <p className="mt-1 text-3xl font-black tabular-nums text-slate-900">
              {booking.rate ?? 0}%<span className="ml-2 text-sm font-normal text-slate-600">（{booking.cancelled}件 / 予約 {booking.total}件）</span>
            </p>
            <p className="text-xs text-slate-500">
              受け付けた日が120日以内で、予約日が過ぎた予約。「キャンセル」の状態のものを数えます（日時の変更はキャンセルに入りません）。灰色の棒は{MIN_GROUP}件より少ない組、オレンジは全体より5ポイント以上高い組です。
            </p>
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-bold text-slate-700">月ごと（予約日の月）</h3>
                <RateBars cells={booking.byMonth} overall={booking.rate} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-700">初めて／2回目以降</h3>
                <RateBars cells={booking.byVisitType} overall={booking.rate} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-700">曜日</h3>
                <RateBars cells={booking.byWeekday} overall={booking.rate} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-700">予約を受けてから予約日まで</h3>
                <RateBars cells={booking.byLead} overall={booking.rate} />
              </div>
              <div className="lg:col-span-2">
                <h3 className="text-sm font-bold text-slate-700">どこから来た予約か（流入元）</h3>
                <RateBars cells={booking.bySource} overall={booking.rate} />
              </div>
            </div>
          </>
        )}
      </section>

      {/* カルテ */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold text-slate-900">カルテのキャンセルの記録</h2>
        <p className="text-xs text-slate-500">
          カルテの「キャンセル」に入っている記録（予約システムから取り込んだもの・手で入れたもの）。入力ミス・院側の都合は除きます。
        </p>
        {!karte ? (
          <p className="mt-1 text-sm text-slate-500">読み込んでいます…</p>
        ) : karte.total === 0 ? (
          <p className="mt-1 text-sm text-slate-600">この期間のキャンセルの記録はありません。</p>
        ) : (
          <div className="mt-3 grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-bold text-slate-700">いつの連絡か（{karte.total}件）</h3>
              <CountBars items={(Object.keys(KIND_LABELS) as Array<keyof typeof KIND_LABELS>).map((k) => ({ label: KIND_LABELS[k], count: karte.byKind[k] }))} total={karte.total} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-700">何日前の連絡か</h3>
              <CountBars items={karte.notice} total={karte.total} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-700">理由</h3>
              <CountBars items={karte.reasons} total={karte.total} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-700">キャンセルした方の LINE 連携</h3>
              <CountBars
                items={[
                  { label: 'LINE 連携あり', count: karte.people.linked },
                  { label: 'LINE 連携なし', count: karte.people.notLinked },
                ]}
                total={karte.people.linked + karte.people.notLinked}
              />
              <p className="mt-1 text-xs text-slate-500">人数で数えます。連携なしの方には、LINE の前日のお知らせが届きません。</p>
            </div>
            <div className="lg:col-span-2">
              <h3 className="text-sm font-bold text-slate-700">この期間に2回以上キャンセルした方</h3>
              {karte.repeaters.length === 0 ? (
                <p className="mt-1 text-sm text-slate-600">いません。</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 text-sm">
                  {karte.repeaters.slice(0, 20).map((r) => (
                    <li key={r.patientId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
                      <Link href={`/patients/${r.patientId}`} className="font-bold text-teal-800 underline underline-offset-2">
                        {r.name}
                      </Link>
                      <span className="tabular-nums text-slate-800">{r.count}回</span>
                      <span className="text-xs text-slate-500">最後 {md(r.last)}</span>
                      <span className={`text-xs ${r.linked ? 'text-teal-800' : 'text-orange-800'}`}>{r.linked ? 'LINE 連携あり' : 'LINE 連携なし'}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1 text-xs text-slate-500">次の予約のときに、通いやすい曜日・時間を一緒に決めておくと、続けやすくなります。</p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
