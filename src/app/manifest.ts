import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'YUUKI REHAB | 運動器リハビリ動画分析',
    short_name: 'YUUKI REHAB',
    description: 'ゆうき整骨院のリハビリ管理・動画分析・プロトコル立案・復帰基準テストシステム',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#080e1a',
    theme_color: '#0d9488',
    categories: ['medical', 'health', 'fitness'],
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
