// ──────────────────────────────────────────────
// 患者さんにお見せする紹介動画（今日 → 「患者さんに見せる」）
//   1. 料金と会員プランのご紹介（PRICE_GUIDE_VIDEO・/dashboard/price-video）
//   2. 料金のしくみと健康保険のご案内（FEE_SYSTEM_VIDEO・/dashboard/fee-video。2026-11-17 院長の依頼で、別の枠として足した）
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
  /** スタッフ用のページ（今日 →「患者さんに見せる」から開く） */
  page: string
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
  page: '/dashboard/price-video',
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

// ──────────────────────────────────────────────
// 2. 料金のしくみと健康保険のご案内（2026-11-17 院長の依頼「高いと言われる前に、院の料金の必要性と保険制度を説明する動画」）
//
// 流れ：先に疑問を言葉にする（整骨院なのに、どうして保険だけじゃないの？）→ 健康保険が使えるケガ・使えないもの（国の決まり）
//   → 窓口の料金は全体の一部（1〜3割）→ 国が決めた1か所の施術料金は全部で676円（窓口3割で約200円）
//   → 痛みが引いても、まだ戻っていないことがある（線のグラフ＝イメージ図。1年後も痛みが残る人 100人に5〜33人）
//   → バランスの運動を加えた人は、ねんざをくり返した人が少なかった（100人の図：33人 → 22人）
//   → 保険と自費は役割がちがう・時期と目的で使い分ける（帯のグラフ。重なる時期に「保険＋自費」）
//   → 保険＋自費という選び方（2026-11-17 院長の依頼「保険＋自費も多いので、なぜか納得できるように」）：ケガの手当ては保険、
//     運動療法の時間は自費。理由は、ねんざ・打撲の保険の料金表に運動療法の項目が無いため（柔道整復運動後療料は
//     骨折・脱臼・不全骨折だけ）。「保険で受けられるところは保険で、自費は必要なぶんだけ」。組み合わせの合計金額は出さない
//   → 2,850円に含まれるもの → 当院の特殊な物理療法（2026-11-17 院長の依頼「特殊電気治療の差別化と費用の必要性も」）：
//     保険の電気の料金（電療料）は、どの機器を使っても1か所1回46円。専用の機器（微弱電流エレサス・コンビネーション療法・
//     超音波・体外衝撃波）は、用意と点検に費用がかかるので、使う日だけ自費（1回1,100〜3,500円・会員は月額に含む）。
//     ほかの院との比較や、機器の効果を約束する言い方はしない（ちがいは「保険の電気」との仕組みのちがいとして見せる）
//   → リハビリ2,850円に含まれるもの → 金額は先に伝える・追加は了承をいただいてから → 選び方 → 受付でどうぞ。
// 保険のきまりは、厚生労働省「柔道整復師の施術を受けられる方へ」（2026-11-17 確認）の範囲だけ。院のことは、ホームページの
//   料金ページ（2026-11-16 版）の範囲だけ。
// 1か所の料金（676円）は、院長の依頼（2026-11-17「1部位の総合の料金を出したほうが、自費の必要性を感じやすい。患者様は保険で
//   すべてまかなえると思っている」）で足した。国が決めた金額（令和8年7月1日から。保発0601第4号）で、改定で変わる。
//   変わったら INSURANCE_ONE_PART を直して動画を作り直す（金額は書きかえられない）。初検料など、ほかの保険の金額は入れていない。
// 「保険では不十分だから自費」という言い方はしない（保険の施術を下げて見せない。目的がちがう、と説明する）。
//   効果の約束・他院との比較・不安をあおる言い方・急がせる言い方は入れていない。
// 「なぜ保険だけではいけないのか」は、院長の依頼（2026-11-17「自費も使用したほうが良いと思えるように。グラフで視覚化、
//   マーケティング・心理学も」）で足した。研究の数字は「100人中○人」で見せ（割合より伝わりやすい）、出どころを画面に出し、
//   「すべての方に当てはまるわけではありません」と書く。足首のねんざの研究なので、ねんざの例として見せている（EVIDENCE）。
// 案内役と声は、料金と会員プランの動画と同じ（声は行ごとに平均 約196Hz にそろえて少し下げた）。
// ──────────────────────────────────────────────

export const FEE_SYSTEM_VIDEO: IntroVideo = {
  id: 'fee-insurance',
  title: '料金のしくみと健康保険のご案内',
  page: '/dashboard/fee-video',
  summary: '整骨院で健康保険が使えるケガと使えないもの、窓口の料金が全体の一部であること、当院のリハビリが自費である理由と料金に含まれるもの、料金の約束を、声と画面でご案内します。',
  seconds: 263,
  asOf: '2026-11-17',
  files: {
    land: { src: '/intro/fee-insurance-land.mp4', poster: '/intro/fee-insurance-land.jpg', width: 1920, height: 1080 },
    port: { src: '/intro/fee-insurance-port.mp4', poster: '/intro/fee-insurance-port.jpg', width: 1080, height: 1920 },
  },
  captions: '/intro/fee-insurance.vtt',
}

