import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, ChevronRight, Activity, Brain, Target, Lightbulb, Users } from 'lucide-react'

export const metadata: Metadata = {
  title: '初めての方へ｜施術の流れと院の考え方',
  description: 'ゆうき整骨院に初めて来院される方へ。施術の流れ、院の考え方、なぜ運動療法を重視するのかをご説明します。下関市のスポーツ障害・術前術後リハビリ専門整骨院。',
}

const visitSteps = [
  {
    num: '01',
    title: 'ご予約',
    desc: 'LINEまたはお電話でご予約ください。症状・希望の来院日をお知らせください。予約優先制ですので、ご予約いただくと待ち時間が少なく、しっかりお時間を確保できます。',
    time: '予約時',
  },
  {
    num: '02',
    title: '問診・ヒアリング',
    desc: '症状がいつから・どのように起きたか、スポーツ歴・術後経過・日常生活への影響など、丁寧にお聞きします。急がず、しっかり聞かせてください。',
    time: '約15分',
  },
  {
    num: '03',
    title: '身体評価・動作分析',
    desc: '関節の可動域・筋力・バランス・動作パターンを評価します。痛みの根本原因を特定するために、全身的な視点でアセスメントを行います。',
    time: '約15分',
  },
  {
    num: '04',
    title: '施術・運動療法',
    desc: '評価をもとに、手技療法と個別の運動療法を組み合わせた施術を行います。内容・目的を都度説明しながら進めますので、安心してお受けいただけます。',
    time: '約30分',
  },
  {
    num: '05',
    title: '説明・ホームエクササイズ',
    desc: '施術後は今日わかったことと今後の方針をお伝えします。自宅でできる運動・注意点もお伝えします。疑問はその場でご質問ください。',
    time: '約10分',
  },
]

const whyExercise = [
  {
    icon: Brain,
    title: '痛みの原因は「動き方」にある',
    desc: '多くのスポーツ障害・慢性痛は、筋肉の使い方の偏りや動作パターンの問題が根本原因です。手技だけでは根本には届きません。動作を変えることが本質的な改善につながります。',
  },
  {
    icon: Target,
    title: '「安静」が必ずしも正解ではない',
    desc: 'スポーツ医学の最新のエビデンスでは、適切な負荷をかけながら回復を促す「ペイン神経科学」「段階的な運動療法」が主流です。ゆうき整骨院では、痛みの状態に合わせた適切な運動を処方します。',
  },
  {
    icon: Activity,
    title: '「治った」ではなく「また動ける」が目標',
    desc: '競技復帰・スポーツ復帰が目標のアスリートにとって、痛みが取れることがゴールではありません。競技レベルに応じた機能回復・再発予防のトレーニングまで一貫してサポートします。',
  },
  {
    icon: Lightbulb,
    title: '自分の身体を理解することが再発防止になる',
    desc: 'なぜ痛みが起きたか、どう動けばいいか、自分で理解することが最大の再発予防です。施術中も原因・メカニズムを丁寧に説明し、「わかった」状態での回復を目指します。',
  },
]

const philosophy = [
  '痛みの原因を根本から評価し、適切な治療方針を立てる',
  '医学的根拠（エビデンス）に基づいた施術を行う',
  '施術内容・目的を丁寧に説明し、患者様が理解した状態で進める',
  '必要に応じて整形外科・医療機関と連携する',
  '競技復帰だけでなく、再発予防・パフォーマンス向上までサポートする',
  '過剰な通院を促さず、自立した回復を目指す',
]

export default function FirstVisitPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-navy to-blue-800 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <span className="text-blue-300 text-sm font-bold tracking-widest uppercase">First Visit</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mt-2 mb-4">初めての方へ</h1>
          <p className="text-blue-100 max-w-2xl mx-auto">
            初めてのご来院でも安心していただけるよう、施術の流れと院の考え方を詳しくご説明します。
          </p>
        </div>
      </section>

      {/* Visit Flow */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-blue-700 text-sm font-bold tracking-widest uppercase">Flow</span>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mt-2">初診の<span className="text-blue-700">流れ</span></h2>
            <p className="text-slate-500 mt-3 text-sm">初診時は約70分ほどお時間をいただいています</p>
          </div>
          <div className="relative">
            <div className="absolute left-7 top-0 bottom-0 w-0.5 bg-blue-100 hidden md:block" />
            <div className="space-y-6">
              {visitSteps.map((step) => (
                <div key={step.num} className="flex gap-5">
                  <div className="relative flex-shrink-0 w-14 h-14 bg-blue-700 rounded-full flex items-center justify-center z-10">
                    <span className="text-white font-black text-sm">{step.num}</span>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-5 md:p-6 flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
                      <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2.5 py-1 rounded-full">{step.time}</span>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="py-16 md:py-24 bg-blue-50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-blue-700 text-sm font-bold tracking-widest uppercase">Philosophy</span>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mt-2">院の<span className="text-blue-700">考え方</span></h2>
          </div>
          <div className="bg-white rounded-2xl p-6 md:p-10 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Users size={28} className="text-blue-700" />
              <h3 className="text-xl font-bold text-slate-800">ゆうき整骨院が大切にしていること</h3>
            </div>
            <ul className="space-y-4">
              {philosophy.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 size={20} className="text-blue-600 shrink-0 mt-0.5" />
                  <span className="text-slate-700 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 p-5 bg-blue-50 rounded-xl">
              <p className="text-slate-700 text-sm leading-relaxed">
                ゆうき整骨院では、「とりあえず来てください」ではなく、患者様が自分の症状と向き合い、理解したうえで回復できるよう丁寧に関わることを大切にしています。スポーツ・運動に関わるすべての方の、より良いコンディションを全力でサポートします。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Exercise Therapy */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-blue-700 text-sm font-bold tracking-widest uppercase">Why Exercise</span>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mt-2">なぜ<span className="text-blue-700">運動療法</span>を重視するのか</h2>
            <p className="text-slate-500 mt-3 max-w-2xl mx-auto text-sm leading-relaxed">
              「電気を当ててマッサージするだけ」では改善しない方が多くいます。スポーツ障害の本質的な回復には、運動療法が欠かせない理由があります。
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {whyExercise.map((item) => (
              <div key={item.title} className="flex gap-5 bg-slate-50 rounded-2xl p-6">
                <div className="w-12 h-12 bg-blue-700 rounded-xl flex items-center justify-center shrink-0">
                  <item.icon size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-navy to-blue-800">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">まずはLINEでご相談ください</h2>
          <p className="text-blue-200 mb-8">症状・来院への不安など、気軽にメッセージください</p>
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
              症状から探す <ChevronRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
