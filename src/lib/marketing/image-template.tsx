/**
 * 投稿画像の生成（共通モジュール・サーバー専用）
 *
 * - テンプレート画像（Instagramフィード・Google投稿）… /api/marketing/image（プレビュー・ダウンロード）と publishers.ts から
 * - AI画像（ChatGPTで作った文字なしの写真）＋見出し … renderPhotoPostImage（同上。写真が読めなければテンプレ画像）
 * - Instagramストーリーの空き状況 … publishers.ts（投稿する時刻に空きを取り直して作る）と /api/marketing/image?kind=story から
 *
 * サーバー（Vercel）には日本語のフォントが入っていないので、assets/fonts の Zen Kaku Gothic New を読み込んで
 * next/og（Satori）で描く（以前の SVG＋sharp だと、サーバーでは日本語が□になるおそれがあった）。
 * ネイビーのブランド色。Instagram に渡すときは JPEG に直す（toJpeg）。
 *
 * sharp（JPEG変換だけに使う）はネイティブモジュールで、本番では読み込みに失敗することがある。
 * 先頭で import すると、このファイルを読み込んだだけで落ちてしまい、
 * sharp を使わない PNG の生成（next/og）まで巻き添えで止まる。
 * そのため toJpeg の中で、JPEGに直す直前にだけ読み込む。
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { DEFAULT_CLINIC_PROFILE } from './clinic'
import { STORY_LEVEL_LABELS, type StoryLevel, type StoryRow } from './autopilot-planner'

export const IMAGE_SIZES: Record<string, { w: number; h: number }> = {
  instagram: { w: 1080, h: 1080 },
  instagram_portrait: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
  google: { w: 1200, h: 900 },
  note: { w: 1280, h: 670 },
}

const NAVY = '#16233d'
const NAVY_2 = '#2b4a75'
const MINT = '#5eead4'
const FONT = 'Zen Kaku Gothic New'

type Font = { name: string; data: Buffer; weight: 400 | 700; style: 'normal' }
let fontsPromise: Promise<Font[]> | null = null

/** 日本語フォント（400・700）。1回読んだら使い回す */
function loadFonts(): Promise<Font[]> {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      readFile(join(process.cwd(), 'assets/fonts/zen-kaku-gothic-new-japanese-400-normal.woff')),
      readFile(join(process.cwd(), 'assets/fonts/zen-kaku-gothic-new-japanese-700-normal.woff')),
    ])
      .then(([regular, bold]) => [
        { name: FONT, data: regular, weight: 400 as const, style: 'normal' as const },
        { name: FONT, data: bold, weight: 700 as const, style: 'normal' as const },
      ])
      .catch((error) => {
        fontsPromise = null
        throw error
      })
  }
  return fontsPromise
}

async function render(node: React.ReactElement, w: number, h: number): Promise<Buffer> {
  const fonts = await loadFonts()
  const res = new ImageResponse(node, { width: w, height: h, fonts })
  return Buffer.from(await res.arrayBuffer())
}

/**
 * PNG → JPEG（InstagramのAPIは JPEG の画像を受け付ける）
 *
 * まず sharp（速い・ネイティブモジュール）で変換する。本番で sharp が読み込めないことがあるため、
 * 失敗したら pngjs＋jpeg-js（JavaScriptだけで動く。少し遅いが確実）で変換する。
 * sharp が失敗した原因はログに残す（短く丸めると、本番で何が起きているのか追えなくなる）。
 */
export async function toJpeg(png: Buffer): Promise<Buffer> {
  try {
    const { default: sharp } = await import('sharp')
    return await sharp(png).jpeg({ quality: 90, mozjpeg: true }).toBuffer()
  } catch (error) {
    console.warn('[image-template] sharp でJPEGに直せなかったため、JavaScriptだけの変換に切り替えます', error)
  }
  const [{ PNG }, jpeg] = await Promise.all([import('pngjs'), import('jpeg-js')])
  const decoded = PNG.sync.read(png)
  // JPEG に透明は無いので、白の上に重ねる
  const data = Buffer.alloc(decoded.width * decoded.height * 4)
  for (let i = 0; i < data.length; i += 4) {
    const a = decoded.data[i + 3] / 255
    data[i] = Math.round(decoded.data[i] * a + 255 * (1 - a))
    data[i + 1] = Math.round(decoded.data[i + 1] * a + 255 * (1 - a))
    data[i + 2] = Math.round(decoded.data[i + 2] * a + 255 * (1 - a))
    data[i + 3] = 255
  }
  const encoded = jpeg.encode({ data, width: decoded.width, height: decoded.height }, 90)
  return Buffer.from(encoded.data)
}

