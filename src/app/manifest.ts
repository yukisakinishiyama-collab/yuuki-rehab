import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ゆうき整骨院 院内アプリ',
    short_name: 'ゆうき院内',
    description: 'ゆうき整骨院の院内アプリ（予約管理・カルテ・経営・集客）',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#13253d',
    theme_color: '#0d9488',
    categories: ['medical', 'business'],
    icons: [
      {
        src: '/icon.png.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon.png.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [],
  }
}
