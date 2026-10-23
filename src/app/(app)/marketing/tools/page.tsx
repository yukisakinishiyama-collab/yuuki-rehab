'use client'

/**
 * 集客の道具：計測つきリンクとQRコードを作る／今の空きでストーリー画像を作る
 *
 * リンク … 行き先（ネット予約など）と「どこに貼るか（流入元）」「計測名」を入れると、計測つきのリンクとQRができる。
 *          押されると /api/marketing/go がクリックを数え、予約システムにも流入元・計測名が残る（「集客の効果」で見られる）。
 * ストーリー … 予約システムの今の空きで、Instagramのストーリー用の画像（1080×1920）を作る。保存して手で投稿する。
 * どちらも患者さんの情報は使わない。作ったリンクはこの端末に最大10件だけ覚えておく。
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Check, Copy, Download, ExternalLink, ImageIcon, Link2, RefreshCw } from 'lucide-react'
import { SITE_URL } from '@/lib/site/seo'
import { SOURCE_LABELS } from '@/lib/marketing/booking-stats-labels'

type Dest = 'reserve' | 'yoyaku-net' | 'line' | 'map' | 'home' | 'instagram'

const DEST_LABELS: Record<Dest, string> = {
  reserve: 'ネット予約（そのまま予約の画面へ）',
  'yoyaku-net': 'ネット予約の案内ページ（Googleの投稿の予約ボタン向け）',
  line: '公式LINE（友だち追加）',
  map: 'Googleマップ',
  home: 'ホームページ（shimonoseki-yuuki.com）',
  instagram: 'Instagram',
}

const today = () => {
  const t = new Date(Date.now() + 9 * 3_600_000)
  return t.toISOString().slice(0, 10).replace(/-/g, '')
}

interface Preset {
  id: string
  label: string
  dest: Dest
  source: string
  campaign: () => string
  hint: string
}

const PRESETS: Preset[] = [
  { id: 'ig-profile', label: 'Instagramのプロフィール', dest: 'reserve', source: 'instagram', campaign: () => 'profile', hint: 'Instagramの「プロフィールを編集」→「リンク」に貼る' },
  { id: 'ig-story', label: 'Instagramのストーリー', dest: 'reserve', source: 'instagram', campaign: () => `story-${today()}`, hint: 'ストーリーの「リンク」スタンプに貼る' },
  { id: 'gbp-post', label: 'Googleの投稿', dest: 'yoyaku-net', source: 'google_post', campaign: () => `gbp-${today()}`, hint: '投稿の「予約」ボタンのリンクに貼る（予約システムのアドレスは断られるため案内ページ）' },
  { id: 'gbp-profile', label: 'Googleのビジネスプロフィール', dest: 'yoyaku-net', source: 'google_profile', campaign: () => 'profile', hint: 'ビジネスプロフィールの「予約」リンクに貼る' },
  { id: 'flyer', label: 'チラシ・院内のQR', dest: 'reserve', source: 'flyer', campaign: () => `flyer-${today().slice(0, 6)}`, hint: '下のQRを印刷物に使う。チラシごとに計測名を変えると、どれから来たか分かる' },
  { id: 'hp', label: 'ホームページのボタン', dest: 'reserve', source: 'website', campaign: () => 'hp', hint: 'ホームページの「ネット予約」ボタンのリンクに' },
  { id: 'line-rich', label: 'LINEのメニュー', dest: 'reserve', source: 'line', campaign: () => 'richmenu', hint: 'LINE公式アカウントのリッチメニューの予約ボタンに' },
]

const SAFE = /[^A-Za-z0-9_-]/g
const clean = (v: string) => v.replace(SAFE, '').slice(0, 60)

function buildUrl(dest: Dest, source: string, campaign: string): string {
  const qs = new URLSearchParams()
  if (dest !== 'yoyaku-net') qs.set('d', dest)
  if (source) qs.set('source', source)
  if (campaign) qs.set('campaign', campaign)
  return dest === 'yoyaku-net' ? `${SITE_URL}/yoyaku-net?${qs.toString()}` : `${SITE_URL}/api/marketing/go?${qs.toString()}`
}

// ── この端末に覚えておく、最近作ったリンク ────────────────────

interface SavedLink {
  url: string
  label: string
  at: string
}
const HISTORY_KEY = 'mk:tool-links'
const HISTORY_EVENT = 'mk:tool-links'

function readHistory(): string {
  try {
    return window.localStorage.getItem(HISTORY_KEY) ?? '[]'
  } catch {
    return '[]'
  }
}
function subscribeHistory(onChange: () => void) {
  window.addEventListener(HISTORY_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(HISTORY_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}
function saveHistory(list: SavedLink[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 10)))
  } catch {
    // 保存できない環境では覚えない
  }
  window.dispatchEvent(new Event(HISTORY_EVENT))
}

// ── 部品 ─────────────────────────────────────────────

const input =
  'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100'
const pill =
  'inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50'
const primary =
  'inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-teal-600 px-5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50'

function CopyButton({ text, label = 'コピー' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      window.prompt('この文字をコピーしてお使いください', text)
    }
    setDone(true)
    window.setTimeout(() => setDone(false), 2000)
  }
  return (
    <>
      <button type="button" onClick={() => void copy()} className={primary}>
        {done ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        {done ? 'コピーしました' : label}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {done ? 'コピーしました' : ''}
      </span>
    </>
  )
}

// ── リンクとQR ─────────────────────────────────────────

function LinkMaker() {
  const [presetId, setPresetId] = useState<string>('ig-profile')
  const preset = PRESETS.find((p) => p.id === presetId)
  const [dest, setDest] = useState<Dest>(preset?.dest ?? 'reserve')
  const [source, setSource] = useState(preset?.source ?? 'instagram')
  const [campaign, setCampaign] = useState(preset?.campaign() ?? 'profile')
  const qrWrap = useRef<HTMLDivElement>(null)
  const historyRaw = useSyncExternalStore(subscribeHistory, readHistory, () => '[]')
  const history = useMemo(() => {
    try {
      return JSON.parse(historyRaw) as SavedLink[]
    } catch {
      return []
    }
  }, [historyRaw])

  const url = buildUrl(dest, source, clean(campaign))
  const label = `${preset?.label ?? DEST_LABELS[dest]}（${clean(campaign) || '計測名なし'}）`

  function choose(p: Preset) {
    setPresetId(p.id)
    setDest(p.dest)
    setSource(p.source)
    setCampaign(p.campaign())
  }

  function remember() {
    saveHistory([{ url, label, at: new Date().toISOString() }, ...history.filter((h) => h.url !== url)])
  }

  function downloadQr() {
    const canvas = qrWrap.current?.querySelector('canvas')
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `qr-${source}-${clean(campaign) || 'link'}.png`
    a.click()
    remember()
  }

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white">
      <div className="px-4 pt-4 sm:px-6 sm:pt-6">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
          <Link2 className="h-4 w-4 text-teal-700" aria-hidden />
          計測つきのリンクとQRを作る
        </h2>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
          どこに貼るかを選ぶだけで作れます。押された数と、そこから入った予約は「集客の効果」で見られます。
        </p>
      </div>

      <div className="px-4 pt-4 sm:px-6">
        <p className="text-xs font-bold text-slate-600">どこに貼りますか？</p>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="どこに貼るか">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={presetId === p.id}
              onClick={() => choose(p)}
              className={`h-10 rounded-full px-4 text-sm font-bold ${
                presetId === p.id ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset && <p className="mt-2 text-xs leading-relaxed text-slate-500">{preset.hint}</p>}
      </div>

      <details className="group px-4 pt-3 sm:px-6">
        <summary className="cursor-pointer list-none text-sm font-bold text-teal-700 [&::-webkit-details-marker]:hidden">
          行き先・流入元・計測名を変える
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block min-w-0">
            <span className="text-xs font-bold text-slate-600">行き先</span>
            <select className={input} value={dest} onChange={(e) => { setDest(e.target.value as Dest); setPresetId('') }}>
              {(Object.keys(DEST_LABELS) as Dest[]).map((d) => (
                <option key={d} value={d}>
                  {DEST_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="text-xs font-bold text-slate-600">流入元（どこから来たか）</span>
            <select className={input} value={source} onChange={(e) => { setSource(e.target.value); setPresetId('') }}>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="text-xs font-bold text-slate-600">計測名（英数字と - _）</span>
            <input className={input} value={campaign} maxLength={60} onChange={(e) => setCampaign(clean(e.target.value))} placeholder="例：flyer-202611" />
          </label>
        </div>
      </details>

      <div className="grid gap-4 px-4 py-4 sm:grid-cols-[1fr_auto] sm:px-6">
        <div className="min-w-0">
          <label className="block">
            <span className="text-xs font-bold text-slate-600">できたリンク</span>
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className={`${input} font-mono text-xs`} aria-label="できたリンク" />
          </label>
          <div className="mt-3 flex flex-wrap gap-2" onClick={remember}>
            <CopyButton text={url} label="リンクをコピー" />
            <a href={url} target="_blank" rel="noopener noreferrer" className={pill}>
              <ExternalLink className="h-4 w-4" aria-hidden />
              試しに開く
            </a>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            試しに開くと、押した数に1回入ります。予約までは進めないでください。
          </p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div ref={qrWrap} className="rounded-xl border border-slate-200 bg-white p-3">
            <QRCodeCanvas value={url} size={168} marginSize={1} level="M" />
          </div>
          <button type="button" onClick={downloadQr} className={pill}>
            <Download className="h-4 w-4" aria-hidden />
            QRを保存
          </button>
        </div>
      </div>

      {history.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-3 sm:px-6">
          <p className="text-xs font-bold text-slate-600">最近作ったリンク（この端末）</p>
          <ul className="mt-2 divide-y divide-slate-100">
            {history.map((h) => (
              <li key={h.url} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm text-slate-800">{h.label}</span>
                  <span className="block truncate font-mono text-[11px] text-slate-400">{h.url}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(h.url).catch(() => window.prompt('この文字をコピーしてお使いください', h.url))}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                  aria-label={`${h.label}のリンクをコピー`}
                >
                  <Copy className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

// ── ストーリー画像 ─────────────────────────────────────

type Range = 'today' | 'next' | 'week'
const RANGE_LABELS: Record<Range, string> = { today: '本日', next: '次の診療日', week: 'この1週間' }

function StoryMaker() {
  const [range, setRange] = useState<Range>('today')
  const [busy, setBusy] = useState(false)
  const [image, setImage] = useState<{ url: string; name: string; hasOpening: boolean } | null>(null)
  const [error, setError] = useState('')
  const storyLink = buildUrl('reserve', 'instagram', `story-${today()}`)

  // 作った画像の一時URLは、作り直す・画面を離れるときに片づける
  useEffect(() => {
    return () => {
      if (image) URL.revokeObjectURL(image.url)
    }
  }, [image])

  async function make(r: Range) {
    setRange(r)
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/marketing/image?kind=story&range=${r}&fresh=1`, { cache: 'no-store' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? '画像を作れませんでした')
        setImage(null)
        return
      }
      const blob = await res.blob()
      const name = `story-${today()}-${r}.png`
      setImage({ url: URL.createObjectURL(blob), name, hasOpening: res.headers.get('X-Story-Has-Opening') !== '0' })
    } catch {
      setError('画像を作れませんでした（通信の失敗）')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
        <ImageIcon className="h-4 w-4 text-teal-700" aria-hidden />
        今の空きでストーリー画像を作る
      </h2>
      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
        予約システムの今の空きで作ります（枠の数は出さず「空きあり・少しあり・いっぱい」）。保存して、Instagramのストーリーで投稿してください。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
          <button key={r} type="button" disabled={busy} onClick={() => void make(r)} className={range === r && image ? primary : pill}>
            {busy && range === r ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {RANGE_LABELS[r]}の空きで作る
          </button>
        ))}
      </div>
      {error && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>}
      {image && (
        <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element -- その場で作った画像（最適化は不要） */}
          <img src={image.url} alt={`${RANGE_LABELS[range]}の空き状況のストーリー画像`} className="w-44 rounded-2xl border border-slate-200 sm:w-52" />
          <div className="min-w-0 space-y-3 text-sm leading-relaxed text-slate-700">
            {!image.hasOpening && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900">案内できる空きがありません（どこも「いっぱい」か休診です）。出すかどうか、ご判断ください。</p>
            )}
            <a href={image.url} download={image.name} className={primary}>
              <Download className="h-4 w-4" aria-hidden />
              画像を保存
            </a>
            <p className="text-xs text-slate-500">スマホでは、画像を長押しして「写真に保存」でも保存できます。</p>
            <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-600">
              <li>Instagramアプリで、ストーリーを作る → 保存した画像を選ぶ</li>
              <li>「スタンプ」→「リンク」に、下のリンクを貼る（予約が計測されます）</li>
              <li>シェアする</li>
            </ol>
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton text={storyLink} label="ストーリー用のリンクをコピー" />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default function ToolsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-black text-slate-900 sm:text-2xl">リンク・QR・ストーリー</h1>
        <p className="mt-0.5 text-xs text-slate-500">集客の道具。患者さんの情報は使いません。</p>
      </div>
      <LinkMaker />
      <StoryMaker />
    </div>
  )
}
