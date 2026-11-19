'use client'
// ──────────────────────────────────────────────
// 予約管理の常駐フレーム
// AppShell内に常駐させ、タブ切替では非表示にするだけにする。
// これにより /yoyaku を再訪してもGAS画面を再読み込みせず、一瞬で表示される。
// 院内アプリを開いて画面が落ち着いたらすぐ、裏で先に読み込んでおく（予約システムは起動・ログイン・予約の読みこみで
// 数秒かかるため、最初に「予約」を押したときに待たないように。2026-11-19 までは2.5秒待ってから）。
// 通信を節約する設定の端末では、開いたときだけ読み込む。
// まだ開いている途中で「予約」に来たときは、白い画面のままにせず、待っていることと目安の秒数を出す（lib/yoyaku-preload.ts）。
// 予約管理画面のログイン（管理チケット）は12時間で切れるので、切れる前に新しいチケットで読み直す
// （見ていないとき・しばらく離れて戻ってきたときはだまって、見ている最中は「読み直す」ボタンで。lib/yoyaku-ticket.ts）。
// ──────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react'
import { preconnect } from 'react-dom'
import { useRouter } from 'next/navigation'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { getPatients, initPatientStore } from '@/lib/patient-store'
import { matchKartePatients } from '@/lib/karte-link'
import { adminFrameAge, adminFrameNotice, shouldAutoRefresh, type AdminFrameAge } from '@/lib/yoyaku-ticket'
import {
  LOAD_HISTORY_KEY, PRELOAD_FALLBACK_DELAY_MS, PRELOAD_IDLE_TIMEOUT_MS,
  loadingText, parseLoadHistory, rememberLoadMs, typicalLoadSeconds,
} from '@/lib/yoyaku-preload'

const RESERVATION_ADMIN_URL =
  'https://script.google.com/macros/s/AKfycby6httkx008ojq7MIBpC7pDmfsJQAtQx6xpYNkD67JM7K7jgGaWGkTky9RHW04M1qm9/exec?page=admin'

const RESERVATION_PATIENT_URL =
  'https://script.google.com/macros/s/AKfycby6httkx008ojq7MIBpC7pDmfsJQAtQx6xpYNkD67JM7K7jgGaWGkTky9RHW04M1qm9/exec'

/** 新しい署名つきのURL（＝新しい管理チケット）をもらう。取れなければ null */
async function fetchAdminUrl(): Promise<{ url: string; signed: boolean } | null> {
  try {
    const res = await fetch('/api/yoyaku/admin-url', { cache: 'no-store' })
    const d = (await res.json()) as { ok?: boolean; url?: string; signed?: boolean }
    return d.ok && d.url ? { url: d.url, signed: d.signed !== false } : null
  } catch {
    return null
  }
}

/** 予約管理画面（GAS）からの合図を受けるのは、Googleのこの2つの入れ物だけ */
function isReservationOrigin(origin: string): boolean {
  return origin === 'https://script.google.com' || origin.endsWith('.googleusercontent.com')
}

function readLoadHistory(): number[] {
  try {
    return parseLoadHistory(localStorage.getItem(LOAD_HISTORY_KEY))
  } catch {
    return []
  }
}

