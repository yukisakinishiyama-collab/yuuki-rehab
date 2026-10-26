'use client'
/**
 * 公式LINEのリッチメニュー（7マス版）を作って、LINE に登録する画面（院長用）
 *
 * LINE の管理画面で作れるメニューは最大6マス。ここでは管理画面のメニュー画像をもとに、
 * 右下を「カルテ連携」に、上の帯の右に小さな「Instagram」を描き足し、7つの押せる場所を
 * API で登録する（lib/marketing/line-richmenu-server.ts）。
 * 「管理画面のメニューに戻す」で、API のメニューを外せる。
 */
import { useEffect, useRef, useState } from 'react'
import { LIFF_ID, LIFF_RESERVE_URL } from '@/lib/marketing/clinic'

const W = 2500
const H = 1686
const NAVY = 'rgb(17,55,97)'
const PAPER = 'rgb(251,252,252)'

/** 管理画面に置いてある今のメニュー画像（2026-10 時点）。変わったら画像を選び直せばよい */
const DEFAULT_BASE_URL =
  'https://manager.line-scdn.net/0h4nsWPUgIa0FOLndxaTkUFmNvcSI-Rn4JMRB2fjd6ajV9FnlDIE8gdWkpNHk2G3kRe0AsdTwuNHAwTX8fdh8ncz5rNXdrHH5AIEk'

const INSTAGRAM_URL = 'https://www.instagram.com/yu.ki__seikotsuin'
const KARTE_LINK_URL = `https://liff.line.me/${LIFF_ID}/link`

