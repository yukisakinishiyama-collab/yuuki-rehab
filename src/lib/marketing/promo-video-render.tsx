/**
 * 宣伝の短い動画（YouTubeショート・TikTok）を組み立てる（サーバー専用）
 *
 * 縦 1080×1920・約16秒・音なし（無音の音声トラックつき）の mp4。
 * - 上（y 220〜730）に文字、下（y 760〜）に院の写真。アプリの画面では、いちばん上（検索など）と
 *   下・右（説明・いいねのボタン）に部品が重なるので、読ませる文字は上の面だけに置く
 * - 文字の面は next/og（Satori）で透明の PNG にし、ゆっくり寄る写真の上に ffmpeg で重ねる（文字は動かさない）
 * - 場面は5つ（src/data/promo-videos.ts の promoScenes）。場面のあいだは 0.5 秒で切りかえる
 * - 絵は、前半がAIで作ったイメージ（呼び出し側が中身を渡す。画面に「映像はイメージです」と出す）、
 *   後半が人物の写っていない院の写真（assets/gbp-photos）。AIの絵が無い場面は、その場面の院の写真で代える
 * ffmpeg は ffmpeg-static（next.config の outputFileTracingIncludes で同梱する）。
 */
import type { PromoScene, PromoVideo } from '@/data/promo-videos'
import { PROMO_CLINIC, promoScenes, promoTextWidth } from '@/data/promo-videos'
import { loadClinicPhoto, render } from './image-template'

export const PROMO_W = 1080
export const PROMO_H = 1920
const TEXT_TOP = 220
const PHOTO_TOP = 760
const PHOTO_H = PROMO_H - PHOTO_TOP
const SCENE_SECONDS = 3.6
const FADE_SECONDS = 0.5
const FPS = 30

const NAVY = '#16233d'
const MINT = '#5eead4'
const ORANGE = '#ea580c'
const FONT = 'Zen Kaku Gothic New'

export function promoVideoSeconds(scenes: number): number {
  return Math.round((SCENE_SECONDS * scenes - FADE_SECONDS * (scenes - 1)) * 10) / 10
}

// ── 文字の面 ─────────────────────────────────

function Brand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', fontSize: 32, fontWeight: 700, color: MINT }}>
      {PROMO_CLINIC.name}
      <div style={{ display: 'flex', width: 2, height: 28, background: 'rgba(94,234,212,0.6)', margin: '0 16px' }} />
      <div style={{ display: 'flex', color: '#cbd5e1', fontWeight: 400 }}>下関市彦島</div>
    </div>
  )
}

function Label({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginTop: 26 }}>
      <div style={{ display: 'flex', width: 10, height: 50, background: ORANGE, borderRadius: 4, marginRight: 18 }} />
      <div style={{ display: 'flex', fontSize: 46, fontWeight: 700, color: '#fed7aa' }}>{text}</div>
    </div>
  )
}

