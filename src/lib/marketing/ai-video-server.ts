/**
 * AI動画の自動作成（OpenAI の動画生成 API = Sora）→ 動画ストックに貯める
 *
 * - 週2本（月曜・木曜の朝9時以降、その日まだ作っていなければ1本）。院長のボタンでも1本作れる
 * - 作るのは「セルフケア・姿勢の雰囲気」と「院の雰囲気・季節の映像」だけ
 *   （顔が映らない人物・実在の人や院を名指ししない・効果をうたう表現を入れない・文字を入れない）
 * - 動画の生成には数分かかるので、「作り始める」と「出来上がりを取りに行く」を分ける。
 *   取りに行くのは15分ごとの定期実行（/api/marketing/jobs/run）と、動画ストック画面を開いたとき
 * - 出来上がった動画は Vercel Blob に置き、動画ストックに「未使用・患者なし」で登録する（公開はしない）
 *
 * 必要な設定: OPENAI_API_KEY（Vercel の環境変数）。任意で OPENAI_VIDEO_MODEL（既定 sora-2）
 */
import { jstParts } from './autopilot-planner'
import { listVideos, saveVideo } from './video-store-server'
import type { StockVideo } from './video-types'

const API = 'https://api.openai.com/v1/videos'
const SECONDS = '8'
const SIZE = '720x1280' // 縦型（リール・ストーリー向け）
/** 自動で作る曜日（JST）: 月・木 */
const AUTO_WEEKDAYS = new Set([1, 4])
const AUTO_FROM_HOUR = 9
/** これ以上たっても出来上がらなければ失敗扱い */
const GIVE_UP_MS = 3 * 60 * 60 * 1000

// 共通の注意書き（英語の方が生成の指示が通りやすい）
const COMMON =
  'Vertical 9:16 video, soft natural light, calm and clean Japanese aesthetic, slow gentle camera movement. ' +
  'No text, no captions, no logos, no watermarks. ' +
  'If any person appears, their face must never be visible (shot from behind, from the side below the chin, or cropped at the neck). ' +
  'No medical procedures, no needles, no injuries, no blood.'

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

