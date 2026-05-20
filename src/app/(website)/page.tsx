import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Activity,
  Shield,
  TrendingUp,
  ChevronRight,
  Star,
  Clock,
  MapPin,
  MessageCircle,
  CheckCircle2,
  ArrowRight,
  Users,
  Zap,
  Heart,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'ゆうき整骨院｜下関のスポーツ障害・術前術後リハビリ専門整骨院',
  description: '山口県下関市のゆうき整骨院。スポーツ障害・術前術後リハビリ・競技復帰に特化した運動療法型整骨院。ACL術後、オスグッド、股関節痛、シンスプリントなど幅広く対応。',
}

const symptoms = [
  { label: '足関節捻挫', href: '/symptoms/ankle-sprain', icon: '🦶' },
  { label: 'オスグッド病', href: '/symptoms/osgood', icon: '🦵' },
  { label: '野球肩', href: '/symptoms/baseball-shoulder', icon: '⚾' },
  { label: '野球肘', href: '/symptoms/baseball-elbow', icon: '💪' },
  { label: 'ACL術前・術後リハビリ', href: '/symptoms/acl', icon: '🏃' },
  { label: '半月板術前・術後', href: '/symptoms/acl', icon: '🦴' },
  { label: '股関節痛', href: '/symptoms/hip-pain', icon: '🔵' },
  { label: '股関節唇損傷', href: '/symptoms/hip-pain', icon: '⚡' },
  { label: 'シンスプリント', href: '/symptoms/shin-splints', icon: '🏅' },
  { label: '膝痛', href: '/symptoms/knee-pain', icon: '🔴' },
  { label: '肩痛', href: '/symptoms/baseball-shoulder', icon: '💙' },
  { label: '成長期障害', href: '/symptoms/osgood', icon: '📈' },
]

const features = [
  {
    icon: Activity,
    title: 'スポーツ障害に強い',
    description: '学生アスリートから社会人まで、スポーツによる怪我・障害の評価と治療を専門的に行います。捻挫・腱炎・疲労骨折など幅広く対応。',
  },
  {
    icon: Shield,
    title: '術前・術後リハビリ対応',
    description: '手術前のプレハビリテーション（術前リハビリ）から、ACL再建術・半月板手術後のリハビリまで一貫対応。術前から身体を整えることで、術後回復をより早めることができます。',
  },
  {
    icon: TrendingUp,
    title: '運動療法・動作改善',
    description: '痛みを取るだけでなく、再発しない身体をつくる運動療法を重視。動作分析をもとに根本原因にアプローチし、再発予防まで支えます。',
  },
]

const steps = [
  {
    num: '01',
    title: '問診・評価',
    desc: '症状・スポーツ歴・日常生活の聞き取りを丁寧に行い、動作評価・身体検査で問題を正確に把握します。',
  },
  {
    num: '02',
    title: '施術・運動療法',
    desc: '手技療法と個別の運動療法を組み合わせ、痛みの軽減と身体機能の回復を同時に進めます。',
  },
  {
    num: '03',
    title: '再発予防・競技復帰',
    desc: '症状の改善後も、競技レベルに応じたトレーニング指導で再発予防と安全なスポーツ復帰をサポートします。',
  },
]

const testimonials = [
  {
    name: '平井里佳 さん（股関節術前・術後リハビリ）',
    text: '股関節の術前術後のリハビリをしていただいています。いつも親身になって話を聞いてくださり、分かりやすく説明してリハビリをしてくださいます。とても感謝しています。',
    rating: 5,
  },
  {
    name: '田中優稀 さん（硬式野球）',
    text: '現在硬式野球をしていて足首、腰、肩に痛みが出ており足首はひどい時には歩けない程の痛みが出ていました。ですがゆうき整骨院に通ってリハビリ療法で改善に向けてやっていただき実際に痛みの軽減、改善に向かっている実感があります。スポーツに限らず様々な身体の不調に対応していただけるのですごく助かっています。',
    rating: 5,
  },
  {
    name: 'なえ さん（前十字靭帯）',
    text: '以前、前十字靭帯を断裂した際にいっぱいサポートして頂きました。今では超元気です、また何かあった際は宜しくお願いします！',
    rating: 5,
  },
]