function SceneText({ scene }: { scene: PromoScene }) {
  switch (scene.kind) {
    case 'hook': {
      // 見出しは切れ目のよいところで分けた1〜2行（src/data/promo-videos.ts の headline）。短ければ大きく
      const longest = Math.max(...scene.titleLines.map(promoTextWidth))
      const size = longest <= 11 ? 84 : 74
      return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex' }}>
            <div style={{ display: 'flex', padding: '10px 30px', borderRadius: 999, background: ORANGE, fontSize: 40, fontWeight: 700 }}>{scene.area}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 30 }}>
            {scene.titleLines.map((line, i) => (
              <div key={i} style={{ display: 'flex', fontSize: size, fontWeight: 700, lineHeight: 1.28 }}>
                {line}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', width: 80, height: 7, background: MINT, marginTop: 26 }} />
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 22 }}>
            {scene.subtitleLines.map((line, i) => (
              <div key={i} style={{ display: 'flex', fontSize: 42, lineHeight: 1.45, color: '#dbeafe' }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      )
    }
    case 'worry':
      return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Brand />
          <Label text={scene.label} />
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 34 }}>
            {scene.lines.map((line, i) => (
              <div key={i} style={{ display: 'flex', fontSize: 62, fontWeight: 700, lineHeight: 1.5 }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      )
    case 'points':
      return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Brand />
          <Label text={scene.label} />
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 26 }}>
            {scene.lines.map((line, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', marginTop: 18 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 62,
                    height: 62,
                    borderRadius: 31,
                    background: MINT,
                    color: NAVY,
                    fontSize: 38,
                    fontWeight: 700,
                    marginRight: 20,
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ display: 'flex', fontSize: 50, fontWeight: 700 }}>{line}</div>
              </div>
            ))}
          </div>
        </div>
      )
    case 'strengths':
      return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Brand />
          <Label text={scene.label} />
          <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 30 }}>
            {scene.chips.slice(0, 4).map((chip) => (
              <div
                key={chip}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 464,
                  height: 112,
                  marginRight: 12,
                  marginBottom: 16,
                  borderRadius: 20,
                  border: '3px solid rgba(94,234,212,0.9)',
                  background: 'rgba(94,234,212,0.10)',
                  fontSize: 42,
                  fontWeight: 700,
                  color: '#ccfbf1',
                }}
              >
                {chip}
              </div>
            ))}
          </div>
        </div>
      )
    case 'cta':
      return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', fontSize: 88, fontWeight: 700, color: MINT, lineHeight: 1.1 }}>{scene.name}</div>
          </div>
          <div style={{ display: 'flex', marginTop: 10, fontSize: 38, color: '#cbd5e1' }}>{scene.address}</div>
          <div style={{ display: 'flex', marginTop: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 34px', borderRadius: 999, background: '#ffffff', color: NAVY, fontSize: 46, fontWeight: 700 }}>
              「{scene.search}」で検索
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 24 }}>
            {scene.lines.map((line, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', fontSize: 40, lineHeight: 1.5 }}>
                <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 7, background: MINT, marginRight: 16 }} />
                {line}
              </div>
            ))}
          </div>
        </div>
      )
  }
}

/** その場面に使うAIの絵（中身）。無ければ院の写真（scene.photo）を使う */
export interface PromoSceneImage {
  bytes: Buffer
  type: 'image/png' | 'image/jpeg'
}

/**
 * 1場面の文字の面（透明の PNG）。withPhoto なら絵も入れた1枚（見本・サムネイル用）。
 * aiImage があればAIの絵として扱い、「映像はイメージです」を出す
 */
