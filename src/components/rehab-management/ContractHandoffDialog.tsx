'use client'
// ──────────────────────────────────────────────
// 契約書・同意書を iPad に渡す（パソコンの側の画面。2026-11-19 院長の依頼。DECISIONS.md）
//
// QR コードを出し、iPad での記入を待つ。受け渡しの印を数秒ごとに見て、署名済みになったら、
// 署名入りの本文と記録を取りこんで親に渡す（カルテの同期＝15秒ごと を待たない）。
// 印を読めなかったとき（通信が切れた）のために、カルテの同期で届いた記録も見る。
// ──────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { CheckCircle2, Loader2, TabletSmartphone, X } from 'lucide-react'
import type { ContractRecord } from '@/types/contracts'
import { HANDOFF_POLL_MS, handoffStatusText, handoffUrl, type HandoffStatus } from '@/lib/contracts/handoff'
import { cancelHandoff, fetchHandoff, fetchSignedContract } from '@/lib/contracts/handoff-client'
import { getContracts } from '@/lib/contracts/store'
import { useKarteSynced } from '@/lib/use-karte-sync'
import { Button } from '@/components/ui/button'

type Shown = HandoffStatus | 'expired' | 'missing'

export default function ContractHandoffDialog({
  patientId,
  patientName,
  docId,
  title,
  token,
  onSigned,
  onClose,
}: {
  patientId: string
  patientName: string
  docId: string
  title: string
  token: string
  onSigned: (record: ContractRecord, html: string) => void
  /** やめた・時間切れで閉じた（パソコンの記入の画面に戻る） */
  onClose: () => void
}) {
  const [status, setStatus] = useState<Shown>('waiting')
  const [note, setNote] = useState('')
  const finished = useRef(false)
  /** この画面を開いたときに、もうあった署名済みの記録（同期で届いた記録のうち、これより新しいものだけを受け取る） */
  const [known] = useState(() => new Set(getContracts(patientId).map((c) => c.id)))
  const onSignedRef = useRef(onSigned)
  useEffect(() => {
    onSignedRef.current = onSigned
  })
  // このページのアドレス（院内アプリの中でだけ開く画面なので、端末の側で決まる）
  const url = handoffUrl(window.location.origin, token)

  /** 署名済みの記録を受け取る（同じ患者さん・同じ書類のものだけ） */
  async function take(recordId: string): Promise<boolean> {
    if (finished.current) return true
    const signed = await fetchSignedContract(recordId)
    if (!signed || signed.record.patientId !== patientId || signed.record.docId !== docId) return false
    if (finished.current) return true
    finished.current = true
    setStatus('signed')
    onSignedRef.current(signed.record, signed.html)
    return true
  }

  // 受け渡しの印を数秒ごとに見る
  useEffect(() => {
    let alive = true
    const tick = async () => {
      if (!alive || finished.current) return
      const r = await fetchHandoff(token)
      if (!alive || finished.current) return
      if (r.kind === 'missing') return setStatus('missing')
      if (r.kind === 'error') return setNote('通信がとぎれています。つながると、続きから確かめます。')
      setNote('')
      const s = r.session
      if (s.status === 'signed' && s.recordId) {
        if (!(await take(s.recordId)) && alive) setNote('署名は終わっています。書類を読みこんでいます…')
        return
      }
      setStatus(s.status === 'cancelled' ? 'cancelled' : r.expired ? 'expired' : s.status)
    }
    void tick()
    const timer = setInterval(() => void tick(), HANDOFF_POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
    // take は token・患者さん・書類が同じ間は同じはたらき
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // 印を読めなくても、カルテの同期で届いた記録を受け取る（iPad が「署名が終わった」を知らせそこねたとき）
  useKarteSynced((keys) => {
    if (finished.current || !keys.includes('pt_contracts')) return
    const hit = getContracts(patientId).find((c) => c.docId === docId && !c.voided && !known.has(c.id))
    if (hit) void take(hit.id)
  })

  async function stop() {
    if (status === 'waiting' || status === 'opened') await cancelHandoff(token)
    onClose()
  }

  const live = status === 'waiting' || status === 'opened'

  return (
    <div className="no-print fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-label="iPadで記入してもらう">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-base font-black text-slate-900">
              <TabletSmartphone className="h-5 w-5 shrink-0 text-teal-700" aria-hidden />
              iPadで記入してもらう
            </p>
            <p className="mt-1 break-keep text-sm text-slate-600 wrap-anywhere">
              {patientName}さん・{title}
            </p>
          </div>
          <button type="button" onClick={() => void stop()} aria-label="閉じる" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {live ? (
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-xl border-2 border-slate-200 bg-white p-3">
              <QRCodeSVG value={url} size={220} level="M" marginSize={1} />
            </div>
            <p className="flex items-center gap-2 text-center text-sm font-bold text-slate-900" role="status">
              {status === 'opened' && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-teal-700" aria-hidden />}
              {handoffStatusText(status)}
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
              <li>iPad のカメラをこの QR コードに向けて、出てきたリンクを押します。</li>
              <li>同じ書類が、ここまでに入れた中身のまま開きます。患者様に □ のチェックと署名をお願いします。</li>
              <li>署名が終わると、この画面が自動で「署名が完了しました」に変わります。</li>
            </ol>
            <p className="text-xs text-slate-600">
              iPad の院内アプリで、この患者さんの「契約・同意書」を開いても受け取れます。QR コードは1時間使えます。
            </p>
          </div>
        ) : status === 'signed' ? (
          <p className="flex items-center justify-center gap-2 py-6 text-base font-black text-slate-900" role="status">
            <CheckCircle2 className="h-6 w-6 text-teal-700" aria-hidden />
            {handoffStatusText('signed')}
          </p>
        ) : (
          <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            {handoffStatusText(status)}
          </p>
        )}

        {note && <p className="text-xs text-slate-600">{note}</p>}

        {status !== 'signed' && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => void stop()}>
              {live ? 'やめて、この端末で続ける' : '閉じる'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
