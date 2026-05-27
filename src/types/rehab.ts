export type UserRole =
  | 'admin' | 'pt' | 'doctor' | 'trainer' | 'viewer'
  | 'ballet_coach' | 'jazz_coach' | 'hiphop_coach' | 'breakdance_coach'

export type CaseStatus = 'initial' | 'intervention' | 'preReturn' | 'closed'

export type DeliveryStatus = 'received' | 'analyzing' | 'done' | 'sent'

export type ServiceType = 'sports' | 'rehab' | 'posture' | 'team' | 'other'

export type MovementType =
  | 'walking'
  | 'squat'
  | 'jump'
  | 'running'
  | 'sitsToStand'
  | 'shoulder'
  | 'knee'
  | 'ankle'
  | 'ballet'
  | 'jazz'
  | 'hiphop'
  | 'breakdance'
  | 'other'

export type VideoDirection = 'front' | 'side' | 'rear' | 'other'

export type CommentType = 'problem' | 'improvement' | 'risk' | 'positive' | 'suggestion'

export type ReactionType = 'agree' | 'review' | 'important'

export type AnnotationTool = 'line' | 'angle' | 'arrow' | 'circle' | 'free' | 'text'

export interface AnnotationPoint {
  x: number  // normalized 0-1 relative to canvas width
  y: number  // normalized 0-1 relative to canvas height
}

export interface AnnotationShape {
  id: string
  tool: AnnotationTool
  color: string
  points: AnnotationPoint[]
  text?: string  // for text tool or angle label
}

/** A saved annotation snapshot linked to a video timestamp */
export interface SavedAnnotation {
  id: string
  videoId: string
  caseId: string
  timestamp: number  // seconds
  label: string
  shapes: AnnotationShape[]
  createdBy: string
  createdByName: string
  createdAt: string
}

export interface User {
  id: string
  name: string
  role: UserRole
  department: string
  email: string
}

export interface RehabCase {
  id: string
  anonymousId: string
  patientName?: string
  age: number
  gender: 'male' | 'female' | 'other'
  diagnosis: string
  injuredPart: string
  postOpDays?: number
  evaluationPurpose: string
  status: CaseStatus
  assignedTo: string[]
  reviewers: string[]
  tags: string[]
  createdAt: string
  updatedAt: string
  videos: CaseVideo[]
  // サービス向け追加フィールド
  clientEmail?: string
  clientPhone?: string
  sport?: string
  serviceType?: ServiceType
  deliveryStatus?: DeliveryStatus
  requestNote?: string
}

export interface CaseVideo {
  id: string
  caseId: string
  label: string
  direction: VideoDirection
  movementType: MovementType
  tags: string[]
  uploadedAt: string
  uploadedBy: string
  fileName: string
  duration?: number
}

export interface VideoComment {
  id: string
  videoId: string
  caseId: string
  timestamp: number
  text: string
  type: CommentType
  authorId: string
  authorName: string
  authorRole: UserRole
  createdAt: string
  replies: CommentReply[]
  reactions: CommentReaction[]
}

export interface CommentReply {
  id: string
  commentId: string
  text: string
  authorId: string
  authorName: string
  createdAt: string
}

export interface CommentReaction {
  type: ReactionType
  userId: string
  userName: string
}

export interface EvaluationItem {
  key: string
  label: string
  severity: 'none' | 'mild' | 'moderate' | 'severe' | ''
  checked: boolean
  note: string
}

export interface EvaluationResult {
  id: string
  caseId: string
  videoId: string
  movementType: MovementType
  items: EvaluationItem[]
  overallNote: string
  evaluatedBy: string
  evaluatedByName: string
  evaluatedAt: string
}

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  walking: '歩行',
  squat: 'スクワット',
  jump: 'ジャンプ・着地',
  running: 'ランニング',
  sitsToStand: '立ち上がり',
  shoulder: '肩関節',
  knee: '膝関節',
  ankle: '足関節',
  ballet: 'バレエ',
  jazz: 'ジャズダンス',
  hiphop: 'Hip hop',
  breakdance: 'ブレイクダンス',
  other: 'その他',
}

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  initial: '初回評価',
  intervention: '介入中',
  preReturn: '復帰前評価',
  closed: '終了',
}

