'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronRight, ChevronDown, ShieldCheck, Star, Send } from 'lucide-react'

// SEO metadata は src/app/(website)/price/layout.tsx で設定（'use client'のためここでは定義不可）

const plans = [
  {
    tag: '健康保険診療',
    title: '急性外傷の施術',
    price: '保険適応',
    priceNote: '健康保険・自賠責・労災',
    color: 'from-slate-600 to-slate-800',
    badge: null,
    includes: [
      '捻挫・打撲・肉離れなどの急性外傷',
      '健康保険証をご持参ください',
      '自賠責保険（交通事故）対応',
      '労災保険対応',
      '3割負担で概ね300〜700円程度',
    ],
    note: '※ 慢性的な症状・運動療法は保険適応外。衛生材料（テーピング・包帯等）を使用した際は材料費が別途発生します',
  },
  {
    tag: '自由診療（自費）',
    title: '初回評価',
    price: '¥2,000',
    priceNote: '税込 / 自由診療 / 施術費別途',
    color: 'from-blue-600 to-blue-800',
    badge: 'まずここから',
    includes: [
      '症状・経緯の詳細ヒアリング（約15分）',
      '関節可動域・筋力検査',
      '動作分析・姿勢評価',
      '痛みの原因と根本的な問題の特定',
      '今後の施術方針の説明',
      '自宅でできるセルフケア指導',
    ],
    note: '※ 保険診療の対象外です（自費・¥2,000）。まず現状把握だけでもOKです',
  },
  {
    tag: '自費・施術',
    title: 'リハビリ・運動療法',
    price: '¥3,850〜',
    priceNote: '税込 / 1部位の場合',
    color: 'from-indigo-600 to-blue-800',
    badge: null,
    includes: [
      '基本施術料 ¥2,850',
      '部位加算 ¥1,000（1部位あたり）',
      '手技療法（関節モビライゼーション等）',
      '個別の運動療法プログラム',
      '施術内容・目的の都度説明',
      'ホームエクササイズ指導',
    ],
    note: '2部位の場合 ¥4,850 / 物理療法は別途ご案内',
  },
]