/** 「料金のしくみと健康保険のご案内」に出てくる内容（スタッフが聞かれたときの確認用。動画と同じ） */
export const FEE_SYSTEM_FACTS = {
  /** 都度払い：リハビリ（約30分） */
  paygRehab: 2850,
  /** 都度払い：施術料金（1部位） */
  paygPart: 1500,
  /** 初回のみの初回料（ホームページの料金ページ） */
  firstVisit: 2000,
  /** 健康保険が使えるケガ（厚生労働省の案内） */
  insuranceCovered: ['ねんざ・打撲・肉ばなれ（挫傷）', '骨折・脱臼（応急手当を除き、医師の同意が必要）'],
  /** 健康保険の対象にならないもの（原則。肩こり・疲れは厚生労働省の案内、手術後・競技復帰・再発予防は当院の料金案内） */
  insuranceNotCovered: ['慢性的な痛み・肩こり・疲れ', '手術後のリハビリ', '競技復帰・再発予防が目的のもの'],
  /** 窓口の負担（1〜3割。年齢や所得などで変わる） */
  windowShare: '1〜3割',
  /** 当院の専用機器（自費・1回・税込。ホームページの料金ページ／料金案内のひな形と同じ）。保険の電気（電療料）は機器にかかわらず46円 */
  devices: [
    { name: '微弱電流（エレサス）', fee: 1600 },
    { name: 'コンビネーション療法', fee: 2600 },
    { name: '超音波', fee: 2800 },
    { name: '体外衝撃波', fee: 3500 },
  ],
  /** 動画で言う、物理療法1回の幅（ホームページ：物理療法を1つ加えると＋1,100〜3,500円） */
  deviceFeeMin: 1100,
  deviceFeeMax: 3500,
  /** ねんざ・打撲の保険の料金表に、運動療法の項目は無い（運動の項目＝柔道整復運動後療料は、骨折・脱臼・不全骨折だけ） */
  exerciseItemOnlyFor: ['骨折', '脱臼', '不全骨折'],
  /** 保険のきまりの出どころ */
  insuranceSource: {
    label: '厚生労働省「柔道整復師等の施術にかかる療養費の取扱いについて」',
    url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iryouhoken/jyuudou/index.html',
    checked: '2026-11-17',
  },
} as const

/**
 * 国が決めた1か所の施術料金の例（動画で「全部で676円」と見せている。10割・円）。
 * ねんざ・打撲の2回目以降の施術（後療）で、受傷から6日目以降に温罨法と電療を加えた場合。
 * 長く続く場合（5か月超）・頻回・部位が増える場合などは、これより少なく計算される。
 */
export const INSURANCE_ONE_PART = {
  /** 後療料（打撲・捻挫） */
  koryo: 550,
  /** 温罨法料（受傷の日から5日間を除く） */
  onanpo: 80,
  /** 電療料（温罨法と併せて電気光線器具を使った場合） */
  denryo: 46,
  /** この金額が使われはじめた日 */
  since: '2026-07-01',
  source: {
    label: '厚生労働省「柔道整復師の施術に係る療養費の算定基準」の一部改正（令和8年6月1日 保発0601第4号）',
    url: 'https://www.mhlw.go.jp/hourei/doc/tsuchi/T260603S0010.pdf',
  },
} as const

/** 動画のグラフに出している研究の数字（足首のねんざ。100人中○人） */
export const FEE_VIDEO_EVIDENCE = {
  /** 1年たっても痛みが残る人（研究31本のまとめ。いちばん少ない〜多い研究） */
  painAtOneYear: {
    min: 5,
    max: 33,
    source: 'van Rijn ほか（2008）Am J Med。足首のねんざの研究31本のまとめ',
    doi: '10.1016/j.amjmed.2007.11.018',
  },
  /** 1年のあいだにねんざをくり返した人：いつもの治療だけ／＋自宅で8週間のバランスの運動（522人のランダム化比較試験） */
  recurrence: {
    usualCare: 33,
    withBalanceTraining: 22,
    weeks: 8,
    participants: 522,
    source: 'Hupperets ほか（2009）BMJ。足首をねんざした運動選手のランダム化比較試験',
    doi: '10.1136/bmj.b2684',
  },
} as const

/** 1か所の料金の合計（10割） */
export function insuranceOnePartTotal(): number {
  return INSURANCE_ONE_PART.koryo + INSURANCE_ONE_PART.onanpo + INSURANCE_ONE_PART.denryo
}

/** 窓口のお支払い（一部負担金）。10円未満は四捨五入（厚生労働省の案内のとおり） */
export function windowPayment(total: number, rate: number): number {
  return Math.round((total * rate) / 10) * 10
}

/** 今日 →「患者さんに見せる」に並べる順 */
export const INTRO_VIDEOS: readonly IntroVideo[] = [PRICE_GUIDE_VIDEO, FEE_SYSTEM_VIDEO]

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
