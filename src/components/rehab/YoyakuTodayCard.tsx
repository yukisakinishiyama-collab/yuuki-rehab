'use client'
// ──────────────────────────────────────────────
// 今日の予約ウィジェット（GAS予約システムと連携）
// ・今日/明日の予約を一覧表示（60秒ごと自動更新）
// ・一覧の上に「今日の予約・このあと・次の予約の時刻」、今日の一覧では「次」の方に印。
//   この3つは時計とキャンセルだけで決める（「来院済み」を付けるかどうか・いつ付けるかは院によって違うため）
// ・「来院済み」の数と付け忘れの知らせは、今日「来院済み」が1件でも付いているときだけ出す
//   （キャンセルのカルテ反映 src/lib/yoyaku-cancel-sync.ts の processedDates と同じ見分け方）
// ・「このあと」「次」「付け忘れ」は、表示している予約が日本時間の今日の分のときだけ出す
//   （前の日の控えや、日付が変わってから読み直せていない一覧に、いまの時計を当てないため）
// ・電話へワンタップ発信
// ・患者管理に同一患者（電話 or 氏名一致）がいればカルテへ直接ジャンプ
// 連携キー＝予約管理の管理者パスワード（この端末のみに保存）
//
// 見た目の決まり：札（バッジ）は「気にしてほしいもの」だけに付ける。
// 初診・新しいケガ・会員・来院済み・キャンセル、知らない状態名は付ける。いつもの「再診」「確定」は付けない（一覧をすっきりさせるため）
// お名前は切らない（truncate しない）。入りきらないときは2行にする（同じ名字の方を見分けるため）。
// そのために、指で押す幅では電話・カルテのボタンを「アイコンの下に短い文字」の 44×48px にして、お名前の幅を残す
// （幅 360px のスマホでお名前に約 128px＝16px の字で8文字。横に「カルテ ＞」と書くと約 74px しか残らない）
// ──────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, Check, ChevronRight, FileText, KeyRound, Phone, RefreshCw } from 'lucide-react'
import type { Patient } from '@/types/patient'
import { getPatients, initPatientStore } from '@/lib/patient-store'
import { nextDate } from '@/lib/marketing/noah-analysis'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { IconButton, Panel } from '@/components/clinic/Panel'

const FEED_KEY_STORAGE = 'yoyaku_feed_key'
// 最後に取れた予約の控え（このタブの中だけ。タブを閉じれば消える）。
// 予約システムは起動に3〜5秒かかるので、画面を開いたらまず控えを出し、うしろで新しくする。
// 控えは同じ日（日本時間）のものだけ使う。前の日に開いたタブを翌朝開き直したときは、控えを出さずに取りに行く
const FEED_CACHE_STORAGE = 'yoyaku_feed_cache'

interface FeedRow {
  time: string
  name: string
  kana: string
  phone: string
  kubun: string
  status: string
  reservationNo: string
  memo: string
  /** 会員（月額のサブスク）の患者さん（予約管理画面でチェックした人。予約システム v3.11 から） */
  sub?: boolean
}
interface FeedDay {
  date: string
  rows: FeedRow[]
}
interface Feed {
  ok: boolean
  error?: string
  today?: string
  days?: FeedDay[]
}

/** 予約の控えを読む。today（日本時間の今日 'YYYY-MM-DD'）と日付が違う控えは使わない */
function readFeedCache(today: string): { feed: Feed; updatedAt: string } | null {
  try {
    const raw = sessionStorage.getItem(FEED_CACHE_STORAGE)
    if (!raw) return null
    const value = JSON.parse(raw) as { feed?: Feed; updatedAt?: string }
    return value.feed?.ok && value.feed.today === today ? { feed: value.feed, updatedAt: value.updatedAt ?? '' } : null
  } catch {
    return null
  }
}

function writeFeedCache(feed: Feed | null, updatedAt = '') {
  try {
    if (feed) sessionStorage.setItem(FEED_CACHE_STORAGE, JSON.stringify({ feed, updatedAt }))
    else sessionStorage.removeItem(FEED_CACHE_STORAGE)
  } catch {
    // 保存できない環境では控えを使わない（毎回取りに行く）
  }
}

/** 電話番号を数字だけに正規化して比較する */
const digits = (value: string) => String(value || '').replace(/[^0-9]/g, '')
/** 氏名のスペース揺れを吸収して比較する */
const normName = (value: string) => String(value || '').replace(/[\s　]/g, '')

