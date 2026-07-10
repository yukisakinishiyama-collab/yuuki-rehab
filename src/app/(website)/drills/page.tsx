import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import DrillsExplorer from '@/components/site/DrillsExplorer'

export const metadata: Metadata = {
  title: '競技復帰ドリル・アスリハ動画一覧｜下関のスポーツ障害・リハビリ対応',
  description: '下関市のゆうき整骨院。ACL・半月板・野球肩肘・足関節捻挫など疾患別、サッカー・野球・バスケなど競技別の競技復帰ドリル、アスリハ（アスリートリハビリ）の進め方を紹介。動画はYouTube検索リンクから確認できます。',
}

export default function DrillsPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-navy to-blue-800 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex items-center gap-2 text-blue-300 text-sm mb-6">
            <Link href="/" className="hover:text-white">ホーム</Link>
            <ChevronRight size={14} />
            <span className="text-white">競技復帰ドリル・アスリハ動画</span>
          </nav>
          <span className="text-blue-300 text-sm font-bold tracking-widest uppercase">Return to Sport Drills</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mt-2 mb-4">
            競技復帰ドリル・アスリハ動画
          </h1>
          <p className="text-blue-100 max-w-2xl leading-relaxed">
            疾患・競技別に、アスリハ期（競技復帰に向けた準備段階）と競技復帰期のドリルを紹介します。各ドリルはYouTube検索リンクからやり方を動画で確認できます。実施にあたっては、必ず担当スタッフの評価・指導のもとで段階を進めてください。
          </p>
        </div>
      </section>

      <section className="py-12 md:py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <Suspense fallback={<div className="text-center text-slate-400 py-12">読み込み中...</div>}>
            <DrillsExplorer />
          </Suspense>
        </div>
      </section>

      <section className="py-16 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">自分の症状・競技に合ったドリルを相談したい方へ</h2>
          <p className="text-slate-600 mb-8 leading-relaxed">
            ドリルの進め方は、痛みの有無や回復段階によって一人ひとり異なります。まずはLINEでご相談ください。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://lin.ee/uaGKbfk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-line hover:bg-line-dark text-white font-bold px-8 py-4 rounded-full transition-all hover:scale-105"
            >
              LINEで相談する
            </a>
            <Link
              href="/symptoms"
              className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-8 py-4 rounded-full transition-all"
            >
              症状・お悩み一覧へ <ChevronRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
