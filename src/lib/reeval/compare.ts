// ──────────────────────────────────────────────
// 再評価：前回の正式な再評価のときの値と、今回の値を並べる（純粋な関数）
//
// 新しい評価項目は作らない。カルテにすでにある記録だけを使う：
//   SOAP の痛み（NRS）・アウトカム（pt_outcomes）・ROM・筋力・アウトカム評価（Lysholm など）・復帰基準テストの総合点
// 前回＝前回の再評価日までの、いちばん新しい値。今回＝前回の再評価日より後の、いちばん新しい値。
// 前回の再評価が無いときは、最初の値と最新の値を並べる。
// グラフは今までどおり各タブ（アウトカム・ROM・筋力・経過グラフ）で見る。ここは一覧だけ。
// ──────────────────────────────────────────────
import type { OutcomeRecord } from '@/types/contracts'
import type { ROMRecord, StrengthRecord, MMTGrade } from '@/types/patient'
import { getOutcomeMetric } from '@/data/outcome-metrics'

export interface ComparePoint {
  date: string
  value: number
  text: string
  /** 同じ日の中の順番（記録した時刻） */
  order: string
}

export interface CompareSeries {
  key: string
  group: string
  label: string
  better: 'high' | 'low' | null
  points: ComparePoint[]
}

export interface CompareRow {
  key: string
  group: string
  label: string
  prev: ComparePoint | null
  curr: ComparePoint | null
  /** 良い方向・悪い方向・変わらず（どちらかが無い、向きが決まらないときは null） */
  trend: 'better' | 'worse' | 'same' | null
}

const GROUP_ORDER = ['痛み', '腫れ', '可動域', '筋力', '筋力・LSI', '機能スコア', 'ホップ', 'バランス・競技動作', '機能評価', '復帰基準']

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

const STRENGTH_UNIT: Record<string, string> = { kg: 'kg', N: 'N', Nm: 'Nm', bw_ratio: '%（体重比）', contra_ratio: '%（健側比）' }
const SIDE: Record<string, string> = { right: '右', left: '左', bilateral: '両側', na: '' }
const MMT_VALUE: Record<string, number> = { '0': 0, '1': 1, '2': 2, '3': 3, '4-': 3.7, '4': 4, '4+': 4.3, '5-': 4.7, '5': 5 }

function mmtValue(g: MMTGrade | null): number | null {
  if (g === null || g === undefined) return null
  const v = MMT_VALUE[String(g)]
  return v === undefined ? null : v
}

function push(map: Map<string, CompareSeries>, s: Omit<CompareSeries, 'points'>, p: ComparePoint) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date) || !Number.isFinite(p.value)) return
  const hit = map.get(s.key)
  if (hit) hit.points.push(p)
  else map.set(s.key, { ...s, points: [p] })
}

export interface KarteSeriesInput {
  soapNotes?: Array<{ visitDate: string; painToday: number; createdAt: string }>
  outcomes?: OutcomeRecord[]
  rom?: ROMRecord[]
  strength?: StrengthRecord[]
  /** アウトカム評価（outcomeScores_v1）。名前・向きは呼ぶ側で入れる */
  scores?: Array<{ key: string; label: string; unit: string; higherIsBetter: boolean; date: string; total: number; createdAt: string }>
  /** 復帰基準テストの総合点 */
  returnTests?: Array<{ label: string; date: string; composite: number; createdAt: string }>
}

