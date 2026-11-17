'use client'
/**
 * 患者さんにお見せする紹介動画の、スタッフ用ページの共通の枠
 *
 * 今日 →「患者さんに見せる」から開く。動画ごとにページがある（2026-11-17 院長の依頼で2本目を別の枠として足した）：
 * - 料金と会員プランのご紹介（/dashboard/price-video・IntroVideoPage.tsx）
 * - 料金のしくみと健康保険のご案内（/dashboard/fee-video・FeeVideoPage.tsx）
 *
 * - この枠：題・説明、「患者さんに見せる（画面いっぱい）」、向きの選択、動画の確認（スタッフ用）
 * - その下（children）：動画ごとの「動画に出てくる内容」（聞かれたときの確認用）
 * - 「患者さんに見せる」を押すと、メニューやほかの画面を隠して動画だけを出す（IntroVideoStage.tsx）。Esc か「閉じる」で戻る。
 *   何も保存しない。向きは、押したときの画面の形で選ぶ（横長＝横向き、縦長＝縦向き）。手で選ぶこともできる
 */
import { useCallback, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { MonitorPlay } from 'lucide-react'
import { Button } from '@/components/ui/button'
import IntroVideoStage from './IntroVideoStage'
import { cardSurface } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { INTRO_VIDEOS, lengthLabel, pickOrientation, type IntroVideo, type VideoOrientation } from '@/data/intro-videos'

type Choice = VideoOrientation | 'auto'

const CHOICES: Array<{ id: Choice; label: string }> = [
  { id: 'auto', label: '自動（画面の向き）' },
  { id: 'land', label: '横向き' },
  { id: 'port', label: '縦向き' },
]

export function asOfLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${y}年${m}月${d}日`
}

export default function IntroVideoShell({ video: V, children }: { video: IntroVideo; children: ReactNode }) {
  const [choice, setChoice] = useState<Choice>('auto')
  const [stage, setStage] = useState<VideoOrientation | null>(null)
  const close = useCallback(() => setStage(null), [])
  const preview = V.files[choice === 'auto' ? 'land' : choice]
  const others = INTRO_VIDEOS.filter((x) => x.id !== V.id)

  function show() {
    // 押したときの画面の形で選ぶ（タブレットを横に持っていれば横向きの動画）
    setStage(choice === 'auto' ? pickOrientation(window.innerWidth, window.innerHeight) : choice)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <p className="text-sm font-bold text-teal-800">患者さんに見せる</p>
        <h1 className="text-xl font-black text-slate-900 lg:text-2xl">{V.title}（動画）</h1>
        <p className="mt-1 text-sm text-slate-700">
          {V.summary}
          {lengthLabel(V.seconds)}・音が出ます。
        </p>
      </div>

      <section className={cn(cardSurface, 'space-y-4 p-4 sm:p-5')}>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={show} size="lg" className="h-12 w-full px-5 font-bold sm:w-auto sm:px-8">
            <MonitorPlay className="h-5 w-5" aria-hidden />
            患者さんに見せる（画面いっぱい）
          </Button>
          <div className="flex overflow-hidden rounded-lg border border-slate-300" role="group" aria-label="動画の向き">
            {CHOICES.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={choice === c.id}
                onClick={() => setChoice(c.id)}
                className={cn(
                  'inline-flex min-h-11 items-center px-3 text-sm font-bold',
                  choice === c.id ? 'bg-teal-700 text-white' : 'bg-white text-slate-700 hover:bg-slate-50',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-slate-700">
          押すと、メニューやほかの画面を隠して動画だけを出します。タブレットを患者さんに向けてご覧いただけます。終わったら「閉じる」で戻ります。
        </p>

        <div>
          <p className="mb-1.5 text-sm font-bold text-slate-800">動画の確認（スタッフ用）</p>
          <div className="flex justify-center rounded-lg bg-teal-950 p-2">
            <video
              key={preview.src}
              src={preview.src}
              poster={preview.poster}
              width={preview.width}
              height={preview.height}
              controls
              playsInline
              preload="metadata"
              className="h-auto max-h-[60vh] w-auto max-w-full rounded-md bg-black"
            >
              <track kind="captions" src={V.captions} srcLang="ja" label="日本語（声の文字）" />
              この端末では動画を再生できません。
            </video>
          </div>
          <p className="mt-1.5 text-xs text-slate-600">音を出せないときは、動画の字幕（声の文字）を出せます。画面の文字だけでも内容は分かります。</p>
        </div>
      </section>

      {children}

      {others.length > 0 && (
        <p className="text-sm text-slate-700">
          ほかの動画：
          {others.map((x, i) => (
            <span key={x.id}>
              {i > 0 && '・'}
              <Link href={x.page} className="font-bold text-teal-800 underline underline-offset-2 hover:text-teal-900">
                {x.title}（{lengthLabel(x.seconds)}）
              </Link>
            </span>
          ))}
        </p>
      )}

      {stage && <IntroVideoStage video={V} orientation={stage} onOrientation={setStage} onClose={close} />}
    </div>
  )
}
