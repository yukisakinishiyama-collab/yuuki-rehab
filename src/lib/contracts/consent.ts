// ──────────────────────────────────────────────
// 「施術・リハビリテーション 説明および同意書」の 7「説明と確認」のチェック（純粋な関数）
//
// □ 同意します／□ 追加説明を希望します の、どちらか1つ。
// 「追加説明を希望」にチェックがあるまま、または「同意します」にチェックが無いままでは署名しない
// （疑問が残ったまま署名した形にならないように。説明をしてから、患者さんご自身でチェックを変えていただく）。
// 同意の有無で何かを自動で決めることはしない（説明した内容と意思決定を、そのまま残すだけ）。
// ──────────────────────────────────────────────

export const TREATMENT_CONSENT_ID = 'treatment-consent'

export function consentProblem(docId: string, checks: Array<{ i: number; after: string }>, checked: boolean[]): string | null {
  if (docId !== TREATMENT_CONSENT_ID) return null
  const agree = checks.find((c) => c.after.startsWith('上記の説明を受け'))
  const more = checks.find((c) => c.after.startsWith('疑問・不安が残る'))
  if (!agree || !more) return null
  if (checked[more.i]) return '7 で「追加説明を希望します」にチェックがあります。説明をしてから、患者様ご自身で「同意します」に変えていただいて署名してください。'
  if (!checked[agree.i]) return '7 の「計画に同意します」にチェックを入れてください（同意されない場合は署名しません）。'
  return null
}
