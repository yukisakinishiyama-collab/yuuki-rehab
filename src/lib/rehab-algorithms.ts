// ──────────────────────────────────────────────
// リハビリ管理システム - アルゴリズム関数
// ──────────────────────────────────────────────
import type {
  RehabPhase,
  RiskLevel,
  ROMRecord,
  StrengthRecord,
  SpecialTestRecord,
  ProgressRecord,
  AttendanceRecord,
  ImprovementScoreResult,
  RehabRecommendation,
  BodyRegion,
} from '@/types/patient'

// ──────────────────────────────────────────────
// 改善スコア算出 (0〜100点)
// ──────────────────────────────────────────────
export function calculateImprovementScore(params: {
  initialPain: number
  currentPain: number
  romImprovementRate: number
  strengthImprovementRate: number
  specialTestImproved: boolean
  functionalScore: number
  homeExerciseAdherence: number
  visitContinuity: number
  patientSubjective: number
}): ImprovementScoreResult {
  const {
    initialPain,
    currentPain,
    romImprovementRate,
    strengthImprovementRate,
    specialTestImproved,
    functionalScore,
    homeExerciseAdherence,
    visitContinuity,
    patientSubjective,
  } = params

  // 痛み改善スコア (0-25点)
  const painReduction = initialPain > 0
    ? Math.max(0, (initialPain - currentPain) / initialPain)
    : 0
  const painScore = Math.round(painReduction * 25)

  // ROM改善スコア (0-20点)
  const romScore = Math.round(Math.min(romImprovementRate / 100, 1) * 20)

  // 筋力改善スコア (0-20点)
  const strengthScore = Math.round(Math.min(strengthImprovementRate / 100, 1) * 20)

  // スペシャルテストスコア (0-10点)
  const specialTestScore = specialTestImproved ? 10 : 0

  // ADL・機能スコア (0-15点)
  const funcScore = Math.round(Math.min(functionalScore / 100, 1) * 15)

  // 自宅運動実施率 (0-5点)
  const adherenceScore = Math.round(Math.min(homeExerciseAdherence / 100, 1) * 5)

  // 通院継続・患者主観 (0-5点)
  const continuityScore = Math.round(
    ((visitContinuity / 100) * 0.5 + (patientSubjective / 100) * 0.5) * 5
  )

  const total = Math.min(
    100,
    painScore + romScore + strengthScore + specialTestScore +
    funcScore + adherenceScore + continuityScore
  )

  let label = '土台を整えています'
  if (total >= 80) label = 'とても順調に回復しています'
  else if (total >= 60) label = '着実に改善が進んでいます'
  else if (total >= 40) label = '少しずつ改善しています'
  else if (total >= 20) label = '動きと痛みを少しずつ整えています'

  return {
    total,
    painScore,
    romScore,
    strengthScore,
    specialTestScore,
    functionalScore: funcScore,
    adherenceScore,
    label,
  }
}

// ──────────────────────────────────────────────
// ROM改善量・改善率算出
// ──────────────────────────────────────────────
export function calculateROMImprovement(
  initialRom: number | null,
  previousRom: number | null,
  currentRom: number | null,
  normalValue: number
): {
  changeFromInitial: number | null
  changeFromPrevious: number | null
  improvementRate: number | null
  normalRatio: number | null
  isImproved: boolean
} {
  const changeFromInitial =
    initialRom !== null && currentRom !== null
      ? currentRom - initialRom
      : null

  const changeFromPrevious =
    previousRom !== null && currentRom !== null
      ? currentRom - previousRom
      : null

  const improvementRate =
    initialRom !== null && currentRom !== null && normalValue > 0
      ? ((currentRom - initialRom) / normalValue) * 100
      : null

  const normalRatio =
    currentRom !== null && normalValue > 0
      ? (currentRom / normalValue) * 100
      : null

  const isImproved = changeFromInitial !== null ? changeFromInitial > 0 : false

  return { changeFromInitial, changeFromPrevious, improvementRate, normalRatio, isImproved }
}

