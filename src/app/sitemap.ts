import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://yuuki-rehab.vercel.app'

/**
 * 検索に出すページの一覧
 *
 * 院のホームページは https://shimonoseki-yuuki.com/ （Netlify）。このアプリの公開ページのうち、
 * ホームページと同じ内容のもの（症状・料金・アクセス・FAQ・ブログなど）は、ホームページへ移動させている
 * （next.config.ts の TO_HOMEPAGE）。ここには、ホームページに同じページが無い「競技復帰ドリル」だけを載せる。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${BASE_URL}/drills`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ]
}
