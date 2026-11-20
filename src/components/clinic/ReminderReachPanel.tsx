'use client'
// ──────────────────────────────────────────────
// 「今日」の画面：前日のお知らせが届かない方（2026-11-20 院長「キャンセル率を下げる対策を」→「届かない方を一覧に」）
//
// - 明日の予約のうち、前日のお知らせ（LINE・メール）が届かない方 → 電話で確かめる（「連絡した」の印はこの端末だけ）
// - 今日来られる方で、届く手段が無い方 → 受付で LINE 連携（カルテの「公式LINE」→ QRコード）をすすめる
// - LINE の前日のお知らせが「テスト」「止める」のときは、そのことを出す（LINE 連携の方にも届いていないため）
// 決まりは lib/reminder-reach.ts。予約の読み込みは「今日の予約」と同じ（この端末に入れた予約管理のパスワードで）。
// 予約システム v3.26〜で、メールの有無・お知らせ不要・送ったか が分かる（メールアドレスそのものは来ない）
// ──────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BellOff, Phone } from 'lucide-react'
import type { Patient } from '@/types/patient'
import { getPatients, initPatientStore } from '@/lib/patient-store'
import { useLineLinks } from '@/lib/line-link-client'
import { patientLinkKey } from '@/lib/line-link'
import { matchKartePatients } from '@/lib/karte-link'
import { formatDateJa } from '@/lib/reservation-message'
import { buildReachSummary, REACH_LABELS, telHref, type ReachItem, type ReachRow, type RemindMode } from '@/lib/reminder-reach'
import { cn } from '@/lib/utils'
import { Panel } from './Panel'

/** 「今日の予約」と同じ、予約管理のパスワードの置き場所 */
const FEED_KEY_STORAGE = 'yoyaku_feed_key'
/** 「連絡した」の印（この端末だけ。予約番号 → 印を付けた日） */
const CALLED_STORAGE = 'reminder_called'
const DAYS = 14
const RELOAD_MS = 5 * 60 * 1000

interface Feed {
  ok: boolean
  error?: string
  days?: { date: string; rows: Omit<ReachRow, 'date'>[] }[]
}

