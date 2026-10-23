/**
 * 投稿画像の生成（共通モジュール・サーバー専用）
 *
 * - テンプレート画像（Instagramフィード・Google投稿）… /api/marketing/image（プレビュー・ダウンロード）と publishers.ts から
 * - Instagramストーリーの空き状況 … publishers.ts（投稿する時刻に空きを取り直して作る）と /api/marketing/image?kind=story から
 *
 * サーバー（Vercel）には日本語のフォントが入っていないので、assets/fonts の Zen Kaku Gothic New を読み込んで
 * next/og（Satori）で描く（以前の SVG＋sharp だと、サーバーでは日本語が□になるおそれがあった）。
 * ネイビーのブランド色。Instagram に渡すときは JPEG に直す（toJpeg）。
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import sharp from 'sharp'
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

/** PNG → JPEG（InstagramのAPIは JPEG の画像を受け付ける） */
export async function toJpeg(png: Buffer): Promise<Buffer> {
  return sharp(png).jpeg({ quality: 90, mozjpeg: true }).toBuffer()
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
}

/**
 * ストーリー画像（1080×1920）。Instagramの上下の帯（約250px）に文字がかからないよう、内側に寄せる。
 * 枠の数そのものは出さず、「空きあり／少しあり／ご予約いっぱい」で見せる。
 */
export async function renderStoryImage(input: StoryImageInput): Promise<Buffer> {
  const { w, h } = IMAGE_SIZES.story
  const p = DEFAULT_CLINIC_PROFILE
  const single = input.scope === 'day' && input.rows.length === 1 ? input.rows[0] : null
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
        padding: '230px 84px 270px',
        background: `linear-gradient(165deg, ${NAVY} 0%, ${NAVY_2} 100%)`,
        fontFamily: FONT,
        color: '#ffffff',
      }}
    >
      <div style={{ ...fixed, fontSize: 30, fontWeight: 700, letterSpacing: 6, color: MINT }}>YUUKI SEIKOTSU-IN</div>
      <div style={{ ...fixed, fontSize: 44, fontWeight: 700, marginTop: 8 }}>{p.name}</div>
      <div style={{ ...fixed, fontSize: single ? 96 : 72, fontWeight: 700, marginTop: single ? 70 : 50, lineHeight: 1.2 }}>{input.title}</div>
      <div style={{ ...fixed, fontSize: 34, color: '#bfdbe8', marginTop: 14 }}>{input.asOfLabel}</div>

      {single ? (
        <div style={{ ...fixed, flexDirection: 'column', marginTop: 70, gap: 34 }}>
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
                  <div style={{ display: 'flex', width: 220, justifyContent: 'center' }}>
                    <Pill level={r.am} size={30} />
                  </div>
                  <div style={{ display: 'flex', width: 220, justifyContent: 'center' }}>
                    <Pill level={r.pm} size={30} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ ...fixed, flexDirection: 'column', marginTop: 'auto', gap: 12 }}>
        <div style={{ display: 'flex', fontSize: 52, fontWeight: 700, color: MINT }}>ネット予約は24時間受付</div>
        <div style={{ display: 'flex', fontSize: 36 }}>プロフィールのリンクから、その場で予約が確定します</div>
        <div style={{ display: 'flex', fontSize: 32, color: '#bfdbe8', marginTop: 10 }}>急なケガ・強い痛みはお電話で {p.phone}</div>
        <div style={{ display: 'flex', fontSize: 26, color: '#94a3b8', marginTop: 6 }}>（空き状況は変わることがあります）</div>
      </div>
    </div>,
    w,
    h,
  )
}
