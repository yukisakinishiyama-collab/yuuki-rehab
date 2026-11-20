// ──────────────────────────────────────────────
// キャンセルの分析（純粋な関数。画面は app/(app)/marketing/sales/cancellations、
// 予約システムの数字は /api/marketing/cancel-stats がサーバーで集計する）
//
// 2026-11-20 院長「キャンセル率を下げる対策を」→ 院長が選んだ対策の1つ「キャンセルの分析画面」。
// どこに手を打つと効くかを見るため、2つの記録を並べる。
// A. 予約システム（集計の行だけ。お名前・電話は来ない）：予約日が過ぎた予約のうち、キャンセルになった割合を
//    月・初めて/2回目以降・曜日・流入元・「予約を受けてから予約日までの日数」ごとに
// B. カルテのキャンセルの記録（この端末）：予約日前・当日・無断の割合、理由、何日前の連絡か、
//    くり返しキャンセルの方、LINE 連携の有無
// 「気づき」は数字の並びを言葉にするだけ（理由を決めつけない）。件数が少ないときは出さない。
// ──────────────────────────────────────────────
import type { CancellationKind, CancellationRecord } from '@/types/patient'

// ── A. 予約システム ─────────────────────────────

/** 予約システムの集計の行（BookingStatRow と同じ形。サーバー専用のファイルを読まないよう、ここでも持つ） */
export interface BookingCancelRow {
  received: string
  date: string
  source: string
  visitType: string
  status: string
}

export interface RateCell {
  key: string
  label: string
  total: number
  cancelled: number
  /** キャンセル率（%・小数1けた）。0件なら null */
  rate: number | null
}

export interface BookingCancelStats {
  /** 数えた予約日の範囲（予約日が過ぎたもの） */
  from: string
  to: string
  total: number
  cancelled: number
  rate: number | null
  byMonth: RateCell[]
  byVisitType: RateCell[]
  byWeekday: RateCell[]
  bySource: RateCell[]
  /** 予約を受けてから予約日までの日数ごと */
  byLead: RateCell[]
}

const CANCELLED = 'キャンセル'
const COUNTED = new Set(['確定', '来院済み', CANCELLED])
const YMD = /^\d{4}-\d{2}-\d{2}$/
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

const rateOf = (cancelled: number, total: number): number | null => (total > 0 ? Math.round((cancelled / total) * 1000) / 10 : null)

function daysBetween(from: string, to: string): number {
  const a = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)))
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)))
  return Math.round((b - a) / 86_400_000)
}

/** 予約を受けてから予約日までの日数の区切り */
export const LEAD_BANDS: Array<{ key: string; label: string; min: number; max: number }> = [
  { key: 'd0', label: '当日の予約', min: 0, max: 0 },
  { key: 'd1', label: '1〜3日前の予約', min: 1, max: 3 },
  { key: 'd4', label: '4〜7日前の予約', min: 4, max: 7 },
  { key: 'd8', label: '8〜14日前の予約', min: 8, max: 14 },
  { key: 'd15', label: '15日以上前の予約', min: 15, max: Infinity },
]

export function visitTypeLabel(v: string): string {
  if (v.startsWith('初')) return '初めての方'
  if (v) return '2回目以降の方'
  return '院で登録した予約'
}

/**
 * 予約日が過ぎた予約（今日より前）のキャンセル率。
 * 受け付けた日が集計の範囲（予約システムは最長120日）に入る予約だけなので、古い月は少なめに出ることがある
 */
