import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react'

export const metadata: Metadata = {
  title: '下関市のACL術前・術後リハビリ｜プレハビリから競技復帰まで一貫サポート',
  description: '下関市のゆうき整骨院。ACL（前十字靱帯）の術前リハビリ（プレハビリテーション）から術後リハビリ・競技復帰まで一貫対応。医療機関と連携し、科学的根拠に基づいたプログラムを提供。',
}

const prehabGoals = [
  { title: '大腿四頭筋・殿筋の筋力を術前に高める', detail: '術後に筋力が大幅に低下しても回復が早い' },
  { title: '膝関節可動域・柔軟性の確保', detail: '術後の可動域回復がスムーズになる' },
  { title: '体幹・股関節の機能改善', detail: '術後リハビリの土台をつくる' },
  { title: '手術・リハビリへの理解と心理的準備', detail: '不安を減らし、術後の積極的なリハビリにつながる' },
]

const phases = [
  {
    phase: 'Phase 1',
    period: '術後〜4週',
    title: '炎症・浮腫の管理',
    goals: ['疼痛・腫脹のコントロール', '大腿四頭筋の活性化', '歩行の正常化'],
    notes: '医療機関の指示に沿って慎重に進めます',
  },
  {
    phase: 'Phase 2',
    period: '4〜12週',
    title: '筋力回復・可動域改善',
    goals: ['下肢筋力の段階的強化', '膝関節可動域の回復', '固有感覚トレーニング'],
    notes: 'ランニング・ジャンプは段階を追って開始',
  },
  {
    phase: 'Phase 3',
    period: '3〜6ヶ月',
    title: 'スポーツ動作の再学習',
    goals: ['方向転換・カッティング動作', '競技特性に応じたトレーニング', '心理的な不安の解消'],
    notes: '競技特性・ポジションに合わせて個別対応',
  },
  {
    phase: 'Phase 4',
    period: '6ヶ月〜',
    title: '競技復帰',
    goals: ['復帰基準のクリア（筋力比・動作評価）', '段階的な練習・試合への参加', '再受傷予防教育'],
    notes: '復帰後のフォローアップも継続',
  },
]

