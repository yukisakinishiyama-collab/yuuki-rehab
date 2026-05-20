import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: '下関市の腰痛・スポーツ腰部障害のリハビリ｜慢性腰痛から競技復帰まで',
  description: '下関市のゆうき整骨院。慢性腰痛・急性腰痛・スポーツ腰部障害（椎間板ヘルニア・筋筋膜性腰痛など）に運動療法で対応。安静だけに頼らない、動作改善・体幹強化で根本から回復を目指します。',
}

const phases = [
  {
    phase: 'Phase 1',
    title: '疼痛管理・評価',
    period: '初回〜',
    items: [
      '動作・姿勢評価（どの動きで痛むか）',
      '筋力・可動域・神経症状の確認',
      '痛みを増悪させる動作パターンの特定',
      '安全に行える軽い運動の開始',
    ],
  },
  {
    phase: 'Phase 2',
    title: '体幹機能の回復',
    period: '2〜4週',
    items: [
      '体幹深層筋（多裂筋・腹横筋）の再教育',
      '腰椎の動的安定性トレーニング',
      '股関節・胸椎の可動性改善',
      '日常動作の改善指導',
    ],
  },
  {
    phase: 'Phase 3',
    title: '全身連動性の改善',
    period: '1〜2ヶ月',
    items: [
      'スクワット・デッドリフト系の動作再獲得',
      '競技に必要な動作パターンの練習',
      '再発予防のためのセルフケア習慣',
      '段階的な競技・スポーツ復帰',
    ],
  },
]

export default function LowerBackPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-navy to-blue-800 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex items-center gap-2 text-blue-300 text-sm mb-6">
            <Link href="/" className="hover:text-white">ホーム</Link>
            <ChevronRight size={14} />
            <Link href="/symptoms" className="hover:text-white">症状・お悩み</Link>
            <ChevronRight size={14} />
            <span className="text-white">腰痛・腰部障害</span>
          </nav>
          <span className="inline-block bg-blue-500/30 text-blue-200 text-xs font-bold px-3 py-1 rounded-full mb-4">下関市 腰部障害・慢性腰痛</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            腰痛・腰部障害のリハビリ
          </h1>
          <p className="text-blue-100 max-w-2xl leading-relaxed">
            「マッサージに通っても治らない」「痛みをかばって他の部位も辛くなった」——腰痛は安静だけでは解決しないことがほとんどです。動作評価と運動療法で、根本から改善を目指します。
          </p>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 space-y-10">

          {/* 対応する腰部疾患 */}
          <div className="bg-blue-50 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle size={22} className="text-blue-700" />
              対応する腰部の症状
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { label: '慢性腰痛', desc: '数週間以上続く腰の痛み・だるさ' },
                { label: '急性腰痛（ぎっくり腰）', desc: '突然の強い腰痛、動けなくなる痛み' },
                { label: '筋筋膜性腰痛', desc: '筋肉・筋膜の緊張による腰痛' },
                { label: '腰椎椎間板ヘルニア', desc: '下肢への放散痛・しびれを伴う場合も' },
                { label: 'スポーツ腰部障害', desc: '競技中・後に繰り返す腰痛' },
                { label: '姿勢性腰痛', desc: 'デスクワーク・スマホ姿勢による腰痛' },
              ].map((item) => (
                <div key={item.label} className="bg-white rounded-xl p-4 border border-blue-100">
                  <p className="font-semibold text-slate-800 text-sm">{item.label}</p>
                  <p className="text-slate-500 text-xs mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-slate-600 text-sm mt-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              ⚠️ 腰部脊柱管狭窄症の重症例・骨折の疑い・強い神経症状（両下肢のしびれ・膀胱直腸障害）がある場合は、整形外科での診察が優先です。必要に応じてご紹介します。
            </p>
          </div>

          {/* なぜ運動療法か */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-5">なぜ「安静」だけでは治らないのか</h2>
            <div className="space-y-4">
              {[
                {
                  title: '腰痛の約85%は「非特異的腰痛」',
                  body: '明確な構造的原因が特定できない腰痛が大半です。この場合、安静やマッサージだけでは根本解決にならず、動作パターンや筋力の問題にアプローチすることが重要です。',
                },
                {
                  title: '「痛いから動かさない」が悪循環を生む',
                  body: '腰痛時に動かさないでいると、体幹筋が弱化→姿勢が悪化→さらに痛みが増す、という悪循環に陥ります。現代のガイドラインでは適切な運動の継続が推奨されています。',
                },
                {
                  title: '腰痛の原因は「腰だけ」ではない',
                  body: '股関節・胸椎・足部の可動性低下が腰への負担を増やすことが多く見られます。腰だけを見るのではなく、全身の動きを評価することが重要です。',
                },
              ].map((item) => (
                <div key={item.title} className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-2">{item.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{item.body}</p>
                </div>
              ))}
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

          {/* 対応スポーツ */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-5">腰部障害が多い競技・場面</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: '野球・ソフトボール', desc: '投球・バッティングの回旋動作による腰部負担' },
                { label: 'ラグビー・格闘技', desc: 'コンタクトスポーツによる急性腰痛' },
                { label: '陸上・マラソン', desc: '反り腰・疲労による筋筋膜性腰痛' },
                { label: 'バレーボール・バスケ', desc: 'ジャンプ・着地の繰り返しによる椎間板負担' },
                { label: '体操・新体操', desc: '過伸展動作による分離症・腰部疲労骨折' },
                { label: 'デスクワーク', desc: '長時間座位による姿勢性腰痛' },
              ].map((s) => (
                <div key={s.label} className="bg-blue-50 rounded-xl p-4">
                  <p className="font-bold text-slate-800 text-sm mb-1">{s.label}</p>
                  <p className="text-slate-500 text-xs">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 腰椎分離症リンク */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
            <p className="text-slate-700 text-sm font-semibold mb-2">成長期の腰痛には「腰椎分離症」の可能性も</p>
            <p className="text-slate-500 text-sm leading-relaxed mb-4">
              中学・高校生の腰痛は、腰椎分離症（疲労骨折）である場合があります。整形外科での画像診断（CT・MRI）が必要です。ゆうき整骨院では診断後のリハビリ・競技復帰サポートに対応しています。
            </p>
            <Link
              href="/symptoms/spondylolysis"
              className="inline-flex items-center gap-2 text-blue-700 font-semibold text-sm hover:text-blue-900"
            >
              腰椎分離症のページを見る <ChevronRight size={16} />
            </Link>
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-br from-navy to-blue-800 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">下関の腰痛リハビリはゆうき整骨院へ</h2>
            <p className="text-blue-200 text-sm mb-6">「マッサージでは改善しなかった」「何度も繰り返す」という方はご相談ください</p>
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
