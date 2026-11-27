// アウトカム（カルテ → 評価・測定 → アウトカム）で記録する指標と、競技ごと・疾患ごとの評価セット
// 疾患ごとの評価セット（足関節捻挫・肉離れ 3 部位）は 2026-11-27 院長「アウトカムで捻挫や肉離れのようにそれぞれの疾患に伴うアウトカム評価も」。
// 目安の線・参考の論文は PubMed で抄録を読んで確かめた範囲だけ（DECISIONS.md）
// better … 'low' は数字が小さいほど良い（痛み・左右差）、'high' は大きいほど良い
//
// 目安の線（target）は「論文で使われた値」を参考に引くもので、復帰してよいかを決めるものではない。
//   reach   … この値に届いているか（例：LSI 90%）
//   caution … この値を超えると注意（例：Yバランス前方の左右差 4cm）
//   reference … 比べるための参考の値（例：健康な人の平均）
import type { ConditionKey, OutcomeMetricKey, SportKey } from '@/types/contracts'

export type OutcomeGroup = '痛み' | '腫れ' | '可動域' | '機能スコア' | '筋力・LSI' | 'ホップ' | 'バランス・競技動作'

export interface OutcomeTarget {
  value: number
  type: 'reach' | 'caution' | 'reference'
  /** 線の横に出す短い言葉（例「目安 90%」） */
  label: string
  /** どの論文の値か（画面の下に小さく出す） */
  source: string
  /** caution のとき、区切りの値ちょうどを注意に入れる（GIRD 20°以上・CAIT 25点以下） */
  inclusive?: boolean
}

/** 左右を入れて計算する指標 */
export interface OutcomePair {
  /** lsi＝患側÷健側×100、lsi_time＝健側÷患側×100（時間は短いほど良いため）、absdiff＝左右の差の大きさ */
  calc: 'lsi' | 'lsi_time' | 'absdiff'
  labels: [string, string]
  unit: string
  step: number
  min: number
  max: number
  start: [number, number]
  /** 入れ方の説明（例「HHD・同じ姿勢で」） */
  hint?: string
}

export interface OutcomeMetric {
  key: OutcomeMetricKey
  label: string
  group: OutcomeGroup
  /** グラフ・一覧に出す値の単位 */
  unit: string
  min: number
  max: number
  step: number
  better: 'low' | 'high'
  /** 最初に入っている値（その方の前回の値があればそちら） */
  start: number
  target?: OutcomeTarget
  /** 左右の2つを入れて計算する */
  pair?: OutcomePair
  /** 肩の内旋・外旋を左右で4つ入れて、GIRD と TRM 差を出す */
  rotation?: boolean
  /** 入れ方の説明（例「合計点を入れる」） */
  hint?: string
}

// 2026-11-20：左右の値の上限を広げた（前は筋力 150kg・ホップ 300cm などを超えると、理由が出ないまま記録できなかった）
const HHD_HINT = 'HHD など・左右とも同じ姿勢と道具で'

const GRINDEM = 'Grindem 2016（ACL再建後の復帰の研究）で使われた LSI 90%'
const LSI90: OutcomeTarget = { value: 90, type: 'reach', label: '目安 90%', source: GRINDEM }

export const WILK_SOURCE = 'Wilk 2011（プロ野球投手の研究）で使われた区切り：GIRD 20°以上・TRM 差 5°超'
export const TRM_CAUTION = 5

