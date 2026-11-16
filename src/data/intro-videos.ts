// ──────────────────────────────────────────────
// 患者さんにお見せする紹介動画（今日 → 「患者さんに見せる」→ 料金と会員プランのご紹介）
//
// 2026-11-16 院長の依頼で足した。声の解説つき・約2分。タブレットを患者さんに向けて、画面いっぱいで見せる。
// 動画の本体は public/intro/（横向き＝タブレット・モニター用 1920x1080、縦向き＝スマホ用 1080x1920。中身は同じ）。
//
// 動画の中の金額・条件は、動画を作った日（asOf）の料金。あとから書きかえられないので、料金や条件を変えたら
// 動画を作り直して、下の PRICE_GUIDE_FACTS もいっしょに直す。
// 契約書・料金案内のひな形（src/data/contract-templates.ts）と金額が食いちがうと、
// tools/test-intro-videos.mjs が知らせる（古い金額の動画を患者さんに見せ続けないため）。
//
// 文面の決まり：効果を約束する言い方・不安をあおる言い方・「今だけ」のような急がせる言い方は入れていない。
// 都度払いのほうが少ない例もそのまま出している。通院中の方に院内でお見せする前提なので、
// SNS など院の外に出すときは、広告として点検し直す（料金の表示は施術所の広告では出せないため）。
// ──────────────────────────────────────────────

/** 動画の向き。land＝横向き（タブレット・モニター）、port＝縦向き（スマホ） */
export type VideoOrientation = 'land' | 'port'

export interface IntroVideoFile {
  src: string
  /** 再生の前に出しておく絵 */
  poster: string
  width: number
  height: number
}

export interface IntroVideo {
  id: string
  title: string
  /** スタッフ向けの一言（何の動画か） */
  summary: string
  /** 長さ（秒） */
  seconds: number
  /** 動画の中の金額・条件を確かめた日 */
  asOf: string
  files: Record<VideoOrientation, IntroVideoFile>
  /** 声の文字（WebVTT）。音を出せない場所や、耳の遠い方のために、動画の字幕ボタンで出せる */
  captions: string
}

export const PRICE_GUIDE_VIDEO: IntroVideo = {
  id: 'price-guide',
  title: '料金と会員プランのご紹介',
  summary: '都度払いの料金、会員プランの内容・料金・都度払いとの比較・入る前に知っておいてほしいことを、声と画面でご案内します。',
  seconds: 125,
  asOf: '2026-11-16',
  files: {
    land: { src: '/intro/price-guide-land.mp4', poster: '/intro/price-guide-land.jpg', width: 1920, height: 1080 },
    port: { src: '/intro/price-guide-port.mp4', poster: '/intro/price-guide-port.jpg', width: 1080, height: 1920 },
  },
  captions: '/intro/price-guide.vtt',
}

/**
 * 動画に出てくる金額（税込・円）と条件。動画と同じ数字を書いておく（スタッフが聞かれたときの確認用にも画面に出す）。
 * ひな形の金額と比べるのは tools/test-intro-videos.mjs
 */
export const PRICE_GUIDE_FACTS = {
  /** 都度払い：リハビリ（約30分） */
  paygRehab: 2850,
  /** 都度払い：施術料金（1部位） */
  paygPart: 1500,
  /** 初回のみの初回料（ホームページの料金ページ） */
  firstVisit: 2000,
  /** 物理療法を加える日（1つにつき。いちばん安いもの〜高いもの） */
  physioMin: 1100,
  physioMax: 3500,
  /** 会員プランの月額 */
  memberGeneral: 23000,
  memberStudent: 19000,
  /** 会員：1回ごとの1部位施術料。健康保険を使う日（このほかに保険の窓口料金） */
  memberPartWithInsurance: 1000,
  /** 会員：1回ごとの1部位施術料。健康保険を使わない日 */
  memberPartNoInsurance: 1500,
  /** 会員：材料費は別にいただかない（2026-11-16 院長） */
  memberMaterialsIncluded: true,
  /** 最低利用期間（か月） */
  minimumMonths: 3,
} as const

/** 都度払いの1回の基本（リハビリ＋施術1部位） */
export function paygPerVisit(): number {
  return PRICE_GUIDE_FACTS.paygRehab + PRICE_GUIDE_FACTS.paygPart
}

/** 画面の向きに合う動画（横長の画面なら横向き、縦長なら縦向き） */
export function pickOrientation(width: number, height: number): VideoOrientation {
  return width >= height ? 'land' : 'port'
}

/** 「約2分」のような長さの表記 */
export function lengthLabel(seconds: number): string {
  if (seconds < 50) return `約${Math.max(10, Math.round(seconds / 10) * 10)}秒`
  return `約${Math.max(1, Math.round(seconds / 60))}分`
}

export function yen(n: number): string {
  return `${n.toLocaleString('ja-JP')}円`
}
