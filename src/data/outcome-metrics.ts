// アウトカム（カルテ → 評価・測定 → アウトカム）で記録する指標と、競技ごとの評価セット
// better … 'low' は数字が小さいほど良い（痛み・左右差）、'high' は大きいほど良い
//
// 目安の線（target）は「論文で使われた値」を参考に引くもので、復帰してよいかを決めるものではない。
//   reach   … この値に届いているか（例：LSI 90%）
//   caution … この値を超えると注意（例：Yバランス前方の左右差 4cm）
//   reference … 比べるための参考の値（例：健康な人の平均）
import type { OutcomeMetricKey, SportKey } from '@/types/contracts'

export type OutcomeGroup = '痛み' | '可動域' | '機能スコア' | '筋力・LSI' | 'ホップ' | 'バランス・競技動作'

export interface OutcomeTarget {
  value: number
  type: 'reach' | 'caution' | 'reference'
  /** 線の横に出す短い言葉（例「目安 90%」） */
  label: string
  /** どの論文の値か（画面の下に小さく出す） */
  source: string
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

const GRINDEM = 'Grindem 2016（ACL再建後の復帰の研究）で使われた LSI 90%'
const LSI90: OutcomeTarget = { value: 90, type: 'reach', label: '目安 90%', source: GRINDEM }

export const WILK_SOURCE = 'Wilk 2011（プロ野球投手の研究）で使われた区切り：GIRD 20°以上・TRM 差 5°超'
export const TRM_CAUTION = 5

export const OUTCOME_METRICS: OutcomeMetric[] = [
  // ── 痛み ──
  { key: 'nrs', label: '痛み NRS', group: '痛み', unit: '', min: 0, max: 10, step: 1, better: 'low', start: 5 },
  { key: 'throw_nrs', label: '投げるときの痛み NRS', group: '痛み', unit: '', min: 0, max: 10, step: 1, better: 'low', start: 3 },
  { key: 'run_nrs', label: '走るときの痛み NRS', group: '痛み', unit: '', min: 0, max: 10, step: 1, better: 'low', start: 3 },

  // ── 可動域 ──
  { key: 'rom_knee_flex', label: '膝 屈曲', group: '可動域', unit: '°', min: 0, max: 160, step: 5, better: 'high', start: 120 },
  { key: 'rom_knee_ext', label: '膝 伸展', group: '可動域', unit: '°', min: -30, max: 15, step: 1, better: 'high', start: 0 },
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
    target: { value: 20, type: 'caution', label: 'GIRD 20°', source: WILK_SOURCE },
    hint: '仰向け・肩90°外転で、肩甲骨を押さえて測る。GIRD＝投げない側の内旋 − 投げる側の内旋',
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
    pair: { calc: 'lsi', labels: ['患側', '健側'], unit: 'kg', step: 0.5, min: 0, max: 150, start: [20, 25], hint: 'HHD など・左右とも同じ姿勢と道具で' },
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
    pair: { calc: 'lsi', labels: ['患側', '健側'], unit: 'kg', step: 0.5, min: 0, max: 150, start: [12, 15], hint: 'HHD など・左右とも同じ姿勢と道具で' },
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
    pair: { calc: 'lsi', labels: ['患側', '健側'], unit: 'kg', step: 0.5, min: 0, max: 100, start: [15, 18], hint: 'HHD・仰向けで' },
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
    pair: { calc: 'lsi', labels: ['患側', '健側'], unit: 'kg', step: 0.5, min: 0, max: 100, start: [15, 18], hint: 'HHD・仰向けで' },
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
    key: 'lsi_calf',
    label: 'カーフレイズ回数 LSI',
    group: '筋力・LSI',
    unit: '%',
    min: 0,
    max: 150,
    step: 1,
    better: 'high',
    start: 80,
    pair: { calc: 'lsi', labels: ['患側', '健側'], unit: '回', step: 1, min: 0, max: 100, start: [15, 25], hint: '片脚で、かかとを上げられなくなるまでの回数' },
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
    pair: { calc: 'lsi', labels: ['患側', '健側'], unit: 'cm', step: 1, min: 0, max: 300, start: [120, 140], hint: '片脚で1回とんだ距離' },
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
    pair: { calc: 'lsi', labels: ['患側', '健側'], unit: 'cm', step: 1, min: 0, max: 900, start: [380, 430], hint: '片脚で3回続けてとんだ距離' },
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
    pair: { calc: 'lsi', labels: ['患側', '健側'], unit: 'cm', step: 1, min: 0, max: 900, start: [350, 400], hint: '線をまたいでジグザグに3回とんだ距離' },
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
    pair: { calc: 'lsi_time', labels: ['患側', '健側'], unit: '秒', step: 0.01, min: 0, max: 20, start: [2.6, 2.3], hint: '6mを片脚でとぶ時間（短いほど良いので、健側÷患側で出す）' },
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
  { key: 'run_minutes', label: '走れた時間', group: 'バランス・競技動作', unit: '分', min: 0, max: 240, step: 5, better: 'high', start: 10, hint: '痛みが強くならずに走れた時間' },
  { key: 'throw_distance', label: '投球プログラムの距離', group: 'バランス・競技動作', unit: 'm', min: 0, max: 120, step: 5, better: 'high', start: 15, hint: '段階的な投球プログラムで、痛みなく投げられた距離' },
]

export const OUTCOME_GROUPS: OutcomeGroup[] = ['痛み', '可動域', '機能スコア', '筋力・LSI', 'ホップ', 'バランス・競技動作']

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
