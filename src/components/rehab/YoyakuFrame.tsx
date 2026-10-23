'use client'
// ──────────────────────────────────────────────
// 予約管理の常駐フレーム
// AppShell内に常駐させ、タブ切替では非表示にするだけにする。
// これにより /yoyaku を再訪してもGAS画面を再読み込みせず、一瞬で表示される。
// 初回に /yoyaku を開いたときだけ iframe をマウントする（無駄な読み込み防止）。
// ──────────────────────────────────────────────
import { useState } from 'react'
import { ExternalLink } from 'lucide-react'

const RESERVATION_ADMIN_URL =
  'https://script.google.com/macros/s/AKfycby6httkx008ojq7MIBpC7pDmfsJQAtQx6xpYNkD67JM7K7jgGaWGkTky9RHW04M1qm9/exec?page=admin'

const RESERVATION_PATIENT_URL =
  'https://script.google.com/macros/s/AKfycby6httkx008ojq7MIBpC7pDmfsJQAtQx6xpYNkD67JM7K7jgGaWGkTky9RHW04M1qm9/exec'

export default function YoyakuFrame({ visible }: { visible: boolean }) {
  const [mounted, setMounted] = useState(false)

  // 初めて表示された時点でマウントし、以後はセッション中ずっと保持する
  // （レンダー中のstate調整パターン。effect不要でラッチできる）
  if (visible && !mounted) setMounted(true)

  if (!mounted) return null

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
            href={RESERVATION_ADMIN_URL}
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
        <iframe
          src={RESERVATION_ADMIN_URL}
          title="予約管理（GAS）"
          className="w-full h-full border-0"
        />
      </div>

      <p className="text-[11px] text-slate-400 mt-2">
        画面が表示されない・ログインがうまくいかない場合は「新しいタブで開く」をご利用ください。
      </p>
    </div>
  )
}