export function bookingCancelStats(rows: BookingCancelRow[], today: string, labelSource: (source: string) => string = (s) => s): BookingCancelStats {
  const past = rows.filter((r) => YMD.test(r.date) && r.date < today && COUNTED.has(r.status))
  const cells = new Map<string, Map<string, { label: string; total: number; cancelled: number }>>()
  const add = (group: string, key: string, label: string, cancelled: boolean) => {
    const g = cells.get(group) ?? new Map()
    const c = g.get(key) ?? { label, total: 0, cancelled: 0 }
    c.total += 1
    if (cancelled) c.cancelled += 1
    g.set(key, c)
    cells.set(group, g)
  }
  let from = ''
  let to = ''
  let cancelledAll = 0
  for (const r of past) {
    const cancelled = r.status === CANCELLED
    if (cancelled) cancelledAll += 1
    if (!from || r.date < from) from = r.date
    if (!to || r.date > to) to = r.date
    add('month', r.date.slice(0, 7), `${Number(r.date.slice(5, 7))}月`, cancelled)
    const vt = visitTypeLabel(String(r.visitType || ''))
    add('visit', vt, vt, cancelled)
    const wd = new Date(`${r.date}T00:00:00Z`).getUTCDay()
    add('weekday', String(wd), WEEKDAYS[wd], cancelled)
    const src = r.source || 'direct'
    add('source', src, labelSource(src), cancelled)
    if (YMD.test(r.received)) {
      const lead = Math.max(0, daysBetween(r.received, r.date))
      const band = LEAD_BANDS.find((b) => lead >= b.min && lead <= b.max)
      if (band) add('lead', band.key, band.label, cancelled)
    }
  }
  const list = (group: string, order?: string[]): RateCell[] => {
    const g = cells.get(group) ?? new Map()
    const keys = order ? order.filter((k) => g.has(k)) : [...g.keys()]
    return keys.map((key) => {
      const c = g.get(key)!
      return { key, label: c.label, total: c.total, cancelled: c.cancelled, rate: rateOf(c.cancelled, c.total) }
    })
  }
  const months = [...(cells.get('month')?.keys() ?? [])].sort()
  const bySource = list('source').sort((a, b) => b.total - a.total)
  return {
    from,
    to,
    total: past.length,
    cancelled: cancelledAll,
    rate: rateOf(cancelledAll, past.length),
    byMonth: list('month', months),
    byVisitType: list('visit', ['初めての方', '2回目以降の方', '院で登録した予約']),
    byWeekday: list('weekday', ['1', '2', '3', '4', '5', '6', '0']),
    bySource,
    byLead: list('lead', LEAD_BANDS.map((b) => b.key)),
  }
}

// ── B. カルテのキャンセルの記録 ─────────────────────

export const KIND_LABELS: Record<CancellationKind, string> = {
  advance: '予約日前に連絡',
  same_day: '当日に連絡',
  no_show: '無断（連絡なし）',
}

/** 理由の分け方（カルテの「理由」のボタンと同じ。ほかの言葉は「その他」、空は「記録なし」） */
export const REASON_GROUPS = ['体調不良', '仕事の都合', '家族の用事', '交通・天候', '症状が改善', 'その他', '記録なし'] as const

export function reasonGroup(reason: string): (typeof REASON_GROUPS)[number] {
  const r = String(reason || '').trim()
  if (!r) return '記録なし'
  const hit = REASON_GROUPS.find((g) => g !== 'その他' && g !== '記録なし' && r.includes(g))
  return hit ?? 'その他'
}

/** 何日前に連絡があったか */
export function noticeBand(record: Pick<CancellationRecord, 'kind' | 'contactedDate' | 'appointmentDate'>): string {
  if (record.kind === 'no_show' || !YMD.test(record.contactedDate) || !YMD.test(record.appointmentDate)) return '連絡なし（無断）'
  const d = daysBetween(record.contactedDate, record.appointmentDate)
  if (d <= 0) return '当日'
  if (d === 1) return '前日'
  if (d <= 3) return '2〜3日前'
  return '4日以上前'
}
export const NOTICE_ORDER = ['4日以上前', '2〜3日前', '前日', '当日', '連絡なし（無断）']

export interface KarteCancelStats {
  from: string
  to: string
  total: number
  byKind: Record<CancellationKind, number>
  reasons: Array<{ label: string; count: number }>
  notice: Array<{ label: string; count: number }>
  /** 期間の中で2回以上キャンセルした方（多い順） */
  repeaters: Array<{ patientId: string; name: string; count: number; last: string; linked: boolean }>
  /** キャンセルした方（人数）のうち、LINE 連携している・していない */
  people: { linked: number; notLinked: number }
}

/**
 * カルテのキャンセルの記録（数えるものだけ＝入力ミス・院側の都合は除く）を、予約日が from〜to のものだけ数える
 */
export function karteCancelStats(
  records: CancellationRecord[],
  nameOf: (patientId: string) => string,
  isLinked: (patientId: string) => boolean,
  from: string,
  to: string,
): KarteCancelStats {
  const list = records.filter((r) => !r.excludedAs && YMD.test(r.appointmentDate) && r.appointmentDate >= from && r.appointmentDate <= to)
  const byKind: Record<CancellationKind, number> = { advance: 0, same_day: 0, no_show: 0 }
  const reasons = new Map<string, number>()
  const notice = new Map<string, number>()
  const perPatient = new Map<string, { count: number; last: string }>()
  for (const r of list) {
    if (r.kind in byKind) byKind[r.kind] += 1
    const g = reasonGroup(r.reason)
    reasons.set(g, (reasons.get(g) ?? 0) + 1)
    const n = noticeBand(r)
    notice.set(n, (notice.get(n) ?? 0) + 1)
    const p = perPatient.get(r.patientId) ?? { count: 0, last: '' }
    p.count += 1
    if (r.appointmentDate > p.last) p.last = r.appointmentDate
    perPatient.set(r.patientId, p)
  }
  let linked = 0
  let notLinked = 0
  for (const id of perPatient.keys()) {
    if (isLinked(id)) linked += 1
    else notLinked += 1
  }
  return {
    from,
    to,
    total: list.length,
    byKind,
    reasons: REASON_GROUPS.filter((g) => reasons.has(g)).map((g) => ({ label: g, count: reasons.get(g)! })).sort((a, b) => b.count - a.count),
    notice: NOTICE_ORDER.filter((n) => notice.has(n)).map((n) => ({ label: n, count: notice.get(n)! })),
    repeaters: [...perPatient.entries()]
      .filter(([, v]) => v.count >= 2)
      .map(([patientId, v]) => ({ patientId, name: nameOf(patientId), count: v.count, last: v.last, linked: isLinked(patientId) }))
      .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last)),
    people: { linked, notLinked },
  }
}

