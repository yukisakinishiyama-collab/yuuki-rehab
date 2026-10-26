/**
 * 患者さんの動き（離反・リピート）の計算（純粋関数。画面とテストから使う）
 *
 * - カルテ（端末の localStorage）から「最後に来た日」を出し、何日空いているかで分ける
 * - NOAH の月ごとの「リピート率」（先月来た人のうち今月まだ来ていない人 など）を月ごとに並べる
 * この画面は院内だけで見る。外部には何も送らない。
 */
import type { NoahMonth } from './noah-types'

export interface PatientLike {
  id: string
  name: string
  phone: string
  status: string
  firstVisitDate?: string
  noah?: { lastVisit?: string; visitCount?: number }
}

export interface VisitLike {
  patientId: string
  /** 'YYYY-MM-DD' */
  visitDate: string
}

export interface PatientGap {
  id: string
  name: string
  phone: string
  lastVisit: string | null
  /** 空いている日数（最後の来院が無ければ null） */
  days: number | null
  visits: number
}

export type GapBand = 'active' | 'w2' | 'm1' | 'm2' | 'm3plus' | 'none'

export const BANDS: Array<{ key: GapBand; label: string; hint: string }> = [
  { key: 'active', label: '2週間以内', hint: '通院中' },
  { key: 'w2', label: '2〜4週間', hint: 'そろそろ声かけ' },
  { key: 'm1', label: '1〜2か月', hint: '途切れかけ' },
  { key: 'm2', label: '2〜3か月', hint: '離れつつある' },
  { key: 'm3plus', label: '3か月以上', hint: '離れた方' },
  { key: 'none', label: '来院の記録なし', hint: 'カルテに来院日が無い' },
]

export function bandOf(days: number | null): GapBand {
  if (days === null) return 'none'
  if (days <= 14) return 'active'
  if (days <= 28) return 'w2'
  if (days <= 60) return 'm1'
  if (days <= 90) return 'm2'
  return 'm3plus'
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

/** 患者さんごとの「最後に来た日」と空いた日数（SOAP・来院記録・NOAHの最終来院の、いちばん新しい日） */
export function patientGaps(patients: PatientLike[], visits: VisitLike[], today: string): PatientGap[] {
  const last = new Map<string, string>()
  const count = new Map<string, number>()
  for (const v of visits) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.visitDate) || v.visitDate > today) continue
    count.set(v.patientId, (count.get(v.patientId) ?? 0) + 1)
    const cur = last.get(v.patientId)
    if (!cur || v.visitDate > cur) last.set(v.patientId, v.visitDate)
  }
  return patients
    .filter((p) => p.status === 'active' || p.status === 'inactive')
    .map((p) => {
      const candidates = [last.get(p.id), p.noah?.lastVisit, p.firstVisitDate].filter((d): d is string => Boolean(d) && /^\d{4}-\d{2}-\d{2}$/.test(d!) && d! <= today)
      const lastVisit = candidates.length ? candidates.sort().at(-1)! : null
      return {
        id: p.id,
        name: p.name,
        phone: p.phone,
        lastVisit,
        days: lastVisit ? daysBetween(lastVisit, today) : null,
        visits: Math.max(count.get(p.id) ?? 0, p.noah?.visitCount ?? 0),
      }
    })
    .sort((a, b) => (b.days ?? -1) - (a.days ?? -1))
}

export function countBands(gaps: PatientGap[]): Record<GapBand, number> {
  const out: Record<GapBand, number> = { active: 0, w2: 0, m1: 0, m2: 0, m3plus: 0, none: 0 }
  for (const g of gaps) out[bandOf(g.days)] += 1
  return out
}

/** 声かけの候補：2〜8週間空いていて、来院が2回以上あった方（新しい順） */
export function callCandidates(gaps: PatientGap[], limit = 20): PatientGap[] {
  return gaps
    .filter((g) => g.days !== null && g.days > 14 && g.days <= 56 && g.visits >= 2)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))
    .slice(0, limit)
}

export interface RepeatRow {
  month: string
  /** 先月来た人・そのうち今月まだ来ていない人 */
  last: number | null
  gone: number | null
  /** 継続率（1 − gone/last） */
  rate: number | null
  goneCont: number | null
  cured: number | null
  stopped: number | null
  moved: number | null
  selfGone: number | null
  newPt: number | null
  reinit: number | null
  /** 月末までの集計か */
  complete: boolean
}

export function repeatRows(months: NoahMonth[]): RepeatRow[] {
  return [...months]
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 13)
    .map((m) => {
      const r = m.repeat ?? {}
      const [y, mm] = m.month.split('-').map(Number)
      const dim = new Date(Date.UTC(y, mm, 0)).getUTCDate()
      const last = r.last ?? null
      const gone = r.gone ?? null
      return {
        month: m.month,
        last,
        gone,
        rate: last && gone !== null ? 1 - gone / last : null,
        goneCont: r.goneCont ?? null,
        cured: r.cured ?? null,
        stopped: r.stopped ?? null,
        moved: r.moved ?? null,
        selfGone: r.selfGone ?? null,
        newPt: r.newPt ?? null,
        reinit: r.reinit ?? null,
        complete: Number(m.asOf.slice(8, 10)) >= dim,
      }
    })
}
