// 競技復帰ドリル・アスリハ動画関連の型定義

export type DrillPhase = 'アスリハ期' | '競技復帰期'

export interface Drill {
  id: string
  title: string
  phase: DrillPhase
  sports: string[]
  description: string
  /** 動画は自院制作分がまだ無いため、YouTube検索リンクを提供する方式 */
  youtubeQuery: string
}

export interface DiseaseDrillGroup {
  diseaseSlug: string
  diseaseLabel: string
  /** symptoms一覧ページと同じ対応競技タグ */
  sports: string[]
  drills: Drill[]
}
