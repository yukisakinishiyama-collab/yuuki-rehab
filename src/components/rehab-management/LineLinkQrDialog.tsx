'use client'
// ──────────────────────────────────────────────
// カルテの画面の「LINE連携のQRコード」（2026-11-19 院長の依頼。DECISIONS.md）
//
// その方だけの番号（10分・1回だけ）を作って QR コードを出し、患者さんのスマホの LINE で読み取ってもらう。
// 今までの「カルテ連携」のページが開き、「結びつける」を押すだけで、お名前・電話番号・生年月日を入れずに結びつく。
// 番号の状態を数秒ごとに見て、結びついたら「結びつきました」を出す。閉じたら（まだなら）番号は取り消す。
// QR の中は URL と番号だけ（お名前・電話番号は入れない）。LIFF ID は「LINE導線」のカードと同じ、端末の控え。
// ──────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { CheckCircle2, Loader2, QrCode, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LIFF_ID as DEFAULT_LIFF_ID } from '@/lib/marketing/clinic'
import { LINK_QR_POLL_MS, linkQrUrl, remainingText } from '@/lib/line-link-qr'

const LIFF_ID_STORAGE = 'liff_id'

type Shown = 'creating' | 'waiting' | 'linked' | 'expired' | 'cancelled' | 'error'

function readLiffId(): string {
  try {
    return localStorage.getItem(LIFF_ID_STORAGE) || DEFAULT_LIFF_ID
  } catch {
    return DEFAULT_LIFF_ID
  }
}

