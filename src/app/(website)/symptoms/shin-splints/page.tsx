import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: '下関市のシンスプリント治療・リハビリ｜走りながら改善する方法',
  description: '下関市のゆうき整骨院。シンスプリント（脛骨過労性骨膜炎）の治療・リハビリ。陸上・サッカー・バスケットの選手に多い脛の痛みを、競技を続けながら改善する方法を提供。',
}

export default function ShinSplintsPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-navy to-blue-800 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex items-center gap-2 text-blue-300 text-sm mb-6">
            <Link href="/" className="hover:text-white">ホーム</Link>
            <ChevronRight size={14} />
            <Link href="/symptoms" className="hover:text-white">症状・お悩み</Link>
            <ChevronRight size={14} />
            <span className="text-white">シンスプリント</span>
          </nav>
          <span className="inline-block bg-blue-500/30 text-blue-200 text-xs font-bold px-3 py-1 rounded-full mb-4">下関市 スポーツ障害</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">シンスプリントの治療・リハビリ</h1>
          <p className="text-blue-100 max-w-2xl leading-relaxed">
            走ると脛（すね）が痛い。シンスプリントは正しいアプローチで、競技を続けながら改善できます。下関市でシンスプリントの治療をお探しの方はゆうき整骨院へ。
          </p>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 space-y-8">
          <div className="bg-blue-50 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle size={22} className="text-blue-700" />
              シンスプリントとは
            </h2>
            <p className="text-slate-700 leading-relaxed">
              シンスプリント（脛骨過労性骨膜炎）は、脛骨（すねの骨）の内側に繰り返しのストレスがかかることで生じる過労性障害です。陸上・サッカー・バスケットボールなどランニング量の多いスポーツに多く見られます。
            </p>
            <p className="text-slate-700 leading-relaxed mt-3">
              疲労骨折との区別が重要で、必要に応じて医療機関での画像診断を勧める場合があります。ゆうき整骨院では、<strong>下関でシンスプリントの治療</strong>を希望する方に、ランニングフォームの修正・足部アーチの管理・筋機能改善を組み合わせたアプローチを提供します。
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-5">ゆうき整骨院のシンスプリント対応</h2>
            <ul className="space-y-3">
              {[
                '疲労骨折との鑑別（必要時は整形外科へ紹介）',
                '足部アーチ・回内足の評価と改善',
                'ランニングフォームの動作分析・修正',
                '下腿・足部の筋力強化・柔軟性改善',
                '練習量・強度の段階的な管理',
                'インソール・テーピングの活用',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-blue-600 shrink-0 mt-0.5" />
                  <span className="text-slate-700 text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gradient-to-br from-navy to-blue-800 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">下関のシンスプリント治療はゆうき整骨院へ</h2>
            <p className="text-blue-200 mb-6 text-sm">大会前でも走りながら改善できる方法を一緒に考えます</p>
            <a
              href="https://lin.ee/uaGKbfk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-line hover:bg-line-dark text-white font-bold px-8 py-4 rounded-full transition-all hover:scale-105"
            >
              LINEで相談・予約する
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