const VISITED = '来院済み'
const CANCELLED = 'キャンセル'
/** 予約システムのいつもの状態（札は付けない） */
const CONFIRMED = '確定'

/** 区分の札（付けないものは null） */
function kubunBadge(kubun: string): { label: string; className: string } | null {
  if (kubun.includes('初診')) return { label: kubun, className: 'border-teal-300 bg-teal-50 text-teal-800' }
  if (kubun.includes('新しいケガ')) return { label: kubun, className: 'border-orange-300 bg-orange-50 text-orange-800' }
  if (!kubun || kubun.includes('再診')) return null
  return { label: kubun, className: 'border-slate-300 bg-slate-50 text-slate-700' }
}

/** 状態の札（いつもの「確定」は付けない） */
function statusBadge(status: string): { label: string; className: string; done?: boolean } | null {
  if (status === VISITED) return { label: status, className: 'border-green-300 bg-green-50 text-green-800', done: true }
  if (status === CANCELLED) return { label: status, className: 'border-slate-300 bg-slate-100 text-slate-600' }
  if (!status || status === CONFIRMED) return null
  return { label: status, className: 'border-blue-300 bg-blue-50 text-blue-800' }
}

/** 'YYYY-MM-DD' → '6/12（木）' */
function shortDate(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString
  const youbi = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
  return `${date.getMonth() + 1}/${date.getDate()}（${youbi}）`
}

function dayHeading(dateString: string, todayString: string): string {
  if (dateString === todayString) return '今日'
  if (todayString && dateString === nextDate(todayString)) return `明日 ${shortDate(dateString)}`
  return shortDate(dateString)
}

/** '9:30' / '09:30' → 570（分）。読めなければ null */
function toMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(time || '').trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** いまの日付と時刻（日本時間）。date は予約システムと同じ 'YYYY-MM-DD'、minutes は 0時からの分 */
function jstClock(): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

/** 来院済み・キャンセルのどちらでもない予約（まだ来院の印が付いていない） */
const isWaiting = (row: FeedRow) => row.status !== VISITED && row.status !== CANCELLED

/**
 * まだ時刻が来ていない予約（いまの分と同じ時刻もふくむ）。来院済みにした方（早く来られた方）はのぞく。
 * 時刻をすぎた予約は、来院の印があってもなくても入れない（施術中の方を「このあと」「次」と数えないため）
 */
function upcomingRows(rows: FeedRow[], now: number | null): { row: FeedRow; at: number }[] {
  if (now === null) return []
  return rows.flatMap((row) => {
    const at = toMinutes(row.time)
    return isWaiting(row) && at !== null && at >= now ? [{ row, at }] : []
  })
}

/** 「次」の印を付ける予約：まだ時刻が来ていない予約のうち、いちばん早い時刻のもの（同じ時刻に2人いれば2人とも） */
function findNextRows(rows: FeedRow[], now: number | null): FeedRow[] {
  const upcoming = upcomingRows(rows, now)
  if (upcoming.length === 0) return []
  const first = Math.min(...upcoming.map((x) => x.at))
  return upcoming.filter((x) => x.at === first).map((x) => x.row)
}

/**
 * 予約の時刻から何分すぎても「来院済み」が付いていなければ、付け忘れの知らせに入れるか。
 * 会計のときに付ける院でも、施術中の方が入らないように、施術が終わるころ（1時間）にしている
 */
const UNMARKED_AFTER_MINUTES = 60

/** 時刻から1時間すぎても「来院済み」が付いていない予約（今日「来院済み」を付けている日だけ数える） */
function findUnmarkedRows(rows: FeedRow[], now: number | null): FeedRow[] {
  if (now === null || !rows.some((row) => row.status === VISITED)) return []
  return rows.filter((row) => {
    const at = toMinutes(row.time)
    return isWaiting(row) && at !== null && at <= now - UNMARKED_AFTER_MINUTES
  })
}