// ──────────────────────────────────────────────
// 筋力改善量・健側比算出
// ──────────────────────────────────────────────
export function calculateStrengthImprovement(
  initialValue: number | null,
  previousValue: number | null,
  currentValue: number | null,
  contralateralValue: number | null
): {
  changeFromInitial: number | null
  changeFromPrevious: number | null
  improvementRate: number | null
  contralateralRatio: number | null
  isImproved: boolean
  meetsSportReturn: boolean
} {
  const changeFromInitial =
    initialValue !== null && currentValue !== null
      ? currentValue - initialValue
      : null

  const changeFromPrevious =
    previousValue !== null && currentValue !== null
      ? currentValue - previousValue
      : null

  const improvementRate =
    initialValue !== null && initialValue > 0 && currentValue !== null
      ? ((currentValue - initialValue) / initialValue) * 100
      : null

  const contralateralRatio =
    currentValue !== null && contralateralValue !== null && contralateralValue > 0
      ? (currentValue / contralateralValue) * 100
      : null

  const isImproved = changeFromInitial !== null ? changeFromInitial > 0 : false

  // スポーツ復帰基準：健側比80%以上
  const meetsSportReturn = contralateralRatio !== null ? contralateralRatio >= 80 : false

  return {
    changeFromInitial,
    changeFromPrevious,
    improvementRate,
    contralateralRatio,
    isImproved,
    meetsSportReturn,
  }
}

// ──────────────────────────────────────────────
// スペシャルテスト集計
// ──────────────────────────────────────────────
export function summarizeSpecialTests(records: SpecialTestRecord[]): {
  byRegion: Record<string, {
    positive: string[]
    negative: string[]
    suspicious: string[]
    unable: string[]
  }>
  totalPositive: number
  totalNegative: number
} {
  const byRegion: Record<string, {
    positive: string[]
    negative: string[]
    suspicious: string[]
    unable: string[]
  }> = {}

  let totalPositive = 0
  let totalNegative = 0

  for (const record of records) {
    if (!byRegion[record.bodyRegion]) {
      byRegion[record.bodyRegion] = { positive: [], negative: [], suspicious: [], unable: [] }
    }
    const group = byRegion[record.bodyRegion]
    switch (record.result) {
      case 'positive':
        group.positive.push(record.testName)
        totalPositive++
        break
      case 'negative':
        group.negative.push(record.testName)
        totalNegative++
        break
      case 'suspicious':
        group.suspicious.push(record.testName)
        break
      case 'unable':
        group.unable.push(record.testName)
        break
    }
  }

  return { byRegion, totalPositive, totalNegative }
}

// ──────────────────────────────────────────────
// リハビリフェーズ判定
// ──────────────────────────────────────────────
export function determineRehabPhase(params: {
  painNrs: number
  restPain: boolean
  nightPain: boolean
  swelling: boolean
  weightBearingPain: boolean
  romLimitation: number
  strengthDeficit: number
  specialTestPositive: boolean
  adlDifficulty: number
  sportsDifficulty: number
  weeksFromOnset: number
}): RehabPhase {
  const {
    painNrs,
    restPain,
    nightPain,
    swelling,
    weightBearingPain,
    romLimitation,
    strengthDeficit,
    specialTestPositive,
    adlDifficulty,
    sportsDifficulty,
    weeksFromOnset,
  } = params

  // Phase 1: 急性期 - 痛みを落ち着かせる
  if (
    painNrs >= 7 ||
    restPain ||
    nightPain ||
    swelling ||
    (painNrs >= 5 && weightBearingPain)
  ) {
    return 1
  }

  // Phase 2: 亜急性期 - 動きを取り戻す
  if (romLimitation > 30 || (painNrs >= 4 && romLimitation > 15)) {
    return 2
  }

  // Phase 3: 筋力強化
  if (strengthDeficit > 30 || specialTestPositive) {
    return 3
  }

  // Phase 4: 日常動作安定
  if (adlDifficulty > 30 || strengthDeficit > 15) {
    return 4
  }

  // Phase 5: スポーツ・仕事復帰
  if (sportsDifficulty > 20) {
    return 5
  }

  // Phase 6: 再発予防・メンテナンス
  return 6
}