const pad = (n: number) => String(n).padStart(2, '0')
function nowLocal(): { date: string; time: string; tomorrow: string } {
  const d = new Date()
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    tomorrow: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`,
  }
}

function readCalled(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(CALLED_STORAGE) || '{}') as Record<string, string>
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

/** 「連絡した」の印を付ける・外す（3日より前の印は捨てる）。新しい印の一覧を返す */
function toggleCalledMark(no: string): Record<string, string> {
  const next = { ...readCalled() }
  if (next[no]) delete next[no]
  else next[no] = nowLocal().date
  const limit = new Date(Date.now() - 3 * 86_400_000)
  const lim = `${limit.getFullYear()}-${pad(limit.getMonth() + 1)}-${pad(limit.getDate())}`
  for (const k of Object.keys(next)) if (next[k] < lim) delete next[k]
  try {
    localStorage.setItem(CALLED_STORAGE, JSON.stringify(next))
  } catch {
    // 覚えられないだけ
  }
  return next
}

type Loaded = { kind: 'nokey' } | { kind: 'error'; message: string } | { kind: 'ok'; rows: ReachRow[]; mode: RemindMode }

async function load(): Promise<Loaded> {
  const key = localStorage.getItem(FEED_KEY_STORAGE) || ''
  if (!key) return { kind: 'nokey' }
  try {
    const [feedRes, modeRes] = await Promise.all([
      fetch(`/api/yoyaku/feed?key=${encodeURIComponent(key)}&days=${DAYS}`, { cache: 'no-store' }),
      fetch('/api/line-link/remind-mode', { cache: 'no-store' }).catch(() => null),
    ])
    const feed = (await feedRes.json().catch(() => null)) as Feed | null
    if (!feed?.ok) return { kind: 'error', message: feed?.error ? `予約を読み込めませんでした（${feed.error}）` : '予約を読み込めませんでした' }
    const m = modeRes ? ((await modeRes.json().catch(() => null)) as { mode?: string } | null) : null
    const mode: RemindMode = m?.mode === 'on' || m?.mode === 'test' || m?.mode === 'off' ? m.mode : 'unknown'
    const rows = (feed.days ?? []).flatMap((d) => d.rows.map((r) => ({ ...r, date: d.date })))
    return { kind: 'ok', rows, mode }
  } catch {
    return { kind: 'error', message: '予約を読み込めませんでした' }
  }
}

export default function ReminderReachPanel() {
  const { links, linkFor } = useLineLinks()
  const [rows, setRows] = useState<ReachRow[] | null>(null)
  const [mode, setMode] = useState<RemindMode>('unknown')
  const [noKey, setNoKey] = useState(false)
  const [error, setError] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [called, setCalled] = useState<Record<string, string>>({})

  // 読み込みは .then の中で state に入れる（effect の中で同期に setState しないように）
  const reload = useCallback(() => {
    return Promise.resolve()
      .then(() => load())
      .then((r) => {
        if (r.kind === 'nokey') return setNoKey(true)
        if (r.kind === 'error') return setError(r.message)
        initPatientStore()
        setPatients(getPatients())
        setCalled(readCalled())
        setRows(r.rows)
        setMode(r.mode)
        setError('')
      })
  }, [])

  useEffect(() => {
    void reload()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reload()
    }, RELOAD_MS)
    return () => window.clearInterval(timer)
  }, [reload])

  const karteOf = useCallback(
    (row: { name: string; phone: string }) => {
      const hits = matchKartePatients(patients, row.name, row.phone)
      return hits.length === 1 ? hits[0] : null
    },
    [patients],
  )

  const summary = useMemo(() => {
    if (!rows || !links) return null
    const isLinked = (row: ReachRow) => {
      const key = patientLinkKey(row.name, row.phone)
      if (key && links.some((l) => l.key === key)) return true
      const karte = karteOf(row)
      return Boolean(karte && linkFor(karte))
    }
    return buildReachSummary(rows, isLinked, mode, nowLocal())
  }, [rows, links, mode, karteOf, linkFor])

  function toggleCalled(no: string) {
    setCalled(toggleCalledMark(no))
  }

  if (noKey) return null

  const modeNote =
    mode === 'test' || mode === 'off'
      ? `LINEの「前日のお知らせ」が「${mode === 'test' ? 'テスト' : '止める'}」になっているため、LINE連携の方にもLINEでは届いていません（メールのある方にはメールで届きます）。集客 → 自動化設定 で「動かす」にすると届きます。`
      : ''

  const row = (item: ReachItem, opts: { call?: boolean }) => {
    const karte = karteOf(item)
    const tel = telHref(item.phone)
    const done = Boolean(called[item.reservationNo])
    return (
      <li key={item.reservationNo} className={cn('rounded-lg border px-3 py-2', done ? 'border-slate-200 bg-slate-50' : 'border-amber-300 bg-amber-50/50')}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-bold tabular-nums text-slate-900">{item.time}</span>
          {karte ? (
            <Link href={`/patients/${karte.id}?tab=overview`} className="text-sm font-bold text-teal-800 underline underline-offset-2">
              {item.name} 様
            </Link>
          ) : (
            <span className="text-sm font-bold text-slate-900">{item.name} 様</span>
          )}
          <span className="text-xs text-slate-600">{REACH_LABELS[item.reach]}</span>
          <span className="ml-auto flex items-center gap-2">
            {opts.call && tel && (
              <a href={tel} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 max-lg:min-h-10">
                <Phone className="h-3.5 w-3.5" aria-hidden />
                電話
              </a>
            )}
            {opts.call && (
              <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 text-sm text-slate-700 max-lg:min-h-10">
                <input type="checkbox" checked={done} onChange={() => toggleCalled(item.reservationNo)} className="h-5 w-5 accent-teal-700" />
                連絡した
              </label>
            )}
          </span>
        </div>
      </li>
    )
  }

  const n = nowLocal()
  return (
    <Panel title="前日のお知らせが届かない方" icon={BellOff}>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {!error && !summary && <p className="text-sm text-slate-500">読み込んでいます…</p>}
      {summary && (
        <div className="space-y-4">
          {modeNote && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{modeNote}</p>}

          <section>
            <h3 className="text-sm font-bold text-slate-700">明日 {formatDateJa(n.tomorrow)} の予約</h3>
            {summary.tomorrowTotal === 0 ? (
              <p className="mt-1 text-sm text-slate-500">明日の予約はありません。</p>
            ) : summary.tomorrow.length === 0 ? (
              <p className="mt-1 text-sm text-teal-800">明日の予約（{summary.tomorrowTotal}件）は、すべて前日のお知らせが届きます。</p>
            ) : (
              <>
                <p className="mt-1 text-sm text-slate-700">
                  {summary.tomorrowTotal}件のうち <b>{summary.tomorrow.length}件</b> は前日のお知らせが届きません。お電話で予約日時を確かめてください（来られないときは早めの変更をお願いすると、空いた時間をほかの方に回せます）。
                </p>
                <ul className="mt-2 space-y-2">{summary.tomorrow.map((i) => row(i, { call: true }))}</ul>
              </>
            )}
            {summary.tomorrowOff.length > 0 && (
              <p className="mt-2 text-xs text-slate-600">
                お知らせ不要にしている方（ご本人の設定）：{summary.tomorrowOff.map((i) => `${i.time} ${i.name} 様`).join('、')}
              </p>
            )}
          </section>

          {summary.todayNoRoute.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-slate-700">今日来られる方で、お知らせが届く手段が無い方</h3>
              <p className="mt-1 text-sm text-slate-700">
                受付で LINE 連携をすすめてください（お名前を押してカルテの「公式LINE」→「QRコードでLINEと結びつける」）。次の予約から前日のお知らせが届きます。
              </p>
              <ul className="mt-2 space-y-2">{summary.todayNoRoute.map((i) => row(i, {}))}</ul>
            </section>
          )}

          {summary.laterNoRoute > 0 && (
            <p className="text-xs text-slate-600">明後日から2週間先までの予約で、お知らせが届く手段が無いもの：{summary.laterNoRoute}件</p>
          )}
          {summary.legacy && (
            <p className="text-xs text-slate-600">
              予約システムを v3.26 にすると、メールのある方・お知らせ不要の方・もう送った方も見分けられます（今は LINE 連携の有無だけで見ています）。
            </p>
          )}
        </div>
      )}
    </Panel>
  )
}
