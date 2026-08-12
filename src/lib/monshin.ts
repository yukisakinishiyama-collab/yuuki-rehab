// ──────────────────────────────────────────────
// 患者さん自身が入力するWeb問診（新患・新しいけが）
//
// 【設計原則】
// - 患者さんに診断名を示さない。柔道整復師の業務範囲と医療広告ガイドラインを守る
// - 危険兆候（レッドフラッグ）はAIを使わず、決め打ちのルールで判定する。
//   AIの応答を待たず、外部要因で失敗せず、判定根拠が説明できるため
// - AIによる分析は院内画面でだけ実行する。公開画面からAIを呼ばないことで、
//   URLが広まっても利用料が膨らまない
// - 純関数のみ（テスト可能性のため）
// ──────────────────────────────────────────────

/** 問診の入口。新患か、通院中の方の新しいけがか */
export type MonshinVisitType = 'new_patient' | 'new_injury'

export const MONSHIN_VISIT_LABELS: Record<MonshinVisitType, string> = {
  new_patient: 'はじめて受診する',
  new_injury: '通院中だが、新しいけが・別の症状',
}

/** 患者さんが送信する内容。院内の Intake へ取り込みやすい形に揃えている */
export interface MonshinSubmission {
  visitType: MonshinVisitType
  // 本人確認のため（カルテとの紐づけに使う）
  name: string
  kana: string
  phone: string
  birthDate: string
  // 主訴・経緯
  chiefComplaint: string
  injuryDate: string
  injuryMechanism: string
  isFirstTime: boolean
  previousTreatment: string
  // 痛み
  painLocations: string[]
  painNrs: number
  painCharacter: string[]
  painTiming: string[]
  worseFactor: string
  betterFactor: string
  // 生活
  adlDifficulty: string[]
  occupation: string
  sportsActivity: string
  importantGoal: string
  // 既往
  pastMedicalHistory: string
  currentMedications: string
  // 危険兆候のチェック（該当するものを選んでもらう）
  warningSigns: string[]
  // 予約の手がかり（任意）
  appointmentDate: string
  note: string
  consented: boolean
}

// ── 危険兆候 ──────────────────────────────────
//
// 「当てはまるものはありますか」として患者さんに選んでもらう項目。
// urgent は医療機関の受診をすすめ、call は当院へ電話でご相談いただく。

export type WarningLevel = 'urgent' | 'call'

export interface WarningSign {
  id: string
  label: string
  level: WarningLevel
}

export const WARNING_SIGNS: WarningSign[] = [
  { id: 'deformity', label: '見た目に変形している／関節が外れた感じがする', level: 'urgent' },
  { id: 'no_weight', label: '痛む側に体重をかけられない／歩けない', level: 'urgent' },
  { id: 'numbness', label: '手足のしびれがある／力が入らない', level: 'urgent' },
  { id: 'bladder', label: '排尿・排便がしにくい、感覚が鈍い', level: 'urgent' },
  { id: 'fever', label: '発熱がある（37.5度以上）', level: 'urgent' },
  { id: 'chest', label: '胸の痛み・息苦しさ・冷や汗がある', level: 'urgent' },
  { id: 'worsening', label: '痛みが日ごとに強くなっている', level: 'call' },
  { id: 'night_pain', label: '夜、痛みで目が覚める・眠れない', level: 'call' },
  { id: 'high_energy', label: '交通事故・高いところからの落下によるけが', level: 'call' },
  { id: 'weight_loss', label: '思い当たらないのに体重が減っている', level: 'call' },
  { id: 'cancer_history', label: 'がんの治療を受けたことがある', level: 'call' },
  { id: 'steroid', label: 'ステロイドを長く使っている／骨粗しょう症といわれた', level: 'call' },
]

export const WARNING_SIGN_MAP: Record<string, WarningSign> =
  Object.fromEntries(WARNING_SIGNS.map(w => [w.id, w]))