export async function renderPromoFrame(scene: PromoScene, index: number, total: number, withPhoto = false, aiImage?: PromoSceneImage | null): Promise<Buffer> {
  const photo = !withPhoto ? null : aiImage ? `data:${aiImage.type};base64,${aiImage.bytes.toString('base64')}` : await loadClinicPhoto(scene.photo)
  const position = aiImage ? '50% 50%' : (scene.position ?? '50% 50%')
  return render(
    <div style={{ width: PROMO_W, height: PROMO_H, display: 'flex', position: 'relative', fontFamily: FONT, color: '#ffffff' }}>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- next/og（Satori）で描く画像の中
        <img
          src={photo}
          width={PROMO_W}
          height={PHOTO_H}
          alt=""
          style={{ position: 'absolute', left: 0, top: PHOTO_TOP, width: PROMO_W, height: PHOTO_H, objectFit: 'cover', objectPosition: position }}
        />
      )}
      <div style={{ position: 'absolute', left: 0, top: 0, width: PROMO_W, height: PHOTO_TOP, display: 'flex', background: NAVY }} />
      {/* 写真との境目をなじませる */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: PHOTO_TOP,
          width: PROMO_W,
          height: 200,
          display: 'flex',
          background: 'linear-gradient(180deg, rgba(22,35,61,1) 0%, rgba(22,35,61,0.55) 45%, rgba(22,35,61,0) 100%)',
        }}
      />
      {/* 下はアプリの説明・ボタンが重なるので、少し暗くしておく */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: PROMO_H - 460,
          width: PROMO_W,
          height: 460,
          display: 'flex',
          background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 100%)',
        }}
      />
      <div style={{ position: 'absolute', left: 64, top: TEXT_TOP, width: PROMO_W - 128, height: PHOTO_TOP - TEXT_TOP - 44, display: 'flex', flexDirection: 'column' }}>
        <SceneText scene={scene} />
      </div>
      {aiImage && (
        <div
          style={{
            position: 'absolute',
            left: 64,
            top: PHOTO_TOP + 150,
            display: 'flex',
            padding: '6px 18px',
            borderRadius: 999,
            background: 'rgba(22,35,61,0.62)',
            fontSize: 26,
            color: '#e2e8f0',
          }}
        >
          映像はイメージです
        </div>
      )}
      {/* いま何場面めか */}
      <div style={{ position: 'absolute', left: 64, top: PHOTO_TOP - 30, display: 'flex' }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{ display: 'flex', width: i === index ? 64 : 28, height: 8, borderRadius: 4, marginRight: 10, background: i === index ? MINT : 'rgba(255,255,255,0.28)' }} />
        ))}
      </div>
    </div>,
    PROMO_W,
    PROMO_H,
  )
}

/** 見本・サムネイル（その場面を絵つきで1枚に）。aiImage はその場面のAIの絵（あれば） */
export async function renderPromoPoster(video: PromoVideo, sceneIndex = 0, aiImage?: PromoSceneImage | null): Promise<Buffer> {
  const scenes = promoScenes(video)
  const i = Math.min(Math.max(sceneIndex, 0), scenes.length - 1)
  return renderPromoFrame(scenes[i], i, scenes.length, true, aiImage)
}

// ── 動画 ─────────────────────────────────────

/** CSS の object-position（'50% 35%'）→ 切り抜きの位置（0〜1） */
function positionOf(position?: string): { x: number; y: number } {
  const m = /^\s*(\d{1,3})%\s+(\d{1,3})%\s*$/.exec(position ?? '')
  const clamp = (n: number) => Math.min(Math.max(n, 0), 100) / 100
  return m ? { x: clamp(Number(m[1])), y: clamp(Number(m[2])) } : { x: 0.5, y: 0.5 }
}

/** ffmpeg の組み立ての指示（テストでも見られるように分けておく） */
export function promoFilterGraph(scenes: Array<{ position?: string }>): { graph: string; out: string } {
  const frames = Math.round(SCENE_SECONDS * FPS)
  // 写真は出来上がりの2倍の大きさにしてから寄る（寄るときの細かい揺れを目立たなくする）
  const bw = PROMO_W * 2
  const bh = PHOTO_H * 2
  const parts: string[] = []
  scenes.forEach((scene, i) => {
    const pos = positionOf(scene.position)
    // 交互に、寄る／引く
    const zoom = i % 2 === 0 ? `min(1+0.0008*on,1.09)` : `max(1.09-0.0008*on,1.0)`
    parts.push(
      `[${i * 2}:v]scale=${bw}:${bh}:force_original_aspect_ratio=increase,crop=${bw}:${bh}:(iw-${bw})*${pos.x.toFixed(2)}:(ih-${bh})*${pos.y.toFixed(2)},` +
        `zoompan=z='${zoom}':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${PROMO_W}x${PHOTO_H}:fps=${FPS},setsar=1[ph${i}]`,
    )
    parts.push(`color=c=0x16233d:s=${PROMO_W}x${PROMO_H}:r=${FPS}:d=${SCENE_SECONDS}[bg${i}]`)
    parts.push(`[bg${i}][ph${i}]overlay=0:${PHOTO_TOP}:shortest=1[b${i}]`)
    parts.push(`[b${i}][${i * 2 + 1}:v]overlay=0:0:format=auto,format=yuv420p,setsar=1[s${i}]`)
  })
  let last = 's0'
  for (let i = 1; i < scenes.length; i++) {
    const offset = (SCENE_SECONDS - FADE_SECONDS) * i
    const out = i === scenes.length - 1 ? 'vout' : `x${i}`
    parts.push(`[${last}][s${i}]xfade=transition=fade:duration=${FADE_SECONDS}:offset=${offset.toFixed(2)}[${out}]`)
    last = out
  }
  return { graph: parts.join(';'), out: scenes.length > 1 ? 'vout' : 's0' }
}