function model(): string {
  return process.env.OPENAI_VIDEO_MODEL || 'sora-2'
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

/** 1本作り始める（動画ストックに「AIが作成中」で登録） */
export async function startAiVideo(trigger: 'auto' | 'manual', themeKey?: string): Promise<StockVideo> {
  if (!aiVideoConfigured()) throw new Error('OPENAI_API_KEY が未設定です（Vercel の環境変数に入れてください）')
  const now = jstParts(new Date())
  const existing = await listVideos()
  const theme = (themeKey && AI_VIDEO_THEMES.find((t) => t.key === themeKey)) || pickTheme(existing, now.month)
  const prompt = `${theme.prompt} ${COMMON}`

  const res = await fetch(API, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model(), prompt, seconds: SECONDS, size: SIZE }),
  })
  const data = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } }
  if (!res.ok || !data.id) throw new Error(`OpenAIの動画生成を始められませんでした（${data.error?.message ?? `HTTP ${res.status}`}）`)

  const iso = new Date().toISOString()
  const video: StockVideo = {
    id: `v_ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: theme.title,
    url: '',
    patientPresent: false,
    // 実在の人物が映らないAI映像なので、本人の掲載許可は要らない（「許可なし」の赤札にしない）
    permission: 'granted',
    durationSec: Number(SECONDS),
    format: 'mp4',
    resolution: SIZE,
    orientation: 'portrait',
    bodyPart: theme.bodyPart,
    theme: theme.category === 'selfcare' ? 'セルフケア・姿勢' : '院の雰囲気・季節',
    channels: [],
    publishState: 'unused',
    memo: 'AI（OpenAI）で作った映像です。実在の患者・院内の様子ではありません。使うときは文字や音を重ねて、効果をうたう表現は避けてください。',
    ai: {
      provider: 'openai',
      model: model(),
      openaiId: data.id,
      themeKey: theme.key,
      prompt,
      status: 'generating',
      startedDate: now.date,
      startedAt: iso,
      trigger,
    },
    createdAt: iso,
    updatedAt: iso,
  }
  await saveVideo(video)
  return video
}

/** 作成中の動画を見に行き、出来上がっていれば Blob に置いてストックを更新する */
async function collect(video: StockVideo): Promise<'ready' | 'failed' | 'waiting'> {
  const ai = video.ai
  if (!ai || ai.status !== 'generating') return 'waiting'
  const res = await fetch(`${API}/${ai.openaiId}`, { headers: authHeaders() })
  const data = (await res.json().catch(() => ({}))) as { status?: string; error?: { message?: string } }

  const fail = async (message: string) => {
    ai.status = 'failed'
    ai.error = message.slice(0, 300)
    await saveVideo(video)
    return 'failed' as const
  }

  if (!res.ok) {
    if (res.status === 404) return fail('OpenAI側に動画が見つかりませんでした')
    if (Date.now() - Date.parse(ai.startedAt) > GIVE_UP_MS) return fail(`時間内に出来上がりませんでした（HTTP ${res.status}）`)
    return 'waiting'
  }
  if (data.status === 'failed') return fail(data.error?.message ?? 'OpenAI側で作成に失敗しました')
  if (data.status !== 'completed') {
    if (Date.now() - Date.parse(ai.startedAt) > GIVE_UP_MS) return fail('時間内に出来上がりませんでした')
    return 'waiting'
  }

  const { put } = await import('@vercel/blob')
  const mp4 = await fetch(`${API}/${ai.openaiId}/content`, { headers: authHeaders() })
  if (!mp4.ok) return 'waiting' // 取り出しの一時的な失敗は次の回にやり直す
  const blob = await put(`marketing/videos/ai-${video.id}.mp4`, Buffer.from(await mp4.arrayBuffer()), {
    access: 'public',
    contentType: 'video/mp4',
  })
  video.url = blob.url
  try {
    const thumb = await fetch(`${API}/${ai.openaiId}/content?variant=thumbnail`, { headers: authHeaders() })
    if (thumb.ok) {
      const type = thumb.headers.get('content-type') ?? 'image/webp'
      const ext = type.includes('png') ? 'png' : type.includes('jpeg') ? 'jpg' : 'webp'
      video.thumbUrl = (
        await put(`marketing/videos/ai-${video.id}-thumb.${ext}`, Buffer.from(await thumb.arrayBuffer()), { access: 'public', contentType: type })
      ).url
    }
  } catch {
    /* サムネイルは無くてもよい */
  }
  ai.status = 'ready'
  ai.error = undefined
  await saveVideo(video)
  return 'ready'
}

export interface AiVideoTickResult {
  configured: boolean
  started?: string
  ready: number
  failed: number
  waiting: number
  error?: string
}

/**
 * 定期実行から呼ぶ: 作成中の動画を取りに行き、月・木の朝ならその日の1本を作り始める。
 * 失敗しても投稿ジョブの処理は止めない（呼び出し側で握りつぶしてよい）
 */
export async function tickAiVideos(options: { allowAutoStart: boolean }): Promise<AiVideoTickResult> {
  const result: AiVideoTickResult = { configured: aiVideoConfigured(), ready: 0, failed: 0, waiting: 0 }
  if (!result.configured) return result

  const videos = await listVideos()
  for (const v of videos.filter((x) => x.ai?.status === 'generating').slice(0, 3)) {
    try {
      result[await collect(v)]++
    } catch (error) {
      result.waiting++
      result.error = error instanceof Error ? error.message : String(error)
    }
  }

  if (options.allowAutoStart) {
    const now = jstParts(new Date())
    const doneToday = videos.some((v) => v.ai?.trigger === 'auto' && v.ai.startedDate === now.date)
    const busy = videos.some((v) => v.ai?.status === 'generating')
    if (AUTO_WEEKDAYS.has(now.weekday) && now.hour >= AUTO_FROM_HOUR && !doneToday && !busy) {
      try {
        result.started = (await startAiVideo('auto')).title
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error)
      }
    }
  }
  return result
}