/** カルテの記録を、項目ごとの値の並びにする */
export function seriesFromKarte(input: KarteSeriesInput): CompareSeries[] {
  const map = new Map<string, CompareSeries>()

  for (const n of input.soapNotes ?? []) {
    if (typeof n.painToday !== 'number' || n.painToday < 0) continue
    push(map, { key: 'soap:nrs', group: '痛み', label: '痛み NRS（SOAP）', better: 'low' }, {
      date: n.visitDate, value: n.painToday, text: String(n.painToday), order: n.createdAt,
    })
  }

  for (const o of input.outcomes ?? []) {
    const m = getOutcomeMetric(o.metric)
    if (!m) continue
    const side = o.side?.trim()
    push(
      map,
      { key: `outcome:${o.metric}:${side ?? ''}`, group: m.group, label: side ? `${m.label}（${side}）` : m.label, better: m.better },
      { date: o.date, value: o.value, text: `${fmt(o.value)}${m.unit}`, order: o.createdAt },
    )
  }

  for (const r of input.rom ?? []) {
    const active = r.activeRom !== null && r.activeRom !== undefined
    const v = active ? r.activeRom : r.passiveRom
    if (v === null || v === undefined) continue
    const kind = active ? '自動' : '他動'
    const side = SIDE[r.side] ?? ''
    const unit = r.unit === 'cm' ? 'cm' : '°'
    push(
      map,
      {
        key: `rom:${r.joint}:${r.movement}:${r.side}:${kind}:${r.unit}`,
        group: '可動域',
        label: `${r.joint} ${r.movement}（${[side, kind].filter(Boolean).join('・')}）`,
        better: 'high',
      },
      { date: r.measuredDate, value: v, text: `${fmt(v)}${unit}`, order: r.createdAt },
    )
  }

  for (const s of input.strength ?? []) {
    const side = SIDE[s.side] ?? ''
    const name = `${s.muscleGroup}${s.movement ? ` ${s.movement}` : ''}`
    if (s.hhdValue !== null && s.hhdValue !== undefined && Number.isFinite(s.hhdValue)) {
      const unit = STRENGTH_UNIT[s.unit] ?? s.unit
      push(
        map,
        { key: `str:${s.muscleGroup}:${s.movement}:${s.side}:${s.unit}`, group: '筋力', label: `${name}${side ? `（${side}）` : ''}`, better: 'high' },
        { date: s.measuredDate, value: s.hhdValue, text: `${fmt(s.hhdValue)}${unit}`, order: s.createdAt },
      )
    } else {
      const mv = mmtValue(s.mmt)
      if (mv === null) continue
      push(
        map,
        { key: `mmt:${s.muscleGroup}:${s.movement}:${s.side}`, group: '筋力', label: `${name}${side ? `（${side}）` : ''} MMT`, better: 'high' },
        { date: s.measuredDate, value: mv, text: `MMT ${String(s.mmt)}`, order: s.createdAt },
      )
    }
  }

  for (const sc of input.scores ?? []) {
    push(
      map,
      { key: `score:${sc.key}`, group: '機能評価', label: sc.label, better: sc.higherIsBetter ? 'high' : 'low' },
      { date: sc.date, value: sc.total, text: `${fmt(sc.total)}${sc.unit}`, order: sc.createdAt },
    )
  }

  for (const rt of input.returnTests ?? []) {
    push(
      map,
      { key: `return:${rt.label}`, group: '復帰基準', label: rt.label, better: 'high' },
      { date: rt.date, value: rt.composite, text: `${fmt(rt.composite)}点`, order: rt.createdAt },
    )
  }

  return [...map.values()]
}

/** 前回の再評価日をはさんで、前回と今回を並べる */
export function compareSeries(series: CompareSeries[], lastDate: string | null): CompareRow[] {
  const rows: CompareRow[] = []
  for (const s of series) {
    const pts = [...s.points].sort((a, b) => a.date.localeCompare(b.date) || a.order.localeCompare(b.order))
    if (pts.length === 0) continue
    let prev: ComparePoint | null
    let curr: ComparePoint | null
    if (lastDate) {
      prev = [...pts].reverse().find((p) => p.date <= lastDate) ?? null
      curr = [...pts].reverse().find((p) => p.date > lastDate) ?? null
    } else {
      prev = pts[0]
      curr = pts.length > 1 ? pts[pts.length - 1] : null
    }
    if (!prev && !curr) continue
    let trend: CompareRow['trend'] = null
    if (prev && curr && s.better) {
      const diff = curr.value - prev.value
      trend = Math.abs(diff) < 1e-9 ? 'same' : (s.better === 'low' ? diff < 0 : diff > 0) ? 'better' : 'worse'
    }
    rows.push({ key: s.key, group: s.group, label: s.label, prev, curr, trend })
  }
  const g = (x: string) => {
    const i = GROUP_ORDER.indexOf(x)
    return i < 0 ? GROUP_ORDER.length : i
  }
  // 前回測った項目（今回も測りたいもの）を先に、同じなら群の順・名前の順
  return rows.sort((a, b) => Number(!a.prev) - Number(!b.prev) || g(a.group) - g(b.group) || a.label.localeCompare(b.label, 'ja'))
}

export const TREND_TEXT: Record<'better' | 'worse' | 'same', string> = {
  better: '良い方向',
  worse: '悪い方向',
  same: '変わらず',
}

/** 完了したときに履歴へ残す1行ずつの文 */
export function compareSummary(rows: CompareRow[]): string[] {
  return rows.slice(0, 30).map((r) => {
    if (r.prev && r.curr) {
      return `${r.label}：${r.prev.text}（${r.prev.date}）→ ${r.curr.text}（${r.curr.date}）${r.trend ? `・${TREND_TEXT[r.trend]}` : ''}`
    }
    if (r.curr) return `${r.label}：${r.curr.text}（${r.curr.date}）`
    return `${r.label}：前回 ${r.prev!.text}（${r.prev!.date}）・今回は測っていない`
  })
}
