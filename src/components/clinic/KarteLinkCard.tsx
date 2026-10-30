'use client'
/**
 * 「カルテ連携」の案内カード（集客 → LINE導線）
 * 患者さんに開いてもらう URL（https://liff.line.me/{LIFF_ID}/link）と QR、
 * 結びついている人数を出す。LIFF ID はこの端末に控える（秘密ではない。LINEのメニューに入っている値）。
 */
import { useEffect, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { useLineLinks } from '@/lib/line-link-client'
import { LIFF_ID as DEFAULT_LIFF_ID } from '@/lib/marketing/clinic'

const LIFF_ID_STORAGE = 'liff_id'

export default function KarteLinkCard() {
  const [liffId, setLiffId] = useState('')
  const { links, error, reload } = useLineLinks()
  // 「連携が済みました＋患者番号」のLINEが届いたと確かめられていない方への送り直し
  const pendingNotice = (links ?? []).filter(l => l.notified !== true).length
  const [resendState, setResendState] = useState('')
  const resend = async () => {
    if (pendingNotice === 0) return
    if (!window.confirm(`連携のお知らせ（患者番号つき）を、まだ届いたと確かめられていない ${pendingNotice}人にLINEで送ります。よろしいですか？`)) return
    setResendState('送っています…')
    try {
      const res = await fetch('/api/line-link/resend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const d = (await res.json()) as { ok?: boolean; sent?: number; failed?: number; errors?: string[]; error?: string }
      if (!res.ok || !d.ok) throw new Error(d.error ?? `HTTP ${res.status}`)
      setResendState(`${d.sent ?? 0}人に送りました${d.failed ? `（${d.failed}人は送れませんでした：${(d.errors ?? []).join(' / ')}）` : ''}`)
      reload()
    } catch (e) {
      setResendState(e instanceof Error ? e.message : '送れませんでした')
    }
  }

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 端末の控えを最初に1回読むだけ
      setLiffId(localStorage.getItem(LIFF_ID_STORAGE) || DEFAULT_LIFF_ID)
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
        リッチメニューの「カルテ連携」から開けます（7マス版のメニューは
        <a href="/marketing/line/richmenu" className="underline">こちら</a>）。
        患者さんがこのページをLINEの中で開き、お名前・電話番号・生年月日を入れると、カルテと結びつき、ネット予約で使える患者番号がLINEに届きます。
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
                className="mt-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold hover:bg-slate-100 max-lg:min-h-10"
              >
                コピー
              </button>
            </div>
          ) : (
            <p className="text-xs text-amber-700">LIFF ID を入れると、URLとQRが出ます。</p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={resend}
              disabled={pendingNotice === 0 || resendState === '送っています…'}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 max-lg:min-h-10"
            >
              連携のお知らせを送り直す（未確認 {pendingNotice}人）
            </button>
            {resendState && <span className="text-slate-600">{resendState}</span>}
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            受付では、友だち追加のあとに「メニューのカルテ連携から、お名前と電話番号を入れてください」とご案内ください。
            ご家族のカルテは、その方のお名前と院に登録している電話番号で結びつけられます。
          </p>
        </div>
        {url && (
          <div className="flex flex-col items-center gap-1">
            <QRCodeCanvas value={url} size={128} marginSize={1} level="M" />
            <span className="text-xs text-slate-500">LINEのカメラで読める</span>
          </div>
        )}
      </div>
    </section>
  )
}
