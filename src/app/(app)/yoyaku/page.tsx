'use client'

import { ExternalLink } from 'lucide-react'

/**
 * 予約管理（GAS予約システムの管理画面をアプリ内に統合表示）
 *
 * 予約データの実体はGAS（予約管理表スプレッドシート）側にあり、
 * ここでは管理画面をそのまま埋め込んで、患者管理アプリから
 * 行き来せずに予約操作ができるようにする。
 * GAS側の doGet は XFrameOptionsMode.ALLOWALL 設定済み（埋め込み許可）。
 */
const RESERVATION_ADMIN_URL =
  'https://script.google.com/macros/s/AKfycby6httkx008ojq7MIBpC7pDmfsJQAtQx6xpYNkD67JM7K7jgGaWGkTky9RHW04M1qm9/exec?page=admin'

const RESERVATION_PATIENT_URL =
  'https://script.google.com/macros/s/AKfycby6httkx008ojq7MIBpC7pDmfsJQAtQx6xpYNkD67JM7K7jgGaWGkTky9RHW04M1qm9/exec'

export default function YoyakuPage() {
  return (
    <div className="flex flex-col h-[calc(100dvh-7rem)] min-h-[560px]">
      {/* ヘッダー */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-slate-900">予約管理</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            空き時間の確認・予約の登録・キャンセルができます（データは予約管理表と連動）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={RESERVATION_PATIENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-colors"
          >
            <ExternalLink size={13} />
            患者用予約ページ
          </a>
          <a
            href={RESERVATION_ADMIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium transition-colors"
          >
            <ExternalLink size={13} />
            新しいタブで開く
          </a>
        </div>
      </div>

      {/* 予約管理画面（GAS）を埋め込み */}
      <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
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
