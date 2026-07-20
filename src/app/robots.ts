import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://yuuki-rehab.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // 内部スタッフアプリ（(app)グループ）と管理系は検索対象外にする
        disallow: [
          '/cases/',
          '/dashboard/',
          '/gonio/',
          '/literature/',
          '/marketing/',
          '/patient/',
          '/patients/',
          '/protocols/',
          '/rom/',
          '/sports/',
          '/staff/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