export default function YoyakuTodayCard() {
  const [feedKey, setFeedKey] = useState<string>('')
  const [keyInput, setKeyInput] = useState('')
  const [needsSetup, setNeedsSetup] = useState(false)
  const [feed, setFeed] = useState<Feed | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [updatedAt, setUpdatedAt] = useState('')
  // 「このあと」「次」に使ういまの日付と時刻（日本時間）。予約を読み直すたび（60秒ごと）に新しくする
  const [clock, setClock] = useState<{ date: string; minutes: number } | null>(null)

  // 端末に保存されたもの（カルテの患者リスト・連携キー・予約の控え）を読む（画面の表示が終わってから）
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      initPatientStore()
      setPatients(getPatients())
      const saved = localStorage.getItem(FEED_KEY_STORAGE) || ''
      if (!saved) {
        setNeedsSetup(true)
        return
      }
      setFeedKey(saved)
      // 今日の控えがあれば、取りに行くあいだも先に出しておく
      const now = jstClock()
      const cached = readFeedCache(now.date)
      if (cached) {
        setFeed(cached.feed)
        setUpdatedAt(cached.updatedAt)
        setClock(now)
      }
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const load = useCallback(
    async (key: string) => {
      if (!key) return
      setLoading(true)
      setError('')
      setClock(jstClock())
      try {
        const res = await fetch(`/api/yoyaku/feed?key=${encodeURIComponent(key)}&days=2`, { cache: 'no-store' })
        const data = (await res.json()) as Feed
        if (!data.ok) {
          if (data.error === 'unauthorized') {
            localStorage.removeItem(FEED_KEY_STORAGE)
            writeFeedCache(null)
            setFeedKey('')
            setNeedsSetup(true)
            setError('連携キーが一致しません。予約管理の管理者パスワードを入力してください。')
          } else {
            setError(data.error || '予約の取得に失敗しました。')
          }
          return
        }
        const time = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
        setFeed(data)
        setUpdatedAt(time)
        writeFeedCache(data, time)
      } catch {
        setError('予約の取得に失敗しました。通信環境をご確認ください。')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  // 初回＋60秒ごと＋タブ復帰時に更新（初回は描画を終えてから）
  useEffect(() => {
    if (!feedKey) return
    const first = window.setTimeout(() => void load(feedKey), 0)
    const timer = setInterval(() => {
      if (!document.hidden) void load(feedKey)
    }, 60000)
    const onVisible = () => {
      if (!document.hidden) void load(feedKey)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(first)
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [feedKey, load])

  const saveKey = () => {
    const value = keyInput.trim()
    if (!value) return
    localStorage.setItem(FEED_KEY_STORAGE, value)
    setFeedKey(value)
    setNeedsSetup(false)
    setKeyInput('')
  }

  /** 予約の患者を患者管理から探す（電話一致 → 氏名一致） */
  const matchPatient = useMemo(() => {
    return (row: FeedRow): Patient | undefined => {
      const rowPhone = digits(row.phone)
      if (rowPhone.length >= 10) {
        const byPhone = patients.find((p) => digits(p.phone) === rowPhone)
        if (byPhone) return byPhone
      }
      const rowName = normName(row.name)
      if (!rowName) return undefined
      return patients.find((p) => normName(p.name) === rowName)
    }
  }, [patients])

  // 予約システムが「今日」とした日（feed.today）と、日本時間の今日（clock.date）。
  // ふだんは同じ。違うのは、日付が変わってから読み直せていないとき（取得の失敗・端末の時計のずれ）
  const todayString = feed?.today || ''
  const calendarToday = clock?.date || todayString
  const isCurrentDay = !!feed && !!clock && todayString === clock.date
  // 今日の分でないときは、時計を当てるもの（このあと・次・付け忘れ・来院済みの数）を出さない
  const now = isCurrentDay && clock ? clock.minutes : null
  const todayRows = feed?.days?.find((d) => d.date === todayString)?.rows ?? []
  const todayActive = todayRows.filter((row) => row.status !== CANCELLED)
  const todayVisited = isCurrentDay ? todayActive.filter((row) => row.status === VISITED).length : 0
  const upcomingCount = upcomingRows(todayRows, now).length
  const nextRows = findNextRows(todayRows, now)
  const unmarkedRows = findUnmarkedRows(todayRows, now)

  return (
    <Panel
      title="今日の予約"
      icon={CalendarClock}
      meta={updatedAt ? `更新 ${updatedAt}` : undefined}
      action={
        <>
          <IconButton label="予約を読み直す" onClick={() => void load(feedKey)} disabled={loading || !feedKey}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden />
          </IconButton>
          <Link href="/yoyaku" className={cn(buttonVariants(), 'h-11 gap-0.5 rounded-lg px-3 font-bold lg:h-8 lg:text-xs')}>
            予約管理を開く
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </>
      }
    >
      {/* 連携キーの設定（初回のみ） */}
      {needsSetup && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-800">
            <KeyRound className="h-4 w-4" aria-hidden />
            予約システムと連携（初回のみ）
          </div>
          <p className="mb-2 text-xs text-slate-600">
            予約管理画面と同じ<strong>管理者パスワード</strong>を入力してください（この端末にのみ保存されます）。
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveKey()}
              placeholder="管理者パスワード"
              aria-label="予約管理の管理者パスワード"
              className="h-11 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm"
            />
            <Button className="h-11 shrink-0 lg:h-10" onClick={saveKey}>連携する</Button>
          </div>
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        </div>
      )}

      {!needsSetup && error && <p className="mb-2 text-sm text-red-700">{error}</p>}

      {!needsSetup && !feed && !error && (
        <p className="py-2 text-sm text-slate-500">予約を読み込んでいます…</p>
      )}

      {/* 日付が変わってから、まだ今日の予約を読めていないとき（下の一覧は前の日に読んだもの）。
          読み直すボタンは、この知らせの中に置く（見出しのボタンの位置は、スマホの幅によって変わるため） */}
      {!needsSetup && feed?.days && clock && !isCurrentDay && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p>
            下の一覧は {todayString ? shortDate(todayString) : '前の日'} に読んだ予約です。
            {loading ? '今日の予約を読み込んでいます…' : '今日の予約をまだ読み込めていません。'}
          </p>
          {!loading && (
            <button
              type="button"
              onClick={() => void load(feedKey)}
              disabled={!feedKey}
              className="mt-2 inline-flex h-11 items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3 text-sm font-bold text-amber-950 transition-colors hover:bg-amber-100 disabled:opacity-50 lg:h-8"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              今日の予約を読み直す
            </button>
          )}
        </div>
      )}

      {/* 今日の数（ひと目で分かるように、一覧の上にまとめる。時計とキャンセルだけで決まるもの） */}
      {!needsSetup && feed?.days && isCurrentDay && (
        <dl className="mb-3 grid grid-cols-3 gap-2 text-center">
          {[
            { label: '今日の予約', value: String(todayActive.length), unit: '件' },
            { label: 'このあと', value: String(upcomingCount), unit: '件' },
            { label: '次の予約', value: nextRows[0]?.time || '—', unit: nextRows.length > 1 ? `・${nextRows.length}人` : '' },
          ].map((x) => (
            <div key={x.label} className="flex flex-col-reverse justify-end rounded-lg bg-slate-50 px-2 py-2">
              <dt className="text-xs font-bold leading-tight text-slate-600">{x.label}</dt>
              <dd className="mb-0.5 text-2xl font-black tabular-nums text-slate-900">
                {x.value}
                {x.unit && <span className="ml-0.5 text-xs font-bold text-slate-600">{x.unit}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {/* 今日「来院済み」を付けている日だけ：1時間すぎても付いていない予約。
          このままだと、明日「キャンセルのカルテ反映」に無断キャンセルの候補として出る（yoyaku-cancel-sync.ts） */}
      {!needsSetup && unmarkedRows.length > 0 && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p>
            予約の時刻から1時間すぎても「来院済み」が付いていない予約が<strong>{unmarkedRows.length}件</strong>あります（
            {unmarkedRows.slice(0, 3).map((row) => row.time).join('・')}
            {unmarkedRows.length > 3 && `、ほか${unmarkedRows.length - 3}件`}）。
          </p>
          <p className="mt-0.5">
            来院された方は、予約管理で「来院済み」にしてください。このままだと明日、無断キャンセルの候補として確かめることになります。
          </p>
        </div>
      )}

      {/* 予約リスト（今日・明日） */}
      {!needsSetup && feed?.days && (
        <div className="space-y-4">
          {feed.days.map((day) => {
            // 見出しの「今日」「明日」は日本時間の今日で決める（前の日に読んだ一覧の「今日」を今日と言わないため）
            const isToday = day.date === calendarToday
            const activeRows = day.rows.filter((row) => row.status !== CANCELLED)
            const subCount = activeRows.filter((row) => row.sub).length
            return (
              <div key={day.date}>
                <h3 className="mb-1.5 flex flex-wrap items-baseline gap-x-2 border-b border-slate-100 pb-1">
                  <span className={cn('font-bold', isToday ? 'text-base text-slate-900' : 'text-sm text-slate-700')}>
                    {dayHeading(day.date, calendarToday)}
                  </span>
                  <span className="text-xs text-slate-600">{activeRows.length}件</span>
                  {subCount > 0 && <span className="text-xs text-violet-700">うち会員 {subCount}件</span>}
                  {/* 来院済みの数は、その日に「来院済み」を付けているときだけ（付けない院で「0件」と出さないため） */}
                  {isToday && todayVisited > 0 && <span className="text-xs text-green-700">来院済み {todayVisited}件</span>}
                </h3>
                {day.rows.length === 0 ? (
                  <p className="py-1 text-sm text-slate-500">予約はありません</p>
                ) : (
                  // -mx-2：行の地の色だけをカードの余白へ広げ、時刻を見出しの「今日」とそろえる（お名前の幅を 16px 広くとる）
                  <ul className="-mx-2 space-y-1">
                    {day.rows.map((row) => {
                      const patient = matchPatient(row)
                      const cancelled = row.status === CANCELLED
                      const isNext = isToday && nextRows.includes(row)
                      const kubun = kubunBadge(row.kubun)
                      const status = statusBadge(row.status)
                      return (
                        <li
                          key={`${day.date}-${row.reservationNo}`}
                          className={cn(
                            'flex items-center gap-2 rounded-lg px-2 py-2 transition-colors',
                            isNext ? 'bg-teal-50 ring-1 ring-teal-300' : 'hover:bg-slate-50',
                          )}
                        >
                          <span
                            className={cn(
                              'w-12 shrink-0 font-bold tabular-nums',
                              isToday ? 'text-base' : 'text-sm',
                              cancelled ? 'text-slate-500 line-through' : 'text-slate-900',
                            )}
                          >
                            {row.time}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                              {/* お名前は切らない。入りきらないときは名字と名前の間で2行にする（スペースがなければどこででも） */}
                              <span
                                className={cn(
                                  'min-w-0 break-keep font-bold wrap-anywhere',
                                  isToday ? 'text-base' : 'text-sm',
                                  cancelled ? 'text-slate-500 line-through' : 'text-slate-900',
                                )}
                              >
                                {row.name}
                              </span>
                              {isNext && (
                                <span className="rounded-full bg-teal-700 px-2 py-0.5 text-xs font-bold text-white">次</span>
                              )}
                              {row.sub && (
                                <span
                                  className="rounded-full border border-violet-300 bg-violet-50 px-1.5 py-0.5 text-xs font-bold text-violet-800"
                                  title="会員（月額）の患者さん。予約管理画面でチェック・解除できます"
                                >
                                  会員
                                </span>
                              )}
                              {kubun && (
                                <span className={cn('rounded border px-1.5 py-0.5 text-xs', kubun.className)}>{kubun.label}</span>
                              )}
                              {status && (
                                <span className={cn('inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-xs', status.className)}>
                                  {status.done && <Check className="h-3 w-3" aria-hidden />}
                                  {status.label}
                                </span>
                              )}
                            </div>
                            {row.memo && <p className="mt-0.5 truncate text-xs text-slate-600">{row.memo}</p>}
                          </div>
                          {/* 電話・カルテ：指で押す幅ではアイコンの下に短い文字（44×48px）。PCは今までどおりの小さな形。
                              電話がない行・カルテがない行も同じ幅をとり、ボタンの列を上下でそろえる */}
                          <div className="flex shrink-0 items-center gap-1.5">
                            {row.phone ? (
                              <a
                                href={`tel:${digits(row.phone)}`}
                                className="flex h-11 w-12 flex-col items-center justify-center gap-0.5 rounded-lg text-slate-700 ring-1 ring-slate-300 transition-colors hover:bg-teal-50 hover:text-teal-800 lg:h-8 lg:w-8"
                                title={`${row.phone} に電話`}
                                aria-label={`${row.name}様に電話（${row.phone}）`}
                              >
                                <Phone className="h-4 w-4" aria-hidden />
                                <span className="text-xs leading-none lg:hidden">電話</span>
                              </a>
                            ) : (
                              <span className="w-12 lg:w-8" aria-hidden />
                            )}
                            {patient ? (
                              <Link
                                href={`/patients/${patient.id}`}
                                className="flex h-11 w-12 flex-col items-center justify-center gap-0.5 rounded-lg bg-teal-50 text-teal-800 ring-1 ring-teal-200 transition-colors hover:bg-teal-100 lg:h-8 lg:w-auto lg:flex-row lg:px-2.5"
                                aria-label={`${row.name}様のカルテ`}
                              >
                                <FileText className="h-4 w-4 lg:hidden" aria-hidden />
                                <span className="text-xs font-bold leading-none">カルテ</span>
                                <ChevronRight className="hidden h-3.5 w-3.5 lg:block" aria-hidden />
                              </Link>
                            ) : (
                              <span
                                className="w-12 text-center text-xs text-slate-500 lg:w-auto lg:px-1"
                                title="患者管理に同一の患者が見つかりません"
                              >
                                未登録
                              </span>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}