// ──────────────────────────────────────────────
// 離脱リスク算出
// ──────────────────────────────────────────────
export function calculateRetentionRisk(params: {
  daysSinceLastVisit: number
  recommendedIntervalDays: number
  cancelCount: number
  totalVisits: number
  painChange: number
  romImprovementRate: number
  strengthImprovementRate: number
  homeExerciseAdherence: number
  hasEconomicConcern: boolean
  hasGoalUnclear: boolean
  hasExplanationInsufficient: boolean
}): {
  level: RiskLevel
  reasons: string[]
  recommendedAction: string
} {
  const {
    daysSinceLastVisit,
    recommendedIntervalDays,
    cancelCount,
    totalVisits,
    painChange,
    romImprovementRate,
    strengthImprovementRate,
    homeExerciseAdherence,
    hasEconomicConcern,
    hasGoalUnclear,
    hasExplanationInsufficient,
  } = params

  const reasons: string[] = []
  let riskScore = 0

  // 来院間隔
  const intervalRatio = recommendedIntervalDays > 0
    ? daysSinceLastVisit / recommendedIntervalDays
    : 0
  if (intervalRatio > 2) { reasons.push('来院間隔が空いています'); riskScore += 3 }
  else if (intervalRatio > 1.5) { reasons.push('来院間隔がやや空いています'); riskScore += 2 }

  // キャンセル率
  const cancelRate = totalVisits > 0 ? cancelCount / (totalVisits + cancelCount) : 0
  if (cancelRate > 0.3) { reasons.push('キャンセルが多い傾向があります'); riskScore += 2 }

  // 改善実感
  if (painChange < -10) { reasons.push('痛みの変化が感じられにくい状況です'); riskScore += 2 }
  if (romImprovementRate < 5) { reasons.push('可動域の改善が乏しい状況です'); riskScore += 1 }
  if (strengthImprovementRate < 5) { reasons.push('筋力の改善が乏しい状況です'); riskScore += 1 }

  // 自宅運動
  if (homeExerciseAdherence < 30) { reasons.push('自宅運動の実施が難しい状況です'); riskScore += 1 }

  // その他
  if (hasEconomicConcern) { reasons.push('費用面での不安がある可能性があります'); riskScore += 2 }
  if (hasGoalUnclear) { reasons.push('目標が不明確な可能性があります'); riskScore += 2 }
  if (hasExplanationInsufficient) { reasons.push('説明が不十分な可能性があります'); riskScore += 1 }

  let level: RiskLevel = 'low'
  let recommendedAction = '現在の継続支援を続けてください'

  if (riskScore >= 5) {
    level = 'high'
    recommendedAction = reasons.includes('費用面での不安がある可能性があります')
      ? '費用面の不安があるため、通院頻度の再提案が必要です'
      : reasons.includes('目標が不明確な可能性があります')
      ? '次回、現在地と今後の見通しをわかりやすく説明してください'
      : 'ROMや筋力の改善点を見える形で伝えると継続につながります'
  } else if (riskScore >= 3) {
    level = 'medium'
    recommendedAction = '次回来院時に改善できている点を具体的に伝えましょう'
  }

  return { level, reasons, recommendedAction }
}