export interface RenderedPromoVideo {
  mp4: Buffer
  /** 1場面めの絵（PNG）。LINE の動画の見本・YouTube のサムネイルに使う */
  poster: Buffer
  seconds: number
}

/**
 * 1本組み立てる（サーバーで20〜60秒ほど）。
 * images[i] があれば、その場面はAIの絵（中身）を使う。無ければ院の写真
 */
export async function renderPromoVideo(video: PromoVideo, images: Array<PromoSceneImage | null | undefined> = []): Promise<RenderedPromoVideo> {
  const scenes = promoScenes(video)
  const [{ default: ffmpegPath }, { spawn }, fs, path, os] = await Promise.all([
    import('ffmpeg-static'),
    import('node:child_process'),
    import('node:fs/promises'),
    import('node:path'),
    import('node:os'),
  ])
  if (!ffmpegPath) throw new Error('動画を組み立てる道具（ffmpeg）が見つかりません')
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'promo-'))
  try {
    const inputs: string[] = []
    for (const [i, scene] of scenes.entries()) {
      if (!/^[a-z0-9-]+$/.test(scene.photo)) throw new Error('写真の名前が正しくありません')
      const ai = images[i] ?? null
      const overlay = path.join(dir, `ov${i}.png`)
      await fs.writeFile(overlay, await renderPromoFrame(scene, i, scenes.length, false, ai))
      if (ai) {
        const file = path.join(dir, `ai${i}.${ai.type === 'image/jpeg' ? 'jpg' : 'png'}`)
        await fs.writeFile(file, ai.bytes)
        inputs.push('-i', file)
      } else {
        inputs.push('-i', path.join(process.cwd(), 'assets/gbp-photos', `${scene.photo}.jpg`))
      }
      inputs.push('-loop', '1', '-t', String(SCENE_SECONDS), '-i', overlay)
    }
    const seconds = promoVideoSeconds(scenes.length)
    // AIの絵は真ん中で切り抜く（院の写真は場面ごとの位置で）
    const { graph, out } = promoFilterGraph(scenes.map((scene, i) => ({ position: images[i] ? undefined : scene.position })))
    const outFile = path.join(dir, 'out.mp4')
    const args = [
      '-hide_banner', '-loglevel', 'error', '-y',
      ...inputs,
      // 無音の音声トラック（音のない動画を受け付けない・扱いにくいアプリがあるため）
      '-f', 'lavfi', '-t', String(seconds), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-filter_complex', graph,
      '-map', `[${out}]`, '-map', `${scenes.length * 2}:a`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-c:a', 'aac', '-b:a', '96k',
      '-t', String(seconds),
      '-movflags', '+faststart',
      outFile,
    ]
    await new Promise<void>((resolve, reject) => {
      const p = spawn(ffmpegPath, args)
      let err = ''
      p.stderr.on('data', (d) => (err += String(d)))
      p.on('error', reject)
      p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`動画の組み立てに失敗しました（${err.slice(-400) || code}）`))))
    })
    return { mp4: await fs.readFile(outFile), poster: await renderPromoFrame(scenes[0], 0, scenes.length, true, images[0] ?? null), seconds }
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
