/**
 * 自宅運動（自主トレ）の実施状況（SOAP の S）。純粋な関数
 *
 * 実施・一部実施・未実施・未確認（聞いていない）の4つ。2026-11-18 に「未確認」を足し、
 * 新しく書くカルテの初期値を「一部実施」から「未確認」にした（聞いていないのに「一部実施」と残らないように）。
 * 未実施・一部実施のときは、理由をタップで残せる。理由から「運動内容を見直すときの手がかり」を出す。
 * 実施できていないことだけで、危ない方・離脱しそうな方とは決めない（離脱リスクの計算は今までどおり）。
 */
import type { SOAPNote } from '@/types/patient'

export type Adherence = SOAPNote['homeExerciseAdherence']

/** form＝SOAP の入力欄の言葉（今までの「できた・一部できた・できなかった」はそのまま。「未確認」を足した） */
export const ADHERENCE_OPTIONS: { value: Adherence; label: string; long: string; form: string }[] = [
  { value: 'done', label: '実施', long: '✅ 実施できた', form: 'できた' },
  { value: 'partial', label: '一部実施', long: '⚠️ 一部実施', form: '一部できた' },
  { value: 'not_done', label: '未実施', long: '❌ 未実施', form: 'できなかった' },
  { value: 'unknown', label: '未確認', long: '— 未確認', form: '未確認（聞いていない）' },
]

export function adherenceText(v: Adherence | undefined, long = false): string {
  const hit = ADHERENCE_OPTIONS.find((o) => o.value === v) ?? ADHERENCE_OPTIONS[3]
  return long ? hit.long : hit.label
}

/** 実施率（グラフ用）。未確認は数えない（null） */
export function adherenceRate(v: Adherence | undefined): number | null {
  return v === 'done' ? 100 : v === 'partial' ? 50 : v === 'not_done' ? 0 : null
}

/** 未実施・一部実施の理由（短くタップで残す） */
export const ADHERENCE_REASONS = ['痛み', '時間が足りない', '費用', '体調', '必要性に疑問', 'やり方が分からない', 'その他'] as const

/** 理由ごとの、運動内容を見直すときの手がかり（院長が判断する。決めつけない言い方） */
const REVIEW_HINTS: Record<string, string> = {
  痛み: '痛みが出る運動は、種類・回数・強さ・やり方を見直す候補です。痛みの強まりが続くときは、予定日を待たずに再評価も考えます。',
  時間が足りない: '1回を短くする・種目をしぼる・生活の中でできる形にする、などを相談できます。',
  費用: '道具を使わない方法や、家にあるもので代わりにできる方法を考えられます。',
  体調: '体調に合わせて、休む日・軽くする日の目安を決めておけます。',
  必要性に疑問: '運動の目的と、続けると期待できることを、もう一度いっしょに確かめられます。',
  やり方が分からない: 'その場でいっしょに行い、紙や動画で持ち帰れる形にできます。',
}

export function adherenceReviewHints(reasons: readonly string[] | undefined): string[] {
  return (reasons ?? []).map((r) => REVIEW_HINTS[r]).filter((h): h is string => Boolean(h))
}

/** 理由を出すのは、未実施・一部実施のときだけ */
export function needsReason(v: Adherence | undefined): boolean {
  return v === 'not_done' || v === 'partial'
}
