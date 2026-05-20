import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: '下関市の手関節・手首の痛みリハビリ｜TFCC損傷・腱鞘炎・スポーツ手関節障害',
  description: '下関市のゆうき整骨院。手首の痛み（TFCC損傷・腱鞘炎・手関節捻挫・スポーツ手関節障害）に対応。競技復帰・日常生活への復帰まで、動作評価と運動療法でサポートします。',
}

const phases = [
  {
    phase: 'Phase 1',
    title: '疼痛管理・評価',
    period: '初回〜',
    items: [
      '痛みの部位・誘発動作・安静時痛の評価',
      '手関節・前腕の可動域・筋力チェック',
      '圧痛部位・特殊テストによる損傷部位の特定',
      '必要に応じて整形外科受診・画像診断の提案',
    ],
  },
  {
    phase: 'Phase 2',
    title: '機能回復',
    period: '2〜4週',
    items: [
      '手関節・前腕の可動域改善',
      '握力・前腕筋の段階的な筋力強化',
      '患部外（肩・肘）の機能改善',
      '痛みの少ない範囲での競技特有の動作練習',
    ],
  },
  {
    phase: 'Phase 3',
    title: '競技・日常生活復帰',
    period: '1〜2ヶ月〜',
    items: [
      '投球・ラケット・体操など競技動作への対応',
      '再受傷予防のためのテーピング・フォーム指導',
      'セルフケア（ストレッチ・筋トレ）の習慣化',
      '段階的な練習参加〜フル競技復帰',
    ],
  },
]

export default function WristPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-navy to-blue-800 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex items-center gap-2 text-blue-300 text-sm mb-6">
            <Link href="/" className="hover:text-white">ホーム</Link>
            <ChevronRight size={14} />
            <Link href="/symptoms" className="hover:text-white">症状・お悩み</Link>
            <ChevronRight size={14} />
            <span className="text-white">手関節・手首の痛み</span>
          </nav>
          <span className="inline-block bg-blue-500/30 text-blue-200 text-xs font-bold px-3 py-1 rounded-full mb-4">下関市 手関節障害</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            手関節・手首の痛みのリハビリ
          </h1>
          <p className="text-blue-100 max-w-2xl leading-relaxed">
            「手首が痛くてボールが投げられない」「押さえると手首の小指側が痛む」——手関節の痛みは種類が多く、原因によって対応が異なります。正確な評価と適切なリハビリで、スポーツ・日常生活への早期復帰を目指します。
          </p>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 space-y-10">

          {/* 対応する手関節疾患 */}
          <div className="bg-blue-50 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle size={22} className="text-blue-700" />
              対応する手関節の症状
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { label: '手関節捻挫', desc: '転倒・接触による手首の靭帯損傷' },
                { label: 'TFCC損傷', desc: '小指側の手首の痛み・不安定感' },
                { label: '腱鞘炎（ドケルバン病）', desc: '親指側の手首の痛み・腫れ' },
                { label: 'スポーツ手関節障害', desc: '投球・体操・ラケット競技による繰り返しの痛み' },
                { label: '手根管症候群（軽症）', desc: '手のしびれ・夜間痛（重症例は医療機関へ）' },
                { label: '尺側手根伸筋腱障害', desc: '手首外側から小指側にかけての痛み' },
              ].map((item) => (
                <div key={item.label} className="bg-white rounded-xl p-4 border border-blue-100">
                  <p className="font-semibold text-slate-800 text-sm">{item.label}</p>
                  <p className="text-slate-500 text-xs mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-slate-600 text-sm mt-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              ⚠️ 骨折の疑い・手根管症候群の重症例・手指の麻痺や強いしびれがある場合は、整形外科での診察が優先です。必要に応じてご紹介します。
            </p>
          </div>

          {/* TFCC損傷について */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-5">TFCC損傷について</h2>
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
              <p className="text-slate-700 leading-relaxed text-sm mb-4">
                TFCC（三角線維軟骨複合体）は手首の小指側にある軟骨・靭帯の複合体で、手首の安定性と前腕の回旋動作に重要な役割を果たします。
              </p>
              <p className="text-slate-700 leading-relaxed text-sm mb-4">
                転倒時に手をついたり、テニス・バドミントンなどのラケット操作、柔道・体操などの競技で損傷しやすく、<strong>「手首の小指側の痛み」「前腕を回すと痛む」「握力低下」</strong>などが典型的な症状です。
              </p>
              <p className="text-slate-700 leading-relaxed text-sm">
                診断にはMRIが有用で、損傷程度によって保存療法（リハビリ）か手術かが決まります。ゆうき整骨院では保存療法でのリハビリに対応し、必要な場合は整形外科へご紹介しています。
              </p>
            </div>
          </div>

          {/* リハビリの流れ */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-6">リハビリの流れ</h2>
            <div className="space-y-4">
              {phases.map((p) => (
                <div key={p.phase} className="border border-slate-100 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="bg-blue-700 text-white text-xs font-bold px-3 py-1 rounded-full">{p.phase}</span>
                    <h3 className="font-bold text-slate-900">{p.title}</h3>
                    <span className="ml-auto text-xs text-slate-400">{p.period}</span>
                  </div>
                  <ul className="space-y-2">
                    {p.items.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 size={16} className="text-blue-500 shrink-0 mt-0.5" />
                        <span className="text-slate-600 text-sm">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* 対応競技 */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-5">手関節障害が多い競技・場面</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: '野球・ソフトボール', desc: '投球動作・スイング時の手首負担' },
                { label: 'テニス・バドミントン', desc: 'インパクト時のTFCC・腱鞘への衝撃' },
                { label: '体操・新体操', desc: '倒立・支持動作による過負荷' },
                { label: '柔道・レスリング', desc: '組み手・転倒による捻挫・TFCC損傷' },
                { label: 'バスケ・バレー', desc: 'ボールを突き指・手首捻挫' },
                { label: 'デスクワーク', desc: 'PC操作による腱鞘炎・手根管症候群' },
              ].map((s) => (
                <div key={s.label} className="bg-blue-50 rounded-xl p-4">
                  <p className="font-bold text-slate-800 text-sm mb-1">{s.label}</p>
                  <p className="text-slate-500 text-xs">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ゆうき整骨院の対応 */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-5">ゆうき整骨院でできること</h2>
            <ul className="space-y-3">
              {[
                '手関節・前腕・肘の詳細な評価と損傷部位の特定',
                '保存療法（固定・手技・運動療法）によるリハビリ',
                '競技特有の動作に合わせたフォーム指導・テーピング',
                '骨折・手術が必要なケースの整形外科へのご紹介',
                '術後（TFCC縫合・靭帯再建など）のリハビリ対応',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-blue-600 shrink-0 mt-0.5" />
                  <span className="text-slate-700 text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-br from-navy to-blue-800 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">下関の手首・手関節の痛みはゆうき整骨院へ</h2>
            <p className="text-blue-200 text-sm mb-6">「手首が痛くてプレーできない」「どこに行けばいいかわからない」という方はご相談ください</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="https://lin.ee/uaGKbfk"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-line hover:bg-line-dark text-white font-bold px-8 py-4 rounded-full transition-all hover:scale-105"
              >
                LINEで予約・相談する
              </a>
              <Link
                href="/symptoms"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-full border border-white/30 transition-all"
              >
                症状一覧に戻る <ChevronRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
