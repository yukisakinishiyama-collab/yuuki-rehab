import FeeShortVideoPage from '@/components/clinic/FeeShortVideoPage'

/**
 * 料金のしくみと健康保険のご案内・短い版（動画・約2分）。患者さんにお見せする紹介ページ（2026-11-19 院長の依頼）。
 * 今日 →「患者さんに見せる」から開く。/dashboard の下なので、院内アプリのパスワードで守られる（src/proxy.ts）。
 */
export default function FeeShortVideoRoute() {
  return <FeeShortVideoPage />
}