export default function YoyakuFrame({ visible }: { visible: boolean }) {
  // 予約システムの入口へ、先に通り道をつないでおく（名前の引き・暗号の準備のぶん早くなる）
  preconnect('https://script.google.com')
  const [mounted, setMounted] = useState(false)
  // 予約の画面が開き終わったか（iframe の読みこみ、または予約画面からの合図）。読み直すたびに false に戻す
  const [ready, setReady] = useState(false)
  // 開きはじめた時刻（iframe ができた時刻。かかった時間を数える）と、待ちはじめてからの時間（表示用）
  const startedAtRef = useRef(0)
  const [elapsed, setElapsed] = useState(0)
  // この端末で、ふだん何秒で開くか（前に開いたときに残した時間から）
  const [typical, setTypical] = useState<number | null>(() => typicalLoadSeconds(readLoadHistory()))
  // 予約管理画面を開くURL。院内アプリから開くときは署名つきにして、
  // 予約システム側のパスワード入力を省く（院内アプリ自体がパスワードで守られているため）
  const [adminUrl, setAdminUrl] = useState('')
  // 署名つきのURLを読みこんだ時刻（管理チケットの期限を数える。署名なし＝パスワードで入るときは 0）
  const loadedAtRef = useRef(0)
  const [age, setAge] = useState<AdminFrameAge>('fresh')
  const [refreshing, setRefreshing] = useState(false)
  const visibleRef = useRef(visible)
  const router = useRouter()

  // もらったURLで予約の画面を開く（iframe の行き先が変わるので、新しい管理チケットで読み直される）。
  // 取れなかったとき：最初は今までどおり（パスワードを入力）。読み直しのときは、今の画面をそのままにする
  const applyAdminUrl = useCallback((d: { url: string; signed: boolean } | null) => {
    if (!d) {
      setAdminUrl((current) => current || RESERVATION_ADMIN_URL)
      return
    }
    loadedAtRef.current = d.signed ? Date.now() : 0
    setAdminUrl((current) => {
      // 行き先が変わる＝読み直し（iframe を作り直す）。開き終わるまで「開いています」を出す
      if (current !== d.url) {
        setReady(false)
        setElapsed(0)
      }
      return d.url
    })
    setAge('fresh')
  }, [])

  // 最初の読みこみ
  useEffect(() => {
    let alive = true
    void fetchAdminUrl().then((d) => {
      if (alive) applyAdminUrl(d)
    })
    return () => {
      alive = false
    }
  }, [applyAdminUrl])

  // 「読み直す」ボタン
  const refreshFrame = useCallback(() => {
    setRefreshing(true)
    void fetchAdminUrl().then((d) => {
      applyAdminUrl(d)
      setRefreshing(false)
    })
  }, [applyAdminUrl])

  // 管理チケットの期限の見はり：
  // - 「予約」を見ていないとき・アプリから5分以上離れて戻ってきたときは、だまって読み直す
  // - 見ている最中は読み直さず、案内と「読み直す」ボタンを出す（入力の途中で画面が消えないように）
  useEffect(() => {
    let hiddenAt = document.hidden ? Date.now() : 0
    const check = (awayMs: number) => {
      const next = adminFrameAge(loadedAtRef.current, Date.now())
      if (shouldAutoRefresh({ age: next, frameVisible: visibleRef.current && !document.hidden, awayMs })) void fetchAdminUrl().then(applyAdminUrl)
      else setAge(next)
    }
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now()
        return
      }
      const away = hiddenAt ? Date.now() - hiddenAt : 0
      hiddenAt = 0
      check(away)
    }
    const timer = window.setInterval(() => check(0), 5 * 60 * 1000)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [applyAdminUrl])

  // 「予約」に切りかえた・ほかの画面へ移ったとき：見はりに伝え、ほかの画面へ移ったときに古くなっていれば読み直す
  useEffect(() => {
    visibleRef.current = visible
    if (visible) return
    const next = adminFrameAge(loadedAtRef.current, Date.now())
    if (shouldAutoRefresh({ age: next, frameVisible: false, awayMs: 0 })) void fetchAdminUrl().then(applyAdminUrl)
  }, [visible, applyAdminUrl])

  // 初めて表示された時点でマウントし、以後はセッション中ずっと保持する
  // （レンダー中のstate調整パターン。effect不要でラッチできる）
  if (visible && !mounted) setMounted(true)

  // 先に裏で開いておく：画面が落ち着いたら（手が空いたら。遅くとも1.5秒で）すぐ。通信を節約する設定の端末では開かない
  useEffect(() => {
    if (mounted) return
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (conn?.saveData) return
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (w.requestIdleCallback && w.cancelIdleCallback) {
      const id = w.requestIdleCallback(() => setMounted(true), { timeout: PRELOAD_IDLE_TIMEOUT_MS })
      return () => w.cancelIdleCallback?.(id)
    }
    const id = window.setTimeout(() => setMounted(true), PRELOAD_FALLBACK_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [mounted])

  // iframe ができた（＝予約システムを開きはじめた）時刻を残す。行き先が変わると iframe を作り直すので、そのたびに数えなおす
  const startTimer = useCallback((el: HTMLIFrameElement | null) => {
    if (el) startedAtRef.current = Date.now()
  }, [])

  // 開き終わったら、かかった時間を残す（次に待つときの目安）
  const markReady = useCallback(() => {
    const started = startedAtRef.current
    startedAtRef.current = 0
    setElapsed(0)
    setReady(true)
    if (!started) return
    try {
      const next = rememberLoadMs(readLoadHistory(), Date.now() - started)
      localStorage.setItem(LOAD_HISTORY_KEY, JSON.stringify(next))
      setTypical(typicalLoadSeconds(next))
    } catch {
      // 残せなくても表示には関係ない
    }
  }, [])

  // 「予約」を見ていて、まだ開いている途中のときだけ、1秒ごとに待ち時間の表示を動かす
  const waiting = visible && mounted && !ready
  useEffect(() => {
    if (!waiting) return
    const id = window.setInterval(() => {
      if (startedAtRef.current) setElapsed(Date.now() - startedAtRef.current)
    }, 1000)
    return () => window.clearInterval(id)
  }, [waiting])

  // 予約管理画面で氏名を押したとき、その患者さんのカルテを開く
  // （予約システムから届くのは氏名と電話番号だけ。カルテは端末の中で探す）
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isReservationOrigin(event.origin)) return
      const data = event.data as { type?: string; name?: string; phone?: string } | null
      if (!data || typeof data.type !== 'string') return
      if (data.type === 'yuuki:karte-hello') {
        // 「院内アプリの中にいます」と返す（予約画面はこれで、別タブではなくアプリ内でカルテを開く）
        const source = event.source as Window | null
        source?.postMessage({ type: 'yuuki:karte-hello-ack' }, { targetOrigin: event.origin })
        // 予約画面の中身が動きはじめた合図でもある
        markReady()
        return
      }
      if (data.type !== 'yuuki:open-karte') return
      const name = String(data.name ?? '')
      const phone = String(data.phone ?? '')
      if (!name && !phone) return
      initPatientStore()
      const found = matchKartePatients(getPatients(), name, phone)
      if (found.length === 1) router.push(`/patients/${found[0].id}`)
      else router.push(`/patients?karte=${encodeURIComponent(name)}&tel=${encodeURIComponent(phone)}`)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [router, markReady])

  if (!mounted) return null
  const openUrl = adminUrl || RESERVATION_ADMIN_URL
  const notice = adminFrameNotice(age)
  const wait = loadingText(elapsed, typical)

  return (
    <div className={visible ? 'flex h-[calc(100dvh-13rem)] min-h-[480px] flex-col lg:h-[calc(100dvh-5.5rem)]' : 'hidden'}>
      {/* ヘッダー */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="hidden text-2xl font-black text-slate-900 lg:block">予約</h1>
          <p className="text-xs text-slate-500 lg:mt-0.5">
            予約表・空きの確認・予約の登録・キャンセル（予約管理表と連動）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={RESERVATION_PATIENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50 max-lg:min-h-10"
          >
            <ExternalLink size={13} />
            患者用予約ページ
          </a>
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl bg-teal-700 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-teal-800 max-lg:min-h-10"
          >
            <ExternalLink size={13} />
            新しいタブで開く
          </a>
        </div>
      </div>

      {/* ログイン（管理チケット）の期限が近い・切れたときの案内（見ている最中は勝手に読み直さない） */}
      {notice && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2" role="status">
          <p className="text-sm font-bold text-amber-900">{notice}</p>
          <button
            type="button"
            onClick={refreshFrame}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60 max-lg:min-h-10"
          >
            <RefreshCw size={14} aria-hidden />
            {refreshing ? '読み直しています…' : '読み直す'}
          </button>
        </div>
      )}

      {/* 予約管理画面（GAS）を埋め込み（常駐。ログインの期限が近いときだけ、新しいチケットで読み直す） */}
      <div className="relative flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {adminUrl && (
          <iframe
            key={adminUrl}
            ref={startTimer}
            src={adminUrl}
            title="予約管理（GAS）"
            onLoad={markReady}
            className="w-full h-full border-0"
          />
        )}
        {/* 開いている途中は、白い画面のままにせず、待っていることと目安の秒数を出す */}
        {(!adminUrl || !ready) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/95 px-6 text-center" role="status" aria-live="polite">
            <Loader2 className="h-7 w-7 animate-spin text-teal-700" aria-hidden />
            <p className="text-base font-bold text-slate-900">{wait.title}</p>
            <p className="max-w-md text-sm text-slate-700">{wait.detail}</p>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 mt-2">
        画面が表示されない・ログインがうまくいかない場合は「新しいタブで開く」をご利用ください。
      </p>
    </div>
  )
}
