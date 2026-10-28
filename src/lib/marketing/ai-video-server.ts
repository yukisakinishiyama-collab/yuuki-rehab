/**
 * AI動画の自動作成（OpenAI の画像生成 → ゆっくり動くスライド動画）→ 動画ストックに貯める
 *
 * OpenAI の動画生成（Sora / Videos API）は 2026-09-24 で提供終了したため、
 * 画像生成（gpt-image）で同じテーマの写真を3枚作り、ゆっくりズーム＋クロスフェードでつないだ
 * 縦型（720x1280・約10秒・音なし）の mp4 にする。
 *
 * - 自動で作るのは止めている（2026-10-29）。院長のボタンで1本ずつ作れる
 *   （再開するときは jobs/run の allowAutoStart を true に。月・木の朝9時以降に1本ずつ作る）
 * - 作るのは「セルフケア・姿勢の雰囲気」と「院の雰囲気・季節の映像」だけ
 *   （顔が映らない人物・実在の人や院を名指ししない・効果をうたう表現を入れない・文字を入れない）
 * - 出来上がった動画は Vercel Blob に置き、動画ストックに「未使用・患者なし」で登録する（公開はしない）
 *
 * 必要な設定: OPENAI_API_KEY（Vercel の環境変数）。任意で OPENAI_IMAGE_MODEL（既定は gpt-image-2 → 1.5 → 1 の順に試す）
 */
import { jstParts } from './autopilot-planner'
import { listVideos, saveVideo } from './video-store-server'
import type { StockVideo } from './video-types'

const IMAGES_API = 'https://api.openai.com/v1/images/generations'
const IMAGE_SIZE = '1024x1536' // 縦 2:3（動画は 9:16 に切り抜く）
const SHOT_SECONDS = 3.6
const FADE_SECONDS = 0.6
const FPS = 30
const OUT_W = 720
const OUT_H = 1280
/** 自動で作る曜日（JST）: 月・木 */
const AUTO_WEEKDAYS = new Set([1, 4])
const AUTO_FROM_HOUR = 9
/** 作成中のまま、これ以上たったら失敗扱い（処理が途中で止まった場合） */
const STALE_MS = 15 * 60 * 1000

// 共通の注意書き（英語の方が生成の指示が通りやすい）
const COMMON =
  'Photorealistic photograph, vertical composition, soft natural light, calm and clean Japanese aesthetic, gentle muted colors. ' +
  'No text, no captions, no logos, no watermarks. ' +
  'If any person appears, their face must never be visible (shot from behind, from the side below the chin, or cropped at the neck). ' +
  'No medical procedures, no needles, no injuries, no blood.'

/** 1本の動画に使う3枚の撮り方（同じ場面を引き→寄りで） */
const SHOTS = ['Wide establishing shot of the scene.', 'Medium shot, slightly closer.', 'Close-up detail shot of the same scene.']

export interface AiVideoTheme {
  key: string
  /** 動画ストックに出すタイトル */
  title: string
  category: 'selfcare' | 'atmosphere'
  bodyPart?: string
  prompt: string
  /** 季節のテーマは、その月だけ使う */
  months?: number[]
}

