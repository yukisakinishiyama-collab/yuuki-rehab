// ──────────────────────────────────────────────
// 署名の前に確かめる文面のチェック（純粋な関数）
//
// 「施術・リハビリテーション 説明および同意書」の 7「説明と確認」：
//   □ 同意します／□ 追加説明を希望します の、どちらか1つ。
//   「追加説明を希望」にチェックがあるまま、または「同意します」にチェックが無いままでは署名しない
//   （疑問が残ったまま署名した形にならないように。説明をしてから、患者さんご自身でチェックを変えていただく）。
//
// 「治癒前の競技復帰に関する説明・意思確認書」（2026-11-28 院長の PDF）：
//   当院の見解（推奨しない理由・推奨しない活動・当院の提案・医師の指示）、説明したリスク（3つ）、
//   ご本人・保護者の確認（説明を受けた・質問の機会と選択肢・希望する活動）がそろっていないと署名しない
//   （説明が抜けたまま「本人が希望した」形だけが残らないように）。
//
// 同意の有無で何かを自動で決めることはしない（説明した内容と意思決定を、そのまま残すだけ）。
// ──────────────────────────────────────────────

export const TREATMENT_CONSENT_ID = 'treatment-consent'
export const RETURN_TO_SPORT_ID = 'return-to-sport'

type Check = { i: number; after: string; lead?: string; section?: string }
type Blank = { i: number; label: string }

export function consentProblem(
  docId: string,
  checks: Check[],
  checked: boolean[],
  blanks: Blank[] = [],
  values: string[] = [],
): string | null {
  if (docId === RETURN_TO_SPORT_ID) return returnToSportProblem(checks, checked, blanks, values)
  if (docId !== TREATMENT_CONSENT_ID) return null
  const agree = checks.find((c) => c.after.startsWith('上記の説明を受け'))
  const more = checks.find((c) => c.after.startsWith('疑問・不安が残る'))
  if (!agree || !more) return null
  if (checked[more.i]) return '7 で「追加説明を希望します」にチェックがあります。説明をしてから、患者様ご自身で「同意します」に変えていただいて署名してください。'
  if (!checked[agree.i]) return '7 の「計画に同意します」にチェックを入れてください（同意されない場合は署名しません）。'
  return null
}

/** 治癒前の競技復帰に関する説明・意思確認書：署名の前にそろっていてほしいもの（足りなければ最初の1つを返す） */
export function returnToSportProblem(checks: Check[], checked: boolean[], blanks: Blank[], values: string[]): string | null {
  const inSection = (c: Check, no: string) => (c.section ?? '').startsWith(no)
  const any = (pred: (c: Check) => boolean) => checks.some((c) => pred(c) && checked[c.i])
  const all = (pred: (c: Check) => boolean) => {
    const list = checks.filter(pred)
    return list.length > 0 && list.every((c) => checked[c.i])
  }
  const value = (label: string) => {
    const b = blanks.find((x) => x.label === label)
    return b ? String(values[b.i] ?? '').trim() : ''
  }

  if (!value('評価所見・復帰を推奨しない理由')) return '１の「評価所見・復帰を推奨しない理由」を書いてください（当院記入欄）。'
  if (!any((c) => inSection(c, '１') && c.lead === '推奨しない活動')) return '１の「推奨しない活動」を1つ以上えらんでください。'
  if (!any((c) => inSection(c, '１') && c.lead === '当院の提案')) return '１の「当院の提案」を1つ以上えらんでください。'
  if (!any((c) => inSection(c, '１') && c.lead === '医師の指示')) return '１の「医師の指示」をえらんでください（確かめていなければ「未確認」）。'
  if (!all((c) => inSection(c, '２') && !c.lead)) return '２のリスク（3つ）を説明して、チェックを入れてください。'
  const understood = checks.find((c) => inSection(c, '３') && c.after.startsWith('当院が上記の競技参加を推奨していない'))
  const asked = checks.find((c) => inSection(c, '３') && c.after.startsWith('質問する機会があり'))
  const wish = checks.find((c) => inSection(c, '３') && c.after.startsWith('上記の説明を受けたうえで'))
  if (understood && !checked[understood.i]) return '３の「説明を受け、理解しました」に、患者様（保護者）ご自身でチェックを入れていただいてください。'
  if (asked && !checked[asked.i]) return '３の「質問する機会があり、選択肢について説明を受けました」に、患者様（保護者）ご自身でチェックを入れていただいてください。'
  if (wish && !checked[wish.i]) return '３の「以下の活動を希望します」にチェックが無いときは、この書類には署名しません（参加を希望されない場合は不要です）。'
  if (!any((c) => inSection(c, '３') && c.lead === '希望する活動')) return '３の「希望する活動」を1つ以上えらんでください。'
  return null
}