/** テンプレート画像PNGを生成する（タイトル＋サブタイトル＋院名） */
export async function renderTemplateImage(
  title: string,
  subtitle: string,
  sizeKey: keyof typeof IMAGE_SIZES = 'instagram',
): Promise<Buffer> {
  const { w, h } = IMAGE_SIZES[sizeKey] ?? IMAGE_SIZES.instagram
  const safeTitle = title.slice(0, 60)
  const safeSubtitle = subtitle.slice(0, 60)
  // 長いタイトルは少し小さく（最大3行に収める目安）
  const titleSize = Math.round((w / 12) * (safeTitle.length > 24 ? 0.8 : 1))
  const subSize = Math.round((w / 12) * 0.45)
  return render(
    <div
      style={{
        width: w,
        height: h,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_2} 100%)`,
        fontFamily: FONT,
        color: '#ffffff',
      }}
    >
      <div style={{ position: 'absolute', right: -w * 0.08, top: -h * 0.06, width: w * 0.36, height: w * 0.36, borderRadius: w, background: 'rgba(255,255,255,0.05)' }} />
      <div style={{ position: 'absolute', left: -w * 0.14, bottom: -h * 0.12, width: w * 0.44, height: w * 0.44, borderRadius: w, background: 'rgba(255,255,255,0.05)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: w * 0.84 }}>
        <div style={{ width: w * 0.06, height: 6, background: MINT, marginBottom: titleSize * 0.6 }} />
        <div style={{ display: 'flex', fontSize: titleSize, fontWeight: 700, lineHeight: 1.3, textAlign: 'center', justifyContent: 'center' }}>{safeTitle}</div>
        {safeSubtitle && (
          <div style={{ display: 'flex', marginTop: subSize, fontSize: subSize, color: '#bfdbe8', lineHeight: 1.5, textAlign: 'center' }}>{safeSubtitle}</div>
        )}
      </div>
      <div style={{ position: 'absolute', bottom: Math.round(h * 0.05), display: 'flex', fontSize: Math.round(subSize * 0.8), fontWeight: 700, color: MINT }}>
        {DEFAULT_CLINIC_PROFILE.name}
      </div>
    </div>,
    w,
    h,
  )
}

// ── AI画像（写真）＋見出し ─────────────────────────────────────────

/** AI画像の写真として読み込んでよいURL（自分たちの Vercel Blob に置いたものだけ） */
export function isAllowedPhotoUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname.endsWith('.public.blob.vercel-storage.com')
  } catch {
    return false
  }
}

const MAX_PHOTO_BYTES = 10 * 1024 * 1024

/** 写真を読み込んで data URL にする（next/og の画像の中に描くため） */
export async function loadPhotoDataUrl(url: string): Promise<string> {
  if (!isAllowedPhotoUrl(url)) throw new Error('AI画像の置き場所が正しくありません')
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`AI画像を読み込めませんでした（HTTP ${res.status}）`)
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim()
  if (!/^image\/(png|jpeg|webp)$/.test(type)) throw new Error(`AI画像の形式が正しくありません（${type || '不明'}）`)
  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.length > MAX_PHOTO_BYTES) throw new Error('AI画像が大きすぎます')
  return `data:${type};base64,${bytes.toString('base64')}`
}

/**
 * AI画像（文字なしの写真）に、見出し・院名・「画像はイメージです」を重ねた投稿画像PNG。
 * 写真は媒体の大きさに合わせて切り抜く（中央）。下の方を紺のグラデーションにして文字を読みやすくする
 */
export async function renderPhotoPostImage(
  photoDataUrl: string,
  title: string,
  subtitle: string,
  sizeKey: keyof typeof IMAGE_SIZES = 'instagram',
): Promise<Buffer> {
  const { w, h } = IMAGE_SIZES[sizeKey] ?? IMAGE_SIZES.instagram
  const safeTitle = title.slice(0, 50)
  const safeSubtitle = subtitle.slice(0, 50)
  const base = Math.min(w / 14, h / 11)
  const titleSize = Math.round(base * (safeTitle.length > 32 ? 0.72 : safeTitle.length > 20 ? 0.84 : 1))
  const subSize = Math.round(base * 0.42)
  const pad = Math.round(Math.min(w, h) * 0.07)
  const shadow = '0 2px 12px rgba(0,0,0,0.45)'
  return render(
    <div style={{ width: w, height: h, display: 'flex', position: 'relative', background: NAVY, fontFamily: FONT, color: '#ffffff' }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og（Satori）で描く画像の中 */}
      <img src={photoDataUrl} width={w} height={h} alt="" style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, objectFit: 'cover' }} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: w,
          height: Math.round(h * 0.62),
          display: 'flex',
          background: 'linear-gradient(180deg, rgba(22,35,61,0) 0%, rgba(22,35,61,0.72) 42%, rgba(22,35,61,0.94) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: Math.round(pad * 0.6),
          right: Math.round(pad * 0.6),
          display: 'flex',
          padding: `${Math.round(subSize * 0.25)}px ${Math.round(subSize * 0.6)}px`,
          borderRadius: 999,
          background: 'rgba(22,35,61,0.55)',
          fontSize: Math.round(subSize * 0.62),
          color: '#e2e8f0',
        }}
      >
        画像はイメージです
      </div>
      <div
        style={{
          position: 'absolute',
          left: pad,
          right: pad,
          bottom: pad,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', width: Math.round(w * 0.06), height: 6, background: MINT, marginBottom: Math.round(titleSize * 0.4) }} />
        <div style={{ display: 'flex', fontSize: titleSize, fontWeight: 700, lineHeight: 1.3, textShadow: shadow }}>{safeTitle}</div>
        {safeSubtitle && (
          <div style={{ display: 'flex', marginTop: Math.round(subSize * 0.6), fontSize: subSize, color: '#dbeafe', lineHeight: 1.5, textShadow: shadow }}>
            {safeSubtitle}
          </div>
        )}
        <div style={{ display: 'flex', marginTop: Math.round(subSize * 0.9), fontSize: Math.round(subSize * 0.8), fontWeight: 700, color: MINT }}>
          {DEFAULT_CLINIC_PROFILE.name}
        </div>
      </div>
    </div>,
    w,
    h,
  )
}

// ── Instagramストーリー（予約の空き状況） ─────────────────────────────

/** 画像のなかの短い表示（文字が折り返さないように） */
const PILL_LABELS: Record<StoryLevel, string> = { ...STORY_LEVEL_LABELS, full: 'いっぱい' }

const LEVEL_STYLE: Record<StoryLevel, { bg: string; fg: string }> = {
  many: { bg: '#14b8a6', fg: '#ffffff' },
  few: { bg: '#fbbf24', fg: '#1f2937' },
  full: { bg: 'rgba(255,255,255,0.14)', fg: '#cbd5e1' },
  closed: { bg: 'rgba(255,255,255,0.08)', fg: '#94a3b8' },
}

function Pill({ level, size }: { level: StoryLevel; size: number }) {
  const s = LEVEL_STYLE[level]
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${Math.round(size * 0.35)}px ${Math.round(size * 0.7)}px`,
        borderRadius: 999,
        background: s.bg,
        color: s.fg,
        fontSize: size,
        fontWeight: 700,
      }}
    >
      {PILL_LABELS[level]}
    </div>
  )
}

