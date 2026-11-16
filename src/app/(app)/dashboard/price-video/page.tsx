import IntroVideoPage from '@/components/clinic/IntroVideoPage'

/**
 * 料金と会員プランのご紹介（動画）。患者さんにお見せする紹介ページ（2026-11-16 院長の依頼）。
 * 今日 →「患者さんに見せる」から開く。/dashboard の下なので、院内アプリのパスワードで守られる（src/proxy.ts）。
 */
export default function PriceVideoPage() {
  return <IntroVideoPage />
}
