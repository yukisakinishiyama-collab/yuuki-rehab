'use client'
// ──────────────────────────────────────────────
// 「今日」の画面：LINEで連携している方の予約を、LINEで送る（2026-11-02 院長の依頼）
//
// これから2週間の予約のうち、LINE連携している方の分を並べる。
// 「LINEで送る」→ 送る文面を見せる →「この内容で送る」で、患者さんのLINEへ予約日・時間を送る。
// 文面は、LINEから予約した方に予約システムから届く「予約が確定しました」と同じ（lib/reservation-message.ts）。
// 送った予約は「送信済み」。予約の日時が変わったら「日時が変わりました」と出して、送り直せる。
// 予約の読み込みは「今日の予約」と同じ（この端末に入れた予約管理のパスワードで、予約システムから読む）。
// ──────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, MessageCircle, Send } from 'lucide-react'
import type { Patient } from '@/types/patient'
import { getPatients, initPatientStore } from '@/lib/patient-store'
import { useLineLinks } from '@/lib/line-link-client'
import { patientLinkKey, type LineLinkSummary } from '@/lib/line-link'
import { matchKartePatients } from '@/lib/karte-link'
import { formatDateJa, patientConfirmText } from '@/lib/reservation-message'
import { cn } from '@/lib/utils'
import { Panel } from './Panel'

/** 「今日の予約」と同じ、予約管理のパスワードの置き場所 */
const FEED_KEY_STORAGE = 'yoyaku_feed_key'
const DAYS = 14
const CANCELLED = 'キャンセル'
const VISITED = '来院済み'
const RELOAD_MS = 2 * 60 * 1000

interface FeedRow {
  time: string
  name: string
  kana: string
  phone: string
  status: string
  reservationNo: string
}
interface Feed {
  ok: boolean
  error?: string
  days?: { date: string; rows: FeedRow[] }[]
}

interface Item {
  date: string
  time: string
  name: string
  reservationNo: string
  link: LineLinkSummary
}

interface SentInfo {
  date: string
  time: string
  sentAt: string
}

/** 端末の時計での「いま」（'YYYY-MM-DD' と 'HH:MM'） */
function nowLocal(): { date: string; time: string } {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
}

const hhmm = (time: string) => String(time || '').slice(0, 5)

/** '2026-11-02T11:31:00Z' → '11/2 20:31' */
function sentLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

type Upcoming =
  | { kind: 'nokey' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; rows: (FeedRow & { date: string })[] }

/** これからの予約（キャンセル・来院済み・過ぎた時刻を除く）を予約システムから読む */
async function readUpcoming(): Promise<Upcoming> {
  const key = localStorage.getItem(FEED_KEY_STORAGE) || ''
  if (!key) return { kind: 'nokey' }
  try {
    const res = await fetch(`/api/yoyaku/feed?key=${encodeURIComponent(key)}&days=${DAYS}`, { cache: 'no-store' })
    const data = (await res.json().catch(() => null)) as Feed | null
    if (!data?.ok) {
      return { kind: 'error', message: data?.error ? `予約を読み込めませんでした（${data.error}）` : '予約を読み込めませんでした' }
    }
    const now = nowLocal()
    const rows = (data.days ?? [])
      .flatMap((d) => d.rows.map((r) => ({ ...r, date: d.date })))
      .filter((r) => r.status !== CANCELLED && r.status !== VISITED && r.reservationNo)
      .filter((r) => r.date > now.date || (r.date === now.date && hhmm(r.time) >= now.time))
    return { kind: 'ok', rows }
  } catch {
    return { kind: 'error', message: '予約を読み込めませんでした' }
  }
}