export interface StoryImageInput {
  title: string
  /** 例：'10/26（月） 8:00 時点' */
  asOfLabel: string
  scope: 'day' | 'week'
  rows: StoryRow[]
  /** 院長のひとこと（最大40文字） */
  note?: string
  /** 時間ごとの残り枠の数を出すか（既定は出す） */
  showRemaining?: boolean
  /** ネット予約のQR（PNGのdata URL）。cta が 'qr' のときだけ描く */
  qrDataUrl?: string
  /**
   * 予約への入り口の書き方。
   * sticker … Instagramアプリで「リンク」のスタンプを付けて出す（押せる。既定）
   * profile … アプリから自動で出す（APIではスタンプを付けられないので、プロフィールのリンクへ案内）
   * qr      … QRを描く（ストーリーではスマホで見ている人は読めないので、印刷物などの用途だけ）
   */
  cta?: 'sticker' | 'profile' | 'qr'
}

/** 時間ごとの枠（「15:30 残り2」）。午前・午後に分けて並べる */
function SlotGrid({ row, showRemaining }: { row: StoryRow; showRemaining: boolean }) {
  const slots = row.slots ?? []
  // 時間が多い日は5列・小さめにして、下のQR・電話番号にかからないようにする
  const many = slots.length > 10
  const groups: Array<{ label: string; items: typeof slots }> = [
    { label: '午前', items: slots.filter((s) => s.time < '13:00') },
    { label: '午後', items: slots.filter((s) => s.time >= '13:00') },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: many ? 12 : 24 }}>
      {groups.map((g) => (
        <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: many ? 8 : 12 }}>
          <div style={{ display: 'flex', fontSize: many ? 30 : 36, fontWeight: 700, color: '#bfdbe8' }}>{g.label}</div>
          {g.items.length === 0 ? (
            <div style={{ display: 'flex' }}>
              <Pill level={row.closed ? 'closed' : 'full'} size={34} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: many ? 10 : 14 }}>
              {g.items.map((s) => (
                <div
                  key={s.time}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: many ? 170 : 207,
                    padding: many ? '8px 0' : '16px 0',
                    borderRadius: many ? 18 : 22,
                    background: s.remaining <= 1 ? 'rgba(251,191,36,0.18)' : 'rgba(20,184,166,0.2)',
                    border: `3px solid ${s.remaining <= 1 ? '#fbbf24' : '#14b8a6'}`,
                  }}
                >
                  <div style={{ display: 'flex', fontSize: many ? 38 : 46, fontWeight: 700 }}>{s.time}</div>
                  <div style={{ display: 'flex', fontSize: many ? 22 : 28, color: s.remaining <= 1 ? '#fde68a' : '#99f6e4' }}>
                    {showRemaining ? `残り${s.remaining}枠` : s.remaining <= 1 ? 'あと少し' : '空きあり'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * ストーリー画像（1080×1920）。Instagramの上下の帯（約250px）に文字がかからないよう、内側に寄せる。
 * 1日分で時間が取れたときは「時間と残り枠」、それ以外は「空きあり／少しあり／いっぱい」で見せる。
 * 下にネット予約のQR・電話番号・住所。
 */
export async function renderStoryImage(input: StoryImageInput): Promise<Buffer> {
  const cta = input.cta ?? 'sticker'
  const { w, h } = IMAGE_SIZES.story
  const p = DEFAULT_CLINIC_PROFILE
  const single = input.scope === 'day' && input.rows.length === 1 ? input.rows[0] : null
  const withSlots = single && single.slots !== undefined && !single.closed
  const showRemaining = input.showRemaining !== false
  // 縮まないように（上から順に積む。日が多い週は文字を少し小さく）
  const fixed = { display: 'flex', flexShrink: 0 } as const
  const many = input.rows.length >= 5
  return render(
    <div
      style={{
        width: w,
        height: h,
        display: 'flex',
        flexDirection: 'column',
        padding: '220px 84px 260px',
        background: `linear-gradient(165deg, ${NAVY} 0%, ${NAVY_2} 100%)`,
        fontFamily: FONT,
        color: '#ffffff',
      }}
    >
      <div style={{ ...fixed, fontSize: 28, fontWeight: 700, letterSpacing: 6, color: MINT }}>YUUKI SEIKOTSU-IN</div>
      <div style={{ ...fixed, fontSize: 42, fontWeight: 700, marginTop: 6 }}>{p.name}</div>
      <div style={{ ...fixed, fontSize: single ? (withSlots ? 80 : 96) : 72, fontWeight: 700, marginTop: withSlots ? 36 : single ? 70 : 50, lineHeight: 1.2 }}>{input.title}</div>
      <div style={{ ...fixed, fontSize: 32, color: '#bfdbe8', marginTop: 10 }}>{input.asOfLabel}</div>
      {input.note && (
        <div style={{ ...fixed, marginTop: 24, padding: '18px 26px', borderRadius: 24, background: 'rgba(94,234,212,0.14)', border: `2px solid ${MINT}`, fontSize: 34, fontWeight: 700, color: '#ccfbf1' }}>
          {input.note}
        </div>
      )}

      {withSlots ? (
        <div style={{ ...fixed, flexDirection: 'column', marginTop: 28, gap: 14 }}>
          <div style={{ display: 'flex', fontSize: 46, fontWeight: 700 }}>{single!.label}</div>
          <SlotGrid row={single!} showRemaining={showRemaining} />
        </div>
      ) : single ? (
        <div style={{ ...fixed, flexDirection: 'column', marginTop: 60, gap: 34 }}>
          <div style={{ display: 'flex', fontSize: 56, fontWeight: 700 }}>{single.label}</div>
          {(['am', 'pm'] as const).map((half) => (
            <div
              key={half}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '40px 44px',
                borderRadius: 36,
                background: 'rgba(255,255,255,0.07)',
              }}
            >
              <div style={{ display: 'flex', fontSize: 58, fontWeight: 700 }}>{half === 'am' ? '午前' : '午後'}</div>
              <Pill level={single[half]} size={52} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...fixed, flexDirection: 'column', marginTop: 44, gap: many ? 14 : 20 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, paddingRight: 26, fontSize: 28, color: '#bfdbe8' }}>
            <div style={{ display: 'flex', width: 220, justifyContent: 'center' }}>午前</div>
            <div style={{ display: 'flex', width: 220, justifyContent: 'center' }}>午後</div>
          </div>
          {input.rows.map((r) => (
            <div
              key={r.date}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: many ? '18px 26px' : '24px 26px',
                borderRadius: 26,
                background: 'rgba(255,255,255,0.07)',
              }}
            >
              <div style={{ display: 'flex', fontSize: many ? 40 : 44, fontWeight: 700 }}>{r.label}</div>
              {r.closed ? (
                <div style={{ display: 'flex', width: 460, justifyContent: 'center' }}>
                  <Pill level="closed" size={30} />
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 20 }}>
                  {(['am', 'pm'] as const).map((half) => {
                    const count = showRemaining && r.slots
                      ? r.slots.filter((s) => (half === 'am' ? s.time < '13:00' : s.time >= '13:00')).reduce((n, s) => n + s.remaining, 0)
                      : 0
                    return (
                      <div key={half} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 220, gap: 4 }}>
                        <Pill level={r[half]} size={30} />
                        {count > 0 && <div style={{ display: 'flex', fontSize: 22, color: '#bfdbe8' }}>{`残り${count}枠`}</div>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ ...fixed, marginTop: 'auto', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', fontSize: 46, fontWeight: 700, color: MINT }}>ネット予約は24時間受付</div>
          <div style={{ display: 'flex', fontSize: 30 }}>
            {cta === 'qr' && input.qrDataUrl
              ? 'QRから、その場で予約が確定します'
              : cta === 'profile'
                ? 'プロフィールのリンクから、その場で予約が確定します'
                : 'リンクを押すと、その場で予約が確定します'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 10 }}>
            <div style={{ display: 'flex', fontSize: 30, color: '#bfdbe8' }}>お電話</div>
            <div style={{ display: 'flex', fontSize: 50, fontWeight: 700, letterSpacing: 2 }}>{p.phone}</div>
          </div>
          <div style={{ display: 'flex', fontSize: 28, color: '#bfdbe8' }}>{p.address.replace(/^山口県/, '')}（駐車場あり）</div>
          <div style={{ display: 'flex', fontSize: 24, color: '#94a3b8', marginTop: 4 }}>（空き状況は変わることがあります）</div>
        </div>
        {cta === 'qr' && input.qrDataUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{ display: 'flex', padding: 12, borderRadius: 24, background: '#ffffff' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- next/og（Satori）で描く画像の中 */}
              <img src={input.qrDataUrl} width={232} height={232} alt="" />
            </div>
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, color: MINT }}>ネット予約</div>
          </div>
        )}
      </div>
    </div>,
    w,
    h,
  )
}
