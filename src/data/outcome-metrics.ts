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
  {
    key: 'decline_squat_nrs',
    label: '片脚デクラインスクワットの痛み NRS',
    group: '痛み',
    unit: '',
    min: 0,
    max: 10,
    step: 1,
    better: 'low',
    start: 4,
    hint: '前が下がった台の上で片脚しゃがみをしたときの膝のお皿の下の痛み（0〜10）。Rio 2015 で膝蓋腱の痛みの指標に使われた',
  },
  { key: 'ext_nrs', label: '腰を反らすときの痛み NRS', group: '痛み', unit: '', min: 0, max: 10, step: 1, better: 'low', start: 3 },
  {
    key: 'firststep_nrs',
    label: '朝の一歩目の痛み NRS',
    group: '痛み',
    unit: '',
    min: 0,
    max: 10,
    step: 1,
    better: 'low',
    start: 5,
    hint: '朝起きて最初の数歩のかかとの痛み（0〜10）。Salehi 2023 で足底腱膜炎の結果の指標に使われた',
  },
  {
    key: 'hop_nrs',
    label: '片脚でその場ホップしたときの痛み NRS',
    group: '痛み',
    unit: '',
    min: 0,
    max: 10,
    step: 1,
    better: 'low',
    start: 2,
    hint: '痛い側の片脚で、その場で軽く数回とんだときの痛み（0〜10）。Milgrom 2021 では、すねの痛み・押した痛みに加えてホップで痛む方に疲労骨折が多かった',
  },
  {
    key: 'walk_nrs',
    label: '歩くときの痛み NRS',
    group: '痛み',
    unit: '',
    min: 0,
    max: 10,
    step: 1,
    better: 'low',
    start: 2,
    target: { value: 0, type: 'reach', label: '痛みなく歩ける', source: 'George 2024（すねの疲労骨折から走り始める前の条件のまとめ）：痛みなく歩けること' },
  },
  {
    key: 'bony_tender',
    label: '骨を押したときの痛み NRS',
    group: '痛み',
    unit: '',
    min: 0,
    max: 10,
    step: 1,
    better: 'low',
    start: 3,
    target: { value: 0, type: 'reach', label: '押して痛みなし', source: 'George 2024（すねの疲労骨折から走り始める前の条件のまとめ）：骨を押した痛みが消えていること' },
  },
  {
    key: 'tender_length',
    label: 'すねの押して痛む範囲の長さ',
    group: '痛み',
    unit: 'cm',
    min: 0,
    max: 40,
    step: 1,
    better: 'low',
    start: 6,
    hint: 'すねの内側を上下に押して、痛む範囲の長さ。シンスプリントは 5cm 以上にわたって押して痛むもの（Winters 2020）。10cm 以下の狭い範囲で、ホップでも痛むときは疲労骨折を疑う（Milgrom 2021）',
  },

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
  {
    key: 'hbd',
    label: 'かかととお尻の距離（うつ伏せ・痛い側）',
    group: '可動域',
    unit: 'cm',
    min: 0,
    max: 50,
    step: 1,
    better: 'low',
    start: 10,
    hint: 'うつ伏せで膝を曲げて、かかととお尻のあいだの距離（太ももの前の硬さを見る。0 に近いほどやわらかい）。Ladenhauf 2020 で、太もも前（大腿直筋）の硬さがオスグッドの危険因子にあげられた',
  },
  { key: 'rom_other', label: 'その他の可動域', group: '可動域', unit: '°', min: -90, max: 180, step: 5, better: 'high', start: 90 },

  // ── 機能スコア（質問票は合計点を入れる） ──
  { key: 'koos', label: 'KOOS', group: '機能スコア', unit: '点', min: 0, max: 100, step: 1, better: 'high', start: 60 },
  {
    key: 'koos_qol',
    label: 'KOOS 生活の質（QoL）',
    group: '機能スコア',
    unit: '点',
    min: 0,
    max: 100,
    step: 1,
    better: 'high',
    start: 50,
    hint: 'KOOS のうち「生活の質」の点（0〜100）。Djurtoft 2023 で、成長期の膝の痛み（オスグッドなど）の方の生活の質を見るのに使われた',
  },
  {
    key: 'odi',
    label: 'ODI（腰の機能障害）',
    group: '機能スコア',
    unit: '%',
    min: 0,
    max: 100,
    step: 1,
    better: 'low',
    start: 30,
    hint: '腰の質問票の点（0〜100%。小さいほど良い）。Fairbank 2000 のまとめで、腰の状態を見る代表の質問票とされた。質問票はアウトカムスコアの「ODI」でも記入できる',
  },
  { key: 'lysholm', label: 'Lysholm', group: '機能スコア', unit: '点', min: 0, max: 100, step: 1, better: 'high', start: 60 },
  { key: 'ikdc', label: 'IKDC', group: '機能スコア', unit: '点', min: 0, max: 100, step: 1, better: 'high', start: 60 },
  { key: 'acl_rsi', label: 'ACL-RSI', group: '機能スコア', unit: '点', min: 0, max: 100, step: 1, better: 'high', start: 50, hint: '復帰への気持ちの準備（0〜100）' },
  { key: 'kjoc', label: 'KJOC（投げる選手の肩・肘）', group: '機能スコア', unit: '点', min: 0, max: 100, step: 1, better: 'high', start: 70, hint: 'Alberta 2010 の質問票。合計点（0〜100）' },
  { key: 'hagos_sport', label: 'HAGOS スポーツ', group: '機能スコア', unit: '点', min: 0, max: 100, step: 1, better: 'high', start: 60, hint: '股関節・鼠径部の質問票のうち「スポーツ」の点。1人の変化が 18〜34点より小さいときは、答え方のぶれのこともある（Thorborg 2011）' },
  { key: 'hagos_pain', label: 'HAGOS 痛み', group: '機能スコア', unit: '点', min: 0, max: 100, step: 1, better: 'high', start: 60, hint: '「痛み」の点（高いほど痛みが少ない）。1人の変化が 18〜34点より小さいときは、答え方のぶれのこともある（Thorborg 2011）' },
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
  {
    key: 'visa_p',
    label: 'VISA-P（膝蓋腱）',
    group: '機能スコア',
    unit: '点',
    min: 0,
    max: 100,
    step: 1,
    better: 'high',
    start: 60,
    target: { value: 95, type: 'reference', label: '健康な人の平均 95', source: 'Zwerver 2009（VISA-P の研究）の健康な学生の平均。膝蓋腱の痛みのある方の平均は 58' },
  },
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

