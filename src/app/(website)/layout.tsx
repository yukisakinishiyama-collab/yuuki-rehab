import type { Metadata } from 'next'
import Header from '@/components/site/Header'
import Footer from '@/components/site/Footer'
import LineFloatButton from '@/components/site/LineFloatButton'

export const metadata: Metadata = {
  title: {
    default: 'ゆうき整骨院｜下関のスポーツ障害・術前術後リハビリ専門整骨院',
    template: '%s｜ゆうき整骨院',
  },
  description: '山口県下関市のゆうき整骨院。スポーツ障害・術前術後リハビリ・競技復帰に特化。運動療法・動作改善を重視した医学的根拠に基づく施術。ACL術後、オスグッド、股関節痛など対応。',
  keywords: ['下関 整骨院', '下関 スポーツ障害', '下関 リハビリ', '下関 術後リハビリ', '下関 術前リハビリ', '下関 プレハビリテーション', 'ゆうき整骨院', '下関 ACL', '下関 オスグッド', '下関 股関節痛'],
  openGraph: {
    siteName: 'ゆうき整骨院',
    locale: 'ja_JP',
    type: 'website',
  },
}

export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="pt-16 md:pt-20">{children}</main>
      <Footer />
      <LineFloatButton />
    </>
  )
}