export const OUTCOME_METRICS: OutcomeMetric[] = [
  // ── 痛み ──
  { key: 'nrs', label: '痛み NRS', group: '痛み', unit: '', min: 0, max: 10, step: 1, better: 'low', start: 5 },
  { key: 'throw_nrs', label: '投げるときの痛み NRS', group: '痛み', unit: '', min: 0, max: 10, step: 1, better: 'low', start: 3 },
  { key: 'run_nrs', label: '走るときの痛み NRS', group: '痛み', unit: '', min: 0, max: 10, step: 1, better: 'low', start: 3 },
  { key: 'kick_nrs', label: 'ボールを蹴るときの痛み NRS', group: '痛み', unit: '', min: 0, max: 10, step: 1, better: 'low', start: 3 },

  // ── 腫れ ──
  {
    key: 'swelling_f8',
    label: '足首の腫れ（8の字周径）の左右差',
    group: '腫れ',
    unit: 'cm',
    min: 0,
    max: 30,
    step: 0.5,
    better: 'low',
    start: 2,
    pair: {
      calc: 'absdiff',
      labels: ['患側', '健側'],
      unit: 'cm',
      step: 0.5,
      min: 20,
      max: 100,
      start: [52, 50],
      hint: 'フィギュアエイト法（足首に8の字にメジャーを回して測る）。Tatro-Adams 1995・Petersen 1999（腫れた足首でも）で、測り直してもぶれが小さい方法とされた',
    },
  },

  // ── 可動域 ──
  { key: 'rom_knee_flex', label: '膝 屈曲', group: '可動域', unit: '°', min: 0, max: 170, step: 5, better: 'high', start: 120 },
  { key: 'rom_knee_ext', label: '膝 伸展', group: '可動域', unit: '°', min: -40, max: 20, step: 1, better: 'high', start: 0 },
  {
    key: 'gird',
    label: '肩の内旋・外旋（GIRD）',
    group: '可動域',
    unit: '°',
    min: -30,
    max: 90,
    step: 1,
    better: 'low',
    start: 0,
    rotation: true,
    target: { value: 20, type: 'caution', label: 'GIRD 20°', source: WILK_SOURCE, inclusive: true },
    hint: '仰向け・肩90°外転で、肩甲骨を押さえて測る。GIRD＝投げない側の内旋 − 投げる側の内旋',
  },
  {
    key: 'wblt',
    label: '足首の背屈（ランジテスト）の左右差',
    group: '可動域',
    unit: 'cm',
    min: 0,
    max: 20,
    step: 0.5,
    better: 'low',
    start: 2,
    pair: {
      calc: 'absdiff',
      labels: ['患側', '健側'],
      unit: 'cm',
      step: 0.5,
      min: 0,
      max: 30,
      start: [8, 10],
      hint: '壁に向かって片膝を前に出し、かかとが浮かない範囲で届いたつま先と壁の距離。前回との差が 2cm に満たないときは測り方のぶれのことがある（Powden 2015 のまとめ：1.6〜1.9cm）',
    },
  },
  {
    key: 'aslr',
    label: '脚を自分で上げる角度（能動SLR）の左右差',
    group: '可動域',
    unit: '°',
    min: 0,
    max: 90,
    step: 1,
    better: 'low',
    start: 10,
    pair: { calc: 'absdiff', labels: ['患側', '健側'], unit: '°', step: 1, min: 0, max: 150, start: [60, 75], hint: '仰向けで膝を伸ばしたまま、自分の力で脚を上げた角度' },
  },
  { key: 'rom_other', label: 'その他の可動域', group: '可動域', unit: '°', min: -90, max: 180, step: 5, better: 'high', start: 90 },

  // ── 機能スコア（質問票は合計点を入れる） ──
  { key: 'koos', label: 'KOOS', group: '機能スコア', unit: '点', min: 0, max: 100, step: 1, better: 'high', start: 60 },
  { key: 'lysholm', label: 'Lysholm', group: '機能スコア', unit: '点', min: 0, max: 100, step: 1, better: 'high', start: 60 },
  { key: 'ikdc', label: 'IKDC', group: '機能スコア', unit: '点', min: 0, max: 100, step: 1, better: 'high', start: 60 },
  { key: 'acl_rsi', label: 'ACL-RSI', group: '機能スコア', unit: '点', min: 0, max: 100, step: 1, better: 'high', start: 50, hint: '復帰への気持ちの準備（0〜100）' },
  { key: 'kjoc', label: 'KJOC（投げる選手の肩・肘）', group: '機能スコア', unit: '点', min: 0, max: 100, step: 1, better: 'high', start: 70, hint: 'Alberta 2010 の質問票。合計点（0〜100）' },
  { key: 'hagos_sport', label: 'HAGOS スポーツ', group: '機能スコア', unit: '点', min: 0, max: 100, step: 1, better: 'high', start: 60, hint: '股関節・鼠径部の質問票のうち「スポーツ」の点' },
  { key: 'hagos_pain', label: 'HAGOS 痛み', group: '機能スコア', unit: '点', min: 0, max: 100, step: 1, better: 'high', start: 60, hint: '「痛み」の点（高いほど痛みが少ない）' },
  {
    key: 'visa_a',
    label: 'VISA-A（アキレス腱）',
    group: '機能スコア',
    unit: '点',
    min: 0,
    max: 100,
    step: 1,
    better: 'high',
    start: 60,
    target: { value: 96, type: 'reference', label: '健康な人の平均 96', source: 'Robinson 2001（VISA-A をつくった研究）の健康な人の平均' },
  },
  { key: 'visa_p', label: 'VISA-P（膝蓋腱）', group: '機能スコア', unit: '点', min: 0, max: 100, step: 1, better: 'high', start: 60 },
  {
    key: 'cait',
    label: 'CAIT（足首の不安定感）',
    group: '機能スコア',
    unit: '点',
    min: 0,
    max: 30,
    step: 1,
    better: 'high',
    start: 22,
    hint: '質問票の合計点（0〜30）。高いほど安定。質問票はアウトカムスコアの「CAIT」でも記入できる',
    target: {
      value: 25,
      type: 'caution',
      inclusive: true,
      label: '25点以下',
      source: 'Wright 2014（CAIT の区切りを決め直した研究）で、くり返す足首の不安定感の区切りとされた 25点以下',
    },
  },

  // ── 筋力・LSI（左右を入れると LSI を出す） ──
  {
    key: 'lsi_quad',
    label: '大腿四頭筋 LSI',
    group: '筋力・LSI',
    unit: '%',
    min: 0,
    max: 150,
    step: 1,
    better: 'high',
    start: 80,
    target: LSI90,
    pair: { calc: 'lsi', labels: ['患側', '健側'], unit: 'kg', step: 0.5, min: 0, max: 999, start: [20, 25], hint: HHD_HINT },
  },
  {
    key: 'lsi_ham',
    label: 'ハムストリングス LSI',
    group: '筋力・LSI',
    unit: '%',
    min: 0,
    max: 150,
    step: 1,
    better: 'high',
    start: 80,
    target: LSI90,
    pair: { calc: 'lsi', labels: ['患側', '健側'], unit: 'kg', step: 0.5, min: 0, max: 999, start: [12, 15], hint: HHD_HINT },
  },
  {
    key: 'lsi_hip_add',
    label: '股関節 内転筋力 LSI',
    group: '筋力・LSI',
    unit: '%',
    min: 0,
    max: 150,
    step: 1,
    better: 'high',
    start: 85,
    pair: { calc: 'lsi', labels: ['患側', '健側'], unit: 'kg', step: 0.5, min: 0, max: 999, start: [15, 18], hint: 'HHD・仰向けで' },
  },
  {
    key: 'lsi_hip_abd',
    label: '股関節 外転筋力 LSI',
    group: '筋力・LSI',
    unit: '%',
    min: 0,
    max: 150,
    step: 1,
    better: 'high',
    start: 85,
    pair: { calc: 'lsi', labels: ['患側', '健側'], unit: 'kg', step: 0.5, min: 0, max: 999, start: [15, 18], hint: 'HHD・仰向けで' },
  },
  {
    key: 'add_squeeze',
    label: '内転筋スクイーズ',
    group: '筋力・LSI',
    unit: '',
    min: 0,
    max: 400,
    step: 1,
    better: 'high',
    start: 150,
    hint: '両膝の間で押しつぶす力。毎回同じ道具・同じ膝の角度で（例：血圧計のカフ mmHg、HHD kg）',
  },
  {
    key: 'slhb',
    label: '片脚ブリッジ回数 LSI',
    group: '筋力・LSI',
    unit: '%',
    min: 0,
    max: 150,
    step: 1,
    better: 'high',
    start: 80,
    pair: {
      calc: 'lsi',
      labels: ['患側', '健側'],
      unit: '回',
      step: 1,
      min: 0,
      max: 200,
      start: [15, 20],
      hint: '仰向けで片足のかかとを台にのせ、膝を少し曲げたまま、お尻の上げ下げができなくなるまでの回数。Freckleton 2014 では、のちに肉離れになった選手は前の回数が少なかった',
    },
  },
  {
    key: 'lsi_calf',
    label: 'カーフレイズ回数 LSI',
    group: '筋力・LSI',
    unit: '%',
    min: 0,
    max: 150,
    step: 1,
    better: 'high',
    start: 80,
    pair: { calc: 'lsi', labels: ['患側', '健側'], unit: '回', step: 1, min: 0, max: 300, start: [15, 25], hint: '片脚で、かかとを上げられなくなるまでの回数' },
  },

  // ── ホップ（左右を入れると LSI を出す） ──
  {
    key: 'lsi_hop',
    label: '片脚ホップ LSI',
    group: 'ホップ',
    unit: '%',
    min: 0,
    max: 150,
    step: 1,
    better: 'high',
    start: 80,
    target: LSI90,
    pair: { calc: 'lsi', labels: ['患側', '健側'], unit: 'cm', step: 1, min: 0, max: 500, start: [120, 140], hint: '片脚で1回とんだ距離' },
  },
  {
    key: 'lsi_hop_triple',
    label: '3段ホップ LSI',
    group: 'ホップ',
    unit: '%',
    min: 0,
    max: 150,
    step: 1,
    better: 'high',
    start: 80,
    target: LSI90,
    pair: { calc: 'lsi', labels: ['患側', '健側'], unit: 'cm', step: 1, min: 0, max: 1500, start: [380, 430], hint: '片脚で3回続けてとんだ距離' },
  },
  {
    key: 'lsi_hop_cross',
    label: 'クロスオーバーホップ LSI',
    group: 'ホップ',
    unit: '%',
    min: 0,
    max: 150,
    step: 1,
    better: 'high',
    start: 80,
    target: LSI90,
    pair: { calc: 'lsi', labels: ['患側', '健側'], unit: 'cm', step: 1, min: 0, max: 1500, start: [350, 400], hint: '線をまたいでジグザグに3回とんだ距離' },
  },
  {
    key: 'lsi_hop_timed',
    label: '6m タイムホップ LSI',
    group: 'ホップ',
    unit: '%',
    min: 0,
    max: 150,
    step: 1,
    better: 'high',
    start: 80,
    target: LSI90,
    pair: { calc: 'lsi_time', labels: ['患側', '健側'], unit: '秒', step: 0.01, min: 0, max: 30, start: [2.6, 2.3], hint: '6mを片脚でとぶ時間（短いほど良いので、健側÷患側で出す）' },
  },
  {
    key: 'side_hop',
    label: '横とびホップ（サイドホップ）LSI',
    group: 'ホップ',
    unit: '%',
    min: 0,
    max: 150,
    step: 1,
    better: 'high',
    start: 85,
    pair: {
      calc: 'lsi_time',
      labels: ['患側', '健側'],
      unit: '秒',
      step: 0.1,
      min: 0,
      max: 60,
      start: [12, 10],
      hint: '片脚で、決めた幅の左右を決めた回数とぶ時間（毎回同じ幅・同じ回数で。短いほど良いので、健側÷患側で出す）。Caffrey 2009 で、足首の不安定感のある方の差が出たテストの一つ',
    },
  },

  // ── バランス・競技動作 ──
  {
    key: 'ybal_ant',
    label: 'Yバランス 前方の左右差',
    group: 'バランス・競技動作',
    unit: 'cm',
    min: 0,
    max: 30,
    step: 0.5,
    better: 'low',
    start: 2,
    target: { value: 4, type: 'caution', label: '左右差 4cm', source: 'Plisky 2006（高校バスケ選手の研究）で使われた区切り：前方の左右差 4cm' },
    pair: { calc: 'absdiff', labels: ['右', '左'], unit: 'cm', step: 0.5, min: 0, max: 150, start: [60, 60], hint: '前方へ届いた距離（3回のうち一番遠い値）' },
  },
  {
    key: 'sprint_pct',
    label: '痛みなく走れた速さ（全力の何％）',
    group: 'バランス・競技動作',
    unit: '%',
    min: 0,
    max: 100,
    step: 5,
    better: 'high',
    start: 50,
    hint: '自分の全力を 100% として、痛みなく走れた速さ',
    target: {
      value: 100,
      type: 'reach',
      label: '痛みなく全力',
      source: 'Paton 2023（ハムストリングの国際的な専門家の合意）：復帰の前の全力疾走は痛みがないこと',
    },
  },
  { key: 'run_minutes', label: '走れた時間', group: 'バランス・競技動作', unit: '分', min: 0, max: 240, step: 5, better: 'high', start: 10, hint: '痛みが強くならずに走れた時間' },
  { key: 'throw_distance', label: '投球プログラムの距離', group: 'バランス・競技動作', unit: 'm', min: 0, max: 120, step: 5, better: 'high', start: 15, hint: '段階的な投球プログラムで、痛みなく投げられた距離' },
]

