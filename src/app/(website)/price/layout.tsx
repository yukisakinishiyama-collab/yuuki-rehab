import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '料金案内｜初回評価¥2,000〜 保険診療・自費メニュー',
  description: 'ゆうき整骨院の料金案内。初回評価¥2,000、リハビリ・運動療法¥3,850〜、MOTION LAB動画解析¥2,500。保険診療（捻挫・打撲）対応。下関市のスポーツ障害・リハビリ専門整骨院。すべての料金を明確に公開しています。',
}

export default function PriceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
