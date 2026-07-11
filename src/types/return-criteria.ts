// ─────────────────────────────────────────────────────────────────
// 復帰基準テスト型定義
//   Lysholm Knee Score / ACL-RSI / 4-Hop Tests (LSI) / LEFS
// ─────────────────────────────────────────────────────────────────

export type AssessmentType = 'sport' | 'daily'
export type Verdict = 'cleared' | 'conditional' | 'not_ready'
// 対象部位。既存データ（region未設定）は膝として扱う
export type AssessmentRegion = 'knee' | 'hip' | 'shoulder' | 'ankle' | 'lumbar'

export const REGION_LABELS: Record<AssessmentRegion, string> = {
  knee: '膝', hip: '股関節', shoulder: '肩', ankle: '足関節', lumbar: '腰',
}

// ── Lysholm Knee Score (Lysholm 1982; Tegner & Lysholm 1985) ──────
// 各項目のスコア値を直接格納（0-100合計）
export interface LysholmData {
  limp: 0 | 3 | 5                          // 跛行
  support: 0 | 3 | 5                       // 補助具
  locking: 0 | 2 | 6 | 10 | 15            // ロッキング
  instability: 0 | 5 | 10 | 15 | 20 | 25  // 不安定性
  pain: 0 | 5 | 10 | 15 | 20 | 25         // 疼痛
  swelling: 0 | 2 | 6 | 10                 // 腫脹
  stairs: 0 | 2 | 6 | 10                   // 階段昇降
  squat: 0 | 2 | 4 | 5                     // しゃがみ
}

export const LYSHOLM_DEFAULT: LysholmData = {
  limp: 5, support: 5, locking: 15, instability: 25,
  pain: 25, swelling: 10, stairs: 10, squat: 5,
}

// ── ACL-RSI (Webster et al. 2008, Br J Sports Med) ───────────────
// 12項目、各 0–10 の NRS
// 陰性項目（0-5, 9-11): 低いほど準備OK → スコア計算時に反転
// 陽性項目（6-8):       高いほど準備OK → そのまま使用
export type AclRsiItems = [
  number, number, number, number,   // q0-q3  (恐怖・心配・緊張・フラスト)
  number, number,                   // q4-q5  (悲しみ・落胆)
  number, number, number,           // q6-q8  (自信×3)
  number, number, number,           // q9-q11 (リスク認識×3)
]

// ── 4-Hop Test Battery (Grindem et al. 2016, BJSM) ───────────────
export interface HopLimb {
  involved: number    // 患肢 (cm or sec)
  uninvolved: number  // 健肢
}

export interface HopTestsData {
  single: HopLimb     // シングルホップ (cm, 大きい方が良い)
  triple: HopLimb     // トリプルホップ (cm)
  crossover: HopLimb  // クロスオーバーホップ (cm)
  timed: HopLimb      // 6m タイムドホップ (sec, 小さい方が良い)
}

// ── LEFS – Lower Extremity Functional Scale (Binkley et al. 1999) ─
// 20項目, 各 0–4 (0=極めて困難/不可, 4=問題なし)
// 合計0-80点 → 100点換算
export type LefsItems = number[] & { length: 20 }

// ── Harris Hip Score (Harris 1969, J Bone Joint Surg Am) ─────────
// 股関節用の症状評価。膝のLysholmに相当する位置づけ（10項目・合計100点）
export interface HipSymptomData {
  pain: 0 | 10 | 20 | 30 | 40 | 44
  limp: 0 | 5 | 8 | 11
  support: 0 | 2 | 3 | 5 | 7 | 11
  distance: 0 | 2 | 5 | 8 | 11
  stairs: 0 | 1 | 2 | 4
  shoes: 0 | 2 | 4
  sitting: 0 | 3 | 5
  transport: 0 | 1
  deformity: 0 | 4
  rom: 0 | 1 | 3 | 4 | 5
}

export const HIP_SYMPTOM_DEFAULT: HipSymptomData = {
  pain: 44, limp: 11, support: 11, distance: 11, stairs: 4,
  shoes: 4, sitting: 5, transport: 1, deformity: 4, rom: 5,
}

