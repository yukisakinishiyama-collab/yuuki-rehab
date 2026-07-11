'use client'

import { useState, useMemo, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, CheckCircle, AlertTriangle, XCircle, Save, Trash2,
  ChevronDown, ChevronUp, Activity, Brain, Zap, Home, Trophy,
} from 'lucide-react'
import {
  getAssessments, saveAssessment, deleteAssessment,
  calcLysholm, calcAclRsi, calcHopLsi, calcLefs, calcComposite, getVerdict,
  calcHipSymptom, calcHipFunction,
  calcShoulderSymptom, calcShoulderFunction, calcShoulderDaily,
  calcAnkleSymptom, calcAnkleFunction,
  calcLumbarSymptom, calcLumbarFunction,
} from '@/lib/return-criteria-store'
import { getPatient } from '@/lib/patient-store'
import type {
  LysholmData, AclRsiItems, HopTestsData, AssessmentType, AssessmentRegion,
  HipSymptomData, HipFunctionData,
  ShoulderSymptomData, ShoulderFunctionData,
  AnkleSymptomData, AnkleFunctionData,
  LumbarSymptomData, LumbarFunctionData,
  ReturnCriteriaAssessment,
} from '@/types/return-criteria'
import {
  LYSHOLM_DEFAULT, HIP_SYMPTOM_DEFAULT, HIP_FUNCTION_DEFAULT,
  SHOULDER_SYMPTOM_DEFAULT, SHOULDER_FUNCTION_DEFAULT,
  ANKLE_SYMPTOM_DEFAULT, ANKLE_FUNCTION_DEFAULT,
  LUMBAR_SYMPTOM_DEFAULT, LUMBAR_FUNCTION_DEFAULT,
  REGION_LABELS,
} from '@/types/return-criteria'

// ─── 定数 ──────────────────────────────────────────────────────────

const ACL_RSI_QUESTIONS = [
  { text: '膝を再受傷することが怖い', negative: true },
  { text: '復帰後に再受傷するのではないかと心配だ', negative: true },
  { text: 'スポーツ・活動することに緊張感がある', negative: true },
  { text: '活動に参加できないことにフラストレーションを感じる', negative: true },
  { text: '活動ができないことが悲しい', negative: true },
  { text: '目標を達成しにくいことで気持ちが沈む', negative: true },
  { text: '以前と同じレベルで活動できると自信がある', negative: false },
  { text: '困難に直面しても乗り越えられると自信がある', negative: false },
  { text: '以前と同じパフォーマンスが発揮できると思う', negative: false },
  { text: '復帰時の再受傷リスクは高いと感じる', negative: true },
  { text: '活動することで膝にさらなるダメージを与えると心配だ', negative: true },
  { text: '活動中に他者と接触することが怖い', negative: true },
] as const

// 膝以外は「膝」を対象部位名に置き換えたテキストを使用する
function getRsiQuestions(region: AssessmentRegion) {
  if (region === 'knee') return ACL_RSI_QUESTIONS
  return ACL_RSI_QUESTIONS.map(q => ({ ...q, text: q.text.replaceAll('膝', REGION_LABELS[region]) }))
}

// ── Harris Hip Score（股関節の症状評価。Lysholmに相当） ─────────────
const HIP_SYMPTOM_FIELDS: {
  key: keyof HipSymptomData
  label: string
  options: { score: number; label: string }[]
}[] = [
  {
    key: 'pain',
    label: '痛み（最も重要な項目）',
    options: [
      { score: 44, label: '痛みなし' },
      { score: 40, label: '軽微（時々、活動に支障なし）' },
      { score: 30, label: '軽度（通常の活動はできる。稀に中程度の痛み）' },
      { score: 20, label: '中程度（活動が制限される。時々強い痛み）' },
      { score: 10, label: '強い痛み（著しく活動が制限される）' },
      { score: 0,  label: '完全な機能障害（かばって歩けない）' },
    ],
  },
  {
    key: 'limp',
    label: '歩行：跛行',
    options: [
      { score: 11, label: 'なし' }, { score: 8, label: '軽度' },
      { score: 5, label: '中程度' }, { score: 0, label: '重度または歩行不可' },
    ],
  },
  {
    key: 'support',
    label: '歩行：補助具',
    options: [
      { score: 11, label: '不要' }, { score: 7, label: '杖（長距離のみ）' },
      { score: 5, label: '杖（常時）' }, { score: 3, label: '松葉杖（1本）' },
      { score: 2, label: '松葉杖（2本）' }, { score: 0, label: '歩行不可' },
    ],
  },
  {
    key: 'distance',
    label: '歩行距離',
    options: [
      { score: 11, label: '無制限' }, { score: 8, label: '6ブロック（約500m）以上' },
      { score: 5, label: '2〜3ブロック（200m程度）' }, { score: 2, label: '室内のみ' },
      { score: 0, label: '歩行不可' },
    ],
  },
  {
    key: 'stairs',
    label: '階段昇降',
    options: [
      { score: 4, label: '手すりなしで通常通り' }, { score: 2, label: '手すりを使えば通常通り' },
      { score: 1, label: '何らかの方法で可能' }, { score: 0, label: '不可' },
    ],
  },
  {
    key: 'shoes',
    label: '靴・靴下の着脱',
    options: [
      { score: 4, label: '容易にできる' }, { score: 2, label: '困難だができる' }, { score: 0, label: '不可' },
    ],
  },
  {
    key: 'sitting',
    label: '座位',
    options: [
      { score: 5, label: '1時間以上普通の椅子に楽に座れる' },
      { score: 3, label: '30分は高い椅子に座れる' },
      { score: 0, label: '座位が不快' },
    ],
  },
  {
    key: 'transport',
    label: '公共交通機関の利用',
    options: [
      { score: 1, label: '可能' }, { score: 0, label: '不可' },
    ],
  },
  {
    key: 'deformity',
    label: '変形（固定屈曲拘縮・外転拘縮・肢長差など）',
    options: [
      { score: 4, label: '変形なし（または軽微）' }, { score: 0, label: '変形あり' },
    ],
  },
  {
    key: 'rom',
    label: '関節可動域（総合的な評価）',
    options: [
      { score: 5, label: 'ほぼ正常（屈曲≥110°、外転≥20°、内旋≥15°）' },
      { score: 4, label: '軽度制限（屈曲80-109°）' },
      { score: 3, label: '中程度制限（屈曲60-79°）' },
      { score: 1, label: '高度制限（屈曲<60°）' },
      { score: 0, label: '著しい制限' },
    ],
  },
]

// ── ASES肩スコア（肩の症状評価。Lysholm/HHSに相当） ─────────────────
const ASES_FUNC_OPTIONS = [
  { score: 3, label: '困難なし' }, { score: 2, label: 'わずかに困難' },
  { score: 1, label: '非常に困難' }, { score: 0, label: '不可' },
]
const SHOULDER_SYMPTOM_FIELDS: {
  key: keyof ShoulderSymptomData
  label: string
  options: { score: number; label: string }[]
}[] = [
  { key: 'pain', label: '肩の痛み', options: [
    { score: 50, label: '痛みなし' }, { score: 40, label: '軽度' },
    { score: 30, label: '軽度〜中等度' }, { score: 20, label: '中等度〜重度' },
    { score: 10, label: '重度' }, { score: 0, label: '最大の痛み' },
  ]},
  { key: 'f1', label: 'コートやセーターを着る', options: ASES_FUNC_OPTIONS },
  { key: 'f2', label: '患側を下にして寝る', options: ASES_FUNC_OPTIONS },
  { key: 'f3', label: '背中を洗う・ブラジャーを留める', options: ASES_FUNC_OPTIONS },
  { key: 'f4', label: 'トイレの後処理をする', options: ASES_FUNC_OPTIONS },
  { key: 'f5', label: '頭の後ろに手を持っていく（外旋）', options: ASES_FUNC_OPTIONS },
  { key: 'f6', label: '棚の上に物を置く（挙上）', options: ASES_FUNC_OPTIONS },
  { key: 'f7', label: '重い物（4.5kg以上）を持ち上げる', options: ASES_FUNC_OPTIONS },
  { key: 'f8', label: '柔らかいボールを投げる（アンダースロー）', options: ASES_FUNC_OPTIONS },
  { key: 'f9', label: '通常の仕事をする', options: ASES_FUNC_OPTIONS },
  { key: 'f10', label: '通常のスポーツをする', options: ASES_FUNC_OPTIONS },
]

