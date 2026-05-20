import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: '下関市の野球肘・肘関節障害のリハビリ｜内側・外側障害に対応',
  description: '下関市のゆうき整骨院。野球肘（内側型・外側型）のリハビリ。肘だけでなく肩・体幹・投球動作全体を評価し、根本から改善。学生アスリートの競技復帰を全力サポート。',
}

export default function BaseballElbowPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-navy to-blue-800 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex items-center gap-2 text-blue-300 text-sm mb-6">
            <Link href="/" className="hover:text-white">ホーム</Link>
            <ChevronRight size={14} />
            <Link href="/symptoms" className="hover:text-white">症状・お悩み</Link>
            <ChevronRight size={14} />
            <span className="text-white">野球肘</span>
          </nav>
          <span className="inline-block bg-blue-500/30 text-blue-200 text-xs font-bold px-3 py-1 rounded-full mb-4">下関市 投球障害</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">野球肘（肘関節障害）のリハビリ</h1>
          <p className="text-blue-100 max-w-2xl leading-relaxed">
            野球肘は放置すると選手生命に関わる障害に発展することがあります。早期発見・早期対応が鍵です。下関市の整骨院で投球障害・野球肘のリハビリはゆうき整骨院へ。
          </p>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 space-y-8">
          <div className="bg-blue-50 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle size={22} className="text-blue-700" />
              野球肘の種類と特徴
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  type: '内側型',
                  detail: '内側側副靱帯損傷・内側上顆裂離骨折（成長期）。投球時の肘の内側の痛み。中高生に多い。',
                },
                {
                  type: '外側型（離断性骨軟骨炎）',
                  detail: '外側の骨軟骨障害。進行すると手術が必要になることも。早期発見が非常に重要。',
                },
              ].map((item) => (
                <div key={item.type} className="bg-white rounded-xl p-4 border border-slate-100">
                  <p className="font-bold text-blue-700 mb-2 text-sm">{item.type}</p>
                  <p className="text-slate-600 text-sm leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-5">ゆうき整骨院の野球肘リハビリ</h2>
            <ul className="space-y-3">
              {[
                '整形外科との連携（レントゲン・MRI確認後のリハビリ）',
                '投球数・負荷の管理・段階的な投球再開',
                '肘関節の可動域・安定性の回復',
                '前腕・肩・体幹の機能改善（肘への負荷軽減）',
                '投球フォームの動作分析・修正',
                '成長期選手への適切な指導・保護者・指導者との連携',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-blue-600 shrink-0 mt-0.5" />
                  <span className="text-slate-700 text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <p className="text-amber-800 text-sm font-semibold mb-1">⚠️ 野球肘の早期受診のすすめ</p>
            <p className="text-amber-700 text-sm leading-relaxed">
              外側型（離断性骨軟骨炎）は特に進行が速く、放置すると保存療法では改善しないケースがあります。「肘が痛い」と感じたら、まず整形外科でのレントゲン評価を受け、その後のリハビリをゆうき整骨院にお任せください。
            </p>
          </div>

          <div className="bg-gradient-to-br from-navy to-blue-800 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">下関の野球肘リハビリはゆうき整骨院へ</h2>
            <p className="text-blue-200 mb-6 text-sm">肘の痛みは早期対応が大切です。まずはご相談ください。</p>
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
