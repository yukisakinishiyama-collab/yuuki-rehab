'use client'
// ──────────────────────────────────────────────
// 疾患・場面別の実写写真（画像統合指示書 §3・§7）
//
// 解決順: イラスト管理でアップロードした画像 > public/illustrations/<slot>.png > 非表示。
// 画像が無い・読み込めない場合は枠ごと描画しないため、画面が崩れない（指示書§1）。
//
// 仕様: 4:3・object-fit: cover・遅延読み込み・レスポンシブ・alt必須
// ──────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { fetchIllustrationMap } from '@/lib/illustrations'

interface Props {
  slot: string
  alt: string
  /** 画像の下に添える説明文（患者向け。省略可） */
  caption?: string
  className?: string
}

export default function ConditionPhoto({ slot, alt, caption, className }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  // アップロード画像を表示中で、失敗したら静的ファイルに切り替えられる状態か
  const [canFallback, setCanFallback] = useState(false)
  const [failed, setFailed] = useState(false)
  const [prevSlot, setPrevSlot] = useState(slot)

  // スロットが変わったら読み込み状態をリセットする（レンダー中に調整）
  if (slot !== prevSlot) {
    setPrevSlot(slot)
    setSrc(null)
    setFailed(false)
  }

  useEffect(() => {
    let mounted = true
    fetchIllustrationMap().then(map => {
      if (!mounted) return
      if (map[slot]) {
        setSrc(map[slot])
        setCanFallback(true)   // 失敗時は静的ファイルを試す
      } else {
        setSrc(`/illustrations/${slot}.png`)
        setCanFallback(false)  // 静的が最後の手段。失敗したら非表示
      }
    })
    return () => { mounted = false }
  }, [slot])

  // 画像が未登録・読み込み失敗のときは枠ごと出さない
  if (!src || failed) return null

  return (
    <figure className={className}>
      <div className="relative w-full overflow-hidden rounded-2xl bg-slate-100"
        style={{ aspectRatio: '4 / 3' }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Blob等の動的URLのため next/image は使わない */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => {
            if (canFallback) {
              setCanFallback(false)
              setSrc(`/illustrations/${slot}.png`)
            } else {
              setFailed(true)
            }
          }}
        />
      </div>
      {caption && (
        <figcaption className="mt-2 text-sm text-slate-500 leading-relaxed">{caption}</figcaption>
      )}
    </figure>
  )
}