// ── CAIT（足関節の症状評価） ──────────────────────────────────────
const ANKLE_SYMPTOM_FIELDS: {
  key: keyof AnkleSymptomData
  label: string
  options: { score: number; label: string }[]
}[] = [
  { key: 'q1', label: '足関節に痛みがある', options: [
    { score: 5, label: 'まったくない' }, { score: 4, label: '激しい運動中のみ' },
    { score: 3, label: '普通の運動中' }, { score: 2, label: '日常生活動作中' },
    { score: 1, label: '歩行中' }, { score: 0, label: '安静時' },
  ]},
  { key: 'q2', label: '足関節が不安定（ぐらつく）な感じがある', options: [
    { score: 4, label: 'まったくない' }, { score: 3, label: '激しい運動中のみ（競技中）' },
    { score: 2, label: '軽い運動中（ジョギング）' }, { score: 1, label: '歩行中' }, { score: 0, label: '立位（安静）中' },
  ]},
  { key: 'q3', label: '方向転換時に足関節がぐらつく', options: [
    { score: 3, label: 'まったくない' }, { score: 2, label: '時々' }, { score: 1, label: 'よく' }, { score: 0, label: '常に' },
  ]},
  { key: 'q4', label: '階段を下るときに足関節がぐらつく', options: [
    { score: 3, label: 'まったくない' }, { score: 2, label: '速足の時のみ' },
    { score: 1, label: '時々' }, { score: 0, label: '常に' },
  ]},
  { key: 'q5', label: '片脚立ちで足関節がぐらつく', options: [
    { score: 2, label: 'まったくない' }, { score: 1, label: '時々' }, { score: 0, label: '常に' },
  ]},
  { key: 'q6', label: '凸凹な地面を歩くとき足関節がぐらつく', options: [
    { score: 3, label: 'まったくない' }, { score: 2, label: '速足の時のみ' },
    { score: 1, label: '時々' }, { score: 0, label: '常に' },
  ]},
  { key: 'q7', label: '足関節の捻挫の既往', options: [
    { score: 4, label: 'なし' }, { score: 3, label: '1回' }, { score: 2, label: '2回' },
    { score: 1, label: '3回以上' }, { score: 0, label: '毎日のようにぐらつく' },
  ]},
  { key: 'q8', label: '最後の捻挫から通常活動に戻るまでの期間', options: [
    { score: 2, label: '1日以内' }, { score: 1, label: '2〜7日' }, { score: 0, label: '1週間以上' },
  ]},
  { key: 'q9', label: '運動・スポーツ中のサポーター・テーピングの使用', options: [
    { score: 1, label: '使用せず（または使用必要なし）' }, { score: 0, label: '常に使用' },
  ]},
]

// ── ODI（腰部の症状評価。性生活項目は対象患者層を考慮し除外） ──────
// 値が小さいほど良好（ODI本来の方向）。総合スコアは反転して算出される
const LUMBAR_SYMPTOM_FIELDS: {
  key: keyof LumbarSymptomData
  label: string
  options: { score: number; label: string }[]
}[] = [
  { key: 's1', label: '痛みの強さ', options: [
    { score: 0, label: '現在、痛みはない' }, { score: 1, label: '非常に軽度の痛みがある' },
    { score: 2, label: '中程度の痛みがある' }, { score: 3, label: 'かなりひどい痛みがある' },
    { score: 4, label: '非常にひどい痛みがある' }, { score: 5, label: 'これ以上ない最悪の痛みがある' },
  ]},
  { key: 's2', label: 'セルフケア（洗面・着替えなど）', options: [
    { score: 0, label: '痛みなく普通にできる' }, { score: 1, label: '普通にできるが痛みを伴う' },
    { score: 2, label: 'ゆっくりで注意が必要だが介助は不要' }, { score: 3, label: '多少の介助が必要' },
    { score: 4, label: '毎日のほとんどの動作に介助が必要' }, { score: 5, label: '自分でできない' },
  ]},
  { key: 's3', label: '物を持つ（リフティング）', options: [
    { score: 0, label: '重い物も痛みなく持てる' }, { score: 1, label: '重い物も持てるが痛みを伴う' },
    { score: 2, label: '痛みがあるが床から重い物を持てる' }, { score: 3, label: '床からは痛みなく持てないが腰より上なら可' },
    { score: 4, label: '非常に軽い物しか持てない' }, { score: 5, label: '何も持てない・運べない' },
  ]},
  { key: 's4', label: '歩行', options: [
    { score: 0, label: '距離に関係なく歩ける' }, { score: 1, label: '1km以上は歩けないが距離制限は少ない' },
    { score: 2, label: '500m以上は歩けない' }, { score: 3, label: '100m以上は歩けない' },
    { score: 4, label: '杖または松葉杖を使ってのみ歩ける' }, { score: 5, label: 'ほとんど寝たきり・這って移動' },
  ]},
  { key: 's5', label: '座位', options: [
    { score: 0, label: '好きなだけ座れる' }, { score: 1, label: '好きな椅子なら1時間座れる' },
    { score: 2, label: '1時間以上は座れない' }, { score: 3, label: '30分以上は座れない' },
    { score: 4, label: '10分以上は座れない' }, { score: 5, label: '全く座れない' },
  ]},
  { key: 's6', label: '立位', options: [
    { score: 0, label: '必要なだけ立っていられる' }, { score: 1, label: '必要なだけ立っていられるが痛む' },
    { score: 2, label: '1時間以上は立っていられない' }, { score: 3, label: '30分以上は立っていられない' },
    { score: 4, label: '10分以上は立っていられない' }, { score: 5, label: '全く立っていられない' },
  ]},
  { key: 's7', label: '睡眠', options: [
    { score: 0, label: '痛みで睡眠が妨げられない' }, { score: 1, label: '鎮痛薬で6時間以上眠れる' },
    { score: 2, label: '鎮痛薬で4〜6時間眠れる' }, { score: 3, label: '鎮痛薬でも4時間未満' },
    { score: 4, label: '鎮痛薬でも2時間未満' }, { score: 5, label: '全く眠れない' },
  ]},
  { key: 's8', label: '社会生活（趣味・スポーツ含む）', options: [
    { score: 0, label: '通常通りで痛みを伴わない' }, { score: 1, label: '通常通りだが痛みを伴う' },
    { score: 2, label: 'ほぼできる（エネルギーを使う活動を除く）' }, { score: 3, label: '社会生活に参加できない（自宅内は可）' },
    { score: 4, label: 'ほとんど家にいる' }, { score: 5, label: '全く社会参加できない' },
  ]},
  { key: 's9', label: '旅行', options: [
    { score: 0, label: 'どこへでも痛みなく行ける' }, { score: 1, label: 'どこへでも行けるが痛みを伴う' },
    { score: 2, label: '2時間以内の旅行なら可' }, { score: 3, label: '1時間以内の旅行に限られる' },
    { score: 4, label: '30分以内の旅行に限られる' }, { score: 5, label: '旅行できない' },
  ]},
]

// ── 上肢日常生活機能（QuickDASHの項目構成を参考にした11項目） ────────
const SHOULDER_DAILY_ACTIVITIES = [
  'きつい瓶の蓋を開ける',
  '重い日用品（買い物袋など）を運ぶ',
  '棚の上に物を置く',
  '背中を洗う',
  'ナイフで食べ物を切る',
  '力を要するレクリエーション活動（テニス・野球・ゴルフなど）',
  '肩・腕・手の症状のために寝つきが悪い',
  '肩・腕・手の症状で友人・家族との交流が制限される',
  '肩・腕・手の症状のために普段の仕事や日常活動が制限される',
  '肩の痛み（安静時を含む）の程度',
  '肩のうずき・しびれの程度',
]
const SHOULDER_DAILY_OPTIONS = [
  { value: 1, label: '困難・症状なし' },
  { value: 2, label: '軽度' },
  { value: 3, label: '中等度' },
  { value: 4, label: '高度' },
  { value: 5, label: '非常に高度・不可能' },
]