// ── 股関節機能テスト（片脚立位・シングルレッグステップダウン・Trendelenburg徴候）
// 膝の4-Hop Test Batteryに相当する位置づけ
export interface HipFunctionData {
  singleLegStance: HopLimb   // 片脚立位保持時間（秒）
  stepDown: HopLimb          // 30秒間のシングルレッグ・ステップダウン回数
  trendelenburg: 'negative' | 'positive'  // Trendelenburg徴候（陽性=殿筋機能低下の指標）
}

export const HIP_FUNCTION_DEFAULT: HipFunctionData = {
  singleLegStance: { involved: 0, uninvolved: 0 },
  stepDown: { involved: 0, uninvolved: 0 },
  trendelenburg: 'negative',
}

// ── ASES肩スコア (Richards et al. 1994) ───────────────────────────
// 肩用の症状評価。項目構成はASESに準拠（痛みVAS 50点 + 機能10項目×3点=30点を50点換算）
export interface ShoulderSymptomData {
  pain: 0 | 10 | 20 | 30 | 40 | 50
  f1: 0 | 1 | 2 | 3   // コート・セーターを着る
  f2: 0 | 1 | 2 | 3   // 患側を下にして寝る
  f3: 0 | 1 | 2 | 3   // 背中を洗う・ブラジャーを留める
  f4: 0 | 1 | 2 | 3   // トイレの後始末
  f5: 0 | 1 | 2 | 3   // 頭の後ろに手を持っていく（外旋）
  f6: 0 | 1 | 2 | 3   // 棚の上に物を置く（挙上）
  f7: 0 | 1 | 2 | 3   // 重い物（4.5kg以上）を持ち上げる
  f8: 0 | 1 | 2 | 3   // 柔らかいボールを投げる（アンダースロー）
  f9: 0 | 1 | 2 | 3   // 通常の仕事をする
  f10: 0 | 1 | 2 | 3  // 通常のスポーツをする
}

export const SHOULDER_SYMPTOM_DEFAULT: ShoulderSymptomData = {
  pain: 50, f1: 3, f2: 3, f3: 3, f4: 3, f5: 3, f6: 3, f7: 3, f8: 3, f9: 3, f10: 3,
}

// ── 肩機能テスト（座位シングルアーム・ショットパット＋上肢版Y-Balance＋肩甲骨ディスキネジス）
export interface ShoulderFunctionData {
  seatedShotPut: HopLimb   // 座位シングルアーム・ショットパットテスト（cm）
  yBalanceReach: HopLimb   // 上肢版Y-Balanceテスト・内側方向リーチ（cm）
  scapularDyskinesis: 'negative' | 'positive'  // 肩甲骨ディスキネジス（陽性=肩甲骨の異常運動あり）
}

export const SHOULDER_FUNCTION_DEFAULT: ShoulderFunctionData = {
  seatedShotPut: { involved: 0, uninvolved: 0 },
  yBalanceReach: { involved: 0, uninvolved: 0 },
  scapularDyskinesis: 'negative',
}

// ── 上肢日常生活機能（QuickDASHの項目構成を参考にした11項目） ────────
// 1(困難・症状なし)〜5(非常に困難・最重度)。合計を100点換算（高いほど良い方向に反転）
export type ShoulderDailyItems = number[] & { length: 11 }

// ── CAIT: Cumberland足関節不安定性テスト (Hiller et al. 2006) ────
// 足関節用の症状評価。9項目・合計30点満点を100点換算
export interface AnkleSymptomData {
  q1: 0 | 1 | 2 | 3 | 4 | 5  // 足関節の痛み
  q2: 0 | 1 | 2 | 3 | 4      // 不安定感
  q3: 0 | 1 | 2 | 3          // 方向転換時のぐらつき
  q4: 0 | 1 | 2 | 3          // 階段を下るときのぐらつき
  q5: 0 | 1 | 2              // 片脚立ちでのぐらつき
  q6: 0 | 1 | 2 | 3          // 凸凹地面でのぐらつき
  q7: 0 | 1 | 2 | 3 | 4      // 捻挫の既往回数
  q8: 0 | 1 | 2              // 捻挫後、通常活動に戻るまでの日数
  q9: 0 | 1                  // サポーター・テーピングの使用
}

