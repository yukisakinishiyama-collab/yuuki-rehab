'use client'
// ──────────────────────────────────────────────
// 予約管理の常駐フレーム
// AppShell内に常駐させ、タブ切替では非表示にするだけにする。
// これにより /yoyaku を再訪してもGAS画面を再読み込みせず、一瞬で表示される。
// 院内アプリを開いて少ししたら、裏で先に読み込んでおく（予約システムは起動に3〜5秒かかるため、
// 最初に「予約」を押したときに待たないように）。通信を節約する設定の端末では、開いたときだけ読み込む。
// ──────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { getPatients, initPatientStore } from '@/lib/patient-store'
import { matchKartePatients } from '@/lib/karte-link'

const RESERVATION_ADMIN_URL =
  'https://script.google.com/macros/s/AKfycby6httkx008ojq7MIBpC7pDmfsJQAtQx6xpYNkD67JM7K7jgGaWGkTky9RHW04M1qm9/exec?page=admin'

const RESERVATION_PATIENT_URL =
  'https://script.google.com/macros/s/AKfycby6httkx008ojq7MIBpC7pDmfsJQAtQx6xpYNkD67JM7K7jgGaWGkTky9RHW04M1qm9/exec'

/** 予約管理画面（GAS）からの合図を受けるのは、Googleのこの2つの入れ物だけ */
function isReservationOrigin(origin: string): boolean {
  return origin === 'https://script.google.com' || origin.endsWith('.googleusercontent.com')
}

export default function YoyakuFrame({ visible }: { visible: boolean }) {
  const [mounted, setMounted] = useState(false)
  // 予約管理画面を開くURL。院内アプリから開くときは署名つきにして、
  // 予約システム側のパスワード入力を省く（院内アプリ自体がパスワードで守られているため）
  const [adminUrl, setAdminUrl] = useState('')
  const router = useRouter()

  useEffect(() => {
    let alive = true
    fetch('/api/yoyaku/admin-url', { cache: 'no-store' })
      .then(r => r.json())
      .then((d: { ok?: boolean; url?: string }) => {
        if (alive && d.ok && d.url) setAdminUrl(d.url)
      })
      .catch(() => {
        if (alive) setAdminUrl(RESERVATION_ADMIN_URL) // 取れなければ今までどおり（パスワードを入力）
      })
    return () => {
      alive = false
    }
  }, [])

  // 初めて表示された時点でマウントし、以後はセッション中ずっと保持する
  // （レンダー中のstate調整パターン。effect不要でラッチできる）
  if (visible && !mounted) setMounted(true)

  useEffect(() => {
    if (mounted) return
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (conn?.saveData) return
    const id = window.setTimeout(() => setMounted(true), 2500)
    return () => window.clearTimeout(id)
  }, [mounted])

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
  }, [router])

  if (!mounted) return null
  const openUrl = adminUrl || RESERVATION_ADMIN_URL

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
            className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
          >
            <ExternalLink size={13} />
            患者用予約ページ
          </a>
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl bg-teal-700 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-teal-800"
          >
            <ExternalLink size={13} />
            新しいタブで開く
          </a>
        </div>
      </div>

      {/* 予約管理画面（GAS）を埋め込み（常駐・再読み込みなし） */}
      <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {adminUrl ? (
          <iframe
            src={adminUrl}
            title="予約管理（GAS）"
            className="w-full h-full border-0"
          />
        ) : (
          <p className="flex h-full items-center justify-center text-xs text-slate-400">予約管理を開いています…</p>
        )}
      </div>

      <p className="text-[11px] text-slate-400 mt-2">
        画面が表示されない・ログインがうまくいかない場合は「新しいタブで開く」をご利用ください。
      </p>
    </div>
  )
}