export default function LineLinkQrDialog({
  patient,
  onLinked,
  onClose,
}: {
  patient: { id: string; name: string; phone?: string; birthDate?: string }
  /** 結びついた（カルテの「公式LINE」の欄を取り直す） */
  onLinked: () => void
  onClose: () => void
}) {
  const [shown, setShown] = useState<Shown>('creating')
  const [code, setCode] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [needPhone, setNeedPhone] = useState(false)
  const [patientNo, setPatientNo] = useState('')
  const [message, setMessage] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [liffId] = useState(readLiffId)
  const codeRef = useRef('')
  const onLinkedRef = useRef(onLinked)
  useEffect(() => {
    onLinkedRef.current = onLinked
  })

  /** その方だけの番号を作る（作り直すと、前の番号は使えなくなる） */
  const create = useCallback(async () => {
    setShown('creating')
    setMessage('')
    try {
      const res = await fetch('/api/line-link/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: patient.id, name: patient.name, phone: patient.phone ?? '', birthDate: patient.birthDate ?? '' }),
      })
      const data = (await res.json().catch(() => null)) as { ok?: boolean; code?: string; expiresAt?: string; needPhone?: boolean; error?: string } | null
      if (!res.ok || !data?.ok || !data.code || !data.expiresAt) throw new Error(data?.error || `HTTP ${res.status}`)
      codeRef.current = data.code
      setCode(data.code)
      setExpiresAt(data.expiresAt)
      setNeedPhone(Boolean(data.needPhone))
      setShown('waiting')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'QRコードを作れませんでした')
      setShown('error')
    }
  }, [patient.id, patient.name, patient.phone, patient.birthDate])

  // 開いたら番号を作る
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 開いたときに1回、番号を作る（結果は通信のあとに入る）
    void create()
  }, [create])

  // 番号の状態を数秒ごとに見る（結びついた・期限切れ）。残り時間の表示も動かす
  useEffect(() => {
    if (shown !== 'waiting' || !code) return
    let alive = true
    const tick = async () => {
      setNow(Date.now())
      try {
        const res = await fetch(`/api/line-link/qr?c=${encodeURIComponent(code)}`, { cache: 'no-store' })
        const data = (await res.json().catch(() => null)) as { ok?: boolean; status?: string; expired?: boolean; patientNo?: string } | null
        if (!alive || !data?.ok) return
        if (data.status === 'linked') {
          setPatientNo(data.patientNo ?? '')
          setShown('linked')
          onLinkedRef.current()
        } else if (data.status === 'cancelled' || data.status === 'missing') {
          setShown('cancelled')
        } else if (data.expired) {
          setShown('expired')
        }
      } catch {
        // 通信がとぎれても、次の回にもう一度見る
      }
    }
    const timer = window.setInterval(() => void tick(), LINK_QR_POLL_MS)
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      alive = false
      window.clearInterval(timer)
      window.clearInterval(clock)
    }
  }, [shown, code])

  /** 閉じる（まだ使われていない番号は取り消す） */
  const close = async () => {
    if (codeRef.current && (shown === 'waiting' || shown === 'expired')) {
      await fetch(`/api/line-link/qr?c=${encodeURIComponent(codeRef.current)}`, { method: 'DELETE' }).catch(() => undefined)
    }
    onClose()
  }

  const url = code ? linkQrUrl(liffId, code) : ''

  return (
    <div className="no-print fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-label="QRコードでLINEと結びつける">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-base font-black text-slate-900">
              <QrCode className="h-5 w-5 shrink-0 text-green-700" aria-hidden />
              QRコードでLINEと結びつける
            </p>
            <p className="mt-1 break-keep text-sm text-slate-600 wrap-anywhere">{patient.name}さん</p>
          </div>
          <button type="button" onClick={() => void close()} aria-label="閉じる" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {shown === 'creating' && (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-600" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            QRコードを用意しています…
          </p>
        )}

        {shown === 'waiting' && url && (
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-xl border-2 border-slate-200 bg-white p-3">
              <QRCodeSVG value={url} size={220} level="M" marginSize={1} />
            </div>
            <p className="text-center text-sm font-bold text-slate-900" role="status">
              読み取りを待っています（{remainingText(expiresAt, new Date(now))}）
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
              <li>患者さんのスマホの LINE で、QRコードリーダー（LINE の「ホーム」の上、検索欄の右のマーク）からこのQRコードを読み取ってもらいます。スマホのカメラで読むと、機種によっては LINE の外のブラウザで開き、先へ進めません。</li>
              <li>LINE の中に「{patient.name} 様のカルテと、このLINEを結びつけます」が出たら、「結びつける」を押してもらいます。</li>
              <li>結びつくと、この画面が自動で「結びつきました」に変わり、患者さんの LINE に患者番号つきのお知らせが届きます。</li>
            </ol>
            {needPhone && (
              <p className="w-full rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                このカルテには電話番号がないので、読み取ったあと、患者さんに電話番号を入れてもらいます。
              </p>
            )}
            <p className="text-xs text-slate-600">
              QRコードは10分・1回だけ使えます。公式LINEを友だち追加していない方は、先に友だち追加をしてもらうと、お知らせが届きます。
            </p>
          </div>
        )}
        {shown === 'waiting' && !url && (
          <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            LIFF ID が正しくないため、QRコードを出せません。集客 → LINE導線 の「カルテ連携」で LIFF ID を確かめてください。
          </p>
        )}

        {shown === 'linked' && (
          <div className="space-y-2 py-4 text-center" role="status">
            <p className="flex items-center justify-center gap-2 text-base font-black text-slate-900">
              <CheckCircle2 className="h-6 w-6 text-green-700" aria-hidden />
              結びつきました
            </p>
            <p className="text-sm text-slate-700">
              {patient.name}さんのカルテと LINE が結びつきました。{patientNo ? `患者番号 ${patientNo} を LINE でお知らせしています。` : ''}
            </p>
          </div>
        )}

        {(shown === 'expired' || shown === 'cancelled' || shown === 'error') && (
          <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            {shown === 'expired'
              ? 'QRコードの期限（10分）が過ぎました。「QRコードを出し直す」を押してください。'
              : shown === 'cancelled'
                ? 'このQRコードは使えなくなりました（ほかの画面で出し直した など）。「QRコードを出し直す」を押してください。'
                : `QRコードを作れませんでした：${message}`}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {(shown === 'expired' || shown === 'cancelled' || shown === 'error' || shown === 'waiting') && (
            <Button variant="outline" onClick={() => void create()}>
              QRコードを出し直す
            </Button>
          )}
          <Button onClick={() => void close()}>{shown === 'linked' ? '閉じる' : 'やめる'}</Button>
        </div>
      </div>
    </div>
  )
}