export const CASE_STATUS_COLORS: Record<CaseStatus, string> = {
  initial: 'bg-blue-100 text-blue-800',
  intervention: 'bg-yellow-100 text-yellow-800',
  preReturn: 'bg-purple-100 text-purple-800',
  closed: 'bg-gray-100 text-gray-600',
}

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  received: '新着依頼',
  analyzing: '解析中',
  done: '解析完了',
  sent: '送付済み',
}

export const DELIVERY_STATUS_COLORS: Record<DeliveryStatus, string> = {
  received: 'bg-blue-100 text-blue-800 border-blue-200',
  analyzing: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  done: 'bg-green-100 text-green-800 border-green-200',
  sent: 'bg-gray-100 text-gray-600 border-gray-200',
}

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  sports: 'スポーツ・競技',
  rehab: 'リハビリ・回復',
  posture: '姿勢・日常動作',
  team: 'チーム・法人',
  other: 'その他',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理者',
  pt: '理学療法士',
  doctor: '医師',
  trainer: 'トレーナー',
  viewer: '閲覧のみ',
  ballet_coach: 'バレエコーチ',
  jazz_coach: 'ジャズコーチ',
  hiphop_coach: 'Hip hopコーチ',
  breakdance_coach: 'ブレイクダンスコーチ',
}

export const COMMENT_TYPE_LABELS: Record<CommentType, string> = {
  problem: '問題点',
  improvement: '改善点',
  risk: 'リスク',
  positive: '良好',
  suggestion: '追加評価の提案',
}

export const COMMENT_TYPE_COLORS: Record<CommentType, string> = {
  problem: 'bg-red-100 text-red-800 border-red-200',
  improvement: 'bg-blue-100 text-blue-800 border-blue-200',
  risk: 'bg-orange-100 text-orange-800 border-orange-200',
  positive: 'bg-green-100 text-green-800 border-green-200',
  suggestion: 'bg-purple-100 text-purple-800 border-purple-200',
}

export const VIDEO_DIRECTION_LABELS: Record<VideoDirection, string> = {
  front: '正面',
  side: '側面',
  rear: '後方',
  other: 'その他',
}

/** 専門家チャットメッセージ */
export interface ChatMessage {
  id: string
  caseId: string
  videoId?: string         // 特定動画に紐づける場合（任意）
  text: string
  authorId: string
  authorName: string
  authorRole: UserRole
  createdAt: string
  mentions: string[]       // @mention された userId
}

/** AI所見サマリー（自動保存） */
export interface ExpertOpinion {
  id:      string   // 'ortho' | 'pt' | 'at' | 'bio' | 'judo'
  name:    string   // 表示名
  role:    string   // 肩書き
  color:   string   // UIカラー
  opinion: string   // 意見本文
}

export interface AISummary {
  id: string
  videoId: string
  caseId: string
  summary: string             // 合議結論
  experts?: ExpertOpinion[]   // 各専門家の意見
  frameCount: number
  customPrompt?: string
  createdAt: string
  createdByName: string
}

// ─── 動的ROM計測 ─────────────────────────────────────────────────────────────

/** 1サンプル（動画タイムスタンプ + 各関節角度） */
export interface ROMSample {
  t:      number                           // 動画時刻（秒）
  angles: Record<string, {                 // joint key → 角度情報
    value:     number
    direction: string
    label:     string
    side:      string
  }>
}

/** ROM計測セッション（1回分の計測） */
export interface ROMSession {
  id:            string
  caseId:        string
  videoId:       string
  label:         string           // 例: '歩行 ROM計測 #1'
  samples:       ROMSample[]
  durationSec:   number           // 計測区間の長さ
  startTime:     number           // 動画の開始時刻
  createdAt:     string
  createdByName: string
  source:        'mediapipe' | 'virtual_marker' | 'color_marker'
}

// ─── 運動プログラム ───────────────────────────────────────────────────────────

/** 運動フェーズ */
export type ExercisePhase = 'warmup' | 'main' | 'cooldown'

export const EXERCISE_PHASE_LABELS: Record<ExercisePhase, string> = {
  warmup:   'ウォームアップ',
  main:     'メイン',
  cooldown: 'クールダウン',
}

export const EXERCISE_PHASE_COLORS: Record<ExercisePhase, string> = {
  warmup:   'bg-orange-100 text-orange-800 border-orange-200',
  main:     'bg-blue-100 text-blue-800 border-blue-200',
  cooldown: 'bg-teal-100 text-teal-800 border-teal-200',
}

