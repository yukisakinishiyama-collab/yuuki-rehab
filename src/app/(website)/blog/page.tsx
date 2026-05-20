import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Calendar, Tag } from 'lucide-react'

export const metadata: Metadata = {
  title: 'ブログ｜スポーツ障害・リハビリのお役立ち情報',
  description: 'ゆうき整骨院のブログ。スポーツ障害・術前術後リハビリ・競技復帰・再発予防に関する医学的根拠に基づいた情報を発信しています。下関市の整骨院からスポーツリハビリの最新情報を。',
}

const posts = [
  {
    id: 1,
    date: '2026.05.10',
    category: 'スポーツ障害',
    title: '足首捻挫の「正しい」初期対応とは？RICEからPOLICEへ',
    excerpt: '足首を捻ったとき、まず何をするべきか。従来のRICE処置から、現在推奨されるPOLICEアプローチへの変化と、なぜ早期の運動が回復を促すのかを解説します。',
    tags: ['足首', '捻挫', '初期対応'],
    emoji: '🦶',
    color: 'from-orange-500 to-red-500',
  },
  {
    id: 2,
    date: '2026.04.28',
    category: '術前・術後リハビリ',
    title: 'ACL術後リハビリの流れと、競技復帰の判断基準について',
    excerpt: '前十字靱帯（ACL）再建術後のリハビリは「何ヶ月したら復帰」ではありません。科学的な復帰基準（LSI・ホップテストなど）と段階的な進め方を詳しく説明します。',
    tags: ['ACL', '術後', '競技復帰'],
    emoji: '🏃',
    color: 'from-blue-600 to-indigo-700',
  },
  {
    id: 3,
    date: '2026.04.15',
    category: '成長期障害',
    title: 'オスグッド病を抱えながらスポーツを続けるために知っておくこと',
    excerpt: 'オスグッド病＝安静、というのは過去の話。適切な管理と運動療法で、痛みをコントロールしながらスポーツを続ける方法を保護者・選手向けに解説します。',
    tags: ['オスグッド', '成長期', '中学生'],
    emoji: '🌱',
    color: 'from-green-500 to-teal-600',
  },
  {
    id: 4,
    date: '2026.04.03',
    category: '運動療法',
    title: 'なぜ「安静だけ」では治らないのか？運動療法が必要な理由',
    excerpt: 'スポーツ障害・慢性痛に対して、なぜ運動療法が有効なのかをエビデンスとともに解説。「動かすのが怖い」という方にも読んでほしい内容です。',
    tags: ['運動療法', 'エビデンス', 'リハビリ'],
    emoji: '💪',
    color: 'from-teal-500 to-cyan-600',
  },
  {
    id: 5,
    date: '2026.03.22',
    category: 'スポーツ障害',
    title: 'シンスプリントと疲労骨折の違いと見分け方',
    excerpt: 'すねの痛みが続いているとき、シンスプリントなのか疲労骨折なのかは自己判断が難しいケースがあります。違いと、それぞれの対処法を解説します。',
    tags: ['シンスプリント', '疲労骨折', '陸上'],
    emoji: '🏅',
    color: 'from-sky-500 to-blue-600',
  },
  {
    id: 6,
    date: '2026.03.10',
    category: '競技復帰',
    title: '「痛みが取れた＝スポーツ復帰OK」ではない理由',
    excerpt: '痛みが消えても、筋力・動作パターンが回復していなければ再受傷リスクは高いまま。競技復帰に必要な評価項目と準備について解説します。',
    tags: ['競技復帰', '再発予防', 'スポーツ'],
    emoji: '⭐',
    color: 'from-purple-600 to-indigo-700',
  },
]

const categories = ['すべて', 'スポーツ障害', '術前・術後リハビリ', '成長期障害', '運動療法', '競技復帰']

export default function BlogPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-navy to-blue-800 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <span className="text-blue-300 text-sm font-bold tracking-widest uppercase">Blog</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white mt-2 mb-4">ブログ・お役立ち情報</h1>
          <p className="text-blue-100 max-w-2xl mx-auto">
            スポーツ障害・リハビリ・競技復帰に関する情報を、医学的根拠をもとに発信しています。
          </p>
        </div>
      </section>

      <section className="py-12 md:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          {/* Category Filter (Display Only) */}
          <div className="flex flex-wrap gap-2 mb-10">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  cat === 'すべて'
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <article key={post.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
                <div className={`h-40 bg-gradient-to-br ${post.color} flex flex-col items-center justify-center gap-2 relative`}>
                  <span className="text-5xl">{post.emoji}</span>
                  <span className="bg-black/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">{post.category}</span>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                    <Calendar size={12} />
                    {post.date}
                  </div>
                  <h2 className="text-sm font-bold text-slate-800 leading-snug mb-3 line-clamp-2">{post.title}</h2>
                  <p className="text-slate-500 text-xs leading-relaxed mb-4 line-clamp-3">{post.excerpt}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {post.tags.map((tag) => (
                      <span key={tag} className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                        <Tag size={10} />{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 bg-blue-50">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="text-slate-700 mb-2 font-semibold">記事の内容について質問がある方は</p>
          <p className="text-slate-500 text-sm mb-6">LINEでお気軽にお声がけください</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://lin.ee/uaGKbfk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-line hover:bg-line-dark text-white font-bold px-8 py-4 rounded-full transition-all"
            >
              LINEで相談する
            </a>
            <Link
              href="/symptoms"
              className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-8 py-4 rounded-full transition-all"
            >
              症状から探す <ChevronRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