const LEFS_ACTIVITIES = [
  '職場・学校での通常業務',
  '趣味・レクリエーション・スポーツ活動',
  '入浴の出入り',
  '部屋間の移動',
  '靴や靴下の着脱',
  'しゃがみ動作',
  '床から荷物を持ち上げる',
  '軽い家事',
  '重い家事（掃除・洗濯など）',
  '車の乗り降り',
  '約200m（2ブロック）の歩行',
  '約1.6kmの歩行',
  '階段の昇降（10段）',
  '1時間の立位保持',
  '1時間の座位保持',
  '平坦地でのランニング',
  '不整地でのランニング',
  '急激な方向転換',
  'ホッピング（片足跳び）',
  '就寝中の寝返り',
]

const LEFS_OPTIONS = [
  { value: 4, label: '問題なし' },
  { value: 3, label: 'わずかに困難' },
  { value: 2, label: '中程度に困難' },
  { value: 1, label: 'かなり困難' },
  { value: 0, label: '不可能' },
]

const LYSHOLM_FIELDS: {
  key: keyof LysholmData
  label: string
  options: { score: number; label: string }[]
}[] = [
  {
    key: 'pain',
    label: '疼痛 (Pain)',
    options: [
      { score: 25, label: 'まったくない' },
      { score: 20, label: '激しい運動時のみ軽度' },
      { score: 15, label: '激しい運動中または後に著明' },
      { score: 10, label: '2km以上歩行後に著明' },
      { score: 5,  label: '2km未満歩行後に著明' },
      { score: 0,  label: '常時あり' },
    ],
  },
  {
    key: 'instability',
    label: '不安定性 (Giving way)',
    options: [
      { score: 25, label: 'まったくない' },
      { score: 20, label: '激しいスポーツ時にまれに' },
      { score: 15, label: '激しいスポーツ時に頻繁に' },
      { score: 10, label: '日常生活で時々' },
      { score: 5,  label: '日常生活で頻繁に' },
      { score: 0,  label: '全歩行時' },
    ],
  },
  {
    key: 'swelling',
    label: '腫脹 (Swelling)',
    options: [
      { score: 10, label: 'まったくない' },
      { score: 6,  label: '激しい運動後のみ' },
      { score: 2,  label: '通常の運動後' },
      { score: 0,  label: '常時あり' },
    ],
  },
  {
    key: 'locking',
    label: 'ロッキング (Locking)',
    options: [
      { score: 15, label: 'なし' },
      { score: 10, label: '引っかかりはあるがロッキングなし' },
      { score: 6,  label: '時々ロッキングあり' },
      { score: 2,  label: '頻繁にロッキングあり' },
      { score: 0,  label: '関節固定状態' },
    ],
  },
  {
    key: 'stairs',
    label: '階段昇降',
    options: [
      { score: 10, label: '問題なし' },
      { score: 6,  label: 'わずかに困難' },
      { score: 2,  label: '1段ずつ' },
      { score: 0,  label: '不可能' },
    ],
  },
  {
    key: 'squat',
    label: 'しゃがみ動作',
    options: [
      { score: 5, label: '問題なし' },
      { score: 4, label: 'わずかに困難' },
      { score: 2, label: '90度以上屈曲不可' },
      { score: 0, label: '不可能' },
    ],
  },
  {
    key: 'limp',
    label: '跛行 (Limp)',
    options: [
      { score: 5, label: 'なし' },
      { score: 3, label: '軽度または時々' },
      { score: 0, label: '重度または常時' },
    ],
  },
  {
    key: 'support',
    label: '補助具使用',
    options: [
      { score: 5, label: '不要' },
      { score: 3, label: '杖または松葉杖' },
      { score: 0, label: '免荷不能' },
    ],
  },
]

// ─── レーダーチャート ──────────────────────────────────────────────

function RadarChart({ scores }: {
  scores: { symptom: number; psychological: number; functional: number; daily: number }
}) {
  const cx = 150, cy = 150, r = 110
  const axes = [
    { label: '症状\n評価', angle: -90 },
    { label: '心理的\n準備度', angle: -18 },
    { label: '機能\nテスト', angle: 54 },
    { label: '日常\n生活', angle: 126 },
    { label: '総合', angle: 198 },
  ]
  const vals = [
    scores.symptom,
    scores.psychological,
    scores.functional,
    scores.daily,
    Math.round((scores.symptom + scores.psychological + scores.functional + scores.daily) / 4),
  ]

  function pt(angle: number, val: number) {
    const a = (angle * Math.PI) / 180
    return {
      x: cx + (val / 100) * r * Math.cos(a),
      y: cy + (val / 100) * r * Math.sin(a),
    }
  }

  const dataPoints = axes.map((ax, i) => pt(ax.angle, vals[i]))
  const polygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ')

  const gridLevels = [25, 50, 75, 100]

  // カラー：スコアに応じて
  const composite = vals[4]
  const color = composite >= 80 ? '#10b981' : composite >= 65 ? '#f59e0b' : '#ef4444'

  return (
    <svg viewBox="0 0 300 300" className="w-full max-w-xs mx-auto">
      {/* グリッドライン */}
      {gridLevels.map(level => {
        const gpts = axes.map((ax) => pt(ax.angle, level))
        return (
          <polygon
            key={level}
            points={gpts.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        )
      })}

      {/* 軸線 */}
      {axes.map((ax, i) => {
        const end = pt(ax.angle, 100)
        return (
          <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y}
            stroke="#cbd5e1" strokeWidth="1" />
        )
      })}

      {/* スコアポリゴン */}
      <polygon
        points={polygon}
        fill={color}
        fillOpacity="0.18"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* 頂点ドット */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="5"
          fill={color} stroke="white" strokeWidth="1.5" />
      ))}

      {/* スコアラベル（頂点横） */}
      {dataPoints.map((p, i) => (
        <text key={i}
          x={p.x + (p.x > cx + 2 ? 8 : p.x < cx - 2 ? -8 : 0)}
          y={p.y + (p.y > cy + 2 ? 12 : p.y < cy - 2 ? -6 : 4)}
          fontSize="11"
          fontWeight="700"
          fill={color}
          textAnchor={p.x > cx + 2 ? 'start' : p.x < cx - 2 ? 'end' : 'middle'}
        >
          {vals[i]}
        </text>
      ))}

      {/* 軸ラベル */}
      {axes.map((ax, i) => {
        const end = pt(ax.angle, 118)
        const lines = ax.label.split('\n')
        return (
          <text key={i}
            x={end.x}
            y={end.y}
            fontSize="10"
            fill="#475569"
            fontWeight="600"
            textAnchor={end.x > cx + 5 ? 'start' : end.x < cx - 5 ? 'end' : 'middle'}
          >
            {lines.map((line, j) => (
              <tspan key={j} x={end.x}
                dy={j === 0 ? 0 : 13}
                textAnchor={end.x > cx + 5 ? 'start' : end.x < cx - 5 ? 'end' : 'middle'}
              >
                {line}
              </tspan>
            ))}
          </text>
        )
      })}

      {/* グリッドレベル表示 */}
      {gridLevels.map(level => (
        <text key={level} x={cx + 3} y={cy - (level / 100) * r - 2}
          fontSize="8" fill="#94a3b8">{level}</text>
      ))}
    </svg>
  )
}

// ─── スコアバー ────────────────────────────────────────────────────

