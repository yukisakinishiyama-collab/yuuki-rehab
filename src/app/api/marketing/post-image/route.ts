/**
 * 下書きのAI画像を作る（「投稿を作る」画面から）
 *
 * 下書きを書いたAI（Claude）の「画像の場面の説明」に、医療広告・個人情報の決まりを足して
 * ChatGPT（OpenAIの画像生成）で文字なしの写真を1枚作り、Vercel Blob に置いて返す（30秒〜1分ほど）。
 * 見出しの文字は写真に入れず、投稿・プレビューのときに院のデザインで重ねる。
 *
 * 下書きの編集にあたるのでスタッフも使える（公開には院長の承認が必要なのは変わらない）。
 * OPENAI_API_KEY が無い・モックモードのときは configured:false を返す（画面はテンプレ画像のまま）。
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { aiPostImageConfigured, createPostPhoto } from '@/lib/marketing/post-image-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const RequestSchema = z.object({
  theme: z.string().min(1).max(300),
  scene: z.string().max(1000).optional(),
  title: z.string().max(300).optional(),
  hook: z.string().max(300).optional(),
})

export async function POST(request: NextRequest) {
  let input: z.infer<typeof RequestSchema>
  try {
    input = RequestSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ ok: false, error: '入力内容が正しくありません' }, { status: 400 })
  }
  if (!aiPostImageConfigured()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      error: 'OpenAIのAPIキー（OPENAI_API_KEY）が未設定か、モックモードのため、AI画像は作れません（テンプレ画像で投稿します）',
    })
  }
  try {
    const image = await createPostPhoto({
      scene: input.scene,
      theme: input.theme,
      content: { title: input.title ?? '', hook: input.hook ?? '', body: '', cta: { label: '', url: '' }, hashtags: [], warnings: [] },
    })
    return NextResponse.json({ ok: true, configured: true, image })
  } catch (error) {
    console.error('[marketing/post-image] AI画像を作れませんでした', error)
    return NextResponse.json(
      { ok: false, configured: true, error: error instanceof Error ? error.message.slice(0, 300) : 'AI画像を作れませんでした' },
      { status: 502 },
    )
  }
}
