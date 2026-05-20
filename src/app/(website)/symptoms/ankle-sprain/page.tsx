import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: '下関市の足首捻挫・足関節捻挫リハビリ｜再発予防まで対応',
  description: '下関市のゆうき整骨院。足首捻挫（足関節捻挫）の正しい初期対応からリハビリ・再発予防まで一貫対応。「また捻った」を繰り返さないための運動療法・固有感覚トレーニングを提供。',
}

export default function AnkleSprainPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-navy to-blue-800 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex items-center gap-2 text-blue-300 text-sm mb-6">
            <Link href="/" className="hover:text-white">ホーム</Link>
            <ChevronRight size={14} />
            <Link href="/symptoms" className="hover:text-white">症状・お悩み</Link>
            <ChevronRight size={14} />
            <span className="text-white">足関節捻挫</span>
          </nav>
          <span className="inline-block bg-blue-500/30 text-blue-200 text-xs font-bold px-3 py-1 rounded-full mb-4">下関市 スポーツ外傷</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            足首捻挫（足関節捻挫）の治療・リハビリ
          </h1>
          <p className="text-blue-100 max-w-2xl leading-relaxed">
            「また捻った」を繰り返していませんか？捻挫は正しく治さないと慢性不安定性につながります。下関市で足関節捻挫のリハビリをお探しなら、ゆうき整骨院へ。
          </p>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 space-y-8">
          <div className="bg-blue-50 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle size={22} className="text-blue-700" />
              足関節捻挫を「ちゃんと治す」ことの重要性
            </h2>
            <p className="text-slate-700 leading-relaxed">
              足首の捻挫は「よくある怪我」として軽視されがちですが、適切に治療しないと<strong>慢性的な足関節不安定性（CAI）</strong>につながります。「また捻った」を繰り返す方の多くは、最初の捻挫が不完全に治癒していることが原因です。
            </p>
            <p className="text-slate-700 leading-relaxed mt-3">
              現在のスポーツ医学では、捻挫後の早期からの運動療法・固有感覚トレーニングが推奨されています（POLICEアプローチ）。安静だけでは回復が不十分です。
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-5">ゆうき整骨院の足関節捻挫リハビリ</h2>
            <ul className="space-y-3">
              {[
                '重症度の正確な評価（靭帯損傷・骨折除外・不安定性チェック）',
                '初期：適切な固定・アイシング・腫脹管理',
                '早期から開始する荷重・可動域トレーニング',
                '固有感覚（バランス）トレーニングによる再発予防',
                '競技特性に合わせた復帰プログラム（ダッシュ・方向転換など）',
                '慢性不安定性のある方への特化したアプローチ',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-blue-600 shrink-0 mt-0.5" />
                  <span className="text-slate-700 text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              { label: 'サッカー', desc: '方向転換・タックルによる内反捻挫' },
              { label: 'バスケットボール', desc: '着地時・ドリブル中の捻挫' },
              { label: 'バレーボール', desc: 'ブロック・スパイク後の着地捻挫' },
            ].map((s) => (
              <div key={s.label} className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="font-bold text-slate-800 mb-1">{s.label}</p>
                <p className="text-slate-500 text-xs">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-br from-navy to-blue-800 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">下関の足首捻挫リハビリはゆうき整骨院へ</h2>
            <p className="text-blue-200 mb-6 text-sm">急性期から競技復帰まで、「また捻らない身体」をつくります</p>
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