export const AI_VIDEO_THEMES: AiVideoTheme[] = [
  {
    key: 'selfcare-neck',
    title: '首まわりをゆっくり伸ばすセルフケア（雰囲気）',
    category: 'selfcare',
    bodyPart: '首・肩',
    prompt: 'A person in plain comfortable clothes sitting upright on a wooden chair by a bright window, slowly tilting the head to stretch the side of the neck, relaxed breathing. Camera behind the shoulder.',
  },
  {
    key: 'selfcare-shoulder',
    title: '肩をまわして力を抜くセルフケア（雰囲気）',
    category: 'selfcare',
    bodyPart: '肩',
    prompt: 'Close-up of shoulders and upper back of a person in a light T-shirt, slowly rolling the shoulders backwards in large circles, in a calm room with plants. Camera from behind.',
  },
  {
    key: 'selfcare-back',
    title: '腰まわりをやさしくほぐすストレッチ（雰囲気）',
    category: 'selfcare',
    bodyPart: '腰',
    prompt: 'A person lying on a yoga mat on a wooden floor, gently hugging both knees to the chest and rocking slightly side to side. Camera from the feet side at a low angle, face out of frame.',
  },
  {
    key: 'selfcare-posture-desk',
    title: 'デスクワーク中の姿勢を整える（雰囲気）',
    category: 'selfcare',
    bodyPart: '背中・腰',
    prompt: 'A person at a tidy desk with a laptop, slowly sitting up from a slouched posture to an upright, relaxed posture, feet flat on the floor. Camera from the side, framed from the chin down.',
  },
  {
    key: 'selfcare-walk',
    title: '背すじを伸ばしてゆっくり歩く（雰囲気）',
    category: 'selfcare',
    bodyPart: '全身',
    prompt: 'Lower body and back of a person walking with good posture along a quiet seaside promenade in the morning, sneakers, relaxed steady pace. Camera follows from behind.',
  },
  {
    key: 'selfcare-calf',
    title: 'ふくらはぎを伸ばすストレッチ（雰囲気）',
    category: 'selfcare',
    bodyPart: '脚',
    prompt: 'Close-up of legs of a person doing a calf stretch against a wall, one leg back with heel on the floor, slow and steady, in a bright simple room.',
  },
  {
    key: 'atmosphere-room',
    title: '落ち着いた施術室の雰囲気',
    category: 'atmosphere',
    prompt: 'An empty, clean and calm treatment room with a neatly made treatment bed with white towels, wooden accents, warm sunlight through blinds, a small green plant. Slow dolly-in. No people.',
  },
  {
    key: 'atmosphere-entrance',
    title: '明るい待合の雰囲気',
    category: 'atmosphere',
    prompt: 'A bright small waiting area with a bench, a few books and a plant, soft afternoon light, gentle dust in the air, peaceful. Slow pan. No people.',
  },
  {
    key: 'atmosphere-sea',
    title: '朝の港町と海（季節を問わず）',
    category: 'atmosphere',
    prompt: 'Early morning view of a calm harbor town in western Japan, small fishing boats, gentle waves, soft sunrise colors, seagulls in the distance. Slow aerial drift. No people in focus.',
  },
  {
    key: 'season-autumn',
    title: '秋の景色（紅葉と澄んだ空）',
    category: 'atmosphere',
    months: [10, 11],
    prompt: 'Autumn maple leaves in red and orange gently falling along a quiet path near the sea, clear blue sky, soft breeze. Slow tracking shot. No people.',
  },
  {
    key: 'season-winter',
    title: '冬のあたたかい室内',
    category: 'atmosphere',
    months: [12, 1, 2],
    prompt: 'A cozy warm room in winter, steam rising from a cup of tea on a wooden table, a soft knitted blanket, cold blue light outside the window. Slow push-in. No people.',
  },
  {
    key: 'season-spring',
    title: '春の桜と海辺',
    category: 'atmosphere',
    months: [3, 4],
    prompt: 'Cherry blossom petals drifting in the wind near a calm seaside, pale pink and soft blue tones, gentle sunlight. Slow pan. No people.',
  },
  {
    key: 'season-early-summer',
    title: '初夏の緑と雨上がり',
    category: 'atmosphere',
    months: [5, 6],
    prompt: 'Fresh green leaves with raindrops after a light rain, sunlight breaking through, hydrangeas in bloom. Slow macro movement. No people.',
  },
  {
    key: 'season-summer',
    title: '夏の青い海と空',
    category: 'atmosphere',
    months: [7, 8, 9],
    prompt: 'Bright summer sea and blue sky with white clouds, gentle waves on a small beach, wind chime swaying softly. Slow pan. No people.',
  },
]

export function aiVideoConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