const faqs = [
  {
    q: '現金以外の支払いはできますか？',
    a: '現時点では現金払いのみ対応しています。カード・QRコード払いの導入については検討中です。詳しくはLINEでお問い合わせください。',
  },
  {
    q: '保険診療と自費メニューを同日に受けられますか？',
    a: '基本的には可能です。ただし保険適応の対象（急性外傷）と自費メニュー（運動療法・リハビリ）は明確に区分してご案内します。詳しくは初回ヒアリング時にご説明します。',
  },
  {
    q: '追加費用は発生しますか？',
    a: '施術前にメニューと費用をご説明し、ご了承いただいてから開始します。なお、健康保険を使用した際にテーピング・包帯などの衛生材料を使用した場合は、材料費が別途発生することがあります。使用前に必ずご説明します。',
  },
  {
    q: 'キャンセルはいつまでにすればいいですか？',
    a: '前日までのご連絡をお願いしています。当日キャンセルは次の患者様のご迷惑になることがあります。急な体調不良などはLINEでご連絡ください。',
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
        <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform mt-0.5 ${open ? 'rotate-180' : ''}`} />
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

export default function PricePage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-navy to-blue-800 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <span className="text-blue-300 text-sm font-bold tracking-widest uppercase">Pricing</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mt-2 mb-4">料金案内</h1>
          <p className="text-blue-100 max-w-2xl mx-auto leading-relaxed">
            「料金がわからないから行きにくい」をなくすために、すべての料金を明確に公開しています。<br />
            <span className="text-blue-300 text-sm">※ 表示価格はすべて税込です</span>
          </p>
        </div>
      </section>

      {/* 来院誘導バナー */}
      <section className="bg-amber-400">
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-amber-900 font-bold text-sm md:text-base text-center sm:text-left">
            💡 まずは <strong>初回評価 ¥2,000</strong> から — 「どんな状態か知りたい」だけでも大歓迎
          </p>
          <a
            href="https://lin.ee/uaGKbfk"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 bg-amber-900 hover:bg-amber-800 text-white font-bold text-sm px-6 py-2.5 rounded-full transition-all whitespace-nowrap"
          >
            LINEで予約する →
          </a>
        </div>
      </section>

      {/* 料金カード */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">施術メニューと<span className="text-blue-700">料金</span></h2>
            <p className="text-slate-500 text-sm mt-3">施術開始前に必ず内容と料金をご説明します。同意いただいてから進めますのでご安心ください。</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {plans.map((plan) => (
              <div key={plan.title} className="relative bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                {plan.badge && (
                  <div className="absolute top-4 right-4 bg-amber-400 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full">
                    {plan.badge}
                  </div>
                )}
                <div className={`bg-gradient-to-br ${plan.color} p-6 text-white`}>
                  <span className="text-xs font-bold text-white/70 uppercase tracking-widest">{plan.tag}</span>
                  <h3 className="text-xl font-bold mt-1 mb-3">{plan.title}</h3>
                  <div className="text-3xl font-black">{plan.price}</div>
                  <div className="text-white/70 text-xs mt-1">{plan.priceNote}</div>
                </div>
                <div className="p-6 flex-1">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">含まれる内容</p>
                  <ul className="space-y-2 mb-4">
                    {plan.includes.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 size={15} className="text-blue-500 shrink-0 mt-0.5" />
                        <span className="text-slate-700 text-sm">{item}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.note && (
                    <p className="text-xs text-slate-400 border-t border-slate-100 pt-3 leading-relaxed">{plan.note}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 補足 */}
          <div className="bg-blue-50 rounded-2xl p-5 text-center">
            <p className="text-slate-600 text-sm">
              リハビリ・運動療法は <strong className="text-blue-700">1回あたり¥3,850〜</strong>（1部位の場合）。
              スポーツの継続・再発防止を目的とした<strong>自由診療メニュー</strong>です。
              施術ごとに内容と費用をご説明してから開始しますので、ご安心ください。
            </p>
          </div>
        </div>
      </section>

      {/* MOTION LAB 二層価格 */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-[#0d1f33] via-[#1a3a5c] to-[#0a2d28] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl" />
        </div>
        <div className="max-w-5xl mx-auto px-4 relative z-10">
          <div className="text-center mb-10">
            <span className="inline-block bg-teal-500/20 text-teal-300 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-3">Online Service</span>
            <h2 className="text-2xl md:text-3xl font-bold text-white mt-2">
              YUUKI <span className="text-teal-400">MOTION LAB</span> 料金
            </h2>
            <p className="text-blue-200 text-sm mt-3">動画解析サービスは、通院中の方・遠隔の方で料金が異なります</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* 通院中 */}
            <div className="bg-white/5 border border-teal-400/40 rounded-2xl p-8 relative">
              <div className="absolute -top-3 left-6 bg-teal-400 text-teal-900 text-xs font-black px-3 py-1 rounded-full">通院中の方限定</div>
              <p className="text-teal-300 text-xs font-bold uppercase tracking-widest mb-2 mt-2">In-clinic Patient</p>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl font-black text-white">¥500</span>
                <span className="text-teal-300 text-sm">税込</span>
              </div>
              <div className="flex items-center gap-2 mb-5">
                <span className="line-through text-white/40 text-sm">¥2,500</span>
                <span className="bg-teal-500/20 text-teal-300 text-xs font-bold px-2 py-0.5 rounded-full">80% OFF</span>
              </div>
              <ul className="space-y-2">
                {[
                  '施術と組み合わせた動作改善に活用',
                  '担当スタッフが直接フィードバック',
                  '通院記録と連携した継続分析',
                  '動画送信で来院前に状態を共有',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-teal-400 shrink-0 mt-0.5" />
                    <span className="text-blue-100 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-teal-300/60 text-xs mt-5">※ 通院中の方のみ。定期通院の継続特典です。</p>
            </div>

            {/* 一般・遠隔 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
              <p className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-2">Remote / New Patient</p>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl font-black text-white">¥2,500</span>
                <span className="text-blue-300 text-sm">税込</span>
              </div>
              <p className="text-blue-300/60 text-sm mb-5">一般・遠隔の方・初めての方</p>
              <ul className="space-y-2">
                {[
                  'スマホ動画を送るだけで解析開始',
                  'AI＋専門家による動作分析レポート',
                  '動作の問題点・改善ポイントを提示',
                  '下関へ来院前の「お試し相談」に最適',
                  '気に入ったらそのまま来院へ移行',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-blue-400 shrink-0 mt-0.5" />
                    <span className="text-blue-100 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 遠隔→来院の導線 */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col sm:flex-row items-center gap-5">
            <div className="flex-1">
              <p className="text-white font-bold mb-1">「遠い」「まず試したい」方へ</p>
              <p className="text-blue-200 text-sm leading-relaxed">
                ¥2,500で動画を送ってもらい、分析結果をお届けします。「この先生に診てもらいたい」と感じたら、そのままLINEで来院予約に進んでいただけます。遠方からでも、まず繋がれる場所を作りたいと考えています。
              </p>
            </div>
            <Link
              href="/submit"
              className="shrink-0 inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-bold px-6 py-3.5 rounded-full transition-all hover:scale-105 whitespace-nowrap"
            >
              <Send size={16} />
              動画を送る（¥2,500）
            </Link>
          </div>
        </div>
      </section>

      {/* 保険診療について */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <ShieldCheck size={22} className="text-blue-700" />
            保険診療について
          </h2>
          <div className="bg-slate-50 rounded-2xl p-6 md:p-8 space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { title: '健康保険', desc: '急性の捻挫・打撲・肉離れが対象。慢性痛・運動療法は対象外です。' },
                { title: '自賠責保険', desc: '交通事故による外傷。事故直後のご来院でも対応可。まずご連絡を。' },
                { title: '労災保険', desc: '仕事中・通勤中の外傷。書類のご準備についてもご案内します。' },
              ].map((item) => (
                <div key={item.title} className="bg-white rounded-xl p-4 border border-slate-100">
                  <p className="font-bold text-slate-800 text-sm mb-1">{item.title}</p>
                  <p className="text-slate-500 text-xs leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-slate-500 text-xs leading-relaxed border-t border-slate-200 pt-4">
              ※ 保険診療の適否は症状・経緯によって異なります。「使えるか不明」な場合はLINEでお気軽にご相談ください。不必要な保険請求は行いません。
            </p>
          </div>
        </div>
      </section>

      {/* Googleレビュー誘導 */}
      <section className="py-12 bg-blue-50">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-1 mb-3">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={18} className="text-amber-400 fill-amber-400" />
            ))}
          </div>
          <p className="text-slate-700 font-semibold mb-1">実際に通院された患者様の声</p>
          <p className="text-slate-500 text-sm mb-5">Googleマップのレビューで、通院中の患者様の声をご確認いただけます。</p>
          <a
            href="https://www.google.com/maps/search/ゆうき整骨院+下関"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm px-6 py-3 rounded-full border border-slate-200 shadow-sm transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#4285F4"/>
            </svg>
            Googleマップでレビューを見る
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-xl font-bold text-slate-900 mb-6">料金に関するよくある質問</h2>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-navy to-blue-800">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">まずは¥2,000の初回評価から</h2>
          <p className="text-blue-200 text-sm mb-8 leading-relaxed">
            「どこが悪いのか知りたいだけ」「施術するか迷っている」——そういう方こそ、まず評価だけでも受けてみてください。<br />
            納得いただいてから、一緒に方針を決めましょう。
          </p>
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
              href="/first-visit"
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-full border border-white/30 transition-all"
            >
              初めての方へ <ChevronRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