export default function LineReservationPanel() {
  const { links, linkFor } = useLineLinks()
  const [rows, setRows] = useState<(FeedRow & { date: string })[] | null>(null)
  const [noKey, setNoKey] = useState(false)
  const [patients, setPatients] = useState<Patient[]>([])
  const [sent, setSent] = useState<Record<string, SentInfo>>({})
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // 読み込みは .then の中で state に入れる（画面を開いた直後の effect の中で、同期に setState しないように）
  const load = useCallback(() => {
    return Promise.resolve()
      .then(() => readUpcoming())
      .then((result) => {
        if (result.kind === 'nokey') {
          setNoKey(true)
          return
        }
        if (result.kind === 'error') {
          setError(result.message)
          return
        }
        initPatientStore()
        setPatients(getPatients())
        setRows(result.rows)
        setError('')
      })
  }, [])

  // 開いたら読み込む。開いている間は2分ごと、アプリに戻ってきたときにも読み直す（予約を入れたあと戻ってきたとき）
  useEffect(() => {
    void load()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, RELOAD_MS)
    const onBack = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onBack)
    window.addEventListener('focus', onBack)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onBack)
      window.removeEventListener('focus', onBack)
    }
  }, [load])

  /** 予約の方のLINE（電話＋お名前が同じLINE → 無ければ、カルテを通して（お名前＋生年月日）） */
  const items = useMemo<Item[]>(() => {
    if (!rows || !links) return []
    const out: Item[] = []
    for (const row of rows) {
      const key = patientLinkKey(row.name, row.phone)
      let link: LineLinkSummary | null | undefined = key ? links.find((l) => l.key === key) : undefined
      if (!link) {
        const kartes = matchKartePatients(patients, row.name, row.phone)
        if (kartes.length === 1) link = linkFor(kartes[0])
      }
      if (link) out.push({ date: row.date, time: hhmm(row.time), name: row.name, reservationNo: row.reservationNo, link })
    }
    return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  }, [rows, links, patients, linkFor])

  // 送ったかどうかを読み込む
  const nos = items.map((i) => i.reservationNo).join(',')
  useEffect(() => {
    if (!nos) return
    let alive = true
    void fetch(`/api/line-link/reservation?nos=${encodeURIComponent(nos)}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: { ok?: boolean; sent?: Record<string, SentInfo> }) => {
        if (alive && data.ok && data.sent) setSent(data.sent)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [nos])

  async function send(item: Item) {
    setBusy(item.reservationNo)
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/line-link/reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: item.link.key, reservationNo: item.reservationNo, date: item.date, time: item.time }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; sentAt?: string; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setSent((s) => ({ ...s, [item.reservationNo]: { date: item.date, time: item.time, sentAt: data.sentAt ?? new Date().toISOString() } }))
      setPreview('')
      setNotice(`${item.name}様のLINEへ、${formatDateJa(item.date)} ${item.time} のご予約を送りました。`)
    } catch (e) {
      setError(`送れませんでした：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy('')
    }
  }

  if (noKey) return null

  const statusOf = (item: Item): 'unsent' | 'sent' | 'changed' => {
    const s = sent[item.reservationNo]
    if (!s) return 'unsent'
    return s.date === item.date && hhmm(s.time) === item.time ? 'sent' : 'changed'
  }
  const waiting = items.filter((i) => statusOf(i) !== 'sent').length

  return (
    <Panel
      title="LINEで予約日時を送る"
      icon={MessageCircle}
      meta={`LINE連携の方・${DAYS}日先まで`}
      attention={waiting > 0}
    >
      {rows === null || links === null ? (
        error ? <p className="text-sm text-red-700">{error}</p> : <p className="text-sm text-slate-500">読み込み中…</p>
      ) : (
        <div className="space-y-3">
          {notice && (
            <p role="status" className="flex items-start gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
              <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {notice}
            </p>
          )}
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {items.length === 0 ? (
            <p className="text-sm text-slate-600">これから{DAYS}日のあいだに、LINE連携している方の予約はありません。</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => {
                const status = statusOf(item)
                const s = sent[item.reservationNo]
                const open = preview === item.reservationNo
                return (
                  <li key={item.reservationNo} className={cn('rounded-lg border px-3 py-2', status === 'sent' ? 'border-slate-200' : 'border-amber-300 bg-amber-50/50')}>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-nowrap text-sm font-bold tabular-nums text-slate-900">
                          {formatDateJa(item.date)} {item.time}
                        </p>
                        <p className="text-sm text-slate-800">{item.name} 様</p>
                        <div className="mt-1">
                          {status === 'sent' && s && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-bold text-green-800">
                              <Check className="h-3.5 w-3.5" aria-hidden />
                              送信済み {sentLabel(s.sentAt)}
                            </span>
                          )}
                          {status === 'changed' && s && (
                            <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                              日時が変わりました（前に送ったのは {formatDateJa(s.date)} {hhmm(s.time)}）
                            </span>
                          )}
                          {status === 'unsent' && (
                            <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">まだ送っていません</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreview(open ? '' : item.reservationNo)}
                        aria-expanded={open}
                        className={cn(
                          'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-bold max-lg:min-h-10',
                          status === 'sent'
                            ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                            : 'bg-green-700 text-white hover:bg-green-800',
                        )}
                      >
                        <Send className="h-3.5 w-3.5" aria-hidden />
                        {status === 'sent' ? 'もう一度送る' : 'LINEで送る'}
                      </button>
                    </div>
                    {open && (
                      <div className="mt-2 space-y-2 rounded-lg border border-green-200 bg-white p-3">
                        <p className="text-xs font-bold text-slate-600">この文面を {item.link.name} 様のLINEへ送ります</p>
                        <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-2 text-sm text-slate-800">
                          {patientConfirmText({ name: item.link.name, date: item.date, time: item.time, reservationNo: item.reservationNo })}
                        </p>
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setPreview('')}
                            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 max-lg:min-h-10"
                          >
                            やめる
                          </button>
                          <button
                            type="button"
                            onClick={() => void send(item)}
                            disabled={busy !== ''}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-green-700 px-3 text-sm font-bold text-white hover:bg-green-800 disabled:opacity-60 max-lg:min-h-10"
                          >
                            <Send className="h-3.5 w-3.5" aria-hidden />
                            {busy === item.reservationNo ? '送っています…' : 'この内容で送る'}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <p className="text-xs text-slate-600">
            LINEから予約された方には、予約システムから同じ「確定しました」のお知らせが自動で届いています。二重に送らないようご注意ください。
          </p>
        </div>
      )}
    </Panel>
  )
}