/** 1種目の運動 */
export interface ExerciseItem {
  id:             string
  name:           string       // 例: '膝屈曲ストレッチ'
  phase:          ExercisePhase
  durationSec:    number       // 実施時間（秒）
  sets?:          number       // セット数
  reps?:          string       // 例: '10回' '30秒キープ'
  restSec?:       number       // 休憩（秒）
  instruction:    string       // 手順（Step形式）
  purpose:        string       // なぜこの運動が必要か
  caution?:       string       // 注意事項
  youtubeQuery:   string       // YouTube検索キーワード（日本語）
  customVideoUrl?: string      // ユーザーが貼り付けた動画URL（YouTube等）
}

/** 15分運動プログラム */
export interface ExerciseProgram {
  id:            string
  caseId:        string
  createdAt:     string
  targetArea:    string       // 例: '左膝・股関節'
  goal:          string       // 例: '可動域改善・筋力増強'
  totalMinutes:  number       // 総時間（分）
  exercises:     ExerciseItem[]
  generalNotes:  string       // 全体的な注意事項
  createdByName: string
}

/** 動画上の対象者マーカー（バウンディングボックス・正規化座標 0–1） */
export interface PersonMarker {
  videoId: string
  x: number        // 左端 (0–1)
  y: number        // 上端 (0–1)
  width: number    // 幅   (0–1)
  height: number   // 高さ (0–1)
  label: string    // 例: "患者"
  color: string    // CSSカラー
}

