import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react'

export const metadata: Metadata = {
  title: '下関市のシーバー病（踵骨骨端症）治療｜スポーツを続けながら改善',
  description: '下関市のゆうき整骨院。シーバー病（踵骨骨端症）の治療・リハビリ。かかとの痛みで悩む小学生・中学生アスリートを対象に、スポーツを続けながら回復できるプログラムを提供します。',
}

export default function SeversPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-navy to-blue-800 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex items-center gap-2 text-blue-300 text-sm mb-6">
            <Link href="/" className="hover:text-white">ホーム</Link>
            <ChevronRight size={14} />
            <Link href="/symptoms" className="hover:text-white">症状・お悩み</Link>
            <ChevronRight size={14} />
            <span className="text-white">シーバー病</span>
          </nav>
          <span className="inline-block bg-blue-500/30 text-blue-200 text-xs font-bold px-3 py-1 rounded-full mb-4">下関市 成長期障害</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            シーバー病（踵骨骨端症）の治療・リハビリ
          </h1>
          <p className="text-blue-100 max-w-2xl leading-relaxed">
            かかとの痛みで練習を休まなければならない子どもたちへ。成長期特有のかかとの痛みをコントロールしながら、スポーツを続ける方法があります。
          </p>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 space-y-10">

          {/* ===== シーバー病とは ===== */}
          <div className="bg-blue-50 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle size={22} className="text-blue-700" />
              シーバー病（踵骨骨端症）とは
            </h2>
            <p className="text-slate-700 leading-relaxed text-sm">
              シーバー病（踵骨骨端症）とは、成長期（7〜12歳頃）に多い踵（かかと）の痛みです。成長期の踵には骨の成長軟骨（骨端核）があり、アキレス腱・足底腱膜に引っ張られることで炎症・疼痛が生じます。
            </p>
            <p className="text-slate-700 leading-relaxed text-sm mt-3">
              サッカー・陸上・バスケットなど、走る・跳ぶ動作が多いスポーツで起こりやすく、特に<strong>成長スパート（急に身長が伸びる時期）</strong>に症状が出やすくなります。
            </p>
            <div className="mt-4 bg-white rounded-xl p-4 border border-blue-100">
              <p className="text-sm font-semibold text-slate-800 mb-1">オスグッド病との違い</p>
              <p className="text-slate-600 text-xs leading-relaxed">オスグッド病は膝の下（脛骨粗面）の痛み、シーバー病はかかと（踵骨骨端）の痛みです。どちらも同じ「成長期の腱・骨の牽引による炎症」が原因で、アプローチも似ています。</p>
            </div>
          </div>

          {/* ===== 症状 ===== */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-5">こんな症状はシーバー病かもしれません</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                'ランニング・ジャンプ後にかかとが痛む',
                '練習開始時は痛いが、動くと少し楽になる',
                'かかとの後ろ〜下を押すと痛い',
                '成長期（小学生〜中学生）の子どもに起きた',
                '両足ともかかとが痛い（両側性も多い）',
                '最近急に身長が伸びた',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 bg-slate-50 rounded-xl p-4">
                  <CheckCircle2 size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  <span className="text-slate-700 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ===== 安静だけではいけない理由 ===== */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-4">「安静だけ」では改善しない理由</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  title: '筋肉の硬さが根本原因',
                  desc: 'ふくらはぎ（下腿三頭筋）の柔軟性低下がアキレス腱を通じて踵骨を引っ張り続けます。筋肉の柔軟性を改善しなければ、練習を再開するとすぐ再発します。',
                },
                {
                  title: '足のアーチ・着地動作の問題',
                  desc: '扁平足や過回内（かかとが内側に倒れる）があると踵へのストレスが増加します。インソールや動作改善で対処できます。',
                },
                {
                  title: '体重・成長の影響',
                  desc: '成長期は骨が伸びるのに対して筋肉・腱の伸長が追いつかないため、柔軟性を保つことが特に重要です。',
                },
                {
                  title: 'スポーツへの心理的影響',
                  desc: '痛みで練習を長期離脱すると、体力・技術・チームとの関係が失われます。適切な管理でスポーツを続けることが最善です。',
                },
              ].map((item) => (
                <div key={item.title} className="bg-slate-50 rounded-xl p-4">
                  <h3 className="font-bold text-slate-800 mb-2 text-sm">{item.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{item.desc}</p>
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
                'ふくらはぎ・アキレス腱のストレッチ指導',
                '足のアーチ機能の評価とインソール提案',
                '痛みを抑えながら続けられる練習量の調整',
                '着地・走り方の動作改善',
                '保護者・指導者への説明と連携',
                '成長スパートに合わせた柔軟性管理',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-blue-600 shrink-0 mt-0.5" />
                  <span className="text-slate-700 text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <h3 className="font-bold text-slate-800 mb-2 text-sm">骨折との鑑別について</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              強い痛みが続く場合、踵骨の疲労骨折との鑑別が必要です。画像検査（X線・MRI）が必要なケースは医療機関をご紹介します。
            </p>
          </div>

          <div className="bg-gradient-to-br from-navy to-blue-800 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">下関のシーバー病治療はゆうき整骨院へ</h2>
            <p className="text-blue-200 mb-6 text-sm">
              「スポーツをやめなければいけないの？」<br />
              まずはご相談ください。続けながら治す方法を一緒に考えます。
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