function imageModels(): string[] {
  const fromEnv = process.env.OPENAI_IMAGE_MODEL
  return fromEnv ? [fromEnv] : ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1']
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ''}` }
}

/** 次に作るテーマ。セルフケアと院の雰囲気を交互に、最近使ったものは避ける。季節ものはその月だけ */
export function pickTheme(existing: StockVideo[], month: number): AiVideoTheme {
  const ai = existing.filter((v) => v.ai).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  const lastCategory = AI_VIDEO_THEMES.find((t) => t.key === ai[0]?.ai?.themeKey)?.category
  const wantCategory = lastCategory === 'selfcare' ? 'atmosphere' : 'selfcare'
  const usable = AI_VIDEO_THEMES.filter((t) => !t.months || t.months.includes(month))
  const recent = new Set(ai.slice(0, 8).map((v) => v.ai?.themeKey))
  const pool = usable.filter((t) => t.category === wantCategory)
  const fresh = pool.filter((t) => !recent.has(t.key))
  // 季節ものがあれば優先（院の雰囲気の回）
  const seasonal = fresh.find((t) => t.months)
  return seasonal ?? fresh[0] ?? pool[0] ?? usable[0]
}

/** モデルが使えない（未提供・未許可）ときは次のモデルを試す */
function isModelProblem(status: number, message: string): boolean {
  return status === 404 || /model|verif|not have access|does not exist/i.test(message)
}

/** 画像を1枚作る（PNG/JPEG のバイト列）。使えたモデル名も返す */
async function generateImage(prompt: string, models: string[]): Promise<{ bytes: Buffer; model: string }> {
  let lastError = ''
  for (const model of models) {
    const res = await fetch(IMAGES_API, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, size: IMAGE_SIZE, quality: 'medium', n: 1 }),
    })
    const data = (await res.json().catch(() => ({}))) as { data?: Array<{ b64_json?: string; url?: string }>; error?: { message?: string } }
    const item = data.data?.[0]
    if (res.ok && item?.b64_json) return { bytes: Buffer.from(item.b64_json, 'base64'), model }
    if (res.ok && item?.url) {
      const img = await fetch(item.url)
      if (img.ok) return { bytes: Buffer.from(await img.arrayBuffer()), model }
    }
    lastError = data.error?.message ?? `HTTP ${res.status}`
    if (!isModelProblem(res.status, lastError)) break
  }
  throw new Error(`OpenAIで画像を作れませんでした（${lastError}）`)
}

/** 3枚の画像を、ゆっくりズーム＋クロスフェードの縦動画（mp4・音なし）にする */
async function renderSlideshow(images: Buffer[]): Promise<{ mp4: Buffer; seconds: number }> {
  const [{ default: ffmpegPath }, { spawn }, fs, path, os] = await Promise.all([
    import('ffmpeg-static'),
    import('node:child_process'),
    import('node:fs/promises'),
    import('node:path'),
    import('node:os'),
  ])
  if (!ffmpegPath) throw new Error('動画を組み立てる道具（ffmpeg）が見つかりません')
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aivideo-'))
  try {
    const inputs: string[] = []
    for (const [i, bytes] of images.entries()) {
      const file = path.join(dir, `shot${i}.img`)
      await fs.writeFile(file, bytes)
      inputs.push('-i', file)
    }
    const frames = Math.round(SHOT_SECONDS * FPS)
    const parts: string[] = []
    images.forEach((_, i) => {
      // 交互にズームイン／ズームアウトして単調にしない
      const zoom = i % 2 === 0 ? `min(1+0.0010*on,1.10)` : `max(1.10-0.0010*on,1.0)`
      parts.push(
        `[${i}:v]scale=${OUT_W * 2}:${OUT_H * 2}:force_original_aspect_ratio=increase,crop=${OUT_W * 2}:${OUT_H * 2},` +
          `zoompan=z='${zoom}':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${OUT_W}x${OUT_H}:fps=${FPS},setsar=1,format=yuv420p[v${i}]`,
      )
    })
    let last = 'v0'
    for (let i = 1; i < images.length; i++) {
      const offset = (SHOT_SECONDS - FADE_SECONDS) * i
      const out = i === images.length - 1 ? 'out' : `x${i}`
      parts.push(`[${last}][v${i}]xfade=transition=fade:duration=${FADE_SECONDS}:offset=${offset.toFixed(2)}[${out}]`)
      last = out
    }
    const outFile = path.join(dir, 'out.mp4')
    const args = [
      '-hide_banner', '-loglevel', 'error', '-y',
      ...inputs,
      '-filter_complex', parts.join(';'),
      '-map', images.length > 1 ? '[out]' : '[v0]',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-movflags', '+faststart',
      outFile,
    ]
    await new Promise<void>((resolve, reject) => {
      const p = spawn(ffmpegPath, args)
      let err = ''
      p.stderr.on('data', (d) => (err += String(d)))
      p.on('error', reject)
      p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`動画の組み立てに失敗しました（${err.slice(-300) || code}）`))))
    })
    const seconds = SHOT_SECONDS * images.length - FADE_SECONDS * (images.length - 1)
    return { mp4: await fs.readFile(outFile), seconds: Math.round(seconds * 10) / 10 }
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * 1本作る（1〜3分かかる）。先に「AIが作成中」で登録し、出来上がったら動画とサムネイルを入れる。
 * 失敗したら「AI作成に失敗」にして理由を残す（例外は投げ直す）
 */
export async function startAiVideo(trigger: 'auto' | 'manual', themeKey?: string): Promise<StockVideo> {
  if (!aiVideoConfigured()) throw new Error('OPENAI_API_KEY が未設定です（Vercel の環境変数に入れてください）')
  const now = jstParts(new Date())
  const existing = await listVideos()
  const running = existing.find((v) => v.ai?.status === 'generating' && Date.now() - Date.parse(v.ai.startedAt) < STALE_MS)
  if (running) throw new Error(`いま「${running.title}」を作成中です。終わってからもう一度押してください`)

  const theme = (themeKey && AI_VIDEO_THEMES.find((t) => t.key === themeKey)) || pickTheme(existing, now.month)
  const iso = new Date().toISOString()
  const video: StockVideo = {
    id: `v_ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: theme.title,
    url: '',
    patientPresent: false,
    // 実在の人物が映らないAI映像なので、本人の掲載許可は要らない（「許可なし」の赤札にしない）
    permission: 'granted',
    format: 'mp4',
    resolution: `${OUT_W}x${OUT_H}`,
    orientation: 'portrait',
    bodyPart: theme.bodyPart,
    theme: theme.category === 'selfcare' ? 'セルフケア・姿勢' : '院の雰囲気・季節',
    channels: [],
    publishState: 'unused',
    memo: 'AI（OpenAIの画像）で作ったスライド動画です。実在の患者・院内の様子ではありません。音はないので、使うときは文字や音楽を重ねてください。効果をうたう表現は避けてください。',
    ai: {
      provider: 'openai',
      model: imageModels()[0],
      kind: 'image-slideshow',
      themeKey: theme.key,
      prompt: `${theme.prompt} ${COMMON}`,
      status: 'generating',
      startedDate: now.date,
      startedAt: iso,
      trigger,
    },
    createdAt: iso,
    updatedAt: iso,
  }
  await saveVideo(video)
  const ai = video.ai!

  try {
    // 1枚目で使えるモデルを決めてから、残り2枚を同じモデルで同時に作る
    const first = await generateImage(`${theme.prompt} ${SHOTS[0]} ${COMMON}`, imageModels())
    const rest = await Promise.all(SHOTS.slice(1).map((shot) => generateImage(`${theme.prompt} ${shot} ${COMMON}`, [first.model])))
    const images = [first.bytes, ...rest.map((r) => r.bytes)]
    ai.model = first.model
    ai.images = images.length

    const { mp4, seconds } = await renderSlideshow(images)
    const { put } = await import('@vercel/blob')
    video.url = (await put(`marketing/videos/ai-${video.id}.mp4`, mp4, { access: 'public', contentType: 'video/mp4' })).url
    video.thumbUrl = (await put(`marketing/videos/ai-${video.id}-thumb.png`, images[0], { access: 'public', contentType: 'image/png' })).url
    video.durationSec = seconds
    ai.status = 'ready'
    ai.error = undefined
    await saveVideo(video)
    return video
  } catch (error) {
    ai.status = 'failed'
    ai.error = (error instanceof Error ? error.message : String(error)).slice(0, 300)
    await saveVideo(video).catch(() => {})
    throw error
  }
}

