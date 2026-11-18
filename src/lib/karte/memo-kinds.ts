/**
 * 簡易メモの種類（治療方針と同意内容の記録。2026-11-18 院長の指示書「5. 治療方針と同意内容の管理」）
 *
 * 新しい画面は作らず、今ある「簡易メモ」に種類を付けて残す（月ごとの一覧・カルテ印刷にもそのまま出る）。
 * 署名で残す説明・同意は「契約・同意書」タブの「施術・リハビリテーション 説明および同意書」。
 * ここは、そのあとの出来事（中断の申し出・自己判断での再開・計画の変更など）を日付つきで残す。
 * 説明した内容と、患者さんの意思決定を、事実のまま残すための記録（同意の有無で何かを自動で決めることはしない）。
 */
import type { QuickMemoKind } from '@/types/patient'

export const MEMO_KINDS: { value: QuickMemoKind; label: string; template: string }[] = [
  { value: 'explain', label: '治療方針の説明・同意', template: '説明した内容：\n患者さんの理解：\n同意の状況（同意・追加説明を希望・保留 など）：\n' },
  { value: 'home_plan', label: '自主トレの合意', template: '合意した運動（種類・回数・頻度）：\n患者さんの意見：\n' },
  { value: 'stop_request', label: '治療中断の申し出', template: '申し出の内容：\n理由：\n説明したこと：\n' },
  { value: 'self_resume', label: '自己判断での運動・競技の再開', template: '再開した内容と時期：\nきっかけ：\n説明したこと：\n' },
  { value: 'plan_change', label: '治療計画の変更', template: '変更前：\n変更後：\n理由：\n' },
  { value: 'caution', label: '説明した注意事項', template: '注意事項：\n' },
  { value: 'wish', label: '患者さんの希望と最終的な方針', template: '患者さんの希望：\n最終的な方針：\n' },
]

export function memoKindLabel(kind: QuickMemoKind | undefined): string | null {
  return MEMO_KINDS.find((k) => k.value === kind)?.label ?? null
}

/** 種類をえらんだとき、欄が空（または前の種類の見本のまま）なら見本を入れる */
export function memoTemplateFor(kind: QuickMemoKind | null, current: string): string {
  const trimmed = current.trim()
  const isTemplate = MEMO_KINDS.some((k) => k.template.trim() === trimmed)
  if (trimmed && !isTemplate) return current
  return kind ? (MEMO_KINDS.find((k) => k.value === kind)?.template ?? current) : isTemplate ? '' : current
}
