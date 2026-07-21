import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://yuuki-rehab.vercel.app'

// 内部スタッフアプリ（(app)グループ）と管理系は検索・AIクロールの対象外
const DISALLOW = [
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
]

// 生成AI検索（GEO）向けに、主要なAIクローラーを明示的に歓迎する。
// 公開ページはクロール可・内部アプリは除外、という方針を各ボットに明示。
const AI_BOTS = [
  'GPTBot', // OpenAI（ChatGPT学習・検索）
  'OAI-SearchBot', // OpenAI 検索
  'ChatGPT-User', // ChatGPT ブラウジング
  'ClaudeBot', // Anthropic
  'anthropic-ai',
  'Claude-Web',
  'PerplexityBot', // Perplexity
  'Perplexity-User',
  'Google-Extended', // Google Gemini / AI Overview
  'Applebot-Extended', // Apple Intelligence
  'CCBot', // Common Crawl（多くのLLMの学習元）
  'Bytespider',
  'meta-externalagent', // Meta AI
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // 一般の検索エンジン
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOW,
      },
      // AIクローラー（公開ページは歓迎・内部アプリは除外）
      {
        userAgent: AI_BOTS,
        allow: '/',
        disallow: DISALLOW,
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
