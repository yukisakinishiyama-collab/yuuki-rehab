import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react'

export const metadata: Metadata = {
  title: '下関市の肉離れ治療・リハビリ｜早期回復と競技復帰をサポート',
  description: '下関市のゆうき整骨院。肉離れ（筋肉の損傷）の初期対応から段階的リハビリ・競技復帰まで対応。太もも・ふくらはぎ・ハムストリングスの肉離れに対応。再受傷予防を重視したリハビリを提供します。',
}

const grades = [
  {
    grade: 'Grade Ⅰ（軽症）',
    desc: '筋線維の微細損傷。強い痛みはあるが機能的には比較的保たれている。復帰目安：2〜3週',
    color: 'bg-green-50 border-green-100',
  },
  {
    grade: 'Grade Ⅱ（中等症）',
    desc: '筋線維の部分断裂。腫脹・皮下出血を伴うことがある。復帰目安：4〜8週',
    color: 'bg-amber-50 border-amber-100',
  },
  {
    grade: 'Grade Ⅲ（重症）',
    desc: '筋の完全断裂。強い痛みと機能障害。場合によって手術適応。復帰目安：3ヶ月以上',
    color: 'bg-red-50 border-red-100',
  },
]

const phases = [
  {
    phase: 'Phase 1',
    period: '受傷後〜1週',
    title: '急性期管理（POLICE）',
    goals: ['Protect：部分的な保護（完全固定は不要）', 'Optimal Loading：痛みのない範囲での早期荷重', 'Ice / Compression / Elevation：炎症のコントロール'],
    notes: '過度な安静（完全固定）は組織の回復を遅らせます。痛みのない範囲での早期運動が推奨されます',
  },
  {
    phase: 'Phase 2',
    period: '1〜3週',
    title: '組織修復・柔軟性回復',
    goals: ['段階的なストレッチの開始', '筋力トレーニング（等尺性→等張性）', '正常歩行の回復'],
    notes: '痛みを引き起こすほどの強いストレッチは逆効果。適切な強度が重要',
  },
  {
    phase: 'Phase 3',
    period: '3週〜',
    title: 'スポーツ動作の再学習',
    goals: ['ジョギング→ランニング→ダッシュの段階的負荷', '競技特性に応じた動作練習', '再発リスクの動作分析と改善'],
    notes: 'Grade・部位によって期間は異なります。焦りは再受傷の最大のリスク',
  },
]

export default function MuscleStrainPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-navy to-blue-800 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex items-center gap-2 text-blue-300 text-sm mb-6">
            <Link href="/" className="hover:text-white">ホーム</Link>
            <ChevronRight size={14} />
            <Link href="/symptoms" className="hover:text-white">症状・お悩み</Link>
            <ChevronRight size={14} />
            <span className="text-white">肉離れ</span>
          </nav>
          <span className="inline-block bg-blue-500/30 text-blue-200 text-xs font-bold px-3 py-1 rounded-full mb-4">下関市 スポーツ外傷</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            肉離れの治療・リハビリ
          </h1>
          <p className="text-blue-100 max-w-2xl leading-relaxed">
            「しっかり休んだのに再発した」という肉離れは、根本的な回復ができていないサインです。段階的なリハビリで再受傷を防ぎながら競技に戻ります。
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <span className="bg-white/20 text-white text-sm font-semibold px-4 py-1.5 rounded-full">ハムストリングス</span>
            <span className="bg-white/10 text-blue-200 text-sm px-4 py-1.5 rounded-full border border-white/20">大腿四頭筋</span>
            <span className="bg-white/10 text-blue-200 text-sm px-4 py-1.5 rounded-full border border-white/20">ふくらはぎ</span>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 space-y-10">

          {/* ===== 肉離れとは ===== */}
          <div className="bg-blue-50 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle size={22} className="text-blue-700" />
              肉離れとは
            </h2>
            <p className="text-slate-700 leading-relaxed text-sm">
              肉離れとは、筋肉が急激に引き伸ばされることで起こる筋線維の損傷です。ダッシュのスタート・急停止・ジャンプ着地などで多く起こり、「ブチッ」という感覚とともに強い痛みが生じます。
            </p>
            <p className="text-slate-700 leading-relaxed text-sm mt-3">
              スポーツ選手に多いのは<strong>ハムストリングス（太もも裏）・大腿四頭筋（太もも前）・腓腹筋（ふくらはぎ）</strong>の肉離れです。下関市でスポーツ中の肉離れが起きた際は、早めにご相談ください。
            </p>
          </div>

          {/* ===== 重症度 ===== */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-5">重症度の分類</h2>
            <div className="space-y-3">
              {grades.map((g) => (
                <div key={g.grade} className={`border rounded-xl p-4 ${g.color}`}>
                  <p className="font-bold text-slate-800 text-sm mb-1">{g.grade}</p>
                  <p className="text-slate-600 text-sm leading-relaxed">{g.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3 bg-slate-50 px-4 py-3 rounded-lg">
              ※ 復帰目安はあくまで目安です。部位・年齢・競技レベル・個人差によって大きく異なります。
            </p>
          </div>

          {/* ===== なぜ再発するのか ===== */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-4">肉離れが「再発しやすい」理由</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  title: '痛みが取れただけで復帰する',
                  desc: '痛みがなくなっても筋力・柔軟性・神経筋コントロールが回復していないため、同じ動作で再断裂が起きやすい。',
                },
                {
                  title: '瘢痕組織が柔軟性を低下させる',
                  desc: '修復過程で形成される瘢痕（傷跡）組織は柔軟性が低い。適切なリハビリなしでは新たな断裂の起点になる。',
                },
                {
                  title: '動作パターンの問題',
                  desc: 'スプリント時のフォームや着地動作に問題があると、特定の筋肉に過度な負荷が集中し続ける。',
                },
                {
                  title: '拮抗筋とのバランス不良',
                  desc: '例えばハムストリングス単独を強化しても、大腿四頭筋との筋力バランスが崩れたままでは再受傷リスクが高い。',
                },
              ].map((item) => (
                <div key={item.title} className="bg-slate-50 rounded-xl p-4">
                  <h3 className="font-bold text-slate-800 mb-2 text-sm">{item.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{item.desc}</p>
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
                    <span className="text-blue-300 text-sm">{p.period}</span>
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
                '受傷直後の正しい初期対応（POLICE）の指導',
                '損傷部位・重症度に応じた段階的な運動療法',
                '筋力・柔軟性・神経筋コントロールの同時回復',
                'スプリント動作・着地フォームの分析と改善',
                '復帰基準の明確化（筋力比・機能テスト）',
                '再受傷予防のためのトレーニング継続指導',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-blue-600 shrink-0 mt-0.5" />
                  <span className="text-slate-700 text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gradient-to-br from-navy to-blue-800 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">下関の肉離れ治療・リハビリはゆうき整骨院へ</h2>
            <p className="text-blue-200 mb-6 text-sm">
              「また再発した」を繰り返さないために、<br />
              根本からしっかり治しましょう。
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