function ScoreBar({ label, score, threshold, icon: Icon, color }: {
  label: string
  score: number
  threshold: number
  icon: React.ElementType
  color: string
}) {
  const passed = score >= threshold
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-slate-600">
          <Icon className={`w-3.5 h-3.5 ${color}`} />
          {label}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="font-bold text-slate-800 text-sm">{score}<span className="text-slate-400 font-normal text-xs">/100</span></span>
          {passed
            ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            : <XCircle className="w-3.5 h-3.5 text-red-400" />}
        </span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${score}%`,
            background: score >= 80 ? '#10b981' : score >= 65 ? '#f59e0b' : '#ef4444',
          }}
        />
      </div>
      <div className="relative h-0">
        <div
          className="absolute top-[-6px] w-px h-3 bg-slate-400"
          style={{ left: `${threshold}%` }}
        />
      </div>
      <p className="text-[10px] text-slate-400 text-right">基準: {threshold}点</p>
    </div>
  )
}

// ─── ページ本体 ────────────────────────────────────────────────────

export default function ReturnCriteriaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: patientId } = use(params)
  const router = useRouter()
  const patient = getPatient(patientId)
  // 初期値は患者の登録部位から推定するが、手動で切り替え可能
  const AUTO_REGIONS: AssessmentRegion[] = ['knee', 'hip', 'shoulder', 'ankle', 'lumbar']
  const [region, setRegion] = useState<AssessmentRegion>(
    (AUTO_REGIONS as string[]).includes(patient?.bodyRegion ?? '')
      ? (patient!.bodyRegion as AssessmentRegion)
      : 'knee'
  )

  // フォーム状態
  const [assessmentType, setAssessmentType] = useState<AssessmentType>('sport')
  const [assessmentDate, setAssessmentDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [lysholm, setLysholm] = useState<LysholmData>({ ...LYSHOLM_DEFAULT })
  const [hipSymptom, setHipSymptom] = useState<HipSymptomData>({ ...HIP_SYMPTOM_DEFAULT })
  const [shoulderSymptom, setShoulderSymptom] = useState<ShoulderSymptomData>({ ...SHOULDER_SYMPTOM_DEFAULT })
  const [ankleSymptom, setAnkleSymptom] = useState<AnkleSymptomData>({ ...ANKLE_SYMPTOM_DEFAULT })
  const [lumbarSymptom, setLumbarSymptom] = useState<LumbarSymptomData>({ ...LUMBAR_SYMPTOM_DEFAULT })
  const [aclRsi, setAclRsi] = useState<AclRsiItems>(
    Array(12).fill(5) as AclRsiItems
  )
  const [hopTests, setHopTests] = useState<HopTestsData>({
    single:    { involved: 0, uninvolved: 0 },
    triple:    { involved: 0, uninvolved: 0 },
    crossover: { involved: 0, uninvolved: 0 },
    timed:     { involved: 0, uninvolved: 0 },
  })
  const [hipFunction, setHipFunction] = useState<HipFunctionData>({ ...HIP_FUNCTION_DEFAULT })
  const [shoulderFunction, setShoulderFunction] = useState<ShoulderFunctionData>({ ...SHOULDER_FUNCTION_DEFAULT })
  const [ankleFunction, setAnkleFunction] = useState<AnkleFunctionData>({ ...ANKLE_FUNCTION_DEFAULT })
  const [lumbarFunction, setLumbarFunction] = useState<LumbarFunctionData>({ ...LUMBAR_FUNCTION_DEFAULT })
  const [lefs, setLefs] = useState<number[]>(Array(20).fill(4))
  const [shoulderDaily, setShoulderDaily] = useState<number[]>(Array(11).fill(1))
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)

  // 履歴
  const [history, setHistory] = useState<ReturnCriteriaAssessment[]>(
    () => getAssessments(patientId)
  )
  const [showHistory, setShowHistory] = useState(false)

  const rsiQuestions = useMemo(() => getRsiQuestions(region), [region])

  // ライブスコア
  const scores = useMemo(() => {
    let symptom: number, functional: number, daily: number
    switch (region) {
      case 'knee':
        symptom = calcLysholm(lysholm); functional = calcHopLsi(hopTests); daily = calcLefs(lefs); break
      case 'hip':
        symptom = calcHipSymptom(hipSymptom); functional = calcHipFunction(hipFunction); daily = calcLefs(lefs); break
      case 'shoulder':
        symptom = calcShoulderSymptom(shoulderSymptom); functional = calcShoulderFunction(shoulderFunction); daily = calcShoulderDaily(shoulderDaily); break
      case 'ankle':
        symptom = calcAnkleSymptom(ankleSymptom); functional = calcAnkleFunction(ankleFunction); daily = calcLefs(lefs); break
      case 'lumbar':
        symptom = calcLumbarSymptom(lumbarSymptom); functional = calcLumbarFunction(lumbarFunction); daily = calcLefs(lefs); break
    }
    const psychological = calcAclRsi(aclRsi)
    const composite = calcComposite(symptom, psychological, functional, daily, assessmentType)
    return { symptom, psychological, functional, daily, composite }
  }, [region, lysholm, hipSymptom, shoulderSymptom, ankleSymptom, lumbarSymptom,
      aclRsi, hopTests, hipFunction, shoulderFunction, ankleFunction, lumbarFunction,
      lefs, shoulderDaily, assessmentType])

  const verdict = getVerdict(scores.composite)

  const VERDICT_CONFIG = {
    cleared:     { label: '復帰可能', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300', Icon: CheckCircle,    iconColor: 'text-emerald-600' },
    conditional: { label: '条件付き復帰検討', color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-300',   Icon: AlertTriangle, iconColor: 'text-amber-500' },
    not_ready:   { label: '継続リハビリ推奨', color: 'text-red-700',     bg: 'bg-red-50 border-red-300',       Icon: XCircle,       iconColor: 'text-red-500' },
  }
  const vc = VERDICT_CONFIG[verdict]

  const SCORE_LABELS: Record<AssessmentRegion, { symptom: string; psychological: string; functional: string; daily: string }> = {
    knee:     { symptom: '症状 (Lysholm)',   psychological: '心理的準備度 (ACL-RSI)', functional: '機能テスト (Hop LSI)', daily: '日常生活 (LEFS)' },
    hip:      { symptom: '症状 (HHS)',       psychological: '心理的準備度 (RSI)',       functional: '機能テスト (LSI)',     daily: '日常生活 (LEFS)' },
    shoulder: { symptom: '症状 (ASES)',      psychological: '心理的準備度 (RSI)',       functional: '機能テスト (LSI)',     daily: '日常生活 (上肢機能)' },
    ankle:    { symptom: '症状 (CAIT)',      psychological: '心理的準備度 (RSI)',       functional: '機能テスト (LSI)',     daily: '日常生活 (LEFS)' },
    lumbar:   { symptom: '症状 (ODI)',       psychological: '心理的準備度 (RSI)',       functional: '機能テスト (LSI)',     daily: '日常生活 (LEFS)' },
  }
  const scoreLabels = SCORE_LABELS[region]

  function handleSave() {
    const base = { patientId, assessmentDate, type: assessmentType, aclRsi, notes }
    const record = saveAssessment(
      region === 'knee' ? { ...base, region, lysholm, hopTests, lefs }
      : region === 'hip' ? { ...base, region, hipSymptom, hipFunction, lefs }
      : region === 'shoulder' ? { ...base, region, shoulderSymptom, shoulderFunction, shoulderDaily }
      : region === 'ankle' ? { ...base, region, ankleSymptom, ankleFunction, lefs }
      : { ...base, region, lumbarSymptom, lumbarFunction, lefs }
    )
    setHistory(prev => [record, ...prev])
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function handleDelete(id: string) {
    if (!confirm('この評価記録を削除しますか？')) return
    deleteAssessment(id)
    setHistory(getAssessments(patientId))
  }

  function lsiOf(inv: number, uni: number, invert = false) {
    if (!inv || !uni) return '—'
    const v = invert ? (uni / inv) * 100 : (inv / uni) * 100
    return `${Math.min(100, Math.round(v))}%`
  }

  // セクション開閉
  const [openSections, setOpenSections] = useState({
    lysholm: true, aclRsi: true, hop: true, lefs: true,
  })
  function toggleSection(key: keyof typeof openSections) {
    setOpenSections(s => ({ ...s, [key]: !s[key] }))
  }

  if (!patient) {
    return (
      <div className="p-8 text-center text-slate-500">
        患者が見つかりません
        <Link href="/patients" className="block mt-2 text-teal-600 hover:underline">患者一覧へ</Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto pb-16">

      {/* ── ヘッダー ── */}
      <div className="flex items-center gap-3 mb-5">
        <Link href={`/patients/${patientId}`}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft className="w-4 h-4" />{patient.name}
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-700">復帰基準テスト</span>
      </div>

      {/* ── タイプ選択・日付 ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">
              対象部位
              {!AUTO_REGIONS.includes(patient.bodyRegion as AssessmentRegion) && (
                <span className="ml-1 text-slate-400 font-normal">（登録部位からは自動判定できないため選択してください）</span>
              )}
            </p>
            <div className="flex gap-2 flex-wrap">
              {(Object.entries(REGION_LABELS) as [AssessmentRegion, string][]).map(([value, label]) => (
                <button key={value}
                  onClick={() => setRegion(value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                    region === value
                      ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">評価の種別</p>
            <div className="flex gap-2">
              {([
                { value: 'sport', label: '競技復帰', Icon: Trophy },
                { value: 'daily', label: '日常生活復帰', Icon: Home },
              ] as const).map(({ value, label, Icon }) => (
                <button key={value}
                  onClick={() => setAssessmentType(value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                    assessmentType === value
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-teal-400'
                  }`}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">評価日</p>
            <input type="date" value={assessmentDate}
              onChange={e => setAssessmentDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* ── 左: フォーム ── */}
        <div className="lg:col-span-3 space-y-4">

          {/* Lysholm（膝） */}
          {region === 'knee' && (
          <Section
            title="症状評価 — Lysholm Knee Score"
            subtitle="Lysholm 1982 / Tegner & Lysholm 1985"
            score={scores.symptom}
            threshold={assessmentType === 'sport' ? 85 : 75}
            open={openSections.lysholm}
            onToggle={() => toggleSection('lysholm')}
            color="blue"
          >
            <div className="space-y-4">
              {LYSHOLM_FIELDS.map(({ key, label, options }) => (
                <div key={key}>
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">{label}</p>
                  <div className="space-y-1">
                    {options.map(opt => (
                      <label key={opt.score}
                        className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors text-sm
                          ${lysholm[key] === opt.score
                            ? 'bg-blue-50 text-blue-800 font-medium'
                            : 'hover:bg-slate-50 text-slate-600'}`}
                      >
                        <input type="radio"
                          checked={lysholm[key] === opt.score}
                          onChange={() => setLysholm(d => ({ ...d, [key]: opt.score }))}
                          className="accent-blue-600"
                        />
                        <span className="flex-1">{opt.label}</span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          lysholm[key] === opt.score ? 'bg-blue-200 text-blue-900' : 'bg-slate-100 text-slate-500'
                        }`}>{opt.score}点</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
          )}

          {/* Harris Hip Score（股関節） */}
          {region === 'hip' && (
          <Section
            title="症状評価 — Harris Hip Score"
            subtitle="Harris (1969) J Bone Joint Surg Am"
            score={scores.symptom}
            threshold={assessmentType === 'sport' ? 85 : 75}
            open={openSections.lysholm}
            onToggle={() => toggleSection('lysholm')}
            color="blue"
          >
            <div className="space-y-4">
              {HIP_SYMPTOM_FIELDS.map(({ key, label, options }) => (
                <div key={key}>
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">{label}</p>
                  <div className="space-y-1">
                    {options.map(opt => (
                      <label key={opt.score}
                        className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors text-sm
                          ${hipSymptom[key] === opt.score
                            ? 'bg-blue-50 text-blue-800 font-medium'
                            : 'hover:bg-slate-50 text-slate-600'}`}
                      >
                        <input type="radio"
                          checked={hipSymptom[key] === opt.score}
                          onChange={() => setHipSymptom(d => ({ ...d, [key]: opt.score }))}
                          className="accent-blue-600"
                        />
                        <span className="flex-1">{opt.label}</span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          hipSymptom[key] === opt.score ? 'bg-blue-200 text-blue-900' : 'bg-slate-100 text-slate-500'
                        }`}>{opt.score}点</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
          )}

          {/* ASES肩スコア（肩） */}
          {region === 'shoulder' && (
          <Section
            title="症状評価 — ASES肩スコア"
            subtitle="Richards et al. 1994（項目構成を参考に採点）"
            score={scores.symptom}
            threshold={assessmentType === 'sport' ? 85 : 75}
            open={openSections.lysholm}
            onToggle={() => toggleSection('lysholm')}
            color="blue"
          >
            <div className="space-y-4">
              {SHOULDER_SYMPTOM_FIELDS.map(({ key, label, options }) => (
                <div key={key}>
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">{label}</p>
                  <div className="space-y-1">
                    {options.map(opt => (
                      <label key={opt.score}
                        className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors text-sm
                          ${shoulderSymptom[key] === opt.score
                            ? 'bg-blue-50 text-blue-800 font-medium'
                            : 'hover:bg-slate-50 text-slate-600'}`}
                      >
                        <input type="radio"
                          checked={shoulderSymptom[key] === opt.score}
                          onChange={() => setShoulderSymptom(d => ({ ...d, [key]: opt.score }))}
                          className="accent-blue-600"
                        />
                        <span className="flex-1">{opt.label}</span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          shoulderSymptom[key] === opt.score ? 'bg-blue-200 text-blue-900' : 'bg-slate-100 text-slate-500'
                        }`}>{opt.score}点</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
          )}

          {/* CAIT（足関節） */}
          {region === 'ankle' && (
          <Section
            title="症状評価 — CAIT（Cumberland足関節不安定性テスト）"
            subtitle="Hiller et al. 2006, Manual Therapy"
            score={scores.symptom}
            threshold={assessmentType === 'sport' ? 85 : 75}
            open={openSections.lysholm}
            onToggle={() => toggleSection('lysholm')}
            color="blue"
          >
            <div className="space-y-4">
              {ANKLE_SYMPTOM_FIELDS.map(({ key, label, options }) => (
                <div key={key}>
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">{label}</p>
                  <div className="space-y-1">
                    {options.map(opt => (
                      <label key={opt.score}
                        className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors text-sm
                          ${ankleSymptom[key] === opt.score
                            ? 'bg-blue-50 text-blue-800 font-medium'
                            : 'hover:bg-slate-50 text-slate-600'}`}
                      >
                        <input type="radio"
                          checked={ankleSymptom[key] === opt.score}
                          onChange={() => setAnkleSymptom(d => ({ ...d, [key]: opt.score }))}
                          className="accent-blue-600"
                        />
                        <span className="flex-1">{opt.label}</span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          ankleSymptom[key] === opt.score ? 'bg-blue-200 text-blue-900' : 'bg-slate-100 text-slate-500'
                        }`}>{opt.score}点</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
          )}

          {/* ODI（腰部） */}
          {region === 'lumbar' && (
          <Section
            title="症状評価 — ODI（Oswestry腰痛機能障害質問票）"
            subtitle="Fairbank et al. 1980（各項目は点数が低いほど良好。総合スコアは反転して算出）"
            score={scores.symptom}
            threshold={assessmentType === 'sport' ? 85 : 75}
            open={openSections.lysholm}
            onToggle={() => toggleSection('lysholm')}
            color="blue"
          >
            <div className="space-y-4">
              {LUMBAR_SYMPTOM_FIELDS.map(({ key, label, options }) => (
                <div key={key}>
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">{label}</p>
                  <div className="space-y-1">
                    {options.map(opt => (
                      <label key={opt.score}
                        className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors text-sm
                          ${lumbarSymptom[key] === opt.score
                            ? 'bg-blue-50 text-blue-800 font-medium'
                            : 'hover:bg-slate-50 text-slate-600'}`}
                      >
                        <input type="radio"
                          checked={lumbarSymptom[key] === opt.score}
                          onChange={() => setLumbarSymptom(d => ({ ...d, [key]: opt.score }))}
                          className="accent-blue-600"
                        />
                        <span className="flex-1">{opt.label}</span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          lumbarSymptom[key] === opt.score ? 'bg-blue-200 text-blue-900' : 'bg-slate-100 text-slate-500'
                        }`}>{opt.score}点</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
          )}

          {/* ACL-RSI */}
          <Section
            title={region === 'knee' ? '心理的準備度 — ACL-RSI' : `心理的準備度 — RSI（${REGION_LABELS[region]}版）`}
            subtitle={region === 'knee'
              ? 'Webster et al. 2008, Br J Sports Med（カットオフ ≥65）'
              : `ACL-RSI（Webster et al. 2008）の概念を${REGION_LABELS[region]}傷害向けに表現を調整（カットオフ ≥65）`}
            score={scores.psychological}
            threshold={65}
            open={openSections.aclRsi}
            onToggle={() => toggleSection('aclRsi')}
            color="purple"
          >
            <div className="space-y-4">
              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5">
                各質問に対して、現在の気持ちをスライダーで選んでください。<br />
                <span className="text-purple-700 font-semibold">0 = 全くそう思わない　→　10 = 完全にそう思う</span>
              </p>
              {rsiQuestions.map((q, i) => (
                <div key={i}>
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <p className="text-xs font-medium text-slate-700">
                      <span className="text-slate-400 mr-1">Q{i + 1}.</span>
                      {q.text}
                      {q.negative && (
                        <span className="ml-1.5 text-[9px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded font-semibold">懸念</span>
                      )}
                    </p>
                    <span className="text-sm font-bold text-purple-700 min-w-[1.5rem] text-right">{aclRsi[i]}</span>
                  </div>
                  <input type="range" min="0" max="10" step="1"
                    value={aclRsi[i]}
                    onChange={e => {
                      const next = [...aclRsi] as AclRsiItems
                      next[i] = Number(e.target.value)
                      setAclRsi(next)
                    }}
                    className="w-full accent-purple-600 h-1.5"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                    <span>全くない (0)</span>
                    <span>完全にそう (10)</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Hop Tests（膝） */}
          {region === 'knee' && (
          <Section
            title="機能テスト — 4 Hop Test Battery (LSI)"
            subtitle="Grindem et al. 2016, BJSM（LSI ≥90%が競技復帰基準）"
            score={scores.functional}
            threshold={assessmentType === 'sport' ? 90 : 80}
            open={openSections.hop}
            onToggle={() => toggleSection('hop')}
            color="teal"
          >
            <div className="space-y-4">
              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5">
                患肢と健肢の両方を計測してください。<br />
                LSI（肢体対称性指数）= 患肢 / 健肢 × 100<br />
                <span className="font-semibold text-teal-700">競技復帰基準: 4テスト全て LSI ≥90%</span>
              </p>

              {([
                { key: 'single',    label: 'シングルホップ',        unit: 'cm', invert: false, desc: '片足で1回ジャンプ（最大距離）' },
                { key: 'triple',    label: 'トリプルホップ',         unit: 'cm', invert: false, desc: '片足で3回連続ジャンプ（累計距離）' },
                { key: 'crossover', label: 'クロスオーバーホップ', unit: 'cm', invert: false, desc: 'ラインをまたいで3回ジャンプ（累計距離）' },
                { key: 'timed',     label: '6m タイムドホップ',    unit: '秒', invert: true,  desc: '6mをできるだけ速く片足ジャンプ（短いほど良）' },
              ] as const).map(({ key, label, unit, invert, desc }) => {
                const test = hopTests[key]
                const lsiVal = test.involved && test.uninvolved
                  ? Math.min(100, Math.round(invert
                      ? (test.uninvolved / test.involved) * 100
                      : (test.involved / test.uninvolved) * 100))
                  : null
                return (
                  <div key={key} className="border border-slate-100 rounded-xl p-3">
                    <p className="text-xs font-semibold text-slate-700 mb-0.5">{label}</p>
                    <p className="text-[10px] text-slate-400 mb-2.5">{desc}</p>
                    <div className="grid grid-cols-3 gap-2 items-end">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">患肢 ({unit})</label>
                        <input type="number" min="0" step="0.1"
                          value={test.involved || ''}
                          onChange={e => setHopTests(d => ({
                            ...d, [key]: { ...d[key], involved: parseFloat(e.target.value) || 0 }
                          }))}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center
                            focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">健肢 ({unit})</label>
                        <input type="number" min="0" step="0.1"
                          value={test.uninvolved || ''}
                          onChange={e => setHopTests(d => ({
                            ...d, [key]: { ...d[key], uninvolved: parseFloat(e.target.value) || 0 }
                          }))}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center
                            focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                          placeholder="0"
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-semibold text-slate-500 mb-1">LSI</p>
                        <p className={`text-lg font-bold ${
                          lsiVal === null ? 'text-slate-300'
                            : lsiVal >= 90 ? 'text-emerald-600'
                            : lsiVal >= 80 ? 'text-amber-500'
                            : 'text-red-500'
                        }`}>{lsiVal !== null ? `${lsiVal}%` : '—'}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>
          )}

          {/* 股関節機能テスト */}
          {region === 'hip' && (
          <Section
            title="機能テスト — 片脚立位・ステップダウン・Trendelenburg徴候"
            subtitle="臨床所見に基づく股関節機能評価（LSI ≥90%が競技復帰の目安）"
            score={scores.functional}
            threshold={assessmentType === 'sport' ? 90 : 80}
            open={openSections.hop}
            onToggle={() => toggleSection('hop')}
            color="teal"
          >
            <div className="space-y-4">
              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5">
                患肢と健肢の両方を計測してください。<br />
                LSI（肢体対称性指数）= 患肢 / 健肢 × 100<br />
                <span className="font-semibold text-teal-700">Trendelenburg徴候が陽性の場合はスコアから減点されます</span>
              </p>

              {([
                { key: 'singleLegStance', label: '片脚立位保持時間', unit: '秒', desc: '骨盤を水平に保ったまま片脚立位を保持できる時間' },
                { key: 'stepDown',        label: 'シングルレッグ・ステップダウン', unit: '回', desc: '30秒間で、骨盤の傾きを保ったままできた回数' },
              ] as const).map(({ key, label, unit, desc }) => {
                const test = hipFunction[key]
                const lsiVal = test.involved && test.uninvolved
                  ? Math.min(100, Math.round((test.involved / test.uninvolved) * 100))
                  : null
                return (
                  <div key={key} className="border border-slate-100 rounded-xl p-3">
                    <p className="text-xs font-semibold text-slate-700 mb-0.5">{label}</p>
                    <p className="text-[10px] text-slate-400 mb-2.5">{desc}</p>
                    <div className="grid grid-cols-3 gap-2 items-end">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">患肢 ({unit})</label>
                        <input type="number" min="0" step="0.1"
                          value={test.involved || ''}
                          onChange={e => setHipFunction(d => ({
                            ...d, [key]: { ...d[key], involved: parseFloat(e.target.value) || 0 }
                          }))}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center
                            focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">健肢 ({unit})</label>
                        <input type="number" min="0" step="0.1"
                          value={test.uninvolved || ''}
                          onChange={e => setHipFunction(d => ({
                            ...d, [key]: { ...d[key], uninvolved: parseFloat(e.target.value) || 0 }
                          }))}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center
                            focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                          placeholder="0"
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-semibold text-slate-500 mb-1">LSI</p>
                        <p className={`text-lg font-bold ${
                          lsiVal === null ? 'text-slate-300'
                            : lsiVal >= 90 ? 'text-emerald-600'
                            : lsiVal >= 80 ? 'text-amber-500'
                            : 'text-red-500'
                        }`}>{lsiVal !== null ? `${lsiVal}%` : '—'}</p>
                      </div>
                    </div>
                  </div>
                )
              })}

              <div className="border border-slate-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-slate-700 mb-0.5">Trendelenburg徴候</p>
                <p className="text-[10px] text-slate-400 mb-2.5">片脚立位時に反対側の骨盤が下がる場合は陽性（中殿筋機能低下の指標）</p>
                <div className="flex gap-2">
                  {([
                    { value: 'negative', label: '陰性' },
                    { value: 'positive', label: '陽性' },
                  ] as const).map(opt => (
                    <button key={opt.value}
                      onClick={() => setHipFunction(d => ({ ...d, trendelenburg: opt.value }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${
                        hipFunction.trendelenburg === opt.value
                          ? opt.value === 'positive'
                            ? 'bg-red-500 text-white border-red-500'
                            : 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-teal-400'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>
          )}

          {/* 肩機能テスト */}
          {region === 'shoulder' && (
          <Section
            title="機能テスト — 座位ショットパット・Y-Balance・肩甲骨ディスキネジス"
            subtitle="上肢版RTSテストバッテリーの概念に基づく（LSI ≥90%が競技復帰の目安）"
            score={scores.functional}
            threshold={assessmentType === 'sport' ? 90 : 80}
            open={openSections.hop}
            onToggle={() => toggleSection('hop')}
            color="teal"
          >
            <div className="space-y-4">
              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5">
                患側・健側の両方を計測してください。<br />
                LSI（肢体対称性指数）= 患側 / 健側 × 100<br />
                <span className="font-semibold text-teal-700">肩甲骨ディスキネジスが陽性の場合はスコアから減点されます</span>
              </p>

              {([
                { key: 'seatedShotPut', label: '座位シングルアーム・ショットパットテスト', unit: 'cm', desc: '座位で薬球等を片手で最大距離まで押し出す' },
                { key: 'yBalanceReach', label: '上肢版Y-Balanceテスト（内側リーチ）',       unit: 'cm', desc: '四つ這い支持位から反対の手を最大距離までリーチする' },
              ] as const).map(({ key, label, unit, desc }) => {
                const test = shoulderFunction[key]
                const lsiVal = test.involved && test.uninvolved
                  ? Math.min(100, Math.round((test.involved / test.uninvolved) * 100))
                  : null
                return (
                  <div key={key} className="border border-slate-100 rounded-xl p-3">
                    <p className="text-xs font-semibold text-slate-700 mb-0.5">{label}</p>
                    <p className="text-[10px] text-slate-400 mb-2.5">{desc}</p>
                    <div className="grid grid-cols-3 gap-2 items-end">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">患側 ({unit})</label>
                        <input type="number" min="0" step="0.1"
                          value={test.involved || ''}
                          onChange={e => setShoulderFunction(d => ({
                            ...d, [key]: { ...d[key], involved: parseFloat(e.target.value) || 0 }
                          }))}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center
                            focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">健側 ({unit})</label>
                        <input type="number" min="0" step="0.1"
                          value={test.uninvolved || ''}
                          onChange={e => setShoulderFunction(d => ({
                            ...d, [key]: { ...d[key], uninvolved: parseFloat(e.target.value) || 0 }
                          }))}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center
                            focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                          placeholder="0"
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-semibold text-slate-500 mb-1">LSI</p>
                        <p className={`text-lg font-bold ${
                          lsiVal === null ? 'text-slate-300'
                            : lsiVal >= 90 ? 'text-emerald-600'
                            : lsiVal >= 80 ? 'text-amber-500'
                            : 'text-red-500'
                        }`}>{lsiVal !== null ? `${lsiVal}%` : '—'}</p>
                      </div>
                    </div>
                  </div>
                )
              })}

              <div className="border border-slate-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-slate-700 mb-0.5">肩甲骨ディスキネジス</p>
                <p className="text-[10px] text-slate-400 mb-2.5">挙上・下制動作時に肩甲骨の異常な動き（浮き上がり等）が見られる場合は陽性</p>
                <div className="flex gap-2">
                  {([
                    { value: 'negative', label: '陰性' },
                    { value: 'positive', label: '陽性' },
                  ] as const).map(opt => (
                    <button key={opt.value}
                      onClick={() => setShoulderFunction(d => ({ ...d, scapularDyskinesis: opt.value }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${
                        shoulderFunction.scapularDyskinesis === opt.value
                          ? opt.value === 'positive'
                            ? 'bg-red-500 text-white border-red-500'
                            : 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-teal-400'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>
          )}

          {/* 足関節機能テスト */}
          {region === 'ankle' && (
          <Section
            title="機能テスト — Y-Balance（前方）・Figure-8ホップテスト"
            subtitle="Star Excursion Balance Test概念 / Trojian & McKeag 2006（LSI ≥90%が競技復帰の目安）"
            score={scores.functional}
            threshold={assessmentType === 'sport' ? 90 : 80}
            open={openSections.hop}
            onToggle={() => toggleSection('hop')}
            color="teal"
          >
            <div className="space-y-4">
              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5">
                患肢と健肢の両方を計測してください。<br />
                LSI（肢体対称性指数）= 患肢 / 健肢 × 100
              </p>

              {([
                { key: 'yBalanceAnterior', label: 'Y-Balanceテスト（前方リーチ）', unit: 'cm', invert: false, desc: '片脚立位で反対脚を前方に最大距離までリーチする' },
                { key: 'figure8Hop',       label: 'Figure-8ホップテスト',          unit: '秒', invert: true,  desc: '8の字コースを片脚ホップで周回する所要時間（短いほど良い）' },
              ] as const).map(({ key, label, unit, invert, desc }) => {
                const test = ankleFunction[key]
                const lsiVal = test.involved && test.uninvolved
                  ? Math.min(100, Math.round(invert
                      ? (test.uninvolved / test.involved) * 100
                      : (test.involved / test.uninvolved) * 100))
                  : null
                return (
                  <div key={key} className="border border-slate-100 rounded-xl p-3">
                    <p className="text-xs font-semibold text-slate-700 mb-0.5">{label}</p>
                    <p className="text-[10px] text-slate-400 mb-2.5">{desc}</p>
                    <div className="grid grid-cols-3 gap-2 items-end">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">患肢 ({unit})</label>
                        <input type="number" min="0" step="0.1"
                          value={test.involved || ''}
                          onChange={e => setAnkleFunction(d => ({
                            ...d, [key]: { ...d[key], involved: parseFloat(e.target.value) || 0 }
                          }))}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center
                            focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">健肢 ({unit})</label>
                        <input type="number" min="0" step="0.1"
                          value={test.uninvolved || ''}
                          onChange={e => setAnkleFunction(d => ({
                            ...d, [key]: { ...d[key], uninvolved: parseFloat(e.target.value) || 0 }
                          }))}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center
                            focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                          placeholder="0"
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-semibold text-slate-500 mb-1">LSI</p>
                        <p className={`text-lg font-bold ${
                          lsiVal === null ? 'text-slate-300'
                            : lsiVal >= 90 ? 'text-emerald-600'
                            : lsiVal >= 80 ? 'text-amber-500'
                            : 'text-red-500'
                        }`}>{lsiVal !== null ? `${lsiVal}%` : '—'}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>
          )}

          {/* 腰部機能テスト */}
          {region === 'lumbar' && (
          <Section
            title="機能テスト — サイドブリッジ保持テスト"
            subtitle="McGillの体幹持久力評価の概念に基づく左右差の比較（LSI ≥90%が目安）"
            score={scores.functional}
            threshold={assessmentType === 'sport' ? 90 : 80}
            open={openSections.hop}
            onToggle={() => toggleSection('hop')}
            color="teal"
          >
            <div className="space-y-4">
              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5">
                症状のある側を「弱い側」、反対側を「健側」として計測してください。<br />
                LSI（左右対称性指数）= 弱い側 / 健側 × 100
              </p>
              <div className="border border-slate-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-slate-700 mb-0.5">サイドブリッジ（体幹側方保持）保持時間</p>
                <p className="text-[10px] text-slate-400 mb-2.5">肘と足部のみで体幹を側方に持ち上げ、姿勢を保持できる時間</p>
                <div className="grid grid-cols-3 gap-2 items-end">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 block mb-1">弱い側 (秒)</label>
                    <input type="number" min="0" step="0.1"
                      value={lumbarFunction.sideBridge.involved || ''}
                      onChange={e => setLumbarFunction(d => ({
                        ...d, sideBridge: { ...d.sideBridge, involved: parseFloat(e.target.value) || 0 }
                      }))}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center
                        focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 block mb-1">健側 (秒)</label>
                    <input type="number" min="0" step="0.1"
                      value={lumbarFunction.sideBridge.uninvolved || ''}
                      onChange={e => setLumbarFunction(d => ({
                        ...d, sideBridge: { ...d.sideBridge, uninvolved: parseFloat(e.target.value) || 0 }
                      }))}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center
                        focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                      placeholder="0"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-semibold text-slate-500 mb-1">LSI</p>
                    <p className={`text-lg font-bold ${
                      !lumbarFunction.sideBridge.involved || !lumbarFunction.sideBridge.uninvolved ? 'text-slate-300'
                        : scores.functional >= 90 ? 'text-emerald-600'
                        : scores.functional >= 80 ? 'text-amber-500'
                        : 'text-red-500'
                    }`}>{lumbarFunction.sideBridge.involved && lumbarFunction.sideBridge.uninvolved ? `${scores.functional}%` : '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          </Section>
          )}

          {/* LEFS（肩以外） */}
          {region !== 'shoulder' && (
          <Section
            title="日常生活機能 — LEFS"
            subtitle="Lower Extremity Functional Scale — Binkley et al. 1999（MCID: 9点）"
            score={scores.daily}
            threshold={assessmentType === 'daily' ? 75 : 60}
            open={openSections.lefs}
            onToggle={() => toggleSection('lefs')}
            color="orange"
          >
            <div className="space-y-1">
              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5 mb-3">
                各活動に対して、現在の能力レベルを選択してください
              </p>
              {LEFS_ACTIVITIES.map((activity, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                  <span className="text-[10px] text-slate-400 w-4 flex-shrink-0">{i + 1}</span>
                  <span className="text-xs text-slate-700 flex-1">{activity}</span>
                  <div className="flex gap-1">
                    {LEFS_OPTIONS.map(opt => (
                      <button key={opt.value}
                        onClick={() => {
                          const next = [...lefs]
                          next[i] = opt.value
                          setLefs(next)
                        }}
                        title={opt.label}
                        className={`w-6 h-6 rounded text-[10px] font-bold border transition-all ${
                          lefs[i] === opt.value
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-white text-slate-400 border-slate-200 hover:border-orange-300'
                        }`}>
                        {opt.value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-slate-400 text-right pt-1">
                合計: {lefs.reduce((s, v) => s + v, 0)}/80点
              </p>
            </div>
          </Section>
          )}

          {/* 上肢日常生活機能（肩） */}
          {region === 'shoulder' && (
          <Section
            title="日常生活機能 — 上肢機能質問紙"
            subtitle="QuickDASHの項目構成を参考にした11項目"
            score={scores.daily}
            threshold={assessmentType === 'daily' ? 75 : 60}
            open={openSections.lefs}
            onToggle={() => toggleSection('lefs')}
            color="orange"
          >
            <div className="space-y-1">
              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5 mb-3">
                各活動・症状について、現在の状態を選択してください
              </p>
              {SHOULDER_DAILY_ACTIVITIES.map((activity, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                  <span className="text-[10px] text-slate-400 w-4 flex-shrink-0">{i + 1}</span>
                  <span className="text-xs text-slate-700 flex-1">{activity}</span>
                  <div className="flex gap-1">
                    {SHOULDER_DAILY_OPTIONS.map(opt => (
                      <button key={opt.value}
                        onClick={() => {
                          const next = [...shoulderDaily]
                          next[i] = opt.value
                          setShoulderDaily(next)
                        }}
                        title={opt.label}
                        className={`w-6 h-6 rounded text-[10px] font-bold border transition-all ${
                          shoulderDaily[i] === opt.value
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-white text-slate-400 border-slate-200 hover:border-orange-300'
                        }`}>
                        {opt.value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
          )}

          {/* メモ */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">臨床メモ</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="特記事項・所見・臨床家のコメント"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none
                focus:outline-none focus:ring-2 focus:ring-teal-500/40"
            />
          </div>
        </div>

        {/* ── 右: ライブ結果 ── */}
        <div className="lg:col-span-2 space-y-4 lg:sticky lg:top-4 lg:self-start">

          {/* 判定カード */}
          <div className={`rounded-2xl border-2 p-4 ${vc.bg}`}>
            <div className="flex items-center gap-2 mb-2">
              <vc.Icon className={`w-5 h-5 ${vc.iconColor}`} />
              <span className={`text-base font-bold ${vc.color}`}>{vc.label}</span>
            </div>
            <div className="text-center py-2">
              <span className={`text-5xl font-black ${vc.color}`}>{scores.composite}</span>
              <span className="text-lg text-slate-400 font-normal">/100</span>
            </div>
            <p className="text-[11px] text-center text-slate-500 mt-1">
              {assessmentType === 'sport' ? '競技' : '日常生活'}復帰スコア
              {verdict === 'cleared'     && '（80点以上: 復帰可能）'}
              {verdict === 'conditional' && '（65-79点: 条件付き検討）'}
              {verdict === 'not_ready'   && '（65点未満: 継続リハビリ推奨）'}
            </p>
          </div>

          {/* レーダーチャート */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 mb-3 text-center">ドメイン別スコア</p>
            <RadarChart scores={scores} />
          </div>

          {/* スコアバー */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
            <ScoreBar label={scoreLabels.symptom} score={scores.symptom}
              threshold={assessmentType === 'sport' ? 85 : 75}
              icon={Activity} color="text-blue-500" />
            <ScoreBar label={scoreLabels.psychological} score={scores.psychological}
              threshold={65}
              icon={Brain} color="text-purple-500" />
            <ScoreBar label={scoreLabels.functional} score={scores.functional}
              threshold={assessmentType === 'sport' ? 90 : 80}
              icon={Zap} color="text-teal-500" />
            <ScoreBar label={scoreLabels.daily} score={scores.daily}
              threshold={assessmentType === 'daily' ? 75 : 60}
              icon={Home} color="text-orange-500" />
          </div>

          {/* 保存ボタン */}
          <button onClick={handleSave}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold
              transition-all shadow-sm ${
                saved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-teal-600 text-white hover:bg-teal-700'
              }`}>
            {saved ? <><CheckCircle className="w-4 h-4" />保存しました</> : <><Save className="w-4 h-4" />この評価を保存</>}
          </button>

          {/* 注意書き */}
          <p className="text-[10px] text-slate-400 leading-relaxed text-center">
            本スコアは臨床判断の補助ツールです。<br />
            最終的な復帰判断は有資格の医療者が行ってください。
          </p>
        </div>
      </div>

      {/* ── 評価履歴 ── */}
      {history.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowHistory(v => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800 mb-3">
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            評価履歴 ({history.length}件)
          </button>
          {showHistory && (
            <div className="space-y-3">
              {history.map(rec => {
                const vc2 = VERDICT_CONFIG[rec.verdict]
                return (
                  <div key={rec.id}
                    className="bg-white rounded-xl border border-slate-200 p-4 flex gap-4 items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-slate-700">{rec.assessmentDate}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                          {rec.type === 'sport' ? '競技復帰' : '日常生活復帰'}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${vc2.bg} ${vc2.color}`}>
                          {vc2.label}
                        </span>
                      </div>
                      <div className="flex gap-4 text-xs text-slate-500">
                        <span>総合 <strong className="text-slate-800">{rec.scores.composite}</strong></span>
                        <span>症状 <strong>{rec.scores.symptom}</strong></span>
                        <span>心理 <strong>{rec.scores.psychological}</strong></span>
                        <span>機能 <strong>{rec.scores.functional}</strong></span>
                        <span>日常 <strong>{rec.scores.daily}</strong></span>
                      </div>
                      {rec.notes && <p className="text-xs text-slate-400 mt-1">{rec.notes}</p>}
                    </div>
                    <button onClick={() => handleDelete(rec.id)}
                      className="text-slate-300 hover:text-red-400 transition-colors p-1 flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Section ラッパー ──────────────────────────────────────────────

function Section({
  title, subtitle, score, threshold, open, onToggle, color, children,
}: {
  title: string
  subtitle: string
  score: number
  threshold: number
  open: boolean
  onToggle: () => void
  color: 'blue' | 'purple' | 'teal' | 'orange'
  children: React.ReactNode
}) {
  const colorMap = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   bar: 'bg-blue-500',   border: 'border-blue-200' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', bar: 'bg-purple-500', border: 'border-purple-200' },
    teal:   { bg: 'bg-teal-50',   text: 'text-teal-700',   bar: 'bg-teal-500',   border: 'border-teal-200' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-700', bar: 'bg-orange-500', border: 'border-orange-200' },
  }
  const c = colorMap[color]
  const passed = score >= threshold

  return (
    <div className={`rounded-2xl border ${c.border} bg-white shadow-sm overflow-hidden`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-4 ${c.bg} hover:opacity-90 transition-opacity`}>
        <div className="text-left">
          <p className={`text-sm font-bold ${c.text}`}>{title}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className={`text-lg font-black ${c.text}`}>{score}</p>
            <p className="text-[9px] text-slate-400">/ 100点</p>
          </div>
          {passed
            ? <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* スコアバー */}
      <div className="h-1.5 bg-slate-100">
        <div className={`h-full ${c.bar} transition-all duration-500`} style={{ width: `${score}%` }} />
      </div>

      {open && <div className="p-4">{children}</div>}
    </div>
  )
}