export interface RedFlagResult {
  level: WarningLevel | null
  /** 該当した項目（表示・カルテ記載用） */
  matched: WarningSign[]
  /** 患者さんに表示する案内文（診断はしない） */
  message: string
}

const URGENT_MESSAGE =
  'お書きいただいた内容には、当院での施術より先に医療機関での確認が必要かもしれない項目が含まれています。'
  + 'まずは整形外科など医療機関の受診をご検討ください。判断に迷う場合は、当院までお電話ください。'

const CALL_MESSAGE =
  'お書きいただいた内容について、来院前に一度お電話でご相談いただけると安心です。'
  + '状態によっては、医療機関の受診をおすすめする場合があります。'

/**
 * 危険兆候を判定する。強い方（urgent）を優先する。
 * 痛みが非常に強い場合も、来院前の電話相談をすすめる。
 */
export function detectRedFlags(submission: {
  warningSigns: string[]
  painNrs: number
}): RedFlagResult {
  const matched = submission.warningSigns
    .map(id => WARNING_SIGN_MAP[id])
    .filter((w): w is WarningSign => Boolean(w))

  if (matched.some(w => w.level === 'urgent')) {
    return { level: 'urgent', matched, message: URGENT_MESSAGE }
  }
  if (matched.length > 0) {
    return { level: 'call', matched, message: CALL_MESSAGE }
  }
  if (submission.painNrs >= 9) {
    return {
      level: 'call',
      matched: [],
      message: '痛みがとても強いご様子です。来院前に一度お電話でご相談ください。',
    }
  }
  return { level: null, matched: [], message: '' }
}

// ── 入力チェック ──────────────────────────────

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

/** 送信前・受信時の両方で使う。サーバー側でも必ず通す */
export function validateSubmission(s: Partial<MonshinSubmission>): ValidationResult {
  const errors: string[] = []
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

  if (!s.visitType || !(s.visitType in MONSHIN_VISIT_LABELS)) errors.push('受診のきっかけを選んでください')
  if (!text(s.name)) errors.push('お名前を入力してください')
  if (!text(s.phone)) errors.push('電話番号を入力してください')
  else if (!/^[0-9０-９\-ー\s]{8,20}$/.test(text(s.phone))) errors.push('電話番号の形式をご確認ください')
  if (!text(s.chiefComplaint)) errors.push('どこがつらいかを入力してください')
  if (typeof s.painNrs !== 'number' || s.painNrs < 0 || s.painNrs > 10) errors.push('痛みの強さを選んでください')
  if (!s.consented) errors.push('個人情報の取り扱いへの同意が必要です')

  // 長すぎる入力は保存しない（いたずら・貼り付けミス対策）
  const longFields: Array<[string, unknown]> = [
    ['お名前', s.name], ['ふりがな', s.kana], ['どこがつらいか', s.chiefComplaint],
    ['きっかけ', s.injuryMechanism], ['悪化する動作', s.worseFactor], ['楽になること', s.betterFactor],
    ['お仕事', s.occupation], ['スポーツ', s.sportsActivity], ['取り戻したいこと', s.importantGoal],
    ['これまでの病気・けが', s.pastMedicalHistory], ['お薬', s.currentMedications],
    ['これまでの治療', s.previousTreatment], ['そのほか', s.note],
  ]
  for (const [label, value] of longFields) {
    if (typeof value === 'string' && value.length > 1000) errors.push(`${label}が長すぎます`)
  }

  return { ok: errors.length === 0, errors }
}

// ── 保存される形 ──────────────────────────────

export interface StoredMonshin {
  id: string
  submittedAt: string
  submission: MonshinSubmission
  redFlag: { level: WarningLevel | null; matchedIds: string[] }
  /** カルテへ取り込み済みか（取り込むと一覧から消す） */
  importedPatientId?: string
}

/** 一覧表示用の短い要約 */
export function summarizeMonshin(item: StoredMonshin): string {
  const s = item.submission
  const parts = [s.chiefComplaint, s.painNrs != null ? `痛み${s.painNrs}/10` : '']
  return parts.filter(Boolean).join(' / ')
}
