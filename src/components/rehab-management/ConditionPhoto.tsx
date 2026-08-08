'use client'
// ──────────────────────────────────────────────
// 疾患・場面別の実写写真（画像統合指示書 §3・§7）
//
// 解決順: イラスト管理でアップロードした画像 > public/illustrations/<slot>.png > 表示しない。
// 実際に読み込めた画像だけを返すため、未登録・読み込み失敗のときは
// 見出しごと非表示にでき、空の枠が残らない（指示書§1 のフォールバック要件）。
//
// 仕様: 4:3・object-fit: cover・レスポンシブ・alt必須
// ──────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { fetchIllustrationMap } from '@/lib/illustrations'

/**
 * スロットの画像URLを解決する。候補を順に読み込んでみて、
 * 成功したものだけを返す（失敗し続ければ null）。
 * 呼び出し側は null のときセクションごと描画しないことで、空枠や壊れた画像を防げる。
 */
export function useResolvedIllustration(slot: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(null)
  const [prevSlot, setPrevSlot] = useState(slot)

  // スロットが変わったら前の画像を残さない（レンダー中に調整）
  if (slot !== prevSlot) {
    setPrevSlot(slot)
    setSrc(null)
  }

  useEffect(() => {
    let mounted = true
    if (!slot) return

    fetchIllustrationMap().then(map => {
      if (!mounted) return
      const candidates = [map[slot], `/illustrations/${slot}.png`].filter(Boolean) as string[]

      const tryCandidate = (i: number) => {
        if (!mounted || i >= candidates.length) return
        const probe = new Image()
        probe.onload = () => { if (mounted) setSrc(candidates[i]) }
        probe.onerror = () => tryCandidate(i + 1)
        probe.src = candidates[i]
      }
      tryCandidate(0)
    })

    return () => { mounted = false }
  }, [slot])

  return src
}

interface Props {
  /** 解決済みの画像URL（useResolvedIllustration の戻り値） */
  src: string
  alt: string
  /** 画像の下に添える説明文（患者向け。省略可） */
  caption?: string
  className?: string
}

export default function ConditionPhoto({ src, alt, caption, className }: Props) {
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
        />
      </div>
      {caption && (
        <figcaption className="mt-2 text-sm text-slate-500 leading-relaxed">{caption}</figcaption>
      )}
    </figure>
  )
}
