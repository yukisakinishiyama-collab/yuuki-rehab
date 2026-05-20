import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react'

export const metadata: Metadata = {
  title: '下関市の腰椎分離症治療・リハビリ｜スポーツ復帰を目指す成長期の腰痛',
  description: '下関市のゆうき整骨院。腰椎分離症（成長期の腰の疲労骨折）の治療・リハビリ。野球・体操・陸上など腰を反らすスポーツに多い腰椎分離症に、段階的なリハビリとスポーツ復帰支援を提供します。',
}

const phases = [
  {
    phase: 'Phase 1',
    period: '安静期（医師指示に従う）',
    title: '骨癒合の促進',
    goals: ['医師の指示に基づくコルセット着用・安静', '腰部に負担のかからない姿勢の指導', '上肢・下肢の筋力維持トレーニング'],
    notes: '急性期・進行期は腰部への負荷を避けます。主治医の判断が最優先です',
  },
  {
    phase: 'Phase 2',
    period: '安静解除後',
    title: '体幹・股関節機能の回復',
    goals: ['体幹筋（インナーマッスル）の段階的な強化', '股関節柔軟性の改善（腰部負担を減らす）', 'ウォーキング→軽いジョギングへの段階的移行'],
    notes: '体幹が安定することで腰への負担が大幅に減ります',
  },
  {
    phase: 'Phase 3',
    period: '復帰準備期',
    title: 'スポーツ動作の再学習',
    goals: ['投球・スウィング・体操動作など競技特性に応じた練習', '腰部に過度な負担がかからない動作への修正', '段階的な練習復帰と状態の確認'],
    notes: '「痛みが消えた」だけで復帰せず、動作・筋力の確認をしてから復帰します',
  },
]

export default function SpondylolysisPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-navy to-blue-800 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex items-center gap-2 text-blue-300 text-sm mb-6">
            <Link href="/" className="hover:text-white">ホーム</Link>
            <ChevronRight size={14} />
            <Link href="/symptoms" className="hover:text-white">症状・お悩み</Link>
            <ChevronRight size={14} />
            <span className="text-white">腰椎分離症</span>
          </nav>
          <span className="inline-block bg-blue-500/30 text-blue-200 text-xs font-bold px-3 py-1 rounded-full mb-4">下関市 成長期障害</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            腰椎分離症の治療・リハビリ
          </h1>
          <p className="text-blue-100 max-w-2xl leading-relaxed">
            成長期アスリートに多い腰の疲労骨折（腰椎分離症）。「安静だけ」では終わらせない。骨癒合後の体幹機能回復・競技復帰まで一貫してサポートします。
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <span className="bg-white/20 text-white text-sm font-semibold px-4 py-1.5 rounded-full">野球</span>
            <span className="bg-white/10 text-blue-200 text-sm px-4 py-1.5 rounded-full border border-white/20">体操</span>
            <span className="bg-white/10 text-blue-200 text-sm px-4 py-1.5 rounded-full border border-white/20">陸上</span>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 space-y-10">

          {/* ===== 腰椎分離症とは ===== */}
          <div className="bg-blue-50 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle size={22} className="text-blue-700" />
              腰椎分離症とは
            </h2>
            <p className="text-slate-700 leading-relaxed text-sm">
              腰椎分離症とは、腰の骨（腰椎）の後方にある「椎弓峡部」に繰り返しのストレスがかかることで生じる<strong>疲労骨折</strong>です。成長期（12〜17歳頃）のスポーツ選手に多く、腰を反らす・ひねる動作が多いスポーツで起こりやすい傾向があります。
            </p>
            <p className="text-slate-700 leading-relaxed text-sm mt-3">
              初期・進行期に適切な安静と治療を行えば<strong>骨癒合（骨がくっつく）</strong>が期待できますが、放置して悪化すると骨癒合が困難になり、慢性腰痛の原因になる場合があります。下関市で腰椎分離症の治療を希望される場合は、早期の対処が重要です。
            </p>
          </div>

          {/* ===== 重要な注意点 ===== */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <h3 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
              <AlertCircle size={18} className="text-amber-600" />
              整骨院での対応について
            </h3>
            <p className="text-amber-700 text-sm leading-relaxed">
              腰椎分離症の診断・安静期の管理は<strong>整形外科での画像検査（X線・MRI・CT）が必要</strong>です。ゆうき整骨院では医療機関の診断に基づき、骨癒合後の体幹機能回復・スポーツ復帰リハビリに対応します。「腰が痛いけど病院に行っていない」という場合は、まず整形外科の受診をお勧めします。
            </p>
          </div>

          {/* ===== 症状 ===== */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-5">こんな症状はありませんか？</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                '腰を反らすと痛みが増す',
                '片側または両側の腰に鈍痛がある',
                '長時間の運動後に腰が痛む',
                '成長期の子どもに腰痛が続いている',
                '「ただの腰痛」と言われたが改善しない',
                '野球の投球・バッティング時に腰が痛い',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 bg-slate-50 rounded-xl p-4">
                  <CheckCircle2 size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  <span className="text-slate-700 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ===== リハビリの流れ ===== */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-1 h-8 bg-blue-700 rounded-full shrink-0" />
              <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                リハビリの流れ
              </h2>
            </div>
            <div className="space-y-4">
              {phases.map((p) => (
                <div key={p.phase} className="border border-slate-100 rounded-xl overflow-hidden">
                  <div className="bg-navy text-white px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="bg-blue-500/30 text-blue-200 text-xs font-bold px-2 py-0.5 rounded">{p.phase}</span>
                      <span className="font-semibold">{p.title}</span>
                    </div>
                    <span className="text-blue-300 text-sm shrink-0">{p.period}</span>
                  </div>
                  <div className="p-5">
                    <ul className="space-y-2">
                      {p.goals.map((g) => (
                        <li key={g} className="flex items-start gap-2 text-sm text-slate-700">
                          <CheckCircle2 size={16} className="text-blue-600 shrink-0 mt-0.5" />
                          {g}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-slate-500 mt-3 bg-slate-50 px-3 py-2 rounded-lg">{p.notes}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ===== アプローチ ===== */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-1 h-8 bg-blue-700 rounded-full shrink-0" />
              <h2 className="text-xl font-bold text-slate-900">ゆうき整骨院のアプローチ</h2>
            </div>
            <ul className="space-y-3">
              {[
                '整形外科との連携（主治医の指示に沿ったリハビリ）',
                '骨癒合後の体幹インナーマッスルの段階的強化',
                '股関節・胸椎の柔軟性改善（腰部負担の軽減）',
                '競技特性に応じた動作改善（投球・スウィング等）',
                '学校・部活スケジュールに合わせた段階的復帰',
                '再受傷・再分離予防のための姿勢・動作教育',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-blue-600 shrink-0 mt-0.5" />
                  <span className="text-slate-700 text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gradient-to-br from-navy to-blue-800 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">下関の腰椎分離症リハビリはゆうき整骨院へ</h2>
            <p className="text-blue-200 mb-6 text-sm">
              骨癒合後「さあ復帰」のタイミングから、<br />
              体幹機能・競技動作の回復をサポートします。
            </p>
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