export const ANKLE_SYMPTOM_DEFAULT: AnkleSymptomData = {
  q1: 5, q2: 4, q3: 3, q4: 3, q5: 2, q6: 3, q7: 4, q8: 2, q9: 1,
}

// ── 足関節機能テスト（Y-Balance前方リーチ＋Figure-8ホップテスト）───
export interface AnkleFunctionData {
  yBalanceAnterior: HopLimb  // Y-Balanceテスト・前方リーチ（cm）
  figure8Hop: HopLimb        // Figure-8ホップテスト（秒、短いほど良い）
}

export const ANKLE_FUNCTION_DEFAULT: AnkleFunctionData = {
  yBalanceAnterior: { involved: 0, uninvolved: 0 },
  figure8Hop: { involved: 0, uninvolved: 0 },
}

// ── ODI: Oswestry腰痛機能障害質問票 (Fairbank et al. 1980) ────────
// 腰部用の症状評価。9項目（性生活項目は対象患者層を考慮し除外）合計45点満点
// ODIは高いほど障害が重いため、スコア化の際は反転（100-障害度%）する
export interface LumbarSymptomData {
  s1: 0 | 1 | 2 | 3 | 4 | 5  // 痛みの強さ
  s2: 0 | 1 | 2 | 3 | 4 | 5  // セルフケア
  s3: 0 | 1 | 2 | 3 | 4 | 5  // 物を持つ
  s4: 0 | 1 | 2 | 3 | 4 | 5  // 歩行
  s5: 0 | 1 | 2 | 3 | 4 | 5  // 座位
  s6: 0 | 1 | 2 | 3 | 4 | 5  // 立位
  s7: 0 | 1 | 2 | 3 | 4 | 5  // 睡眠
  s8: 0 | 1 | 2 | 3 | 4 | 5  // 社会生活
  s9: 0 | 1 | 2 | 3 | 4 | 5  // 旅行
}

export const LUMBAR_SYMPTOM_DEFAULT: LumbarSymptomData = {
  s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0, s7: 0, s8: 0, s9: 0,
}

// ── 腰部機能テスト（サイドブリッジ保持テスト：左右差の比較） ──────
// McGillの体幹持久力評価の概念に基づく。左右の保持時間差が大きいほど腰部傷害リスクが高いとされる
export interface LumbarFunctionData {
  sideBridge: HopLimb   // サイドブリッジ（体幹側方）保持時間（秒）。症状側をinvolvedとする
}

export const LUMBAR_FUNCTION_DEFAULT: LumbarFunctionData = {
  sideBridge: { involved: 0, uninvolved: 0 },
}

// ── 統合アセスメント ─────────────────────────────────────────────
export interface ReturnCriteriaAssessment {
  id: string
  patientId: string
  assessmentDate: string
  type: AssessmentType
  region: AssessmentRegion

  // 膝用（region === 'knee'）
  lysholm?: LysholmData
  hopTests?: HopTestsData

  // 股関節用（region === 'hip'）
  hipSymptom?: HipSymptomData
  hipFunction?: HipFunctionData

  // 肩用（region === 'shoulder'）
  shoulderSymptom?: ShoulderSymptomData
  shoulderFunction?: ShoulderFunctionData
  shoulderDaily?: number[]   // 11 items（LEFSの代わりに使用）

  // 足関節用（region === 'ankle'）
  ankleSymptom?: AnkleSymptomData
  ankleFunction?: AnkleFunctionData

  // 腰部用（region === 'lumbar'）
  lumbarSymptom?: LumbarSymptomData
  lumbarFunction?: LumbarFunctionData

  // 部位共通（膝・股関節・足関節・腰部はLEFSを使用。肩はshoulderDailyを使用）
  aclRsi: AclRsiItems
  lefs?: number[]   // 20 items（肩以外）

  // 計算済みスコア (0-100)
  scores: {
    symptom: number       // Lysholm
    psychological: number // ACL-RSI
    functional: number    // Hop LSI 平均
    daily: number         // LEFS
    composite: number     // 重み付き合計
  }

  verdict: Verdict
  notes: string
  createdAt: string
}
