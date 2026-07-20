import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Calendar, Tag, ChevronRight, Clock, AlertCircle } from 'lucide-react'
import JsonLd from '@/components/site/JsonLd'
import { BLOG_POSTS, getPostBySlug } from '@/lib/site/blog'
import { SITE_URL, breadcrumbJsonLd } from '@/lib/site/seo'

/** 全記事を静的生成する */
export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return {}

  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      url: `${SITE_URL}/blog/${post.slug}`,
      publishedTime: post.isoDate,
    },
  }
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  // 同カテゴリの関連記事（自分以外・最大3件）
  const related = BLOG_POSTS.filter(
    (p) => p.slug !== post.slug && p.category === post.category,
  ).slice(0, 3)

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.isoDate,
    dateModified: post.isoDate,
    inLanguage: 'ja',
    keywords: post.tags.join(', '),
    articleSection: post.category,
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
    author: { '@type': 'Organization', name: 'ゆうき整骨院', url: SITE_URL },
    publisher: { '@id': `${SITE_URL}/#clinic` },
  }

  return (
    <div>
      <JsonLd data={articleJsonLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'ホーム', url: `${SITE_URL}/` },
          { name: 'ブログ・お役立ち情報', url: `${SITE_URL}/blog` },
          { name: post.title, url: `${SITE_URL}/blog/${post.slug}` },
        ])}
      />

      {/* Hero */}
      <section className={`bg-gradient-to-br ${post.color} py-14 md:py-20`}>
        <div className="max-w-3xl mx-auto px-4 text-center">
          <span className="text-6xl block mb-4">{post.emoji}</span>
          <span className="bg-black/20 text-white text-xs font-bold px-3 py-1 rounded-full">
            {post.category}
          </span>
          <h1 className="text-2xl md:text-3xl font-bold text-white mt-4 leading-snug">
            {post.title}
          </h1>
          <div className="flex items-center justify-center gap-4 text-white/80 text-xs mt-4">
            <span className="flex items-center gap-1">
              <Calendar size={12} /> {post.date}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} /> 約{post.readingMinutes}分で読めます
            </span>
          </div>
        </div>
      </section>

      {/* パンくず（画面表示用） */}
      <nav className="max-w-3xl mx-auto px-4 pt-6 text-xs text-slate-500">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="hover:text-blue-700">
              ホーム
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li>
            <Link href="/blog" className="hover:text-blue-700">
              ブログ
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li className="text-slate-700 line-clamp-1">{post.title}</li>
        </ol>
      </nav>

      {/* 本文 */}
      <article className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-slate-600 leading-relaxed border-l-4 border-blue-600 pl-4 mb-10">
          {post.excerpt}
        </p>

        {post.body.map((section) => (
          <section key={section.heading} className="mb-10">
            <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-4 flex items-start gap-2">
              <span className="w-1 h-6 bg-blue-700 rounded-full inline-block shrink-0 mt-0.5" />
              {section.heading}
            </h2>

            {section.paragraphs?.map((text) => (
              <p key={text.slice(0, 24)} className="text-slate-700 leading-loose mb-4">
                {text}
              </p>
            ))}

            {section.list && (
              <ul className="space-y-2 my-4">
                {section.list.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-slate-700 text-sm leading-relaxed bg-slate-50 rounded-lg px-4 py-3"
                  >
                    <span className="text-blue-600 mt-1 shrink-0">●</span>
                    {item}
                  </li>
                ))}
              </ul>
            )}

            {section.note && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-amber-900 text-sm leading-relaxed">{section.note}</p>
              </div>
            )}
          </section>
        ))}

        {/* タグ */}
        <div className="flex flex-wrap gap-2 pt-6 border-t border-slate-100">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded border border-slate-100"
            >
              <Tag size={10} />
              {tag}
            </span>
          ))}
        </div>
      </article>

      {/* CTA */}
      <section className="bg-slate-50 py-14">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="text-slate-700 mb-2 font-semibold">
            この記事の内容について質問がある方は
          </p>
          <p className="text-slate-500 text-sm mb-6">
            症状の程度や進め方には個人差があります。気になる点はお気軽にご相談ください。
          </p>
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

      {/* 関連記事 */}
      {related.length > 0 && (
        <section className="py-14 bg-white">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-lg font-bold text-slate-900 mb-6">関連する記事</h2>
            <div className="grid md:grid-cols-3 gap-5">
              {related.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div
                    className={`h-28 bg-gradient-to-br ${p.color} flex items-center justify-center`}
                  >
                    <span className="text-4xl">{p.emoji}</span>
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-bold text-slate-800 leading-snug line-clamp-2">
                      {p.title}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="max-w-3xl mx-auto px-4 pb-14">
        <Link
          href="/blog"
          className="text-blue-700 text-sm font-semibold hover:underline"
        >
          ← ブログ一覧に戻る
        </Link>
      </div>
    </div>
  )
}