export const OUTCOME_GROUPS: OutcomeGroup[] = ['痛み', '腫れ', '可動域', '機能スコア', '筋力・LSI', 'ホップ', 'バランス・競技動作']

export function getOutcomeMetric(key: string): OutcomeMetric | undefined {
  return OUTCOME_METRICS.find((m) => m.key === key)
}

// ── 競技ごとの評価セット ─────────────────────────

export interface SportSet {
  key: SportKey
  label: string
  /** どんな方に使うか */
  who: string
  metrics: OutcomeMetricKey[]
}

export const SPORT_SETS: SportSet[] = [
  { key: 'none', label: 'えらばない', who: 'すべての指標から自由に記録します', metrics: [] },
  {
    key: 'baseball',
    label: '野球（投げる選手）',
    who: '肩・肘の投球障害',
    metrics: ['throw_nrs', 'gird', 'kjoc', 'throw_distance'],
  },
  {
    key: 'soccer',
    label: 'サッカー',
    who: '鼠径部・股関節の痛み',
    metrics: ['hagos_sport', 'hagos_pain', 'add_squeeze', 'lsi_hip_add', 'lsi_hip_abd'],
  },
  {
    key: 'running',
    label: '陸上・ランナー',
    who: 'アキレス腱・すね・足の痛み',
    metrics: ['run_nrs', 'run_minutes', 'visa_a', 'lsi_calf'],
  },
  {
    key: 'jump',
    label: 'バスケ・バレー',
    who: '膝蓋腱・足首・ジャンプ着地',
    metrics: ['visa_p', 'ybal_ant', 'lsi_hop', 'lsi_hop_triple', 'lsi_hop_cross', 'lsi_hop_timed'],
  },
  {
    key: 'acl',
    label: 'ACL術後',
    who: '前十字靱帯の再建後',
    metrics: ['acl_rsi', 'ikdc', 'lsi_quad', 'lsi_ham', 'lsi_hop', 'lsi_hop_triple', 'lsi_hop_cross', 'lsi_hop_timed', 'rom_knee_ext', 'rom_knee_flex'],
  },
]