// ──────────────────────────────────────────────
// 推奨運動抽出
// ──────────────────────────────────────────────
export function recommendExercises(params: {
  bodyRegion: BodyRegion
  phase: RehabPhase
  painNrs: number
  restPain: boolean
  swelling: boolean
  romLimitation: number
  strengthDeficit: number
  specialTestPositive: boolean
  instability: boolean
  sportReturn: boolean
  contraindications: string[]
}): RehabRecommendation {
  const {
    bodyRegion,
    phase,
    painNrs,
    restPain,
    swelling,
    romLimitation,
    strengthDeficit,
    specialTestPositive,
    instability,
    sportReturn,
    contraindications,
  } = params

  const recommendation: RehabRecommendation = {
    phase,
    priorityIssues: [],
    recommendedExercises: [],
    purpose: [],
    reps: '10回×3セット',
    frequency: '1日1回',
    precautions: [],
    stopCriteria: ['痛みが増す場合は中止してください', '翌日以降に痛みが残る場合は回数を減らしてください'],
    nextROMAssessment: [],
    nextStrengthAssessment: [],
    nextSpecialTests: [],
    therapistNote: '',
    confidence: 'medium',
  }

  // 安全基準チェック
  if (painNrs >= 7 || restPain || swelling) {
    recommendation.priorityIssues = ['高負荷運動は適応外です', '痛みと炎症の管理を優先してください']
    recommendation.recommendedExercises = ['足関節ポンプ運動', '呼吸エクササイズ', 'アイシング']
    recommendation.purpose = ['血流促進', '浮腫軽減', '痛みの管理']
    recommendation.reps = '20回×3セット'
    recommendation.frequency = '1日2〜3回'
    recommendation.confidence = 'high'
    return recommendation
  }

  // 部位別・フェーズ別推奨
  switch (bodyRegion) {
    case 'knee':
      if (phase <= 2) {
        recommendation.recommendedExercises = ['足関節ポンプ運動', 'SLR', 'クアドセッティング', '膝関節屈曲ストレッチ']
        recommendation.purpose = ['大腿四頭筋の賦活', '可動域の回復', '腫脹軽減']
        recommendation.nextROMAssessment = ['膝屈曲・伸展']
        recommendation.nextStrengthAssessment = ['大腿四頭筋MMT', '下腿三頭筋']
      } else if (phase === 3) {
        recommendation.recommendedExercises = ['スクワット', 'レッグプレス', 'ヒップヒンジ', 'カーフレイズ']
        recommendation.purpose = ['大腿四頭筋・ハムストリングスの強化', '膝安定性の向上']
        recommendation.reps = '15回×3セット'
        recommendation.nextStrengthAssessment = ['大腿四頭筋・ハムストリングス健側比']
      } else if (phase >= 4) {
        recommendation.recommendedExercises = ['片脚立位', 'スクワット', 'サイドステップ', 'ランジ']
        recommendation.purpose = ['動的安定性', '動作の自信回復']
        if (instability) {
          recommendation.precautions.push('不安定感がある動作は段階的に進めてください')
        }
      }
      break

    case 'hip':
      if (phase <= 2) {
        recommendation.recommendedExercises = ['クラムシェル', 'ブリッジ', '股関節屈曲ストレッチ']
        recommendation.purpose = ['股関節周囲筋の賦活', '可動域の回復']
        recommendation.nextROMAssessment = ['股関節屈曲・外旋・内旋']
      } else if (phase === 3) {
        recommendation.recommendedExercises = ['クラムシェル', 'ヒップヒンジ', 'ブリッジ', 'サイドステップ']
        recommendation.purpose = ['殿筋・股関節外旋筋の強化']
        recommendation.nextStrengthAssessment = ['股関節外転・外旋筋力']
      } else {
        recommendation.recommendedExercises = ['片脚スクワット', 'サイドステップ', 'ランジ', '体幹ブレーシング']
        recommendation.purpose = ['動的な股関節安定性', '歩行・階段動作の改善']
      }
      break

    case 'ankle':
      if (phase <= 2) {
        recommendation.recommendedExercises = ['足関節ポンプ運動', 'タオルギャザー', '足関節背屈ストレッチ']
        recommendation.purpose = ['浮腫軽減', '可動域の回復']
        recommendation.nextROMAssessment = ['足関節背屈・底屈']
      } else if (phase === 3) {
        recommendation.recommendedExercises = ['カーフレイズ', 'チューブ底屈・背屈', 'バランス練習']
        recommendation.purpose = ['下腿三頭筋の強化', '固有感覚の回復']
      } else {
        recommendation.recommendedExercises = ['片脚カーフレイズ', 'バランスディスク', 'ホップ練習']
        recommendation.purpose = ['動的安定性', 'スポーツ動作への準備']
      }
      break

    case 'shoulder':
      if (phase <= 2) {
        recommendation.recommendedExercises = ['肩甲骨セッティング', 'ペンジュラム', '肩関節ROMエクササイズ']
        recommendation.purpose = ['肩甲骨の安定', '可動域の回復']
        recommendation.nextROMAssessment = ['肩関節外旋・内旋・屈曲']
      } else if (phase === 3) {
        recommendation.recommendedExercises = ['チューブ外旋', '肩甲骨セッティング', 'YTWエクササイズ']
        recommendation.purpose = ['腱板・肩甲骨周囲筋の強化']
      } else {
        recommendation.recommendedExercises = ['チューブ外旋', 'PNFパターン', '投球動作段階的練習']
        recommendation.purpose = ['投球・リーチ動作の準備', '機能的強化']
      }
      break

    case 'lumbar':
      recommendation.recommendedExercises = ['呼吸エクササイズ', '体幹ブレーシング', 'バードドッグ', 'キャット＆カウ']
      recommendation.purpose = ['体幹の安定化', '腰部への負荷軽減']
      recommendation.precautions.push('前屈での痛みが強い場合は中止してください')
      recommendation.nextROMAssessment = ['腰部屈曲・伸展・側屈']
      break

    default:
      recommendation.recommendedExercises = ['呼吸エクササイズ', '全身的な可動性運動']
      recommendation.purpose = ['痛みのない範囲での動作回復']
      recommendation.confidence = 'low'
  }

  // スポーツ復帰前チェック
  if (sportReturn && phase >= 5) {
    recommendation.precautions.push('患側筋力が健側比80%未満の場合はジャンプ・競技復帰を推奨しません')
    recommendation.precautions.push('片脚支持・スクワット・ジャンプ・方向転換・左右差を確認してください')
    recommendation.nextStrengthAssessment.push('患側/健側比（膝伸展・股関節外転など）')
  }

  // 不安定感対応
  if (instability) {
    recommendation.recommendedExercises = [
      ...recommendation.recommendedExercises.filter(e => !e.includes('ジャンプ')),
    ]
    recommendation.precautions.push('不安定感がある場合は低負荷の安定化運動を優先してください')
  }

  // 禁忌対応
  if (contraindications.length > 0) {
    recommendation.precautions.push(`禁忌事項を確認の上、主治医指示を最優先してください: ${contraindications.join('、')}`)
    recommendation.confidence = 'low'
    recommendation.therapistNote = '術後制限・禁忌があるため、追加評価と主治医確認が必要です'
  }

  return recommendation
}

