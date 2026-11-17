import FeeVideoPage from '@/components/clinic/FeeVideoPage'

/**
 * 料金のしくみと健康保険のご案内（動画）。患者さんにお見せする紹介ページ（2026-11-17 院長の依頼。料金と会員プランの動画とは別の枠）。
 * 今日 →「患者さんに見せる」から開く。/dashboard の下なので、院内アプリのパスワードで守られる（src/proxy.ts）。
 */
export default function FeeVideoRoute() {
  return <FeeVideoPage />
}