export function getSportSet(key: string | undefined): SportSet {
  return SPORT_SETS.find((s) => s.key === key) ?? SPORT_SETS[0]
}

/** 傷病名・主訴・メモの言葉から、合いそうなセットを1つ選ぶ（無ければ null） */
export function suggestSport(text: string): SportKey | null {
  const t = text.normalize('NFKC')
  if (/ACL|前十字/i.test(t)) return 'acl'
  if (/野球|投球|ピッチャー|投手|ソフトボール/.test(t)) return 'baseball'
  if (/サッカー|フットサル|鼠径|グロイン/.test(t)) return 'soccer'
  if (/陸上|マラソン|ランニング|ランナー|駅伝|ジョギング|アキレス/.test(t)) return 'running'
  if (/バスケ|バレー|ジャンパー膝|膝蓋腱/.test(t)) return 'jump'
  return null
}

// ── 疾患ごとの評価セット（2026-11-27） ─────────────────────────
//
// 競技のセットとは別に、1つえらべる（両方えらんだときは、疾患の評価を先に並べる）。
// noTarget … この疾患では、指標についている目安の線を出さない（その線は別の疾患の研究の値で、この疾患では合意が無いため）
// refs … このセットで参考にした論文（画面のまとめの下に出す。どれも PubMed で抄録を読んだ範囲）

