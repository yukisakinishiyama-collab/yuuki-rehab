import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: '下関市のオスグッド治療｜スポーツを続けながら改善するリハビリ',
  description: '下関市のゆうき整骨院。オスグッド・シュラッター病の治療・リハビリ。「安静だけ」でなく、原因となる動作・筋力バランスを改善し、スポーツを続けながら回復する方法を提供します。',
}

export default function OsgoodPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-navy to-blue-800 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex items-center gap-2 text-blue-300 text-sm mb-6">
            <Link href="/" className="hover:text-white">ホーム</Link>
            <ChevronRight size={14} />
            <Link href="/symptoms" className="hover:text-white">症状・お悩み</Link>
            <ChevronRight size={14} />
            <span className="text-white">オスグッド病</span>
          </nav>
          <span className="inline-block bg-blue-500/30 text-blue-200 text-xs font-bold px-3 py-1 rounded-full mb-4">下関市 成長期障害</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            オスグッド・シュラッター病の治療・リハビリ
          </h1>
          <p className="text-blue-100 max-w-2xl leading-relaxed">
            「安静にしなさい」と言われたまま改善しない方へ。スポーツを続けながら回復できる方法があります。下関市でオスグッドの治療・リハビリをお探しの方はゆうき整骨院へ。
          </p>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 space-y-8">

          <div className="bg-blue-50 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle size={22} className="text-blue-700" />
              オスグッド病とは
            </h2>
            <p className="text-slate-700 leading-relaxed">
              オスグッド・シュラッター病とは、成長期（10〜15歳頃）の子どもに多い膝の下（脛骨粗面）の痛みです。ジャンプ・キック・ダッシュなどの繰り返しの動作で大腿四頭筋が脛骨粗面を引っ張り続け、炎症・疼痛が生じます。サッカー・バスケット・陸上など、跳躍・ダッシュを多用するスポーツに多く見られます。
            </p>
            <p className="text-slate-700 leading-relaxed mt-4">
              成長期に起こるため「成長すれば治る」と言われることもありますが、適切な治療なしに放置すると慢性化・骨の突出が残るケースもあります。<strong>下関でオスグッド病の治療</strong>を希望される場合は、早めの対処が重要です。
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-5">「安静だけ」では改善しない理由</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  title: '筋肉の硬さが原因',
                  desc: '大腿四頭筋・ハムストリングスの柔軟性低下が脛骨粗面への牽引力を高めています。安静で炎症は収まっても、筋肉の問題は残ります。',
                },
                {
                  title: '動作パターンの問題',
                  desc: '膝に過度な負荷がかかる走り方・着地動作が根本原因のことがあります。動作を変えなければ復帰後も繰り返します。',
                },
                {
                  title: '成長期特有のリスク',
                  desc: '骨の成長に腱・筋肉が追いついていない時期です。適切な柔軟性・筋力バランスを保つことが重要です。',
                },
                {
                  title: '心理的な影響',
                  desc: '「痛みが怖い」「スポーツを諦めなければいけない」という不安を抱えたままでは回復が遅れます。',
                },
              ].map((item) => (
                <div key={item.title} className="bg-slate-50 rounded-xl p-5">
                  <h3 className="font-bold text-slate-800 mb-2 text-sm">{item.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-5">ゆうき整骨院のアプローチ</h2>
            <ul className="space-y-3">
              {[
                '大腿四頭筋・ハムストリングスのストレッチ指導',
                '股関節・体幹の機能改善（膝への負担を分散させる）',
                '痛みを抑えながら続けられるスポーツ参加の調整',
                'ジャンプ・着地動作の改善指導',
                '保護者・指導者への説明・連携',
                '成長期に合わせた適切な運動量の管理',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-blue-600 shrink-0 mt-0.5" />
                  <span className="text-slate-700 text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gradient-to-br from-navy to-blue-800 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">下関のオスグッド治療はゆうき整骨院へ</h2>
            <p className="text-blue-200 mb-6 text-sm">
              「スポーツを諦めてほしくない」<br />
              子どもの痛みでお悩みの保護者の方も、まずはご相談ください。
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
