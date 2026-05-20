import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ChevronRight } from 'lucide-react'

export const metadata: Metadata = {
  title: '症状・お悩み一覧｜下関のスポーツ障害・リハビリ対応',
  description: '下関市のゆうき整骨院が対応する症状一覧。ACL術前・術後リハビリ、オスグッド、足関節捻挫、野球肩・肘、股関節痛、シンスプリントなど、スポーツ障害・成長期障害・術前術後リハビリに幅広く対応。',
}

const symptomCategories = [
  {
    title: 'スポーツ外傷',
    description: 'スポーツ中の急性的な怪我',
    color: 'from-blue-600 to-blue-800',
    items: [
      { label: '足関節捻挫（足首の捻り）', href: '/symptoms/ankle-sprain', tags: ['サッカー', 'バスケ', 'バレー'] },
      { label: '肉離れ', href: '/symptoms/muscle-strain', tags: ['陸上', 'サッカー'] },
    ],
  },
  {
    title: 'スポーツ障害（使いすぎ）',
    description: '繰り返しの動作による疲労・炎症',
    color: 'from-sky-600 to-sky-800',
    items: [
      { label: '野球肩（投球障害肩）', href: '/symptoms/baseball-shoulder', tags: ['野球', '水泳', 'バレー'] },
      { label: '野球肘（内側・外側）', href: '/symptoms/baseball-elbow', tags: ['野球'] },
      { label: 'シンスプリント', href: '/symptoms/shin-splints', tags: ['陸上', 'サッカー', 'バスケ'] },
      { label: '腸脛靱帯炎（ランナー膝）', href: '/symptoms/knee-pain', tags: ['ランニング', '自転車'] },
      { label: '膝蓋腱炎（ジャンパー膝）', href: '/symptoms/knee-pain', tags: ['バレー', 'バスケ', '陸上'] },
      { label: '股関節唇損傷', href: '/symptoms/hip-pain', tags: ['サッカー', '体操', '格闘技'] },
      { label: '腰痛・スポーツ腰部障害', href: '/symptoms/lower-back', tags: ['野球', '陸上', '体操'] },
      { label: '手関節障害・手首の痛み', href: '/symptoms/wrist', tags: ['野球', 'テニス', '体操'] },
    ],
  },
  {
    title: '成長期の障害',
    description: '中学生・高校生に多い成長痛・障害',
    color: 'from-indigo-600 to-indigo-800',
    items: [
      { label: 'オスグッド・シュラッター病', href: '/symptoms/osgood', tags: ['サッカー', 'バスケ', '陸上'] },
      { label: 'シーバー病（踵骨骨端症）', href: '/symptoms/severs', tags: ['サッカー', '陸上'] },
      { label: '分離症（腰椎分離症）', href: '/symptoms/spondylolysis', tags: ['野球', '体操', '陸上'] },
    ],
  },
  {
    title: '術前・術後リハビリ',
    description: '手術前の準備（プレハビリ）から術後の機能回復・競技復帰まで',
    color: 'from-navy to-blue-900',
    items: [
      { label: 'ACL術前リハビリ（プレハビリテーション）', href: '/symptoms/acl', tags: ['サッカー', 'バスケ', 'スキー'] },
      { label: 'ACL（前十字靱帯）術後リハビリ', href: '/symptoms/acl', tags: ['サッカー', 'バスケ', 'スキー'] },
      { label: '半月板術前・術後リハビリ', href: '/symptoms/meniscus', tags: ['サッカー', 'バスケ'] },
      { label: '肩関節術前・術後リハビリ', href: '/symptoms/baseball-shoulder', tags: ['野球', '水泳'] },
    ],
  },
  {
    title: '慢性的な関節痛',
    description: '長引く痛みや繰り返す症状',
    color: 'from-blue-700 to-blue-900',
    items: [
      { label: '股関節痛', href: '/symptoms/hip-pain', tags: ['中高年', 'スポーツ'] },
      { label: '膝痛（変形性膝関節症を除く）', href: '/symptoms/knee-pain', tags: ['スポーツ', '日常生活'] },
      { label: '肩痛（腱板損傷など）', href: '/symptoms/baseball-shoulder', tags: ['スポーツ', '日常生活'] },
      { label: '慢性腰痛・繰り返す腰痛', href: '/symptoms/lower-back', tags: ['スポーツ', '日常生活'] },
      { label: '手首の慢性痛・TFCC損傷', href: '/symptoms/wrist', tags: ['スポーツ', '日常生活'] },
    ],
  },
]

export default function SymptomsPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-navy to-blue-800 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <span className="text-blue-300 text-sm font-bold tracking-widest uppercase">Symptoms</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mt-2 mb-4">症状・お悩み一覧</h1>
          <p className="text-blue-100 max-w-2xl mx-auto">
            スポーツ障害・術前術後リハビリ・成長期の障害など、幅広い症状に対応しています。<br />
            「下関でリハビリといえばゆうき整骨院」を目指しています。
          </p>
        </div>
      </section>

      {/* Notice */}
      <section className="bg-blue-50 py-6">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-slate-600 text-sm text-center">
            ※ 骨折・脱臼の疑いがある場合、変形性関節症の進行例など、医療機関での診察が必要なケースはご紹介します。まずはご相談ください。
          </p>
        </div>
      </section>

      {/* Symptom Categories */}
      <section className="py-12 md:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 space-y-12">
          {symptomCategories.map((cat) => (
            <div key={cat.title}>
              <div className={`inline-flex items-center gap-3 bg-gradient-to-r ${cat.color} text-white rounded-full px-5 py-2 mb-6`}>
                <h2 className="text-base font-bold">{cat.title}</h2>
                <span className="text-xs text-white/70">{cat.description}</span>
              </div>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                {cat.items.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="group bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-xl p-5 transition-all hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 leading-snug">{item.label}</h3>
                      <ArrowRight size={16} className="text-slate-300 group-hover:text-blue-500 shrink-0 mt-0.5 transition-colors" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {item.tags.map((tag) => (
                        <span key={tag} className="bg-white text-slate-500 text-xs px-2 py-0.5 rounded border border-slate-200">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Not sure? */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">症状がどれに当たるかわからない方も</h2>
          <p className="text-slate-600 mb-8 leading-relaxed">
            「この症状は診てもらえるの？」と思ったらまずLINEでご相談ください。<br />
            内容を確認して、対応可能かどうかお伝えします。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://lin.ee/uaGKbfk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-line hover:bg-line-dark text-white font-bold px-8 py-4 rounded-full transition-all hover:scale-105"
            >
              LINEで相談する
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