/** 押せる場所（画像 2500×1686 の座標） */
const AREAS = [
  { bounds: { x: 0, y: 420, width: 833, height: 590 }, action: { type: 'uri' as const, label: '電話で予約', uri: 'tel:0832654545' } },
  { bounds: { x: 833, y: 420, width: 834, height: 590 }, action: { type: 'uri' as const, label: 'アクセス', uri: 'https://maps.google.com/?cid=6709983637345638461' } },
  { bounds: { x: 1667, y: 420, width: 833, height: 590 }, action: { type: 'message' as const, label: '初めての方へ', text: '初めての方へ' } },
  { bounds: { x: 0, y: 1010, width: 833, height: 676 }, action: { type: 'message' as const, label: '料金', text: '料金' } },
  { bounds: { x: 833, y: 1010, width: 834, height: 676 }, action: { type: 'uri' as const, label: 'ネット予約', uri: LIFF_RESERVE_URL } },
  { bounds: { x: 1667, y: 1010, width: 833, height: 676 }, action: { type: 'uri' as const, label: 'カルテ連携', uri: KARTE_LINK_URL } },
  { bounds: { x: 2080, y: 60, width: 420, height: 320 }, action: { type: 'uri' as const, label: 'Instagram', uri: INSTAGRAM_URL } },
]

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** 右下のマスを「カルテ連携」に描き替える */
function drawKarte(g: CanvasRenderingContext2D) {
  const grad = g.createLinearGradient(0, 1045, 0, 1575)
  grad.addColorStop(0, PAPER)
  grad.addColorStop(1, 'rgb(243,247,251)')
  g.fillStyle = grad
  g.fillRect(1690, 1045, 730, 530)
  g.strokeStyle = NAVY
  g.lineJoin = 'round'
  g.lineCap = 'round'
  const cx = 2040
  const top = 1100
  g.lineWidth = 18
  roundRect(g, cx - 85, top + 16, 170, 200, 20)
  g.stroke()
  roundRect(g, cx - 36, top, 72, 36, 12)
  g.fillStyle = PAPER
  g.fill()
  g.stroke()
  g.lineWidth = 14
  g.beginPath()
  g.moveTo(cx - 48, top + 88)
  g.lineTo(cx + 48, top + 88)
  g.moveTo(cx - 48, top + 132)
  g.lineTo(cx + 12, top + 132)
  g.stroke()
  g.lineWidth = 16
  g.fillStyle = PAPER
  g.beginPath()
  g.ellipse(cx + 118, top + 40, 62, 48, 0, 0, Math.PI * 2)
  g.fill()
  g.stroke()
  g.beginPath()
  g.moveTo(cx + 76, top + 78)
  g.lineTo(cx + 62, top + 104)
  g.lineTo(cx + 100, top + 86)
  g.closePath()
  g.fillStyle = PAPER
  g.fill()
  g.lineWidth = 12
  g.stroke()
  g.fillStyle = PAPER
  g.beginPath()
  g.ellipse(cx + 118, top + 40, 55, 41, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = NAVY
  for (const x of [cx + 96, cx + 118, cx + 140]) {
    g.beginPath()
    g.arc(x, top + 40, 7, 0, Math.PI * 2)
    g.fill()
  }
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = 'bold 100px "Yu Mincho", "MS Mincho", "Hiragino Mincho ProN", serif'
  g.fillText('カルテ連携', 2055, 1418)
  g.font = 'bold 38px "Yu Gothic", "Meiryo", "Hiragino Sans", sans-serif'
  g.fillText('LINEとカルテを結びつけ', 2055, 1505)
}

/** 上の帯の右に、小さな Instagram ボタンを描く */
function drawInstagram(g: CanvasRenderingContext2D) {
  const x = 2110
  const y = 100
  const w = 360
  const h = 240
  g.lineJoin = 'round'
  g.lineCap = 'round'
  roundRect(g, x, y, w, h, 30)
  g.fillStyle = 'rgba(255,255,255,0.92)'
  g.fill()
  g.strokeStyle = NAVY
  g.lineWidth = 8
  g.stroke()
  // Instagram の形（角丸四角＋丸＋点）
  const ix = x + w / 2
  const iy = y + 92
  g.lineWidth = 12
  roundRect(g, ix - 55, iy - 55, 110, 110, 30)
  g.stroke()
  g.beginPath()
  g.arc(ix, iy, 26, 0, Math.PI * 2)
  g.stroke()
  g.fillStyle = NAVY
  g.beginPath()
  g.arc(ix + 32, iy - 32, 8, 0, Math.PI * 2)
  g.fill()
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = 'bold 44px "Yu Mincho", "MS Mincho", "Hiragino Mincho ProN", serif'
  g.fillText('Instagram', ix, y + 192)
}

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
  }, [base, karte, insta])

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
      const areas = AREAS.filter((a) => (a.action.label === 'Instagram' ? insta : true)).map((a) =>
        a.action.label === 'カルテ連携' && !karte ? { ...a, action: { type: 'uri' as const, label: 'Instagram', uri: INSTAGRAM_URL } } : a,
      )
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
        <h1 className="text-2xl font-bold">リッチメニュー（7マス版）</h1>
        <p className="mt-1 text-sm text-slate-600">
          LINE の管理画面のメニューは最大6マスです。ここでは今の画像に「カルテ連携」と小さな「Instagram」を描き足し、
          7つの押せる場所を API で登録します。管理画面のメニューは残るので、いつでも戻せます。
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
          <button type="button" onClick={loadFromUrl} disabled={!!busy} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
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
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={karte} onChange={(e) => setKarte(e.target.checked)} />
          右下を「カルテ連携」にする（リンク先 {KARTE_LINK_URL}）
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={insta} onChange={(e) => setInsta(e.target.checked)} />
          上の帯の右に小さな「Instagram」を足す（{INSTAGRAM_URL}）
        </label>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
          <canvas ref={canvasRef} width={W} height={H} className="h-auto w-full max-w-[720px]" />
        </div>
        <p className="text-xs text-slate-500">
          押せる場所：電話で予約／アクセス／初めての方へ／料金／ネット予約／カルテ連携（右下）／Instagram（右上）。
          文字はこのパソコンのフォントで描くので、受付のパソコンで作ると管理画面と同じ見た目になります。
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm space-y-3">
        <h2 className="font-bold">3. LINE に登録する</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={publish} disabled={!!busy || !base} className="rounded-md bg-emerald-600 px-4 py-2 font-bold text-white disabled:opacity-50">
            この画像で友だち全員に表示する
          </button>
          <button type="button" onClick={reset} disabled={!!busy} className="rounded-md border border-slate-300 px-4 py-2 font-bold hover:bg-slate-50 disabled:opacity-50">
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
