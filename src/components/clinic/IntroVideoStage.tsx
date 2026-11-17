'use client'
/**
 * 紹介の動画を、画面いっぱいで患者さんに見せる（どの動画かは video で渡す。省くと、料金と会員プランのご紹介）
 *
 * 開いている間は、院内アプリのメニューや、うしろの画面（カルテなど）を見せない。Esc か「閉じる」で戻る。何も保存しない。
 * 使うところ（2026-11-16 院長の依頼）：
 * - 今日 →「患者さんに見せる」のページ（IntroVideoShell.tsx。料金と会員プラン／料金のしくみと健康保険）
 * - カルテの「契約・同意書」タブの「紹介動画を見せる」（ContractsTab.tsx）。カルテを開いたまま、その場で再生して戻れる
 *
 * 向きは、開くときに画面の形で選んで渡す（pickOrientation）。開いたあとも、右上で横向き・縦向きを替えられる（続きから再生）。
 * ほかの重なる画面（会員プランのご案内＝z-[60]）より手前に出す（z-[70]）
 */
import { useEffect, useRef, useState } from 'react'
import { RectangleHorizontal, RectangleVertical, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PRICE_GUIDE_VIDEO, type IntroVideo, type VideoOrientation } from '@/data/intro-videos'

export default function IntroVideoStage({
  video: V = PRICE_GUIDE_VIDEO,
  orientation,
  onOrientation,
  onClose,
}: {
  video?: IntroVideo
  orientation: VideoOrientation
  onOrientation: (o: VideoOrientation) => void
  onClose: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  /** 向きを替えたとき、同じところから続ける */
  const resumeAt = useRef(0)
  const [ended, setEnded] = useState(false)
  const file = V.files[orientation]

  // Esc で閉じる。開いている間は、うしろの画面を動かさない
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = before
    }
  }, [onClose])

  function switchTo(next: VideoOrientation) {
    if (next === orientation) return
    resumeAt.current = video.current?.currentTime ?? 0
    setEnded(false)
    onOrientation(next)
  }

  function replay() {
    const el = video.current
    if (!el) return
    setEnded(false)
    el.currentTime = 0
    // 再生を断られたとき（端末の設定など）は、動画の再生ボタンを押してもらう
    el.play().catch(() => {})
  }

  return (
    // m-0：置き場所の space-y-* が付ける余白（margin）で、画面の下があかないように
    <div
      className="no-print fixed inset-0 z-[70] m-0 flex flex-col bg-teal-950 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      role="dialog"
      aria-modal="true"
      aria-label={V.title}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 sm:px-4">
        <p className="text-sm font-bold text-teal-100">ゆうき整骨院　{V.title}</p>
        <div className="flex items-center gap-1.5">
          <div className="flex overflow-hidden rounded-lg ring-1 ring-white/40" role="group" aria-label="動画の向き">
            {(['land', 'port'] as const).map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={orientation === o}
                onClick={() => switchTo(o)}
                className={cn(
                  'inline-flex min-h-11 items-center gap-1.5 px-3 text-sm font-bold',
                  orientation === o ? 'bg-white text-teal-900' : 'text-white hover:bg-white/10',
                )}
              >
                {o === 'land' ? <RectangleHorizontal className="h-4 w-4" aria-hidden /> : <RectangleVertical className="h-4 w-4" aria-hidden />}
                {o === 'land' ? '横向き' : '縦向き'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-bold text-white hover:bg-white/10"
          >
            <X className="h-4 w-4" aria-hidden />
            閉じる
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-2 sm:px-4 sm:pb-4">
        <video
          // 向きを替えたら、別の動画として読み直す
          key={`${V.id}-${orientation}`}
          ref={video}
          src={file.src}
          poster={file.poster}
          width={file.width}
          height={file.height}
          controls
          playsInline
          preload="auto"
          className="h-auto max-h-full w-auto max-w-full rounded-lg bg-black"
          onLoadedMetadata={(e) => {
            const el = e.currentTarget
            if (resumeAt.current > 0.3) el.currentTime = resumeAt.current
            resumeAt.current = 0
            // 「患者さんに見せる」を押した流れで再生を始める。断られたら、動画の再生ボタンを押してもらう
            el.play().catch(() => {})
          }}
          onEnded={() => setEnded(true)}
          onPlay={() => setEnded(false)}
        >
          <track kind="captions" src={V.captions} srcLang="ja" label="日本語（声の文字）" />
          この端末では動画を再生できません。
        </video>

        {ended && (
          <div className="absolute inset-x-0 bottom-6 flex justify-center px-4">
            <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 shadow-lg">
              <p className="text-sm font-bold text-slate-900">ご覧いただき、ありがとうございました。</p>
              <Button variant="outline" onClick={replay} className="h-11">
                <RotateCcw className="h-4 w-4" aria-hidden />
                もう一度見る
              </Button>
              <Button onClick={onClose} className="h-11">
                閉じる
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