// ──────────────────────────────────────────────
// 患者向けやさしい説明文生成
// ──────────────────────────────────────────────
export function generatePatientFriendlyMessage(params: {
  phase: RehabPhase
  painNrs: number
  initialPainNrs: number
  romImprovementRate: number
  strengthImprovementRate: number
  improvementScore: number
  nextGoal: string
}): {
  statusMessage: string
  encouragementMessage: string
  nextGoalMessage: string
  phaseExplanation: string
} {
  const {
    phase,
    painNrs,
    initialPainNrs,
    romImprovementRate,
    strengthImprovementRate,
    improvementScore,
    nextGoal,
  } = params

  const phaseExplanations: Record<RehabPhase, string> = {
    1: '今は痛みを無理に我慢して鍛える時期ではありません。まずは痛みを増やさずに、動かせる範囲を少しずつ広げていきましょう。',
    2: '痛みが落ち着いてきたので、動きを少しずつ取り戻していく時期です。焦らず丁寧に進めましょう。',
    3: '動きが戻ってきました。次は体を支える筋力を少しずつ整えていく時期です。',
    4: '筋力が戻ってきています。日常生活で安心して動けるよう、動作の安定を高めていきます。',
    5: '日常生活が安定してきました。スポーツや仕事での動作に段階的に慣れていく時期です。',
    6: 'とても順調です。再発しないよう、状態を維持・向上させていきましょう。',
  }

  let statusMessage = '少しずつ整えています'
  if (improvementScore >= 70) statusMessage = 'とても順調に回復しています'
  else if (improvementScore >= 50) statusMessage = '着実に改善が進んでいます'
  else if (improvementScore >= 30) statusMessage = '痛みを増やさずに動ける範囲が広がってきています'

  let encouragementMessage = '今は少しずつ土台を整える時期です'
  if (initialPainNrs > painNrs) {
    const painDiff = initialPainNrs - painNrs
    encouragementMessage = `最初と比べて痛みが${painDiff}点減っています`
  }
  if (romImprovementRate > 10) {
    encouragementMessage += `。動かせる範囲も${Math.round(romImprovementRate)}%改善しています`
  }
  if (strengthImprovementRate > 10) {
    encouragementMessage += `。体を支える筋力も少しずつ戻ってきています`
  }

  const nextGoalMessage = nextGoal || '次回までの目標を施術者が設定します'

  return {
    statusMessage,
    encouragementMessage,
    nextGoalMessage,
    phaseExplanation: phaseExplanations[phase],
  }
}

// ──────────────────────────────────────────────
// 来院間隔（日数）計算
// ──────────────────────────────────────────────
export function getDaysSinceLastVisit(lastVisitDate: string): number {
  if (!lastVisitDate) return 999
  const last = new Date(lastVisitDate)
  const now = new Date()
  return Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
}

// ──────────────────────────────────────────────
// 年齢計算
// ──────────────────────────────────────────────
export function calcAge(birthDate: string): number {
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}
