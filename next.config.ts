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

// restart trigger
const nextConfig: NextConfig = {
  env: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
  },
  serverExternalPackages: ['@anthropic-ai/sdk'],
  async redirects() {
    return [
      ...REMOVED_TO_HOME.flatMap((source) => [
        { source, destination: '/dashboard', permanent: false },
        { source: `${source}/:path*`, destination: '/dashboard', permanent: false },
      ]),
      // 患者さん向けの画面（Web問診・カラダマップ・患者さん用ページ・動作解析の依頼）は、初めての方のページへ
      { source: '/monshin', destination: '/first-visit', permanent: false },
      { source: '/karada/:path*', destination: '/first-visit', permanent: false },
      { source: '/patient', destination: '/first-visit', permanent: false },
      { source: '/patient/:path*', destination: '/first-visit', permanent: false },
      { source: '/submit', destination: '/first-visit', permanent: false },
    ];
  },
};

export default nextConfig;
