'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Calendar, Tag } from 'lucide-react'
import { BLOG_POSTS } from '@/lib/site/blog'

const posts = BLOG_POSTS
const categories = ['すべて', 'スポーツ障害', '術前・術後リハビリ', '成長期障害', '運動療法', '競技復帰']

export default function BlogPage() {
  const [selected, setSelected] = useState('すべて')
  const filtered = selected === 'すべて' ? posts : posts.filter((p) => p.category === selected)

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
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 mb-10">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelected(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  cat === selected
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-slate-400 py-12">該当する記事がありません</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="block bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md hover:border-blue-200 transition-all"
                >
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
                    <span className="inline-flex items-center gap-1 text-blue-700 text-xs font-semibold mt-4">
                      続きを読む <ChevronRight size={12} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
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
