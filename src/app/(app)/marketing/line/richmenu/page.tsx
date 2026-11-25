'use client'
/**
 * 公式LINEのリッチメニューを作って、LINE に登録する画面（院長用）
 *
 * LINE の管理画面で作れるメニューは最大6マス。ここでは管理画面のメニュー画像をもとに、
 * 右下を「カルテ連携」に、上の帯の右に小さな「Instagram」、左に小さな「予約確認」（2026-11-25）を描き足し、
 * 8つの押せる場所を API で登録する（絵と場所は lib/marketing/richmenu-design.ts、登録は line-richmenu-server.ts）。
 * 「管理画面のメニューに戻す」で、API のメニューを外せる。
 */
import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_BASE_URL,
  INSTAGRAM_URL,
  KARTE_LINK_URL,
  RICH_H,
  RICH_W,
  drawInstagram,
  drawKarte,
  drawReservationCheck,
  richMenuAreas,
} from '@/lib/marketing/richmenu-design'

const W = RICH_W
const H = RICH_H

interface Status {
  configured: boolean
  defaultId: string | null
  menus: Array<{ richMenuId: string; name: string }>
  warning?: string
}

export default function RichMenuPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [base, setBase] = useState<ImageBitmap | null>(null)
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL)
  const [karte, setKarte] = useState(true)
  const [insta, setInsta] = useState(true)
  const [check, setCheck] = useState(true)
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadStatus = () =>
    fetch('/api/marketing/line/richmenu', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: Status & { ok?: boolean; error?: string }) => (d.ok ? setStatus(d) : setError(d.error ?? '状態を読めませんでした')))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '状態を読めませんでした'))

  useEffect(() => {
    void loadStatus()
  }, [])

  // 描き直し
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const g = c.getContext('2d')
    if (!g) return
    g.clearRect(0, 0, W, H)
    if (!base) {
      g.fillStyle = '#eef2f6'
      g.fillRect(0, 0, W, H)
      return
    }
    g.drawImage(base, 0, 0, W, H)
    if (karte) drawKarte(g)
    if (insta) drawInstagram(g)
    if (check) drawReservationCheck(g)
  }, [base, karte, insta, check])

  const loadFromUrl = async () => {
    setError('')
    setBusy('画像を読み込み中…')
    try {
      const res = await fetch(`/api/marketing/line/richmenu/base?url=${encodeURIComponent(baseUrl)}`)
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: `HTTP ${res.status}` }))).error)
      setBase(await createImageBitmap(await res.blob()))
    } catch (e) {
      setError(e instanceof Error ? e.message : '画像を読めませんでした')
    } finally {
      setBusy('')
    }
  }

  const loadFromFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    try {
      setBase(await createImageBitmap(file))
    } catch {
      setError('この画像は読めませんでした')
    }
  }

  const toJpeg = (): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const c = canvasRef.current
      if (!c) return reject(new Error('canvas がありません'))
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('画像を作れませんでした'))), 'image/jpeg', 0.9)
    })

  const publish = async () => {
    if (!base) return setError('先に元の画像を読み込んでください')
    if (!window.confirm('この画像でリッチメニューを登録し、友だち全員に表示します。よろしいですか？')) return
    setError('')
    setMessage('')
    setBusy('LINE に登録中…')
    try {
      const blob = await toJpeg()
      if (blob.size > 1_000_000) throw new Error(`画像が1MBを超えました（${Math.round(blob.size / 1024)}KB）`)
      const form = new FormData()
      form.append('image', blob, 'richmenu.jpg')
      const areas = richMenuAreas({ karte, insta, check })
      form.append('spec', JSON.stringify({ name: `メインメニュー（${new Date().toISOString().slice(0, 10)}）`, chatBarText: 'メニュー', areas }))
      const res = await fetch('/api/marketing/line/richmenu', { method: 'POST', body: form })
      const data = (await res.json()) as { ok?: boolean; error?: string; richMenuId?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setMessage('登録しました。LINE のトークを開き直すと新しいメニューが出ます（反映に数分かかることがあります）')
      await loadStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : '登録に失敗しました')
    } finally {
      setBusy('')
    }
  }

  const reset = async () => {
    if (!window.confirm('API で登録したメニューを外し、LINE の管理画面のメニューに戻します。よろしいですか？')) return
    setError('')
    setMessage('')
    setBusy('戻しています…')
    try {
      const res = await fetch('/api/marketing/line/richmenu', { method: 'DELETE' })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setMessage('管理画面のメニューに戻しました')
      await loadStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : '戻せませんでした')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">リッチメニュー</h1>
        <p className="mt-1 text-sm text-slate-600">
          LINE の管理画面のメニューは最大6マスです。ここでは今の画像に「カルテ連携」と、小さな「Instagram」「予約確認」を描き足し、
          8つの押せる場所を API で登録します。管理画面のメニューは残るので、いつでも戻せます。
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <h2 className="font-bold">いまの状態</h2>
        {status === null ? (
          <p className="mt-1 text-slate-500">確認中…</p>
        ) : !status.configured ? (
          <p className="mt-1 text-amber-700">LINE チャネルが未接続です（LINE_CHANNEL_ACCESS_TOKEN）。</p>
        ) : status.defaultId ? (
          <p className="mt-1 text-emerald-700">
            API のメニューを表示中（{status.menus.find((m) => m.richMenuId === status.defaultId)?.name ?? status.defaultId}）
          </p>
        ) : (
          <p className="mt-1 text-slate-600">LINE の管理画面のメニューを表示中（API のメニューは無し）</p>
        )}
        {status?.warning && <p className="mt-1 text-xs text-amber-700">確認できなかった項目: {status.warning}</p>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm space-y-3">
        <h2 className="font-bold">1. 元の画像</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-1.5 font-mono text-xs"
            placeholder="LINE 管理画面のメニュー画像の URL（line-scdn.net）"
          />
          <button type="button" onClick={loadFromUrl} disabled={!!busy} className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 max-lg:min-h-10">
            URL から読む
          </button>
          <label className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold hover:bg-slate-50">
            画像ファイルを選ぶ
            <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => loadFromFile(e.target.files?.[0])} />
          </label>
        </div>
        <p className="text-xs text-slate-500">画像は 2500×1686。管理画面のメニュー画像（Instagram 入りの元の画像）を使います。</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm space-y-3">
        <h2 className="font-bold">2. 描き足すもの</h2>
        <label className="flex items-center gap-2 max-lg:min-h-10">
          <input type="checkbox" checked={karte} onChange={(e) => setKarte(e.target.checked)} />
          右下を「カルテ連携」にする（リンク先 {KARTE_LINK_URL}）
        </label>
        <label className="flex items-center gap-2 max-lg:min-h-10">
          <input type="checkbox" checked={insta} onChange={(e) => setInsta(e.target.checked)} />
          上の帯の右に小さな「Instagram」を足す（{INSTAGRAM_URL}）
        </label>
        <label className="flex items-center gap-2 max-lg:min-h-10">
          <input type="checkbox" checked={check} onChange={(e) => setCheck(e.target.checked)} />
          上の帯の左に小さな「予約確認」を足す（押すと「予約確認」と送られ、その方のこれからの予約が返ります）
        </label>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
          <canvas ref={canvasRef} width={W} height={H} className="h-auto w-full max-w-[720px]" />
        </div>
        <p className="text-xs text-slate-500">
          押せる場所：電話で予約／アクセス／初めての方へ／料金／ネット予約／カルテ連携（右下）／Instagram（右上）／予約確認（左上）。
          文字はこのパソコンのフォントで描くので、受付のパソコンで作ると管理画面と同じ見た目になります。
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm space-y-3">
        <h2 className="font-bold">3. LINE に登録する</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={publish} disabled={!!busy || !base} className="rounded-md bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-50 max-lg:min-h-10">
            この画像で友だち全員に表示する
          </button>
          <button type="button" onClick={reset} disabled={!!busy} className="rounded-md border border-slate-300 px-4 py-2 font-bold hover:bg-slate-50 disabled:opacity-50 max-lg:min-h-10">
            管理画面のメニューに戻す
          </button>
        </div>
        {busy && <p className="text-slate-500">{busy}</p>}
        {message && <p className="text-emerald-700">{message}</p>}
        {error && <p className="text-red-700">{error}</p>}
      </section>
    </div>
  )
}
