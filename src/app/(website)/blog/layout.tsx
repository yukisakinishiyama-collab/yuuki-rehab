import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ブログ｜スポーツ障害・リハビリのお役立ち情報',
  description: 'ゆうき整骨院のブログ。スポーツ障害・術前術後リハビリ・競技復帰・再発予防に関する医学的根拠に基づいた情報を発信しています。下関市の整骨院からスポーツリハビリの最新情報を。',
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
