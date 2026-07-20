/**
 * 院の基本情報（一元管理・指示書18章）
 *
 * ここが全AI生成のシングルソース。設定画面で編集した値がlocalStorageに保存され、
 * 未設定項目はこのデフォルトで補完される。
 */
import type { ClinicProfile } from './types'

export const RESERVE_URL =
  'https://script.google.com/macros/s/AKfycby6httkx008ojq7MIBpC7pDmfsJQAtQx6xpYNkD67JM7K7jgGaWGkTky9RHW04M1qm9/exec'

export const DEFAULT_CLINIC_PROFILE: ClinicProfile = {
  name: 'ゆうき整骨院',
  address: '山口県下関市彦島江の浦町9丁目1-14',
  phone: '083-265-4545',
  emergencyPhone: '090-5702-7731',
  hours: '月〜金 10:00-13:00・15:00-20:00、土 10:00-15:00',
  closedDays: '日曜・祝日',
  reserveUrl: RESERVE_URL,
  lineUrl: 'https://lin.ee/432amljv',
  googleMapUrl: 'https://maps.google.com/?cid=6709983637345638461',
  instagramUrl: 'https://www.instagram.com/yu.ki__seikotsuin',
  parking: '駐車場あり（院前）',
  services:
    '外傷治療（捻挫・打撲・挫傷など）／スポーツ外傷／術前術後リハビリ／運動療法／体外衝撃波・超音波などの物理療法',
  notServices:
    '診断・投薬・画像検査（必要時は整形外科・医療機関をご案内）／慰安目的のみのリラクゼーション',
  priceSummary:
    '急性外傷は健康保険適用の場合あり。自費：リハビリ約30分 2,850円／施術1部位 1,500円／物理療法 1,100〜3,500円（税込）',
  firstVisitFlow: '①受付・問診 → ②状態の確認（動き・痛みのチェック） → ③ご説明と施術のご提案 → ④施術',
  strengths:
    'エビデンスに基づく評価と施術／医師・医療機関との連携／再発予防と競技復帰までの伴走／ネット予約24時間・即時確定',
  bannedPhrases: '',
  defaultTone: 'やさしく専門的。断定せず、来院を強要しない。',
}

/** AI生成プロンプトに注入する院情報テキストを組み立てる */
export function clinicProfileToPrompt(profile: ClinicProfile): string {
  return [
    `院名: ${profile.name}`,
    `所在地: ${profile.address}（${profile.parking}）`,
    `電話: ${profile.phone}`,
    `診療時間: ${profile.hours}／休診: ${profile.closedDays}`,
    `ネット予約（24時間・即時確定）: ${profile.reserveUrl}`,
    `公式LINE: ${profile.lineUrl}`,
    `Google店舗ページ: ${profile.googleMapUrl}`,
    `Instagram: ${profile.instagramUrl}`,
    `対応内容: ${profile.services}`,
    `対応できない内容: ${profile.notServices}`,
    `料金の目安: ${profile.priceSummary}`,
    `初回の流れ: ${profile.firstVisitFlow}`,
    `院の強み: ${profile.strengths}`,
    `トーン: ${profile.defaultTone}`,
  ].join('\n')
}
