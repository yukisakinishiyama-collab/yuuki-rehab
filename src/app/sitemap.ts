import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://yuuki-rehab.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const symptomPages = [
    'acl',
    'meniscus',
    'ankle-sprain',
    'muscle-strain',
    'baseball-shoulder',
    'baseball-elbow',
    'shin-splints',
    'knee-pain',
    'hip-pain',
    'osgood',
    'severs',
    'spondylolysis',
    'lower-back',
    'wrist',
  ]

  return [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${BASE_URL}/first-visit`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/price`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/symptoms`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    ...symptomPages.map((slug) => ({
      url: `${BASE_URL}/symptoms/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    {
      url: `${BASE_URL}/blog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/faq`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/access`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.8,
    },
  ]
}