export interface ConditionSet {
  key: ConditionKey
  label: string
  /** どんな方に使うか */
  who: string
  metrics: OutcomeMetricKey[]
  noTarget?: OutcomeMetricKey[]
  refs?: string[]
}

export const CONDITION_SETS: ConditionSet[] = [
  { key: 'none', label: 'えらばない', who: '', metrics: [] },
  {
    key: 'ankle_sprain',
    label: '足関節捻挫',
    who: '足首のねんざ（くり返す不安定感も）',
    metrics: ['nrs', 'swelling_f8', 'wblt', 'cait', 'ybal_ant', 'side_hop', 'lsi_hop', 'lsi_calf'],
    refs: [
      'Wright 2014（CAIT の区切り 25点以下）',
      'Tatro-Adams 1995・Petersen 1999（8の字周径の測り直しのぶれ）',
      'Powden 2015（ランジテストのぶれ 1.6〜1.9cm）',
      'Plisky 2006（Yバランス前方の左右差 4cm）',
      'Caffrey 2009（足首の不安定感とホップテスト）',
    ],
  },
  {
    key: 'ham_strain',
    label: 'ハムストリングの肉離れ',
    who: '太ももの裏',
    metrics: ['nrs', 'aslr', 'lsi_ham', 'slhb', 'sprint_pct'],
    noTarget: ['lsi_ham'],
    refs: [
      'Zambaldi 2017（復帰の判断の5つの領域：動き・筋力・柔軟性・痛み・自信。とくに走る力）',
      'Paton 2023（国際的な合意：全力疾走は痛みなく。筋力・柔軟性の数の目安は合意に届かなかった）',
      'Freckleton 2014（片脚ブリッジの回数）',
    ],
  },
  {
    key: 'calf_strain',
    label: 'ふくらはぎの肉離れ',
    who: 'ふくらはぎ（腓腹筋・ヒラメ筋）',
    metrics: ['nrs', 'lsi_calf', 'wblt', 'run_nrs', 'run_minutes', 'lsi_hop'],
    refs: [
      'Sleeswijk Visser 2025（片脚のかかと上げの回数：一般の方の真ん中は 25回ほど）',
      'Powden 2015（ランジテストのぶれ 1.6〜1.9cm）',
      'Green 2020（走っていてのケガは復帰まで長い傾向・前にふくらはぎを痛めた方はくり返しやすい）',
    ],
  },
  {
    key: 'quad_strain',
    label: '太もも前の肉離れ',
    who: '大腿四頭筋（大腿直筋など）',
    metrics: ['nrs', 'kick_nrs', 'lsi_quad', 'rom_knee_flex', 'sprint_pct'],
    noTarget: ['lsi_quad'],
    refs: ['Lempainen 2022（太もも前のケガの手引き：股関節を曲げる・膝を伸ばすときの痛みと腫れ）'],
  },
]

