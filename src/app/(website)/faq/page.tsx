'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'

const faqs = [
  {
    category: '来院について',
    items: [
      {
        q: '予約なしで来院できますか？',
        a: '当院は完全予約制です。飛び込みでのご来院はお受けできない場合がありますので、まずLINEまたはお電話でご連絡ください。',
      },
      {
        q: '初診の持ち物はありますか？',
        a: '保険証（健康保険・労災・交通事故）をお持ちください。整形外科などで検査画像（MRI・レントゲン）をお持ちの方は、ご持参いただけると診察に役立ちます。動きやすい服装でお越しください。',
      },
      {
        q: '子どもも診てもらえますか？',
        a: 'はい、対応しています。オスグッド・シーバー病・野球肘・分離症など、成長期特有の障害を得意としています。保護者の方の同伴をお願いしています。',
      },
      {
        q: '駐車場はありますか？',
        a: '駐車場をご用意しています。詳細はアクセスページまたはLINEでご確認ください。',
      },
    ],
  },
  {
    category: '症状・治療について',
    items: [
      {
        q: '整形外科と整骨院の違いは何ですか？',
        a: '整形外科は医師による診断・投薬・手術を行う医療機関です。整骨院は柔道整復師による施術（手技・運動療法など）を行います。ゆうき整骨院では医療機関との連携を重視しており、骨折・脱臼の疑いや手術が必要と思われる場合は整形外科へご紹介しています。',
      },
      {
        q: 'スポーツを続けながら通院できますか？',
        a: 'はい、可能な場合が多いです。症状の程度によって練習参加の調整を提案しますが、「完全休止」を求めることは少なく、できる範囲でスポーツを続けながら回復するプログラムを立てます。',
      },
      {
        q: '術後すぐでも来院できますか？',
        a: '術後のリハビリは医師の指示が前提です。主治医からリハビリ許可が出た段階でご来院ください。紹介状や手術記録があればお持ちいただけると、より適切な対応が可能です。',
      },
      {
        q: 'どのくらいの通院期間が必要ですか？',
        a: '症状・重症度によって大きく異なります。急性の捻挫なら数回〜2週間程度、ACL術後リハビリでは6ヶ月〜1年程度を目安にしています。初回評価後に目安の期間をお伝えします。',
      },
      {
        q: '「マッサージに行っても治らない」という場合は？',
        a: 'スポーツ障害の多くは、単純なマッサージだけでは根本解決になりません。当院では動作評価・筋力評価・運動療法を中心にアプローチするため、マッサージで改善しなかった方に「違いがわかった」と言っていただけることが多いです。',
      },
    ],
  },
  {
    category: '費用・保険について',
    items: [
      {
        q: '保険は使えますか？',
        a: '柔道整復師の保険適用（急性の捻挫・打撲・肉離れなど）に対応しています。スポーツリハビリ・運動療法については保険外となる場合があります。詳しくはLINEまたはお電話でお問い合わせください。',
      },
      {
        q: '交通事故・労災の対応はできますか？',
        a: 'はい、対応しております。自賠責保険・労災保険どちらも対応可能です。事故直後のご来院でも構いません。まずご連絡ください。',
      },
      {
        q: '費用の目安を教えてください。',
        a: '症状・施術内容によって異なります。初回（評価・施術含む）の目安はLINEでお問い合わせいただけますとご案内できます。',
      },
    ],
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="shrink-0 w-6 h-6 rounded-full bg-blue-700 text-white text-xs font-bold flex items-center justify-center mt-0.5">Q</span>
        <span className="flex-1 font-medium text-slate-800 text-sm leading-snug">{q}</span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform mt-0.5 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="flex gap-3 px-5 pb-5 pt-2 bg-blue-50">
          <span className="shrink-0 w-6 h-6 rounded-full bg-sky-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">A</span>
          <p className="text-slate-700 text-sm leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  )
}

export default function FaqPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-navy to-blue-800 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <span className="text-blue-300 text-sm font-bold tracking-widest uppercase">FAQ</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mt-2 mb-4">よくある質問</h1>
          <p className="text-blue-100 max-w-2xl mx-auto">
            来院前によく寄せられるご質問をまとめています。ここにない質問はLINEでお気軽にどうぞ。
          </p>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 space-y-12">
          {faqs.map((cat) => (
            <div key={cat.category}>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-blue-700 rounded-full inline-block" />
                {cat.category}
              </h2>
              <div className="space-y-3">
                {cat.items.map((item) => (
                  <FaqItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="text-slate-700 mb-6">解決しない疑問・不安はLINEでお気軽に聞いてください</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://lin.ee/uaGKbfk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-line hover:bg-line-dark text-white font-bold px-8 py-4 rounded-full transition-all"
            >
              LINEで質問する
            </a>
            <Link
              href="/first-visit"
              className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-8 py-4 rounded-full transition-all"
            >
              初めての方へ <ChevronRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
