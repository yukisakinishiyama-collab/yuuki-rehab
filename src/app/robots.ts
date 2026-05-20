import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://yuuki-rehab.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/patient/', '/staff/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
