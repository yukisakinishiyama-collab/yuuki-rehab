import type { NextConfig } from "next";

// 削除した画面の古いURL（ブックマーク・LINEの過去のメッセージなど）は、近い画面へ案内する
const REMOVED_TO_HOME = [
  '/patients/dashboard',
  '/cases',
  '/protocols',
  '/diseases',
  '/literature',
  '/illustrations',
  '/rom',
  '/gonio',
  '/sports',
  '/staff',
]

// 院のホームページ（検索に出す本来のサイト）。このアプリの公開ページと同じ内容のものは、ここへ移動させる
const HOMEPAGE = 'https://shimonoseki-yuuki.com'

// このアプリの公開ページ → ホームページの同じページ（検索で2つのサイトが重ならないように。2026-10-24 院長の判断）
// ネット予約の入口（/yoyaku-net）・LINE予約（/liff）・競技復帰ドリル（/drills。ホームページに同じページが無い）は残す
const TO_HOMEPAGE: Array<[string, string]> = [
  ['/', '/'],
  ['/first-visit', '/about'],
  ['/price', '/price'],
  ['/access', '/access'],
  ['/faq', '/faq'],
  ['/blog', '/column'],
  ['/blog/:slug*', '/column'],
  ['/symptoms', '/symptoms'],
  ['/symptoms/acl', '/sym-acl'],
  ['/symptoms/meniscus', '/sym-meniscus'],
  ['/symptoms/knee-pain', '/sym-knee'],
  ['/symptoms/ankle-sprain', '/sym-ankle'],
  ['/symptoms/osgood', '/sym-osgood'],
  ['/symptoms/shin-splints', '/sym-shin'],
  ['/symptoms/severs', '/sym-severs'],
  ['/symptoms/muscle-strain', '/sym-strain'],
  ['/symptoms/baseball-elbow', '/sym-baseball'],
  ['/symptoms/baseball-shoulder', '/sym-baseball'],
  ['/symptoms/hip-pain', '/sym-hip'],
  ['/symptoms/lower-back', '/sym-back'],
  ['/symptoms/spondylolysis', '/sym-back'],
  ['/symptoms/wrist', '/sym-wrist'],
  ['/symptoms/:path*', '/symptoms'],
]

// restart trigger
const nextConfig: NextConfig = {
  env: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
  },
  serverExternalPackages: ['@anthropic-ai/sdk'],
  // 投稿画像（Instagramストーリーの空き状況・テンプレート画像）を作るサーバーの処理に、日本語フォントを同梱する
  outputFileTracingIncludes: {
    '/api/marketing/**': ['./assets/fonts/**/*'],
  },
  async redirects() {
    return [
      ...REMOVED_TO_HOME.flatMap((source) => [
        { source, destination: '/dashboard', permanent: false },
        { source: `${source}/:path*`, destination: '/dashboard', permanent: false },
      ]),
      // 患者さん向けの画面（Web問診・カラダマップ・患者さん用ページ・動作解析の依頼）は、ホームページの「当院について」（初めての方への流れ）へ
      { source: '/monshin', destination: `${HOMEPAGE}/about`, permanent: false },
      { source: '/karada/:path*', destination: `${HOMEPAGE}/about`, permanent: false },
      { source: '/patient', destination: `${HOMEPAGE}/about`, permanent: false },
      { source: '/patient/:path*', destination: `${HOMEPAGE}/about`, permanent: false },
      { source: '/submit', destination: `${HOMEPAGE}/about`, permanent: false },
      ...TO_HOMEPAGE.map(([source, path]) => ({ source, destination: `${HOMEPAGE}${path}`, permanent: true })),
    ];
  },
};

export default nextConfig;
