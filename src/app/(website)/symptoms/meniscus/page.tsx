import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react'

export const metadata: Metadata = {
  title: '下関市の半月板術前・術後リハビリ｜プレハビリから競技復帰まで',
  description: '下関市のゆうき整骨院。半月板損傷・半月板手術（縫合術・切除術）の術前リハビリ（プレハビリテーション）から術後リハビリ・競技復帰まで一貫対応。医療機関と連携しながら段階的に回復をサポートします。',
}

const prehabGoals = [
  { title: '大腿四頭筋・殿筋の筋力を術前に高める', detail: '術後の筋力低下を最小限に抑え、回復を早める' },
  { title: '膝関節可動域の確保', detail: '術後の可動域回復がスムーズになる' },
  { title: '体幹・股関節の機能改善', detail: '膝への負荷を分散させる土台をつくる' },
  { title: '手術内容・リハビリの理解', detail: '縫合術と切除術でリハビリ期間が異なるため、正確な理解が重要' },
]

const phases = [
  {
    phase: 'Phase 1',
    period: '術後〜4週',
    title: '炎症・浮腫の管理',
    goals: ['疼痛・腫脹のコントロール', '大腿四頭筋の活性化（等尺性収縮）', '荷重・歩行の段階的な正常化'],
    notes: '縫合術の場合は荷重制限が厳格なため、主治医の指示を厳守します',
  },
  {
    phase: 'Phase 2',
    period: '4〜12週',
    title: '筋力回復・可動域改善',
    goals: ['下肢筋力の段階的強化', '膝関節可動域の回復（特に屈曲）', '固有感覚・バランストレーニング'],
    notes: '切除術と縫合術で進め方が異なります。術式に応じて個別対応',
  },
  {
    phase: 'Phase 3',
    period: '3〜5ヶ月',
    title: 'スポーツ動作の再学習',
    goals: ['ランニング・ジャンプ動作の段階的導入', '競技特性に応じたトレーニング', '方向転換・カッティング動作'],
    notes: '縫合術の場合は特にこの段階の進め方を慎重に管理します',
  },
  {
    phase: 'Phase 4',
    period: '5〜8ヶ月〜',
    title: '競技復帰',
    goals: ['復帰基準のクリア（筋力比・ホップテスト）', '段階的な練習・試合への参加', '再受傷予防のための動作教育'],
    notes: '縫合術は切除術より復帰に時間がかかる傾向があります',
  },
]

export default function MeniscusPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-navy to-blue-800 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex items-center gap-2 text-blue-300 text-sm mb-6">
            <Link href="/" className="hover:text-white">ホーム</Link>
            <ChevronRight size={14} />
            <Link href="/symptoms" className="hover:text-white">症状・お悩み</Link>
            <ChevronRight size={14} />
            <span className="text-white">半月板術前・術後リハビリ</span>
          </nav>
          <span className="inline-block bg-blue-500/30 text-blue-200 text-xs font-bold px-3 py-1 rounded-full mb-4">下関市 術前・術後リハビリ</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            半月板術前・術後リハビリ
          </h1>
          <p className="text-blue-100 max-w-2xl leading-relaxed">
            半月板縫合術・切除術の術前から術後の段階的リハビリ・競技復帰まで一貫してサポートします。術式によってリハビリの進め方が異なるため、個別のプログラムが重要です。
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <span className="bg-white/20 text-white text-sm font-semibold px-4 py-1.5 rounded-full">術前リハビリ（プレハビリ）</span>
            <span className="bg-white/10 text-blue-200 text-sm px-4 py-1.5 rounded-full border border-white/20">術後リハビリ</span>
            <span className="bg-white/10 text-blue-200 text-sm px-4 py-1.5 rounded-full border border-white/20">縫合術・切除術対応</span>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 space-y-10">

          {/* ===== 術式の違い ===== */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <h2 className="font-bold text-amber-800 mb-3 flex items-center gap-2">
              <AlertCircle size={20} className="text-amber-600" />
              縫合術と切除術：リハビリの進み方が異なります
            </h2>
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div className="bg-white rounded-xl p-4 border border-amber-100">
                <p className="font-bold text-slate-800 text-sm mb-1">半月板縫合術</p>
                <p className="text-slate-600 text-xs leading-relaxed">半月板を縫い合わせて温存する手術。修復組織の保護が必要なため荷重制限が厳格で、復帰まで4〜8ヶ月程度。</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-amber-100">
                <p className="font-bold text-slate-800 text-sm mb-1">半月板切除術（部分切除）</p>
                <p className="text-slate-600 text-xs leading-relaxed">損傷した部分を取り除く手術。荷重制限が比較的少なく、復帰は2〜4ヶ月程度と早い傾向がある。</p>
              </div>
            </div>
          </div>

          {/* ===== 術前リハビリ ===== */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-1 h-8 bg-sky-500 rounded-full shrink-0" />
              <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                術前リハビリ（プレハビリテーション）
              </h2>
            </div>

            <div className="bg-sky-50 border border-sky-100 rounded-2xl p-6 md:p-8 mb-6">
              <p className="text-slate-700 leading-relaxed text-sm">
                手術が決まったら「待つだけ」にせず、<strong>術前から筋力・可動域を高めておく</strong>ことが術後回復を大きく左右します。特に半月板手術後は大腿四頭筋の筋力低下が顕著なため、術前の筋力が高いほど術後の回復が早くなります。
              </p>
              <p className="text-slate-700 leading-relaxed text-sm mt-3">
                ゆうき整骨院では<strong>下関市で半月板術前リハビリ</strong>を希望する方に、手術日から逆算した個別プログラムを提供しています。
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
                半月板術後のリハビリは<strong>術式・損傷部位・年齢・スポーツ種目</strong>によって大きく異なります。「何ヶ月で復帰できる」という画一的な基準ではなく、段階的な評価をもとに進めます。
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
          </div>

          {/* ===== 選ばれる理由 ===== */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-1 h-8 bg-blue-700 rounded-full shrink-0" />
              <h2 className="text-xl font-bold text-slate-900">ゆうき整骨院が選ばれる理由</h2>
            </div>
            <ul className="space-y-3">
              {[
                '術式（縫合術・切除術）に応じた個別リハビリプログラム',
                '術前（プレハビリ）から術後まで一貫したサポート',
                '医療機関・主治医との連携を重視',
                '大腿四頭筋・固有感覚・動作パターンを同時に回復',
                '学生アスリートの大会スケジュールに合わせた進め方',
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
            <h2 className="text-2xl font-bold text-white mb-3">下関で半月板術前・術後リハビリをお探しの方へ</h2>
            <p className="text-blue-200 mb-6 text-sm">
              手術が決まった直後でも、術後の病院リハビリ終了後でも、<br />
              どのタイミングでもご相談ください。
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
