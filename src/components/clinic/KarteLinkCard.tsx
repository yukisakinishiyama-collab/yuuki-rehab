'use client'
/**
 * 「カルテ連携」の案内カード（集客 → LINE導線）
 * 患者さんに開いてもらう URL（https://liff.line.me/{LIFF_ID}/link）と QR、
 * 結びついている人数を出す。LIFF ID はこの端末に控える（秘密ではない。LINEのメニューに入っている値）。
 */
import { useEffect, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { useLineLinks } from '@/lib/line-link-client'

const LIFF_ID_STORAGE = 'liff_id'

export default function KarteLinkCard() {
  const [liffId, setLiffId] = useState('')
  const { links, error } = useLineLinks()

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 端末の控えを最初に1回読むだけ
      setLiffId(localStorage.getItem(LIFF_ID_STORAGE) || '')
    } catch {
      /* noop */
    }
  }, [])

  const onChange = (value: string) => {
    const v = value.trim()
    setLiffId(v)
    try {
      localStorage.setItem(LIFF_ID_STORAGE, v)
    } catch {
      /* noop */
    }
  }

  const valid = /^\d{5,}-\w+$/.test(liffId)
  const url = valid ? `https://liff.line.me/${liffId}/link` : ''

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold">カルテ連携（患者さんのLINEとカルテを結びつける）</h2>
        <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-bold text-green-700">
          結びついている方 {links ? `${links.length}名` : error ? '—' : '…'}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        患者さんがこのページをLINEの中で開き、お名前と電話番号を入れると、カルテと結びつきます。
        結びついた方には、誕生日のご挨拶など院からのお知らせをLINEで送れるようになります
        （送る文面は院長が決めてから。自動では送りません）。
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            LIFF ID（ネット予約のリッチメニューに入れているもの。例 1234567890-AbCdEfGh）
            <input
              value={liffId}
              onChange={(e) => onChange(e.target.value)}
              placeholder="LIFF ID"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 font-mono text-sm"
            />
          </label>
          {url ? (
            <div className="rounded-md bg-slate-50 p-2 text-xs">
              <p className="text-slate-500">患者さんに開いてもらうURL（リッチメニューの「カルテ連携」に設定）</p>
              <p className="mt-0.5 break-all font-mono text-[13px] text-slate-900">{url}</p>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(url)}
                className="mt-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold hover:bg-slate-100"
              >
                コピー
              </button>
            </div>
          ) : (
            <p className="text-xs text-amber-700">LIFF ID を入れると、URLとQRが出ます。</p>
          )}
          <p className="text-[11px] leading-relaxed text-slate-500">
            受付では、友だち追加のあとに「メニューのカルテ連携から、お名前と電話番号を入れてください」とご案内ください。
            ご家族のカルテは、その方のお名前と院に登録している電話番号で結びつけられます。
          </p>
        </div>
        {url && (
          <div className="flex flex-col items-center gap-1">
            <QRCodeCanvas value={url} size={128} marginSize={1} level="M" />
            <span className="text-[11px] text-slate-500">LINEのカメラで読める</span>
          </div>
        )}
      </div>
    </section>
  )
}