export function getConditionSet(key: string | undefined): ConditionSet {
  return CONDITION_SETS.find((s) => s.key === key) ?? CONDITION_SETS[0]
}

/** この疾患のセットのとき、目安の線を出すか（出さない指標は線のない形にして返す） */
export function metricForCondition(metric: OutcomeMetric, condition: ConditionSet): OutcomeMetric {
  return condition.noTarget?.includes(metric.key) ? { ...metric, target: undefined } : metric
}

/** 傷病名・主訴の言葉から、合いそうな疾患のセットを1つ選ぶ（無ければ null） */
export function suggestCondition(text: string): ConditionKey | null {
  const t = text.normalize('NFKC')
  const strain = /肉離れ|肉ばなれ|筋挫傷|筋損傷|筋断裂/.test(t)
  if (strain && /ハムストリング|大腿後|太もも裏|太ももの裏|大腿二頭|半腱|半膜/.test(t)) return 'ham_strain'
  if (strain && /ふくらはぎ|下腿三頭|腓腹|ヒラメ|下腿後/.test(t)) return 'calf_strain'
  if (strain && /大腿前|太もも前|太ももの前|大腿四頭|大腿直筋/.test(t)) return 'quad_strain'
  if (/(足関節|足首|前距腓|ATFL)/i.test(t) && /捻挫|ねんざ|靱帯|靭帯|不安定/.test(t)) return 'ankle_sprain'
  return null
}

