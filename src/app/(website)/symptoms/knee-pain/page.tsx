import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, ChevronRight } from 'lucide-react'

export const metadata: Metadata = {
  title: '下関市の膝痛リハビリ｜膝蓋腱炎・腸脛靱帯炎・スポーツ膝',
  description: '下関市のゆうき整骨院。膝の痛み（膝蓋腱炎・腸脛靱帯炎・半月板損傷後など）のリハビリ。膝への負荷の原因を根本から評価し、再発しない身体づくりをサポート。',
}

export default function KneePainPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-navy to-blue-800 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex items-center gap-2 text-blue-300 text-sm mb-6">
            <Link href="/" className="hover:text-white">ホーム</Link>
            <ChevronRight size={14} />
            <Link href="/symptoms" className="hover:text-white">症状・お悩み</Link>
            <ChevronRight size={14} />
            <span className="text-white">膝痛</span>
          </nav>
          <span className="inline-block bg-blue-500/30 text-blue-200 text-xs font-bold px-3 py-1 rounded-full mb-4">下関市 膝リハビリ</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">膝の痛みのリハビリ</h1>
          <p className="text-blue-100 max-w-2xl leading-relaxed">
            膝蓋腱炎（ジャンパー膝）・腸脛靱帯炎（ランナー膝）・半月板損傷後・スポーツによる慢性的な膝痛に対応。根本原因を評価し、再発しない身体をつくります。
          </p>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 space-y-8">
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { label: '膝蓋腱炎（ジャンパー膝）', sports: 'バレー・バスケ・陸上', desc: 'ジャンプ・スプリント動作の繰り返しで膝蓋腱に炎症が生じます。' },
              { label: '腸脛靱帯炎（ランナー膝）', sports: 'マラソン・自転車', desc: '膝の外側の痛み。走行距離増加時・山下りで悪化しやすい。' },
              { label: '半月板損傷後', sports: 'サッカー・バスケなど', desc: '保存・術後問わずリハビリが重要。機能回復と再発予防を行います。' },
              { label: 'スポーツによる慢性膝痛', sports: '各種スポーツ', desc: '原因不明の慢性的な膝の違和感・痛みを動作評価から改善します。' },
            ].map((item) => (
              <div key={item.label} className="bg-blue-50 rounded-xl p-5">
                <p className="font-bold text-slate-800 mb-1 text-sm">{item.label}</p>
                <p className="text-blue-700 text-xs font-medium mb-2">{item.sports}</p>
                <p className="text-slate-600 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-5">膝リハビリのアプローチ</h2>
            <ul className="space-y-3">
              {[
                '膝関節・股関節・足部の複合的な機能評価',
                '大腿四頭筋・ハムストリングス・殿筋群の強化',
                '膝蓋骨の動きの調整（モビライゼーション）',
                '走動作・着地動作の修正',
                '段階的な競技復帰プログラム',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-blue-600 shrink-0 mt-0.5" />
                  <span className="text-slate-700 text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gradient-to-br from-navy to-blue-800 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">下関の膝痛リハビリはゆうき整骨院へ</h2>
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
