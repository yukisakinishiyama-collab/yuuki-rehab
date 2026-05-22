import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import LineQRCode from '@/components/site/LineQRCode'
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
  Video,
  Brain,
  ScanLine,
  Send,
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
  { label: '半月板術前・術後', href: '/symptoms/meniscus', icon: '🦴' },
  { label: '股関節痛', href: '/symptoms/hip-pain', icon: '🔵' },
  { label: '腰痛・腰部障害', href: '/symptoms/lower-back', icon: '🔧' },
  { label: 'シンスプリント', href: '/symptoms/shin-splints', icon: '🏅' },
  { label: '膝痛', href: '/symptoms/knee-pain', icon: '🔴' },
  { label: '手関節・手首の痛み', href: '/symptoms/wrist', icon: '🤝' },
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
    emoji: '🦶',
    color: 'from-orange-500 to-red-500',
  },
  {
    date: '2026.04.28',
    category: 'リハビリ',
    title: 'ACL術後リハビリの流れと、競技復帰の判断基準について',
    href: '/blog',
    emoji: '🏃',
    color: 'from-blue-600 to-indigo-700',
  },
  {
    date: '2026.04.15',
    category: '成長期障害',
    title: 'オスグッド病を抱えながらスポーツを続けるために知っておくこと',
    href: '/blog',
    emoji: '🌱',
    color: 'from-green-500 to-teal-600',
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
            <h1 className="hero-h1 font-bold text-white mb-4">
              スポーツ障害・保存療法・<br />術前術後リハビリに
              <br />
              <span className="text-sky-300">特化した</span>下関の整骨院
            </h1>
            <p className="text-blue-100 text-base sm:text-lg leading-relaxed mb-8">
              競技復帰と再発予防まで支える、保存療法・運動療法型整骨院。<br className="hidden md:block" />
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

      {/* ===== 来院誘導バナー ===== */}
      <section className="bg-amber-400">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6">
          <p className="text-amber-900 font-bold text-sm text-center">
            💡 初回評価 <strong>¥2,000</strong> — 「まず状態だけ診てほしい」も大歓迎
          </p>
          <Link
            href="/price"
            className="text-amber-900 underline underline-offset-2 font-semibold text-sm hover:text-amber-800 whitespace-nowrap"
          >
            料金・メニュー詳細 →
          </Link>
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
                  {['股関節', '膝関節', '足関節', '肩関節', '腰椎', '手関節', '成長期の障害', '術前・術後リハビリ', 'スポーツ外傷', 'スポーツ障害'].map((item) => (
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

      {/* ===== 院長紹介 ===== */}
      <section className="py-16 md:py-24 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <span className="text-blue-700 text-sm font-bold tracking-widest uppercase">About</span>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mt-2">院長<span className="text-blue-700">紹介</span></h2>
          </div>
          <div className="flex flex-col md:flex-row gap-8 items-center bg-white rounded-2xl shadow-sm p-8">
            <div className="shrink-0">
              <Image
                src="/doctor.jpg"
                alt="ゆうき整骨院 院長"
                width={200}
                height={200}
                className="rounded-2xl object-cover w-48 h-48 md:w-56 md:h-56"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-700 mb-1 tracking-widest">院長</p>
              <h3 className="text-2xl font-bold text-slate-900 mb-1">西山 勇来</h3>
              <p className="text-slate-500 text-sm mb-4">柔道整復師</p>
              <p className="text-slate-700 leading-relaxed text-sm">
                スポーツ障害・術前術後リハビリを専門とし、学生アスリートから社会人まで幅広く対応しています。「痛みを取るだけでなく、再発しない体づくり」を目指し、運動療法と動作改善を重視した施術を行っています。医療機関と連携しながら、科学的根拠に基づいたリハビリプログラムを提供します。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== MOTION LAB ===== */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-[#0d1f33] via-[#1a3a5c] to-[#0a2d28] relative overflow-hidden">
        {/* 背景装飾 */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl" />
        </div>
        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <div className="text-center mb-12">
            <span className="inline-block bg-teal-500/20 text-teal-300 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-3">Technology</span>
            <h2 className="text-2xl md:text-3xl font-bold text-white mt-2">
              YUUKI <span className="text-teal-400">MOTION LAB</span>
            </h2>
            <p className="text-blue-200 mt-3 max-w-2xl mx-auto text-sm leading-relaxed text-left sm:text-center">
              動画を送るだけで、AIと専門家が動作を分析。<br className="hidden sm:block" />
              「なぜ痛むのか」「何を直せばいいのか」を可視化する、ゆうき整骨院の動作解析サービスです。
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {[
              {
                icon: Video,
                title: '動画を送るだけ',
                desc: 'スマートフォンで撮影した動作動画をフォームから送信。来院前でも相談できます。',
              },
              {
                icon: ScanLine,
                title: 'フレーム単位で分析',
                desc: '関節角度・重心バランス・動作パターンを映像で確認。「見えない問題」を可視化します。',
              },
              {
                icon: Brain,
                title: 'AIが補助分析',
                desc: 'AIが動作所見・問題点・介入提案を自動生成。専門家の判断を強力にサポートします。',
              },
            ].map((item) => (
              <div key={item.title} className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                <div className="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center mb-4">
                  <item.icon size={22} className="text-teal-400" />
                </div>
                <h3 className="text-white font-bold mb-2">{item.title}</h3>
                <p className="text-blue-200 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-white/5 border border-teal-500/30 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-1">
              <p className="text-teal-300 text-xs font-bold tracking-widest uppercase mb-2">Remote Analysis</p>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2">遠方の方・来院前の方へ</h3>
              <p className="text-blue-200 text-sm leading-relaxed mb-4">
                下関まで来院できない方も、LINEまたはメールで動画をお送りいただければ専門家が動作を確認してフィードバックします。
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="bg-teal-500/20 text-teal-300 px-3 py-1.5 rounded-full font-bold">一般・遠隔の方 ¥2,500</span>
                <span className="bg-white/10 text-blue-200 px-3 py-1.5 rounded-full font-bold">通院中の方 ¥500</span>
              </div>
            </div>
            <div className="flex flex-col gap-3 shrink-0">
              <a
                href="https://lin.ee/uaGKbfk"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-line hover:bg-line-dark text-white font-bold px-7 py-3.5 rounded-full transition-all hover:scale-105"
              >
                <Send size={16} />
                LINEで動画を送る
              </a>
              <a
                href="mailto:yukisakinishiyama@gmail.com?subject=動作解析のご依頼&body=お名前：%0Aスポーツ・目的：%0Aご要望："
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-7 py-3.5 rounded-full border border-white/30 transition-all"
              >
                <Send size={16} />
                メールで動画を送る
              </a>
            </div>
          </div>
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
                <div className={`h-40 bg-gradient-to-br ${post.color} flex flex-col items-center justify-center gap-2`}>
                  <span className="text-5xl">{post.emoji}</span>
                  <span className="bg-black/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">{post.category}</span>
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
            <div className="space-y-4">
              <div className="rounded-2xl overflow-hidden shadow-md h-56">
                <Image
                  src="/clinic.jpg"
                  alt="ゆうき整骨院 外観"
                  width={600}
                  height={300}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="rounded-2xl overflow-hidden shadow-md h-56">
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
          <div className="flex flex-col items-center gap-6 mb-2">
            <LineQRCode />
          </div>
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
            <a
              href="https://www.instagram.com/yu.ki__seikotsuin/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 bg-white/10 hover:bg-white/20 text-white font-bold px-10 py-4 rounded-full transition-all hover:scale-105 text-lg border border-white/30"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <circle cx="12" cy="12" r="3"/>
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
              </svg>
              Instagramを見る
            </a>
          </div>
          <p className="text-blue-300 text-xs mt-6">予約優先制 / 初診の方もお気軽にどうぞ</p>
        </div>
      </section>
    </div>
  )
}