export const EVALUATION_TEMPLATES: Record<MovementType, { key: string; label: string }[]> = {
  walking: [
    { key: 'stance_initial', label: '初期接地（ヒールストライク）' },
    { key: 'stance_loading', label: '荷重応答期' },
    { key: 'stance_mid', label: '立脚中期' },
    { key: 'stance_terminal', label: '立脚終期' },
    { key: 'swing_initial', label: '遊脚初期' },
    { key: 'swing_mid', label: '遊脚中期' },
    { key: 'pelvis_tilt', label: '骨盤の傾斜・回旋' },
    { key: 'hip_align', label: '股関節アライメント' },
    { key: 'knee_align', label: '膝関節アライメント' },
    { key: 'ankle_align', label: '足関節アライメント' },
    { key: 'trendelenburg', label: 'トレンデレンブルグ徴候' },
    { key: 'knee_buckling', label: '膝折れ' },
    { key: 'foot_contact', label: '足部接地パターン' },
  ],
  squat: [
    { key: 'trunk_lean', label: '体幹前傾' },
    { key: 'pelvis_tilt', label: '骨盤後傾' },
    { key: 'knee_valgus', label: '膝の内側偏位（ニーイン）' },
    { key: 'foot_arch', label: '足部アーチ低下' },
    { key: 'weight_shift', label: '左右荷重差' },
    { key: 'depth', label: '深度（しゃがみ込み深さ）' },
    { key: 'heel_rise', label: 'かかとの浮き上がり' },
  ],
  jump: [
    { key: 'knee_valgus', label: '膝外反（ニーイン）' },
    { key: 'hip_flexion', label: '股関節屈曲不足' },
    { key: 'trunk_lateral', label: '体幹側方偏位' },
    { key: 'shock_absorption', label: '着地時の衝撃吸収' },
    { key: 'bilateral_asymmetry', label: '左右非対称' },
    { key: 'reinjury_risk', label: '再受傷リスク' },
    { key: 'stiffness', label: '関節スティフネス' },
  ],
  shoulder: [
    { key: 'scapula_motion', label: '肩甲骨の動き' },
    { key: 'gh_rhythm', label: '肩甲上腕リズム' },
    { key: 'compensation', label: '代償動作' },
    { key: 'rom_limit', label: '可動域制限' },
    { key: 'pain_provocation', label: '疼痛誘発動作' },
    { key: 'impingement', label: 'インピンジメント徴候' },
  ],
  running: [
    { key: 'cadence', label: 'ケイデンス（歩調）' },
    { key: 'trunk_rotation', label: '体幹回旋' },
    { key: 'arm_swing', label: '上肢の振り' },
    { key: 'foot_strike', label: '足部接地パターン' },
    { key: 'vertical_oscillation', label: '上下動' },
    { key: 'knee_drive', label: '膝の引き上げ' },
  ],
  sitsToStand: [
    { key: 'trunk_lean', label: '体幹前傾の開始タイミング' },
    { key: 'momentum', label: '勢いの利用（モーメント戦略）' },
    { key: 'bilateral_asymmetry', label: '左右非対称' },
    { key: 'knee_align', label: '膝アライメント' },
    { key: 'completion', label: '完全伸展での立位完了' },
  ],
  knee: [
    { key: 'valgus', label: '膝外反' },
    { key: 'varus', label: '膝内反' },
    { key: 'rom', label: '可動域' },
    { key: 'instability', label: '不安定性' },
    { key: 'pain', label: '疼痛' },
    { key: 'effusion', label: '腫脹・水腫' },
  ],
  ankle: [
    { key: 'dorsiflexion', label: '背屈可動域' },
    { key: 'pronation', label: '回内（プロネーション）' },
    { key: 'supination', label: '回外（スピネーション）' },
    { key: 'instability', label: '不安定性' },
    { key: 'foot_arch', label: '足部アーチ' },
  ],
  ballet: [
    { key: 'turnout', label: 'ターンアウト（外旋）の質と左右差' },
    { key: 'plie_alignment', label: 'プリエ時の膝・足部アライメント' },
    { key: 'releve_balance', label: 'ルルヴェの安定性・高さ' },
    { key: 'arabesque_hip', label: 'アラベスク時の骨盤・股関節制御' },
    { key: 'port_de_bras', label: 'ポール・ドゥ・ブラ（上肢協調性）' },
    { key: 'landing_softness', label: 'ジャンプ着地の静粛性・衝撃吸収' },
    { key: 'core_stability', label: '体幹の安定性（エンデオール中）' },
    { key: 'spine_hyperextension', label: '脊柱過伸展・腰椎への負荷' },
    { key: 'ankle_rom', label: '足関節可動域（ポアント・フレックス）' },
    { key: 'injury_risk', label: '再受傷・過負荷リスク' },
  ],
  jazz: [
    { key: 'isolation', label: 'アイソレーション（各パーツの独立動作）' },
    { key: 'hip_mobility', label: '股関節の可動域・柔軟性' },
    { key: 'jump_landing', label: 'ジャンプ・着地の膝アライメント' },
    { key: 'turn_technique', label: 'ターン時のスポッティング・バランス' },
    { key: 'flexibility', label: 'スプリット・開脚の左右対称性' },
    { key: 'trunk_rotation', label: '体幹回旋の可動域と安定性' },
    { key: 'floor_work', label: 'フロアワーク時の体重移動' },
    { key: 'injury_risk', label: '過負荷・疲労骨折リスク' },
  ],
  hiphop: [
    { key: 'bounce_rhythm', label: 'バウンス・リズム感（膝の使い方）' },
    { key: 'groove_posture', label: 'グルーブ時の姿勢・重心位置' },
    { key: 'popping_isolation', label: 'ポッピング・アイソレーションの精度' },
    { key: 'footwork_agility', label: 'フットワークの敏捷性' },
    { key: 'arm_control', label: '上肢コントロール・肩関節安定性' },
    { key: 'low_stance', label: '低姿勢維持時の膝・腰への負荷' },
    { key: 'floor_impact', label: 'フロアへの衝撃（膝関節保護）' },
    { key: 'asymmetry', label: '左右非対称・代償動作' },
  ],
  breakdance: [
    { key: 'wrist_load', label: '手首・前腕への荷重（フリーズ・チェア）' },
    { key: 'shoulder_stability', label: '肩関節の安定性（ハンドスタンド）' },
    { key: 'spine_load', label: '頸椎・腰椎への負荷（ヘッドスピン等）' },
    { key: 'core_strength', label: '体幹筋力（ウインドミル・フレア）' },
    { key: 'hip_flexor', label: '股関節屈筋群の柔軟性と負荷' },
    { key: 'landing_impact', label: '着地衝撃と下肢関節保護' },
    { key: 'power_asymmetry', label: '利き手・軸足の左右差' },
    { key: 'injury_risk', label: '急性外傷・過負荷リスク評価' },
    { key: 'fatigue_pattern', label: '疲労時の動作変化' },
  ],
  other: [
    { key: 'general_alignment', label: '全体的なアライメント' },
    { key: 'compensation', label: '代償動作' },
    { key: 'pain', label: '疼痛' },
    { key: 'rom', label: '可動域' },
    { key: 'instability', label: '不安定性' },
  ],
}