/** 疾患のセットを画面でまとめて並べる部位 */
export type ConditionArea = '足首・足' | 'すね・ふくらはぎ' | '太もも' | '膝' | '股関節・腰'
export const CONDITION_AREAS: ConditionArea[] = ['足首・足', 'すね・ふくらはぎ', '太もも', '膝', '股関節・腰']

export interface ConditionSet {
  key: ConditionKey
  label: string
  /** 画面で並べる部位（えらばない は無し） */
  area?: ConditionArea
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
    area: '足首・足',
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
    area: '太もも',
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
    area: 'すね・ふくらはぎ',
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
    area: '太もも',
    who: '大腿四頭筋（大腿直筋など）',
    metrics: ['nrs', 'kick_nrs', 'lsi_quad', 'rom_knee_flex', 'sprint_pct'],
    noTarget: ['lsi_quad'],
    refs: ['Lempainen 2022（太もも前のケガの手引き：股関節を曲げる・膝を伸ばすときの痛みと腫れ）'],
  },
  // ── 2026-11-27 同じ日「他にも入れてください」で足した 9 つ ──
  {
    key: 'achilles',
    label: 'アキレス腱症',
    area: '足首・足',
    who: 'アキレス腱の痛み（断裂ではない）',
    metrics: ['nrs', 'visa_a', 'lsi_calf', 'run_nrs', 'run_minutes'],
    refs: [
      'Robinson 2001（VISA-A：健康な人の平均 96）',
      'Hanlon 2023（症状・脚の働き・腱の状態・気持ちを分けて経過を見た研究）',
      'Sleeswijk Visser 2025（片脚のかかと上げの回数：一般の方の真ん中は 25回ほど）',
    ],
  },
  {
    key: 'plantar_heel',
    label: 'かかとの痛み（足底腱膜炎）',
    area: '足首・足',
    who: '朝の一歩目に痛むかかとの痛み',
    metrics: ['firststep_nrs', 'nrs', 'wblt', 'lsi_calf'],
    refs: [
      'Koc 2023（かかとの痛みの理学療法の診療ガイドライン 2023年版）',
      'Salehi 2023（朝の一歩目の痛みを結果の指標にした研究）',
      'Powden 2015（ランジテストのぶれ 1.6〜1.9cm）',
    ],
  },
  {
    key: 'mtss',
    label: 'シンスプリント',
    area: 'すね・ふくらはぎ',
    who: 'すねの内側の痛み（走る・跳ぶ）',
    metrics: ['run_nrs', 'tender_length', 'hop_nrs', 'run_minutes'],
    refs: [
      'Winters 2020（シンスプリントの決まり：運動でのすねの内側の痛みと、5cm 以上にわたる押した痛み）',
      'Milgrom 2021（狭い範囲〈10cm 以下〉の押した痛みに加えてホップで痛むときは、疲労骨折が多い）',
    ],
  },
  {
    key: 'bone_stress',
    label: '疲労骨折（骨のストレス障害）',
    area: 'すね・ふくらはぎ',
    who: 'すね・足の骨の疲労骨折（医療機関の画像の確認が要る場所がある）',
    metrics: ['nrs', 'bony_tender', 'walk_nrs', 'hop_nrs', 'run_minutes'],
    refs: [
      'George 2024（すねの疲労骨折から走り始める前の5つ：骨の押した痛みが消える・痛みなく歩ける・治りにくい場所は画像で治りを確認・筋力と動きのテスト・原因の見直し）',
      'Hoenig 2022（場所によって治りやすさがちがい、治りにくい場所は固定などが要ることがある）',
      'Milgrom 2021（すねの疲労骨折の見分け：押した痛みの範囲とホップテスト）',
    ],
  },
  {
    key: 'patellar_tendinopathy',
    label: '膝蓋腱炎（ジャンパー膝）',
    area: '膝',
    who: '膝のお皿の下の痛み（跳ぶ・しゃがむ）',
    metrics: ['nrs', 'decline_squat_nrs', 'visa_p', 'lsi_quad', 'lsi_hop'],
    noTarget: ['lsi_quad', 'lsi_hop'],
    refs: ['Zwerver 2009（VISA-P：健康な学生の平均 95・膝蓋腱の痛みのある方の平均 58）', 'Rio 2015（片脚デクラインスクワットの痛みを指標にした研究）'],
  },
  {
    key: 'osgood',
    label: 'オスグッド病',
    area: '膝',
    who: '成長期の膝のお皿の下の骨の出っぱりの痛み',
    metrics: ['nrs', 'run_nrs', 'hbd', 'koos_qol', 'run_minutes'],
    refs: [
      'Ladenhauf 2020（オスグッドのまとめ：太もも前の硬さ・筋力などが危険因子）',
      'Neuhaus 2021（保存療法の研究のまとめ：比べた研究がまだ少ない）',
      'Djurtoft 2023（成長期の膝の痛みの方の生活の質を KOOS で見た研究）',
    ],
  },
  {
    key: 'meniscus',
    label: '半月板損傷',
    area: '膝',
    who: '膝の半月板のケガ（手術のあとも）',
    metrics: ['nrs', 'koos', 'lysholm', 'rom_knee_flex', 'rom_knee_ext', 'lsi_quad', 'lsi_hop'],
    noTarget: ['lsi_quad', 'lsi_hop'],
    refs: ['Roos 1998（KOOS を半月板・前十字靱帯・軟骨のケガの方で確かめた研究）'],
  },
  {
    key: 'groin',
    label: '鼠径部痛（グロインペイン）',
    area: '股関節・腰',
    who: '足のつけ根の痛み（内転筋・腸腰筋・鼠径部・恥骨）',
    metrics: ['hagos_sport', 'hagos_pain', 'add_squeeze', 'lsi_hip_add', 'lsi_hip_abd'],
    refs: [
      'Thorborg 2011（HAGOS をつくった研究：1人の変化の見分けは 18〜34点）',
      'Weir 2015（ドーハの合意：鼠径部痛を内転筋・腸腰筋・鼠径部・恥骨・股関節に分ける）',
    ],
  },
  {
    key: 'low_back',
    label: '腰痛（成長期の分離症も）',
    area: '股関節・腰',
    who: '腰の痛み（成長期で反らすと痛むときは、医療機関の画像で分離症の確認を）',
    metrics: ['nrs', 'ext_nrs', 'odi', 'run_minutes'],
    refs: [
      'Fairbank 2000（ODI のまとめ：腰の状態を見る代表の質問票）',
      'Chung 2021（腰椎分離症のまとめ：問診・診察・画像でほかの腰痛と見分ける）',
      'Choi 2022（成長期の運動選手の分離症 201人の保存療法の経過）',
    ],
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
  if (/疲労骨折|骨ストレス/.test(t)) return 'bone_stress'
  if (/シンスプリント|脛骨過労性骨膜炎|過労性脛部痛/.test(t)) return 'mtss'
  if (/アキレス腱/.test(t) && !/断裂/.test(t)) return 'achilles'
  if (/足底腱膜|足底筋膜|かかとの痛み|踵の痛み|踵骨部痛/.test(t)) return 'plantar_heel'
  if (/オスグッド/.test(t)) return 'osgood'
  if (/膝蓋腱|ジャンパー膝/.test(t)) return 'patellar_tendinopathy'
  if (/半月板/.test(t)) return 'meniscus'
  if (/鼠径部|鼡径部|グロイン|恥骨結合/.test(t)) return 'groin'
  if (/腰椎分離|分離症|腰痛/.test(t)) return 'low_back'
  return null
}