export default function AclPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-navy to-blue-800 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex items-center gap-2 text-blue-300 text-sm mb-6">
            <Link href="/" className="hover:text-white">ホーム</Link>
            <ChevronRight size={14} />
            <Link href="/symptoms" className="hover:text-white">症状・お悩み</Link>
            <ChevronRight size={14} />
            <span className="text-white">ACL術前・術後リハビリ</span>
          </nav>
          <span className="inline-block bg-blue-500/30 text-blue-200 text-xs font-bold px-3 py-1 rounded-full mb-4">下関市 術前・術後リハビリ</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            ACL（前十字靱帯）術前・術後リハビリ
          </h1>
          <p className="text-blue-100 max-w-2xl leading-relaxed">
            手術前の「プレハビリテーション」から、術後の段階的リハビリ・競技復帰まで一貫してサポートします。術前から身体を整えることが、術後回復を大きく左右します。
          </p>
          {/* Tab-style indicators */}
          <div className="flex flex-wrap gap-3 mt-6">
            <span className="bg-white/20 text-white text-sm font-semibold px-4 py-1.5 rounded-full">術前リハビリ（プレハビリ）</span>
            <span className="bg-white/10 text-blue-200 text-sm px-4 py-1.5 rounded-full border border-white/20">術後リハビリ</span>
            <span className="bg-white/10 text-blue-200 text-sm px-4 py-1.5 rounded-full border border-white/20">競技復帰サポート</span>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 space-y-10">

          {/* ===== 術前リハビリ ===== */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-1 h-8 bg-sky-500 rounded-full shrink-0" />
              <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                術前リハビリ（プレハビリテーション）
              </h2>
            </div>

            <div className="bg-sky-50 border border-sky-100 rounded-2xl p-6 md:p-8 mb-6">
              <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                <AlertCircle size={20} className="text-sky-600" />
                術前リハビリとは？なぜ重要なのか
              </h3>
              <p className="text-slate-700 leading-relaxed text-sm">
                「プレハビリテーション（術前リハビリ）」とは、手術を受ける前に身体機能を高めておくリハビリです。エビデンスに基づく研究では、<strong>術前の筋力・可動域が高いほど術後の回復が早く</strong>、最終的な競技復帰のレベルも高くなることが示されています。
              </p>
              <p className="text-slate-700 leading-relaxed text-sm mt-3">
                手術が決まってから「何もしないで待つ」のではなく、術前のこの期間を積極的に活用することが重要です。ゆうき整骨院では<strong>下関市でACL術前リハビリ</strong>を希望する方に、手術日から逆算した個別プログラムを提供しています。
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {prehabGoals.map((item) => (
                <div key={item.title} className="bg-white border border-sky-100 rounded-xl p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-sky-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800 mb-0.5">{item.title}</p>
                      <p className="text-xs text-slate-500 leading-relaxed">{item.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 bg-slate-50 rounded-xl p-4 text-sm text-slate-600 leading-relaxed">
              <strong className="text-slate-800">期間の目安：</strong> 手術まで2〜6週間が理想ですが、期間が短くても効果があります。診断後・手術日決定後すぐにご相談ください。
            </div>
          </div>

          {/* ===== 術後リハビリ ===== */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-1 h-8 bg-blue-700 rounded-full shrink-0" />
              <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                術後リハビリの流れ
              </h2>
            </div>

            <div className="bg-blue-50 rounded-2xl p-5 md:p-6 mb-6">
              <p className="text-slate-700 leading-relaxed text-sm">
                前十字靱帯（ACL）再建術後の回復期間は一般的に<strong>6〜12ヶ月</strong>とされていますが、単に時間が経過するだけでは不十分です。筋力・固有感覚・動作パターンを同時に回復させる段階的なリハビリが、再受傷予防と早期競技復帰の両立につながります。
              </p>
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
                        <li key={g} className="flex items-center gap-2 text-sm text-slate-700">
                          <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
                          {g}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-slate-500 mt-3 bg-slate-50 px-3 py-2 rounded-lg">{p.notes}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mt-5">
              <h3 className="font-bold text-amber-800 mb-2">競技復帰の判断について</h3>
              <p className="text-amber-700 text-sm leading-relaxed">
                競技復帰の判断は「術後何ヶ月」だけで決めることは危険です。健側との筋力比（Limb Symmetry Index）・ホップテスト・動作評価など、複数の指標をもとに判断します。「まだ怖い」という心理的な側面も重要な評価項目です。
              </p>
            </div>
          </div>

          {/* ===== 選ばれる理由 ===== */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-1 h-8 bg-blue-700 rounded-full shrink-0" />
              <h2 className="text-xl font-bold text-slate-900">ゆうき整骨院が選ばれる理由</h2>
            </div>
            <ul className="space-y-3">
              {[
                '術前（プレハビリ）から術後まで一貫したリハビリプログラム',
                '医療機関・主治医との連携を重視（手術医の指示に沿ったリハビリ）',
                '段階的な運動療法で筋力・固有感覚・動作を同時に回復',
                '競技復帰の判断に科学的な評価指標を使用',
                '学生アスリートの復帰スケジュール（大会・試合）に合わせたプログラム',
                '再受傷予防のための動作教育・神経筋トレーニング',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-blue-600 shrink-0 mt-0.5" />
                  <span className="text-slate-700 text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gradient-to-br from-navy to-blue-800 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">下関でACL術前・術後リハビリをお探しの方へ</h2>
            <p className="text-blue-200 mb-6 text-sm">
              手術が決まった直後から、術後の病院リハビリ終了後まで、どのタイミングでもご相談ください。
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
