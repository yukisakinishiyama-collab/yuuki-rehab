/**
 * 予約画面の進み具合（ネット予約の画面で、どこまで進んだか）の集計（純粋な関数）
 *
 * 予約システム（GAS v3.17〜）が、予約画面の段階ごとの「回数」だけを 日付×流入元 で数えている
 * （お名前・電話番号などは数えない。hubstats の funnel）。数え始めは 2026-11-12 の夜。
 *
 * 段階（予約画面を1回開くごとに、同じ段階は1度だけ数える）:
 *   open    … 予約画面を開いた
 *   time    … 時間を選んだ
 *   info    … お客様情報の画面を開いた
 *   first / repeat … お客様情報を入れ終えた（「初めて」／「2回目以降」）
 *   intake  … 問診の画面を開いた（初めての方・新しいケガのときだけ出る）
 *   confirm … 確認の画面を開いた
 *   done    … 予約が確定した
 *   fee     … 「料金の目安」を開いた（寄り道。進み具合の段には入れない）
 *
 * 数えているのは人数ではなく回数（同じ方が開き直すと、もう1回と数える。院での動作確認も入る）。
 */
import { sourceLabel } from './booking-stats-labels'

export const FUNNEL_KEYS = ['open', 'time', 'info', 'first', 'repeat', 'intake', 'confirm', 'done', 'fee'] as const
export type FunnelKey = (typeof FUNNEL_KEYS)[number]
export type FunnelCounts = Record<FunnelKey, number>

export interface FunnelRow extends FunnelCounts {
  /** 'YYYY-MM-DD'（日本時間） */
  date: string
  /** 流入元（instagram / google_post / google_profile / line / website / flyer / direct） */
  source: string
}

const zero = (): FunnelCounts => ({ open: 0, time: 0, info: 0, first: 0, repeat: 0, intake: 0, confirm: 0, done: 0, fee: 0 })

/** 予約システムから受け取った funnel を確かめて読む。古い予約システム（funnel 無し）は undefined */
export function readFunnel(value: unknown): FunnelRow[] | undefined {
  if (!Array.isArray(value)) return undefined
  const rows: FunnelRow[] = []
  for (const item of value.slice(0, 5000)) {
    if (!item || typeof item !== 'object') continue
    const v = item as Record<string, unknown>
    if (typeof v.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.date)) continue
    const source = typeof v.source === 'string' && /^[a-z_]{1,30}$/.test(v.source) ? v.source : 'direct'
    const row: FunnelRow = { date: v.date, source, ...zero() }
    for (const key of FUNNEL_KEYS) {
      const n = Number(v[key])
      row[key] = Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 1_000_000) : 0
    }
    rows.push(row)
  }
  return rows
}

/** 進み具合の段（上から順に進む） */
export const FUNNEL_STAGES: Array<{ key: string; label: string; count: (c: FunnelCounts) => number }> = [
  { key: 'open', label: '予約画面を開いた', count: (c) => c.open },
  { key: 'time', label: '時間を選んだ', count: (c) => c.time },
  { key: 'info', label: 'お客様情報の画面まで進んだ', count: (c) => c.info },
  { key: 'filled', label: 'お客様情報を入れ終えた', count: (c) => c.first + c.repeat },
  { key: 'confirm', label: '確認の画面まで進んだ', count: (c) => c.confirm },
  { key: 'done', label: '予約を確定した', count: (c) => c.done },
]

export interface FunnelStage {
  key: string
  label: string
  count: number
  /** 予約画面を開いた回数に対する割合（%・整数）。開いた回数が 0 なら null */
  ofOpen: number | null
  /** ひとつ前の段からの割合（%・整数）。最初の段・前の段が 0 なら null */
  ofPrev: number | null
}

export interface FunnelSummary {
  /** 数えた期間（データのある最初の日〜最後の日） */
  from: string
  to: string
  total: FunnelCounts
  stages: FunnelStage[]
  /** いちばん減っている段（前の段から次の段へ進まなかった回数がいちばん多いところ）。回数が少ないうちは null */
  biggestDrop: { from: string; to: string; fromCount: number; toCount: number; lost: number } | null
  sources: Array<{ source: string; label: string; open: number; time: number; filled: number; done: number; fee: number; doneRate: number | null }>
}

const pct = (n: number, base: number): number | null => (base > 0 ? Math.round((n / base) * 100) : null)

/** いちばん減っている段を言うのに要る、予約画面を開いた回数（少ないうちは、たまたまの差が大きい） */
export const FUNNEL_MIN_OPENS = 10

/** since（'YYYY-MM-DD'）以降の行を合計する。行が無ければ null（まだ数えていない・予約システムが古い） */
export function summarizeFunnel(rows: FunnelRow[] | undefined, since: string): FunnelSummary | null {
  const used = (rows ?? []).filter((r) => r.date >= since)
  if (used.length === 0) return null
  const total = zero()
  const bySource = new Map<string, FunnelCounts>()
  let from = used[0].date
  let to = used[0].date
  for (const row of used) {
    if (row.date < from) from = row.date
    if (row.date > to) to = row.date
    const entry = bySource.get(row.source) ?? zero()
    for (const key of FUNNEL_KEYS) {
      total[key] += row[key]
      entry[key] += row[key]
    }
    bySource.set(row.source, entry)
  }
  const stages: FunnelStage[] = FUNNEL_STAGES.map((stage, i) => {
    const count = stage.count(total)
    const prev = i > 0 ? FUNNEL_STAGES[i - 1].count(total) : 0
    return { key: stage.key, label: stage.label, count, ofOpen: pct(count, total.open), ofPrev: i > 0 ? pct(count, prev) : null }
  })
  let biggestDrop: FunnelSummary['biggestDrop'] = null
  if (total.open >= FUNNEL_MIN_OPENS) {
    for (let i = 1; i < stages.length; i++) {
      const lost = stages[i - 1].count - stages[i].count
      if (lost > 0 && (!biggestDrop || lost > biggestDrop.lost)) {
        biggestDrop = { from: stages[i - 1].label, to: stages[i].label, fromCount: stages[i - 1].count, toCount: stages[i].count, lost }
      }
    }
  }
  const sources = [...bySource.entries()]
    .map(([source, c]) => ({ source, label: sourceLabel(source), open: c.open, time: c.time, filled: c.first + c.repeat, done: c.done, fee: c.fee, doneRate: pct(c.done, c.open) }))
    .sort((a, b) => b.open - a.open || b.done - a.done)
  return { from, to, total, stages, biggestDrop, sources }
}
