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
//
// 2026-11-17 院長の依頼で、金額の見せ方を作り直した（金額そのものは変えていない）：
//   都度払いの1か月の合計を先に見せる（月8回：物理療法なし・微弱電流を毎回・体外衝撃波を毎回）
//   → 月額23,000円を「リハビリ約8回分」に言いかえる → 月額に含まれる物理療法に都度払いの値段を付けて「追加料金なし」
//   → 同じ月8回で比べる（会員プランはどの場合も同じ金額）→ 物理療法を使わない場合は「ほぼ同じ・月9回から少なくなる」。
//   比べ方は、カルテの「会員プランのご案内」（lib/contracts/member-guide.ts）の計算と同じ数字になる（テストで確かめる）。
// 案内役は、ふぐのキャラクターから、院内スタッフの絵（AIで作ったオリジナル。実在の人物ではない。名札は白紙で、
//   名前・資格は書いていない）に替えた。医師に見える持ち物（聴診器など）は描いていない。
// 声も同じ日に録り直した（より自然な日本語の合成音声。話す速さはそのままで、高さだけを少し下げて落ち着いた声に
//   ＝平均 約190Hz台）。数字は読みまちがえないよう、漢数字で読ませている（字幕は算用数字）。
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
  seconds: 143,
  asOf: '2026-11-17',
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
  /** 会員プランの月額に含まれる物理療法と、都度払いでの料金（動画で「追加料金なし」と見せている4つ） */
  includedPhysio: [
    { name: '体外衝撃波', fee: 3500 },
    { name: '5D', fee: 2700 },
    { name: 'コンビネーション療法', fee: 2600 },
    { name: '微弱電流エレサス', fee: 1600 },
  ],
  /** 動画で比べている回数（1か月・1部位・健康保険を使わない場合） */
  compareVisits: 8,
  /** 動画で比べている2つの例（毎回1つ加える物理療法と、都度払いでの料金） */
  compareExamples: [
    { label: '微弱電流を毎回', fee: 1600 },
    { label: '体外衝撃波を毎回', fee: 3500 },
  ],
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

/** 動画の比べ方：都度払いの1か月の合計（毎回 physioFee の物理療法を1つ加える。0 なら使わない） */
export function videoPaygMonthly(visits: number, physioFee = 0): number {
  return (paygPerVisit() + physioFee) * visits
}

/** 動画の比べ方：一般会員の1か月の合計（月額＋施術料×回数。健康保険を使わない場合） */
export function videoMemberMonthly(visits: number): number {
  return PRICE_GUIDE_FACTS.memberGeneral + PRICE_GUIDE_FACTS.memberPartNoInsurance * visits
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