// ── 気づき（数字を言葉にするだけ） ───────────────────

/** くらべるのに要る件数（これより少ない組はくらべない） */
export const MIN_GROUP = 10

export function cancelInsights(booking: BookingCancelStats | null, karte: KarteCancelStats | null): string[] {
  const out: string[] = []
  const pct = (v: number | null) => `${v ?? 0}%`
  if (booking && booking.rate !== null && booking.total >= MIN_GROUP) {
    const overall = booking.rate
    // 曜日：全体より5ポイント以上高い曜日
    const highDays = booking.byWeekday.filter((c) => c.total >= MIN_GROUP && c.rate !== null && c.rate >= overall + 5)
    if (highDays.length) out.push(`${highDays.map((c) => `${c.label}曜（${pct(c.rate)}）`).join('・')}は、キャンセル率が全体（${pct(overall)}）より高めです。`)
    // 初めて／2回目以降
    const first = booking.byVisitType.find((c) => c.key === '初めての方')
    const repeat = booking.byVisitType.find((c) => c.key === '2回目以降の方')
    if (first && repeat && first.total >= MIN_GROUP && repeat.total >= MIN_GROUP && first.rate !== null && repeat.rate !== null && Math.abs(first.rate - repeat.rate) >= 5) {
      out.push(`初めての方のキャンセル率は ${pct(first.rate)}、2回目以降の方は ${pct(repeat.rate)} です。`)
    }
    // 予約を受けてから予約日まで
    const near = booking.byLead.filter((c) => c.key === 'd0' || c.key === 'd1')
    const far = booking.byLead.filter((c) => c.key === 'd8' || c.key === 'd15')
    const sum = (cs: RateCell[]) => cs.reduce((a, c) => ({ total: a.total + c.total, cancelled: a.cancelled + c.cancelled }), { total: 0, cancelled: 0 })
    const n = sum(near)
    const f = sum(far)
    const nr = rateOf(n.cancelled, n.total)
    const fr = rateOf(f.cancelled, f.total)
    if (n.total >= MIN_GROUP && f.total >= MIN_GROUP && nr !== null && fr !== null && fr - nr >= 5) {
      out.push(`8日以上前に取った予約のキャンセル率（${pct(fr)}）は、3日以内に取った予約（${pct(nr)}）より高めです。先の予約ほど、前日のお知らせが届くことが大事です。`)
    }
  }
  if (karte && karte.total >= 5) {
    const noShowShare = Math.round((karte.byKind.no_show / karte.total) * 100)
    if (noShowShare >= 20) out.push(`カルテの記録では、キャンセルの ${noShowShare}% が無断（連絡なし）です。「今日」の画面で、前日のお知らせが届かない方を確かめてみてください。`)
    const sameDayShare = Math.round((karte.byKind.same_day / karte.total) * 100)
    if (sameDayShare >= 30) out.push(`カルテの記録では、キャンセルの ${sameDayShare}% が当日の連絡です。`)
    const people = karte.people.linked + karte.people.notLinked
    if (people >= 5) {
      const share = Math.round((karte.people.notLinked / people) * 100)
      if (share >= 60) out.push(`キャンセルした方 ${people}名のうち ${share}% は LINE 連携がありません。受付での LINE 連携（カルテのQR）で、前日のお知らせが届く方を増やせます。`)
    }
    const top = karte.reasons.find((r) => r.label !== '記録なし' && r.label !== 'その他')
    if (top && top.count >= 3) out.push(`理由でいちばん多いのは「${top.label}」（${top.count}件）です。`)
    const none = karte.reasons.find((r) => r.label === '記録なし')
    if (none && none.count / karte.total >= 0.5) out.push('キャンセルの半分以上は理由の記録がありません。カルテの「キャンセル」で理由を選んでおくと、手の打ち方が分かりやすくなります。')
  }
  return out
}
