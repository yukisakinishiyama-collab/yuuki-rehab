/**
 * 音声からカルテ（SOAP）へ書き込む欄の一覧（画面とサーバーで共通）
 *
 * AI（Claude）が会話の文字起こしから患者さんの情報だけを取り出し、ここにある欄へ振り分ける。
 * 書き込んだあと、院長が読んで直してから「カルテを保存」を押す（自動では保存しない。2026-11-02 院長の判断）。
 */
export type SoapSection = 'S' | 'O' | 'A' | 'P'

export type SoapTextKey =
  | 'changeFromLast'
  | 'adlDifficulty'
  | 'patientConcern'
  | 'patientGoalToday'
  | 'romFindings'
  | 'strengthFindings'
  | 'specialTestFindings'
  | 'tenderness'
  | 'gait'
  | 'singleLegStance'
  | 'therapistObservation'
  | 'improvements'
  | 'remainingIssues'
  | 'priorityIssue'
  | 'treatmentToday'
  | 'nextGoal'
  | 'homeExercise'
  | 'forbiddenMovements'
  | 'recommendedFrequency'

export interface VoiceSoapField {
  key: SoapTextKey
  section: SoapSection
  /** 画面の欄の名前（SOAPForm と同じ） */
  label: string
  /** AIへの説明（何を書く欄か） */
  hint: string
  /** 1行の欄（短く書く） */
  singleLine?: boolean
}

export const VOICE_SOAP_FIELDS: readonly VoiceSoapField[] = [
  { key: 'changeFromLast', section: 'S', label: '前回からの変化', hint: '前回の施術から今日までの症状の変化（患者さんの話）' },
  { key: 'adlDifficulty', section: 'S', label: '生活上困ったこと', hint: '仕事・家事・通学・スポーツ・睡眠などで困っている動作' },
  { key: 'patientConcern', section: 'S', label: '患者様の不安', hint: '患者さんが口にした不安・心配' },
  { key: 'patientGoalToday', section: 'S', label: '今日の希望・目標', hint: '患者さんの今日の希望や、できるようになりたいこと', singleLine: true },
  { key: 'romFindings', section: 'O', label: 'ROM所見', hint: '関節の可動域（角度・左右差・制限）' },
  { key: 'strengthFindings', section: 'O', label: '筋力所見', hint: '筋力（MMT・左右差など）' },
  { key: 'specialTestFindings', section: 'O', label: 'スペシャルテスト補足メモ', hint: '徒手検査の名前と結果（陽性・陰性・痛みの再現）' },
  { key: 'tenderness', section: 'O', label: '圧痛', hint: '圧痛のある場所', singleLine: true },
  { key: 'gait', section: 'O', label: '歩行所見', hint: '歩き方の所見', singleLine: true },
  { key: 'singleLegStance', section: 'O', label: '片脚立位', hint: '片脚立ちの秒数・安定性', singleLine: true },
  { key: 'therapistObservation', section: 'O', label: '動作観察・施術者メモ', hint: '動作の観察や、施術中に施術者が確かめたこと' },
  { key: 'improvements', section: 'A', label: '改善している点', hint: '施術者が「良くなった」と評価したこと' },
  { key: 'remainingIssues', section: 'A', label: '残っている問題', hint: '施術者が「まだ残っている」と評価したこと' },
  { key: 'priorityIssue', section: 'A', label: '優先課題', hint: '施術者が一番に取り組むと言ったこと', singleLine: true },
  { key: 'treatmentToday', section: 'P', label: '本日の施術内容', hint: '今日行った施術・運動・テーピングなど' },
  { key: 'nextGoal', section: 'P', label: '次回までの目標', hint: '次回までの目標' },
  { key: 'homeExercise', section: 'P', label: '自宅運動', hint: '自宅でやるよう伝えた運動（種目・回数・セット）' },
  { key: 'forbiddenMovements', section: 'P', label: '禁止動作', hint: '控えるよう伝えた動作', singleLine: true },
  { key: 'recommendedFrequency', section: 'P', label: '通院目安', hint: '次の来院の目安（例: 週2回）', singleLine: true },
]

export type HomeExerciseAdherence = 'done' | 'partial' | 'not_done'

/** AIが振り分けた結果（空の欄は入れない） */
export interface VoiceSoapResult {
  fields: Partial<Record<SoapTextKey, string>>
  /** 患者さんが数字で答えた痛み（NRS 0〜10）。無ければ入れない */
  painToday?: number
  /** 腫れ・熱感が「ある」と話に出たときだけ true */
  swelling?: boolean
  heat?: boolean
  homeExerciseAdherence?: HomeExerciseAdherence
  /** カルテに書かなかった話（雑談など）の短い説明。お名前などは入れない */
  excluded: string[]
}

/** 口述をメモに整えた結果 */
export interface VoiceMemoResult {
  memo: string
  excluded: string[]
}

export const SOAP_SECTION_LABELS: Record<SoapSection, string> = {
  S: 'S：主観',
  O: 'O：客観',
  A: 'A：評価',
  P: 'P：計画',
}