export interface AiVideoTickResult {
  configured: boolean
  started?: string
  failed: number
  error?: string
}

/**
 * 定期実行から呼ぶ: 途中で止まった作成中のものを失敗扱いにし、月・木の朝ならその日の1本を作る。
 * 失敗しても投稿ジョブの処理は止めない（呼び出し側で握りつぶしてよい）
 */
export async function tickAiVideos(options: { allowAutoStart: boolean }): Promise<AiVideoTickResult> {
  const result: AiVideoTickResult = { configured: aiVideoConfigured(), failed: 0 }
  if (!result.configured) return result

  const videos = await listVideos()
  for (const v of videos) {
    if (v.ai?.status === 'generating' && Date.now() - Date.parse(v.ai.startedAt) > STALE_MS) {
      v.ai.status = 'failed'
      v.ai.error = '作成の途中で止まりました（時間切れ）'
      await saveVideo(v).catch(() => {})
      result.failed++
    }
  }

  if (options.allowAutoStart) {
    const now = jstParts(new Date())
    const doneToday = videos.some((v) => v.ai?.trigger === 'auto' && v.ai.startedDate === now.date)
    if (AUTO_WEEKDAYS.has(now.weekday) && now.hour >= AUTO_FROM_HOUR && !doneToday) {
      try {
        result.started = (await startAiVideo('auto')).title
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error)
      }
    }
  }
  return result
}
