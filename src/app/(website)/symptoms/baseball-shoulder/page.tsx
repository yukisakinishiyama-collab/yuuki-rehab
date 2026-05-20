import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: '下関市の野球肩・投球障害肩のリハビリ｜競技復帰サポート',
  description: '下関市のゆうき整骨院。野球肩（投球障害肩）・肩関節疾患のリハビリ。投球メカニクスの分析・肩甲骨機能改善・肩関節周囲筋のバランス調整で根本から改善します。',
}

export default function BaseballShoulderPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-navy to-blue-800 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex items-center gap-2 text-blue-300 text-sm mb-6">
            <Link href="/" className="hover:text-white">ホーム</Link>
            <ChevronRight size={14} />
            <Link href="/symptoms" className="hover:text-white">症状・お悩み</Link>
            <ChevronRight size={14} />
            <span className="text-white">野球肩</span>
          </nav>
          <span className="inline-block bg-blue-500/30 text-blue-200 text-xs font-bold px-3 py-1 rounded-full mb-4">下関市 投球障害</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            野球肩（投球障害肩）・肩痛のリハビリ
          </h1>
          <p className="text-blue-100 max-w-2xl leading-relaxed">
            投げると痛い、肩に違和感がある。投球動作の分析から肩甲骨・体幹の機能改善まで、下関市で投球障害のリハビリを専門的に対応します。
          </p>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 space-y-8">
          <div className="bg-blue-50 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle size={22} className="text-blue-700" />
              投球障害肩とは
            </h2>
            <p className="text-slate-700 leading-relaxed">
              野球肩（投球障害肩）は「肩のインナーマッスル（腱板）」「肩甲骨の動き」「体幹・下半身との連動」に問題があることで生じます。肩だけを治療しても改善しないケースが多く、投球メカニクス全体の評価・改善が必要です。
            </p>
            <p className="text-slate-700 leading-relaxed mt-3">
              野球以外にも、バレーボール・水泳・テニスなどのオーバーヘッド動作を行うスポーツで発生します。
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-5">ゆうき整骨院の肩リハビリ</h2>
            <ul className="space-y-3">
              {[
                '投球動作・フォームの動作分析',
                '肩関節可動域（内旋・外旋）の回復',
                '肩甲骨安定筋のトレーニング',
                '腱板（インナーマッスル）の機能強化',
                '体幹・股関節との連動トレーニング',
                '段階的な投球再開プログラム（段階投球）',
                '術後（腱板修復術など）リハビリへの対応',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-blue-600 shrink-0 mt-0.5" />
                  <span className="text-slate-700 text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gradient-to-br from-navy to-blue-800 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">下関の野球肩リハビリはゆうき整骨院へ</h2>
            <p className="text-blue-200 mb-6 text-sm">「また思いきり投げたい」という気持ちに、しっかり応えます</p>
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