const blogPosts = [
  {
    date: '2026.05.10',
    category: 'スポーツ障害',
    title: '足首捻挫の「正しい」初期対応とは？RICEからPOLICEへ',
    href: '/blog',
  },
  {
    date: '2026.04.28',
    category: 'リハビリ',
    title: 'ACL術後リハビリの流れと、競技復帰の判断基準について',
    href: '/blog',
  },
  {
    date: '2026.04.15',
    category: '成長期障害',
    title: 'オスグッド病を抱えながらスポーツを続けるために知っておくこと',
    href: '/blog',
  },
]

export default function HomePage() {
  return (
    <div className="overflow-x-hidden">
      {/* ===== HERO ===== */}
      <section className="relative min-h-[85vh] flex items-center bg-gradient-to-br from-navy via-blue-900 to-blue-800">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-1/4 w-96 h-96 bg-blue-400 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-sky-400 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-28">
          <div className="max-w-2xl">
            <span className="inline-block bg-blue-500/30 text-blue-200 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-6 uppercase">
              山口県下関市の整骨院
            </span>
            <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight mb-4">
              スポーツ障害・術前術後リハビリに
              <br />
              <span className="text-sky-300">特化した</span>下関の整骨院
            </h1>
            <p className="text-blue-100 text-lg leading-relaxed mb-8">
              競技復帰と再発予防まで支える、運動療法型整骨院。<br className="hidden md:block" />
              医学的根拠をもとに、あなたの回復とパフォーマンス向上を全力でサポートします。
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="https://lin.ee/uaGKbfk"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-line hover:bg-line-dark text-white font-bold px-8 py-4 rounded-full shadow-lg transition-all hover:scale-105"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.145 2 11.243c0 3.121 1.588 5.89 4.063 7.706-.165.595-.535 2.225-.608 2.558-.092.413.148.41.314.3.13-.088 2.053-1.373 2.888-1.932.74.1 1.5.155 2.343.155 5.523 0 10-4.145 10-9.243S17.523 2 12 2z" />
                </svg>
                LINEで予約する
              </a>
              <Link
                href="/first-visit"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-full border border-white/30 transition-all"
              >
                初めての方へ <ChevronRight size={18} />
              </Link>
            </div>
            <div className="flex flex-wrap gap-4 mt-10 text-sm text-blue-200">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-sky-400" /> 予約優先制</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-sky-400" /> 丁寧な説明</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-sky-400" /> 医療機関と連携</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-sky-400" /> 運動療法重視</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== QUICK INFO BAR ===== */}
      <section className="bg-blue-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-10 text-sm">
            <span className="flex items-center gap-2">
              <Clock size={16} className="text-blue-200" />
              <span><strong>平日</strong> 10:00〜13:00 / 15:00〜20:00</span>
            </span>
            <span className="hidden sm:block text-blue-400">|</span>
            <span className="flex items-center gap-2">
              <Clock size={16} className="text-blue-200" />
              <span><strong>土曜</strong> 10:00〜15:00</span>
            </span>
            <span className="hidden sm:block text-blue-400">|</span>
            <span className="flex items-center gap-2">
              <MapPin size={16} className="text-blue-200" />
              <span>山口県下関市</span>
            </span>
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-blue-700 text-sm font-bold tracking-widest uppercase">Our Strengths</span>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mt-2">ゆうき整骨院の<span className="text-blue-700">3つの強み</span></h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {features.map((f) => (
              <div key={f.title} className="bg-blue-50 rounded-2xl p-6 md:p-8 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-blue-700 rounded-xl flex items-center justify-center mb-5">
                  <f.icon size={24} className="text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-3">{f.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TARGET ===== */}
      <section className="py-16 md:py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="md:flex items-center gap-12">
            <div className="md:w-1/2 mb-8 md:mb-0">
              <span className="text-blue-700 text-sm font-bold tracking-widest uppercase">こんな方におすすめ</span>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mt-2 mb-6">
                「治すだけ」でなく<br />
                <span className="text-blue-700">「また動ける身体」</span>へ
              </h2>
              <p className="text-slate-600 leading-relaxed mb-6">
                マッサージや電気治療だけでは改善しなかった方、安静を指示されたまま回復が見えない方に、運動療法・動作改善のアプローチで根本から回復を目指します。
              </p>
              <ul className="space-y-3">
                {[
                  'スポーツ中の怪我・痛みに悩む学生アスリート',
                  '術後のリハビリ先を探している方',
                  '再発を繰り返している慢性的な痛み',
                  '整形外科後のリハビリを継続したい方',
                  '競技復帰を目指しているアスリート',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-slate-700 text-sm">
                    <CheckCircle2 size={18} className="text-blue-600 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:w-1/2">
              <div className="bg-gradient-to-br from-blue-900 to-navy rounded-2xl p-8 text-white">
                <div className="flex items-center gap-3 mb-6">
                  <Users size={28} className="text-sky-300" />
                  <h3 className="text-xl font-bold">対応できる部位・疾患</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {['股関節', '膝関節', '足関節', '肩関節', '成長期の障害', '術前・術後リハビリ', 'スポーツ外傷', 'スポーツ障害'].map((item) => (
                    <div key={item} className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                      <Zap size={14} className="text-sky-300 shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-blue-200 text-xs">
                  ※ 診察・検査が必要な場合は医療機関をご紹介します
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SYMPTOMS ===== */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-blue-700 text-sm font-bold tracking-widest uppercase">Symptoms</span>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mt-2">対応している<span className="text-blue-700">症状・お悩み</span></h2>
            <p className="text-slate-500 mt-3 text-sm">各症状をクリックすると詳しい説明ページに移動します</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {symptoms.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className="group flex items-center gap-3 bg-blue-50 hover:bg-blue-700 rounded-xl px-4 py-4 transition-all hover:shadow-md"
              >
                <span className="text-xl">{s.icon}</span>
                <span className="text-sm font-medium text-slate-700 group-hover:text-white transition-colors">{s.label}</span>
                <ArrowRight size={14} className="ml-auto text-slate-400 group-hover:text-blue-200 transition-colors shrink-0" />
              </Link>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link
              href="/symptoms"
              className="inline-flex items-center gap-2 text-blue-700 font-semibold hover:text-blue-900 transition-colors"
            >
              症状・お悩み一覧を見る <ChevronRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ===== FLOW ===== */}
      <section className="py-16 md:py-24 bg-blue-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-blue-700 text-sm font-bold tracking-widest uppercase">Flow</span>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mt-2">施術の<span className="text-blue-700">流れ</span></h2>
          </div>
          <div className="relative grid md:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <div key={step.num} className="relative bg-white rounded-2xl p-6 md:p-8 shadow-sm">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-6 bg-blue-700 rounded-full z-10" />
                )}
                <span className="block text-4xl font-black text-blue-100 mb-3">{step.num}</span>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/first-visit"
              className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-8 py-3.5 rounded-full transition-colors"
            >
              初めての方はこちら <ChevronRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-blue-700 text-sm font-bold tracking-widest uppercase">Testimonials</span>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mt-2">患者様の<span className="text-blue-700">声</span></h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} size={16} fill="#f59e0b" className="text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 text-sm leading-relaxed mb-5 italic">「{t.text}」</p>
                <p className="text-slate-500 text-xs font-medium">{t.name}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-slate-400 mt-6">※ 個人の感想であり、効果を保証するものではありません</p>
        </div>
      </section>

      {/* ===== BLOG PREVIEW ===== */}
      <section className="py-16 md:py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-blue-700 text-sm font-bold tracking-widest uppercase">Blog</span>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mt-2">ブログ・<span className="text-blue-700">お役立ち情報</span></h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {blogPosts.map((post) => (
              <Link
                key={post.title}
                href={post.href}
                className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="h-40 bg-gradient-to-br from-blue-800 to-blue-600 flex items-center justify-center">
                  <Heart size={40} className="text-white/30" />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">{post.category}</span>
                    <span className="text-slate-400 text-xs">{post.date}</span>
                  </div>
                  <p className="text-slate-800 text-sm font-semibold leading-snug group-hover:text-blue-700 transition-colors line-clamp-2">{post.title}</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-blue-700 font-semibold hover:text-blue-900 transition-colors"
            >
              ブログ一覧を見る <ChevronRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ===== ACCESS ===== */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-blue-700 text-sm font-bold tracking-widest uppercase">Access</span>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mt-2">診療時間・<span className="text-blue-700">アクセス</span></h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
                <Clock size={20} className="text-blue-700" /> 診療時間
              </h3>
              <table className="w-full text-sm border-collapse mb-8">
                <thead>
                  <tr className="bg-blue-700 text-white">
                    <th className="py-2 px-4 text-left rounded-tl-lg">曜日</th>
                    <th className="py-2 px-4 text-left">午前</th>
                    <th className="py-2 px-4 text-left rounded-tr-lg">午後</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { day: '月〜金', am: '10:00〜13:00', pm: '15:00〜20:00' },
                    { day: '土曜日', am: '10:00〜15:00', pm: '—' },
                    { day: '日・祝日', am: '休診', pm: '休診' },
                  ].map((row, i) => (
                    <tr key={row.day} className={i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                      <td className="py-3 px-4 font-medium text-slate-700 border-b border-slate-100">{row.day}</td>
                      <td className="py-3 px-4 text-slate-600 border-b border-slate-100">{row.am}</td>
                      <td className="py-3 px-4 text-slate-600 border-b border-slate-100">{row.pm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-start gap-3 bg-blue-50 rounded-xl p-4">
                <MapPin size={20} className="text-blue-700 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-800 mb-1">ゆうき整骨院</p>
                  <p className="text-slate-600 text-sm">山口県下関市彦島江の浦町9丁目1-14</p>
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=山口県下関市彦島江の浦町9丁目1-14"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-blue-700 text-sm font-medium hover:underline"
                  >
                    Googleマップで見る <ArrowRight size={14} />
                  </a>
                </div>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-md h-64 md:h-full min-h-64">
              <iframe
                src="https://maps.google.com/maps?q=山口県下関市彦島江の浦町9丁目1-14&hl=ja&z=16&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="ゆうき整骨院 地図"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===== LINE CTA ===== */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-navy to-blue-800">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <MessageCircle size={40} className="text-sky-300 mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            まずはLINEで<span className="text-sky-300">お気軽にご相談</span>ください
          </h2>
          <p className="text-blue-200 mb-8 leading-relaxed">
            症状のご相談・ご予約はLINEが便利です。<br />
            質問だけでも大歓迎です。お気軽にメッセージください。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://lin.ee/uaGKbfk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 bg-line hover:bg-line-dark text-white font-bold px-10 py-4 rounded-full shadow-xl transition-all hover:scale-105 text-lg"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.145 2 11.243c0 3.121 1.588 5.89 4.063 7.706-.165.595-.535 2.225-.608 2.558-.092.413.148.41.314.3.13-.088 2.053-1.373 2.888-1.932.74.1 1.5.155 2.343.155 5.523 0 10-4.145 10-9.243S17.523 2 12 2z" />
              </svg>
              LINEで予約・相談する
            </a>
          </div>
          <p className="text-blue-300 text-xs mt-6">予約優先制 / 初診の方もお気軽にどうぞ</p>
        </div>
      </section>
    </div>
  )
}
