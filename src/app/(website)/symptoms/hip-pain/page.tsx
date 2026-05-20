import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: '下関市の股関節痛リハビリ｜股関節唇損傷・股関節痛の治療',
  description: '下関市のゆうき整骨院。股関節痛・股関節唇損傷のリハビリ。股関節の痛みの原因を正確に評価し、運動療法・動作改善で根本から改善。スポーツ復帰まで一貫サポート。',
}

export default function HipPainPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-navy to-blue-800 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex items-center gap-2 text-blue-300 text-sm mb-6">
            <Link href="/" className="hover:text-white">ホーム</Link>
            <ChevronRight size={14} />
            <Link href="/symptoms" className="hover:text-white">症状・お悩み</Link>
            <ChevronRight size={14} />
            <span className="text-white">股関節痛</span>
          </nav>
          <span className="inline-block bg-blue-500/30 text-blue-200 text-xs font-bold px-3 py-1 rounded-full mb-4">下関市 股関節リハビリ</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            股関節痛・股関節唇損傷のリハビリ
          </h1>
          <p className="text-blue-100 max-w-2xl leading-relaxed">
            股関節の痛みは診断が難しく、見落とされやすい部位です。下関市で股関節痛のリハビリをお探しの方、まずは丁寧な評価から始めましょう。
          </p>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 space-y-8">
          <div className="bg-blue-50 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle size={22} className="text-blue-700" />
              股関節痛・股関節唇損傷とは
            </h2>
            <p className="text-slate-700 leading-relaxed">
              股関節唇（こかんせつしん）は股関節の安定性を保つ軟骨組織で、サッカー・体操・格闘技などの回旋動作・インパクト動作で損傷しやすい部位です。
            </p>
            <p className="text-slate-700 leading-relaxed mt-3">
              股関節痛は「鼠蹊部の痛み」「股関節の詰まり感」「ある動作で股関節が痛い」など症状が多様です。整形外科でのMRI・レントゲン評価と並行して、ゆうき整骨院では機能的な評価・リハビリを提供します。
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-5">ゆうき整骨院の股関節リハビリ</h2>
            <ul className="space-y-3">
              {[
                '股関節の可動域・安定性・筋力の包括的評価',
                '股関節インピンジメント（FAI）の動作修正',
                '股関節周囲筋（深層外旋筋・殿筋）の強化',
                '体幹・骨盤のコントロール改善',
                '術後（股関節鏡・人工股関節）リハビリへの対応',
                'スポーツ・日常生活への段階的復帰サポート',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-blue-600 shrink-0 mt-0.5" />
                  <span className="text-slate-700 text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gradient-to-br from-navy to-blue-800 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">下関の股関節痛リハビリはゆうき整骨院へ</h2>
            <p className="text-blue-200 mb-6 text-sm">「股関節が痛くてスポーツを諦めかけている」という方も、ぜひご相談ください</p>
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
