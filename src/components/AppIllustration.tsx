'use client'

// スロット指定でイラストを表示する共通コンポーネント
// 解決順: Blob（イラスト管理でアップロード） > public/illustrations/ の静的ファイル > fallbackSrc > 非表示

import { useEffect, useState } from 'react'
import { fetchIllustrationMap } from '@/lib/illustrations'

interface Props {
  slot: string
  alt: string
  className?: string
  /** Blob・静的ファイルとも無い場合に表示する画像（省略時は非表示） */
  fallbackSrc?: string
}

export default function AppIllustration({ slot, alt, className, fallbackSrc }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [triedStatic, setTriedStatic] = useState(false)

  useEffect(() => {
    let mounted = true
    fetchIllustrationMap().then(map => {
      if (!mounted) return
      if (map[slot]) {
        setSrc(map[slot])
        setTriedStatic(true) // Blob画像が失敗したら fallbackSrc へ直行
      } else {
        setSrc(`/illustrations/${slot}.png`)
      }
    })
    return () => { mounted = false }
  }, [slot])

  if (!src) return null

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Blob等の動的URLのため next/image は使わない
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => {
        if (!triedStatic) {
          // 静的ファイルが無い → fallbackSrc へ
          setTriedStatic(true)
          setSrc(fallbackSrc ?? null)
        } else if (fallbackSrc && src !== fallbackSrc) {
          setSrc(fallbackSrc)
        } else {
          setSrc(null)
        }
      }}
    />
  )
}
