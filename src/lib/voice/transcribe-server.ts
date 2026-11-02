/**
 * 録音した音声を文字にする（サーバー専用。OpenAI の文字起こし）
 *
 * 2026-11-02 院長の判断で、カルテの音声入力は精度を上げるため OpenAI へ音声を送る
 * （それまでの音声入力も、Chrome では音声が Google に送られて文字になっていた）。
 * - 音声はこのアプリのどこにも保存しない。文字にした内容もサーバーのログには残さない（長さ・モデル名だけ）
 * - モデルは OPENAI_TRANSCRIBE_MODEL があればそれだけ、無ければ gpt-transcribe → gpt-4o-transcribe → gpt-4o-mini-transcribe の順に試す
 * - 整骨院でよく出る言葉を「聞き取りのヒント」として渡し、医療用語の聞きまちがいを減らす
 *
 * 必要な設定: OPENAI_API_KEY（Vercel の環境変数。AI画像と同じもの）
 */
// OPENAI_BASE_URL は動作確認用（ふだんは設定しない。OpenAI の公式ライブラリと同じ名前）
const TRANSCRIBE_API = `${(process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '')}/audio/transcriptions`

/** 聞き取りのヒント（話に出てこない言葉が混ざらないよう、整骨院でよく使うものに絞る） */
export const CLINIC_KEYWORDS = [
  '施術', '柔道整復', '前十字靭帯', '内側側副靭帯', '半月板', '腱板', 'インピンジメント', '鵞足', '膝蓋腱', 'アキレス腱',
  '足関節捻挫', '前距腓靭帯', '腰椎椎間板ヘルニア', '脊柱管狭窄症', '腰椎分離症', '坐骨神経', '梨状筋', '大腿四頭筋',
  'ハムストリングス', '腸腰筋', '中殿筋', '下腿三頭筋', '僧帽筋', '肩甲骨', '頚椎', '胸椎', '腰椎', '仙腸関節', '股関節',
  '可動域', 'ROM', 'MMT', 'NRS', '圧痛', '腫脹', '熱感', 'しびれ', 'ラックマンテスト', 'マクマレーテスト', 'SLR',
  'ケンプテスト', 'スパーリングテスト', 'オスグッド', 'シーバー病', 'シンスプリント', 'テニス肘', '野球肘', 'ジャンパー膝',
  'テーピング', 'アイシング', 'ハイボルト', '超音波', 'スクワット', 'カーフレイズ', '片脚立位', '荷重', 'サポーター',
] as const

const BASE_PROMPT = '整骨院での施術中の会話や、施術者の口述メモ（日本語）。医療・リハビリの用語は漢字で書く。'

/** 無音や雑音のときに文字起こしが作ってしまう決まり文句（その1文だけのときは捨てる） */
const HALLUCINATIONS = [
  'ご視聴ありがとうございました',
  'ご清聴ありがとうございました',
  'チャンネル登録よろしくお願いします',
  'チャンネル登録お願いします',
  '最後までご視聴いただきありがとうございます',
  '字幕は自動生成されています',
]

export function transcribeConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

function models(): string[] {
  const fromEnv = process.env.OPENAI_TRANSCRIBE_MODEL?.trim()
  return fromEnv ? [fromEnv] : ['gpt-transcribe', 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe']
}

/** このモデルが使えない（アカウントで未提供・パラメータ未対応など）＝次のモデルを試す */
function shouldTryNext(status: number, code: string, message: string): boolean {
  return (
    status === 404 ||
    code === 'model_not_found' ||
    /does not exist|not have access|not supported|unsupported|unknown parameter|unrecognized|invalid model|deprecated/i.test(message)
  )
}

/** 句読点・空白を除いた、決まり文句かどうか */
function isHallucination(text: string): boolean {
  const core = text.replace(/[\s。、．，.!！?？「」『』]/g, '')
  return HALLUCINATIONS.some((h) => core === h || core === h.replace(/[\s。、]/g, ''))
}

function buildForm(model: string, audio: Blob, filename: string, context: string): FormData {
  const form = new FormData()
  form.append('file', audio, filename)
  form.append('model', model)
  form.append('response_format', 'json')
  // 直前に話していた内容（続きとして聞き取ると、言葉のつながりが正しくなる）
  const tail = context ? `\n直前の内容: ${context}` : ''
  if (model.startsWith('gpt-transcribe')) {
    form.append('languages[]', 'ja')
    for (const k of CLINIC_KEYWORDS) form.append('keywords[]', k)
    form.append('prompt', `${BASE_PROMPT}${tail}`)
  } else if (model === 'whisper-1') {
    // whisper-1 はヒントの長さに上限がある（約224トークン）。直前の内容だけ短く
    form.append('language', 'ja')
    form.append('prompt', context.slice(-80))
  } else {
    form.append('language', 'ja')
    form.append('prompt', `${BASE_PROMPT}よく出る言葉: ${CLINIC_KEYWORDS.join('、')}${tail}`)
  }
  return form
}

/** 使えたモデルを覚えておく（毎回、使えないモデルから試さないように） */
let workingModel: string | null = null

/**
 * 音声1つ分を文字にする。context は直前に文字にした内容（最後の300字ほど）
 * 無音・決まり文句だけのときは '' を返す
 */
export async function transcribeAudio(audio: Blob, filename: string, context = '', signal?: AbortSignal): Promise<{ text: string; model: string }> {
  if (!transcribeConfigured()) throw new Error('OPENAI_API_KEY が未設定です（Vercel の環境変数に入れてください）')
  const list = workingModel ? [workingModel, ...models().filter((m) => m !== workingModel)] : models()
  let lastError = ''
  for (const model of list) {
    const res = await fetch(TRANSCRIBE_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ''}` },
      body: buildForm(model, audio, filename, context.slice(-300)),
      signal: signal ?? AbortSignal.timeout(50_000),
    })
    const data = (await res.json().catch(() => ({}))) as { text?: string; error?: { message?: string; code?: string } }
    if (res.ok) {
      workingModel = model
      const text = (data.text ?? '').trim()
      return { text: isHallucination(text) ? '' : text, model }
    }
    const message = data.error?.message ?? `HTTP ${res.status}`
    lastError = `${model}: ${message}`
    if (!shouldTryNext(res.status, data.error?.code ?? '', message)) break
    if (workingModel === model) workingModel = null
  }
  throw new Error(`文字起こしに失敗しました（${lastError}）`)
}

/** 録音の形式 → OpenAI に渡すファイル名の拡張子（対応: webm・mp4/m4a・mp3・wav） */
export function audioExtension(mime: string): string | null {
  const type = mime.split(';')[0].trim().toLowerCase()
  if (type === 'audio/webm' || type === 'video/webm') return 'webm'
  if (type === 'audio/mp4' || type === 'video/mp4' || type === 'audio/x-m4a' || type === 'audio/m4a') return 'mp4'
  if (type === 'audio/mpeg' || type === 'audio/mp3') return 'mp3'
  if (type === 'audio/wav' || type === 'audio/x-wav' || type === 'audio/wave') return 'wav'
  return null
}
