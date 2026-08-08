// ──────────────────────────────────────────────
// 疾患・部位別の実写リハビリ画像マニフェスト（画像統合指示書 §7・§9）
//
// 画像パスをコードに散在させず、ここ一箇所で管理する。
// 実体の解決は既存のイラスト基盤に任せる:
//   イラスト管理でアップロード（Blob/KV） > public/illustrations/<slot>.png > 非表示
// つまり画像を追加・差し替えるときにコード変更は不要（アップロードのみで反映）。
//
// 【安全上の決まり】
// - 画像は「部位・運動・リハビリ段階」の視覚説明用。診断の断定には使わない
// - 患者説明用キャプションは治癒を保証しない表現にする（医療広告ガイドライン）
// - 推奨はあくまで候補。最終的にどの画像を見せるかは施術者が選ぶ（指示書§9）
// ──────────────────────────────────────────────

import type { BodyRegion } from '@/types/patient'

export interface ConditionImage {
  /** 疾患・場面の識別子（指示書§7の condition_id） */
  conditionId: string
  /** スタッフ向けの表示名 */
  title: string
  /** イラスト管理のスロット名（画像実体の解決キー） */
  slot: string
  /** 代替テキスト（必須。スクリーンリーダー・読み込み失敗時の表示） */
  alt: string
  /** マニフェスト版数。画像を大きく差し替えたら上げる */
  version: string
  /** 部位からの推定に使う */
  bodyRegions: BodyRegion[]
  /** 疾患名・プロトコル名からの推定に使う */
  match: RegExp
  /** 患者説明用のキャプション候補（断定しない・不安を煽らない） */
  patientCaption: string
}

/**
 * 初期導入の6枚（指示書§10）。
 * 画像が未アップロードのスロットは自動的に非表示になるため、
 * 先にマニフェストだけ入れておいても画面は壊れない。
 */
export const CONDITION_IMAGES: ConditionImage[] = [
  {
    conditionId: 'acl_knee',
    title: 'ACL・膝のリハビリ',
    slot: 'condition-acl-knee',
    alt: '膝のリハビリテーションを行う様子',
    version: '1.0',
    bodyRegions: ['knee'],
    match: /(acl|前十字|十字靱帯|十字靭帯|半月板|膝蓋|膝)/i,
    patientCaption: '膝を安定させる動きの練習です。段階に合わせて負荷を調整していきます。',
  },
  {
    conditionId: 'ankle_instability',
    title: '足関節・不安定症のリハビリ',
    slot: 'condition-ankle-instability',
    alt: '足関節のバランス練習を行う様子',
    version: '1.0',
    bodyRegions: ['ankle'],
    match: /(足関節|足首|捻挫|atfl|cfl|不安定症|アキレス)/i,
    patientCaption: '足首を安定させるバランスの練習です。ぐらつきを減らしていきます。',
  },
  {
    conditionId: 'hip',
    title: '股関節のリハビリ',
    slot: 'condition-hip',
    alt: '股関節のリハビリテーションを行う様子',
    version: '1.0',
    bodyRegions: ['hip'],
    match: /(股関節|fai|寛骨臼|関節唇|鼠径|グロイン)/i,
    patientCaption: '股関節まわりの動きと筋力の練習です。動かせる範囲を広げていきます。',
  },
  {
    conditionId: 'shoulder_cuff',
    title: '肩・腱板のリハビリ',
    slot: 'condition-shoulder-cuff',
    alt: '肩のインナーマッスル練習を行う様子',
    version: '1.0',
    bodyRegions: ['shoulder'],
    match: /(肩|腱板|ローテーターカフ|棘上筋|バンカート|インピンジ)/i,
    patientCaption: '肩の深いところにある筋肉を働かせる練習です。腕の動かしやすさを目指します。',
  },
  {
    conditionId: 'low_back',
    title: '腰部のリハビリ',
    slot: 'condition-lumbar',
    alt: '腰部の体幹トレーニングを行う様子',
    version: '1.0',
    bodyRegions: ['lumbar', 'thoracic'],
    match: /(腰|腰椎|椎間板|分離症|ぎっくり|体幹)/i,
    patientCaption: '腰に負担をかけにくい体の使い方の練習です。日常動作の安定を目指します。',
  },
  {
    conditionId: 'return_to_sport',
    title: 'スポーツ復帰',
    slot: 'condition-return-to-sport',
    alt: 'スポーツ復帰に向けた動作練習を行う様子',
    version: '1.0',
    bodyRegions: ['functional'],
    match: /(復帰|rts|return to sport|競技|ジャンプ|アジリティ|スプリント)/i,
    patientCaption: '競技の動きに近づけていく段階の練習です。着地や切り返しの安定を確認します。',
  },
]

export function getConditionImage(conditionId: string): ConditionImage | null {
  return CONDITION_IMAGES.find(c => c.conditionId === conditionId) ?? null
}

export interface RecommendInput {
  /** 診断名・プロトコル名など、施術者が選んだ情報（最優先。指示書§9） */
  diagnosis?: string
  protocolTitle?: string
  /** 現在フェーズ名（復帰期ならスポーツ復帰の画像を優先する） */
  phaseTitle?: string
  bodyRegion?: BodyRegion
  mainComplaint?: string
}

/**
 * 施術者が選択済みの情報から画像候補を推定する（指示書§9）。
 * 患者情報から勝手に診断を作らない。あくまで既に選ばれた疾患・部位に紐づけるだけ。
 */
export function recommendConditionImage(input: RecommendInput): ConditionImage | null {
  // 復帰期のフェーズは、部位より「スポーツ復帰」の場面を優先する
  const phase = input.phaseTitle ?? ''
  if (/(復帰|return|競技|rts)/i.test(phase)) {
    const rts = getConditionImage('return_to_sport')
    if (rts) return rts
  }

  // 施術者が入力した診断名・プロトコル名を最優先で照合
  for (const text of [input.diagnosis, input.protocolTitle, input.mainComplaint]) {
    if (!text) continue
    const hit = CONDITION_IMAGES.find(c => c.match.test(text))
    if (hit) return hit
  }

  // 最後に部位で照合
  if (input.bodyRegion) {
    const hit = CONDITION_IMAGES.find(c => c.bodyRegions.includes(input.bodyRegion!))
    if (hit) return hit
  }

  return null
}
