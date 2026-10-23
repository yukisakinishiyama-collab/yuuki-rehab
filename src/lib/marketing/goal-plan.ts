/**
 * 「月の売上の目標（例：300万円）への道すじ」の計算（純粋関数のみ。外部通信・保存はしない）
 *
 * NOAH の日別集計（来院数・金額・区分ごとの内訳）だけを使う。患者さんの個人情報は扱わない。
 * 数字はすべて「目安」。祝日や臨時の休診は、まだ来ていない日については考えていない（日曜だけ休みとして数える）。
 *
 * 売上の式：売上 ＝ 来院数 × 1回あたり
 *   来院は NOAH の区分で「保険など（保険・労災・保険外）」「自費・商品」「交通事故」に分かれる（区分の合計＝全体）。
 *   保険の1回あたりは決まった料金で動かしにくいので、試算では
 *   「1日の来院数」「自費・商品の割合」「自費・商品の1回あたり」「交通事故の来院」の4つを動かす。
 *   NOAH に入らない収入（アルファノートのサブスクなど）は「NOAH以外の収入（月）」として足す。
 *
 * 型の import だけにしてあるので、node（22.18+）で .ts のまま単体テストできる。
 */
import type { NoahMonth, NoahRepeat } from './noah-types'

const pad = (n: number) => String(n).padStart(2, '0')

// noah-analysis と同じ小さな計算（node の単体テストで .ts を読むため、値の import をしない）
function weekdayOfDate(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** 1日の行：[日, 来院, 金額, 保険人, 保険金額, 自費人, 自費金額, 保険外人, 保険外金額, 事故人, 事故金額, 労災人, 労災金額] */
function monthPoints(m: NoahMonth) {
  return m.days.map((r) => ({
    visits: r[1],
    sales: r[2],
    ins: [r[3], r[4]],
    self: [r[5], r[6]],
    nonIns: [r[7], r[8]],
    acc: [r[9], r[10]],
    work: [r[11], r[12]],
  }))
}

export const DEFAULT_GOAL = 3_000_000

export interface KindTotals {
  key: 'ins' | 'self' | 'acc'
  label: string
  visits: number
  sales: number
  perVisit: number
  shareVisits: number
  shareSales: number
}

export interface Baseline {
  month: string
  asOf: string
  complete: boolean
  /** 来院のあった日（ここまで） */
  openDaysSoFar: number
  /** この月の営業日の見込み（ここまでの来院のあった日＋残りの月〜土） */
  openDaysMonth: number
  /** ここまでの合計 */
  visits: number
  sales: number
  perDay: number
  perVisit: number
  /** 月末までの見込み（ここまでの1日平均 × 残りの営業日） */
  projectedVisits: number
  projectedSales: number
  kinds: KindTotals[]
  /** 記録のある月の中で、来院がいちばん多かった日の人数（受けられる人数の目安） */
  maxDayVisits: number
  repeat?: NoahRepeat
  /** 新患＋再初検（画面で読めた月だけ） */
  newcomers: number | null
  /** いちばん新しい「月が終わっている」月 */
  lastComplete: { month: string; visits: number; sales: number } | null
}

export function isCompleteMonth(m: NoahMonth): boolean {
  return m.asOf === `${m.month}-${pad(daysInMonth(m.month))}`
}

function sumMonth(m: NoahMonth) {
  const pts = monthPoints(m)
  const t = { visits: 0, sales: 0, insV: 0, insS: 0, selfV: 0, selfS: 0, accV: 0, accS: 0, openDays: 0, maxDay: 0 }
  for (const p of pts) {
    t.visits += p.visits
    t.sales += p.sales
    // 保険など ＝ 保険＋労災＋保険外（どれも保険の決まった料金に近い区分）
    t.insV += p.ins[0] + p.work[0] + p.nonIns[0]
    t.insS += p.ins[1] + p.work[1] + p.nonIns[1]
    t.selfV += p.self[0]
    t.selfS += p.self[1]
    t.accV += p.acc[0]
    t.accS += p.acc[1]
    if (p.visits > 0) t.openDays += 1
    t.maxDay = Math.max(t.maxDay, p.visits)
  }
  return t
}

/** 月の中で、date より後の月〜土の日数（日曜は休みとして数えない） */
export function remainingWeekdays(month: string, afterDay: number): number {
  let n = 0
  for (let d = afterDay + 1; d <= daysInMonth(month); d++) {
    if (weekdayOfDate(`${month}-${pad(d)}`) !== 0) n += 1
  }
  return n
}

const div = (a: number, b: number) => (b > 0 ? a / b : 0)

/** 月ごとの集計（新しい月が先頭）から、いまの位置を出す */
export function baseline(months: NoahMonth[]): Baseline | null {
  const sorted = [...months].sort((a, b) => b.month.localeCompare(a.month))
  const current = sorted[0]
  if (!current || current.days.length === 0) return null
  const t = sumMonth(current)
  if (t.visits <= 0) return null
  const complete = isCompleteMonth(current)
  const lastDay = Number(current.asOf.slice(8, 10))
  const remaining = complete ? 0 : remainingWeekdays(current.month, lastDay)
  const openDaysMonth = t.openDays + remaining
  const perDay = div(t.visits, t.openDays)
  const perVisit = div(t.sales, t.visits)
  const projectedVisits = Math.round(t.visits + perDay * remaining)
  const projectedSales = Math.round(t.sales + div(t.sales, t.openDays) * remaining)
  const kind = (key: KindTotals['key'], label: string, v: number, s: number): KindTotals => ({
    key,
    label,
    visits: v,
    sales: s,
    perVisit: div(s, v),
    shareVisits: div(v, t.visits),
    shareSales: div(s, t.sales),
  })
  const maxDayVisits = Math.max(...sorted.map((m) => sumMonth(m).maxDay))
  const lc = sorted.find(isCompleteMonth)
  const lcTotals = lc ? sumMonth(lc) : null
  const repeat = current.repeat
  const newcomers =
    repeat && (typeof repeat.newPt === 'number' || typeof repeat.reinit === 'number')
      ? (repeat.newPt ?? 0) + (repeat.reinit ?? 0)
      : null
  return {
    month: current.month,
    asOf: current.asOf,
    complete,
    openDaysSoFar: t.openDays,
    openDaysMonth,
    visits: t.visits,
    sales: t.sales,
    perDay,
    perVisit,
    projectedVisits,
    projectedSales,
    kinds: [
      kind('ins', '保険など', t.insV, t.insS),
      kind('self', '自費・商品', t.selfV, t.selfS),
      kind('acc', '交通事故', t.accV, t.accS),
    ],
    maxDayVisits,
    repeat,
    newcomers,
    lastComplete: lc && lcTotals ? { month: lc.month, visits: lcTotals.visits, sales: lcTotals.sales } : null,
  }
}

// ── 試算 ─────────────────────────────────────────────

export interface SimInput {
  /** 1か月の営業日 */
  days: number
  /** 1日の来院数（交通事故も含めた全体） */
  perDay: number
  /** 交通事故の来院（回／月） */
  accVisits: number
  /** 交通事故の1回あたり */
  accUnit: number
  /** 交通事故以外の来院のうち、自費・商品の割合（0〜1） */
  selfShare: number
  /** 自費・商品の1回あたり */
  selfUnit: number
  /** 保険などの1回あたり（決まった料金なので試算では動かさない） */
  insUnit: number
  /** NOAH以外の収入（アルファノートのサブスクなど。QR・カードのうちNOAHと重ならない分も含む）円／月 */
  extra: number
}

export interface SimResult {
  visits: number
  selfVisits: number
  insVisits: number
  accVisits: number
  /** NOAHの分（来院による売上） */
  noahSales: number
  /** NOAH以外の収入 */
  extra: number
  /** 合計（NOAH＋NOAH以外） */
  sales: number
  /** NOAHの分の1回あたり */
  perVisit: number
}

export function simulate(i: SimInput): SimResult {
  const visits = Math.max(0, i.perDay * i.days)
  const accVisits = Math.min(Math.max(0, i.accVisits), visits)
  const rest = visits - accVisits
  const share = Math.min(1, Math.max(0, i.selfShare))
  const selfVisits = rest * share
  const insVisits = rest - selfVisits
  const noahSales = selfVisits * i.selfUnit + insVisits * i.insUnit + accVisits * i.accUnit
  const extra = Math.max(0, i.extra || 0)
  return { visits, selfVisits, insVisits, accVisits, noahSales, extra, sales: noahSales + extra, perVisit: div(noahSales, visits) }
}

/** いまの数字（月末の見込み）をそのまま試算の初期値にする */
export function simDefaults(b: Baseline, extra = 0): SimInput {
  const ins = b.kinds.find((k) => k.key === 'ins')!
  const self = b.kinds.find((k) => k.key === 'self')!
  const acc = b.kinds.find((k) => k.key === 'acc')!
  const scale = div(b.projectedVisits, b.visits) || 1
  const nonAcc = ins.visits + self.visits
  return {
    days: b.openDaysMonth,
    perDay: round1(b.perDay),
    accVisits: Math.round(acc.visits * scale),
    accUnit: Math.round(acc.perVisit),
    selfShare: round2(div(self.visits, nonAcc)),
    selfUnit: Math.round(self.perVisit),
    insUnit: Math.round(ins.perVisit),
    extra: Math.max(0, Math.round(extra)),
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100

export interface Requirement {
  /** 1回あたりはそのままで、来院だけで届かせる */
  visitsOnly: { visits: number; perDay: number; ratio: number }
  /** 来院はそのままで、自費・商品の1回あたりだけで届かせる（null は来院が0で計算できない） */
  selfUnitOnly: { selfUnit: number; ratio: number } | null
  /** 来院・自費の1回あたり・交通事故を同じ割合ずつ上げる */
  balanced: { k: number; input: SimInput; result: SimResult }
}

/** 目標に届くための数字（3通り） */
export function requirement(goal: number, base: SimInput): Requirement {
  const now = simulate(base)
  const perVisit = now.perVisit || 1
  // NOAH以外の収入はそのまま足すので、来院で届かせる分は goal − extra
  const visits = Math.max(0, goal - now.extra) / perVisit
  const selfFixed = now.insVisits * base.insUnit + now.accVisits * base.accUnit + now.extra
  const selfUnit = now.selfVisits > 0 ? (goal - selfFixed) / now.selfVisits : null
  const k = solveBalanced(goal, base)
  const input = scaleInput(base, k)
  return {
    visitsOnly: { visits, perDay: div(visits, base.days), ratio: div(visits, now.visits) },
    selfUnitOnly: selfUnit === null ? null : { selfUnit, ratio: div(selfUnit, base.selfUnit) },
    balanced: { k, input, result: simulate(input) },
  }
}

/** 倍率 k をかける（丸めで目標をわずかに下回らないよう、切り上げる） */
export function scaleInput(base: SimInput, k: number): SimInput {
  if (k === 1) return { ...base }
  return {
    ...base,
    perDay: Math.ceil(base.perDay * k * 10 - 1e-9) / 10,
    accVisits: Math.ceil(base.accVisits * k - 1e-9),
    selfUnit: Math.ceil((base.selfUnit * k) / 10 - 1e-9) * 10,
  }
}

/** 来院・自費の1回あたり・交通事故を同じ倍率 k で上げて目標に届く k（1〜5の範囲、届かなければ5） */
export function solveBalanced(goal: number, base: SimInput): number {
  const f = (k: number) =>
    simulate({ ...base, perDay: base.perDay * k, accVisits: base.accVisits * k, selfUnit: base.selfUnit * k }).sales
  if (f(1) >= goal) return 1
  let lo = 1
  let hi = 5
  if (f(hi) < goal) return hi
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2
    if (f(mid) >= goal) hi = mid
    else lo = mid
  }
  return Math.round(hi * 1000) / 1000
}

// ── 道すじ（段階の目標） ────────────────────────────────

export type StageKey = 'keep' | 'new' | 'value' | 'capacity'

export interface Stage {
  key: StageKey
  title: string
  /** この段階で目ざす月の売上 */
  target: number
  /** この段階で上乗せする額 */
  add: number
  /** 上乗せを数字に直した目安 */
  measure: string
}

const STAGE_TITLES: Record<StageKey, string> = {
  keep: '続けて通っていただく（間があいた方への声かけ・次回予約）',
  new: '新しい方を増やす（Google・Instagram・LINE・紹介元との連携）',
  value: '自費メニューの価値を伝える（説明と同意のうえで）',
  capacity: '受けられる人数を広げる（予約枠・時間・人の体制）',
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step

/**
 * いまの見込みから目標までを4段に分ける。
 * 1〜2段目は来院、3段目は自費の1回あたり、4段目は残りを来院で（＝受けられる人数の見直しが要る）として、目安の数字にする。
 */
export function stages(goal: number, base: SimInput, maxDayVisits?: number): Stage[] {
  const now = simulate(base)
  const gap = goal - now.sales
  if (gap <= 0) return []
  const keys: StageKey[] = ['keep', 'new', 'value', 'capacity']
  const perVisit = now.perVisit || 1
  const out: Stage[] = []
  let prev = now.sales
  keys.forEach((key, i) => {
    const target = i === keys.length - 1 ? goal : Math.max(prev, roundTo(now.sales + (gap * (i + 1)) / keys.length, 50_000))
    const add = Math.max(0, target - prev)
    let measure: string
    if (key === 'value') {
      const per = now.selfVisits > 0 ? add / now.selfVisits : 0
      measure = `自費・商品の1回あたり +${fmt(per)}円（いまの来院のままで）`
    } else {
      const v = add / perVisit
      measure = `来院 +${fmt(v)}回／月（1日あたり +${fmt1(div(v, base.days))}人）`
    }
    if (key === 'capacity' && maxDayVisits) {
      // ここまでの段で増やした来院（1・2・4段）をすべて足した1日の人数が、これまでの最多の日を超えるか
      const visitStages = out.filter((st) => st.key !== 'value').reduce((sum, st) => sum + st.add, 0) + add
      const perDayAtEnd = base.perDay + div(visitStages / perVisit, base.days)
      if (perDayAtEnd > maxDayVisits) {
        measure += `。最後は1日 約${fmt1(perDayAtEnd)}人で、これまでの最多の日（${fmt(maxDayVisits)}人）を超えるため、予約枠・時間・人の体制の見直しが要ります`
      }
    }
    out.push({ key, title: STAGE_TITLES[key], target, add, measure })
    prev = target
  })
  return out
}

const fmt = (n: number) => Math.round(n).toLocaleString('ja-JP')
const fmt1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ja-JP')

// ── 気づき（データから言えること） ──────────────────────

export interface Insight {
  tone: 'info' | 'warn'
  text: string
}

export function insights(goal: number, b: Baseline, base: SimInput): Insight[] {
  const out: Insight[] = []
  const now = simulate(base)
  const req = requirement(goal, base)
  if (now.sales >= goal) {
    out.push({ tone: 'info', text: `今月の見込みは目標に届いています。この調子を続けましょう。` })
    return out
  }
  const extraText = now.extra > 0 ? `（NOAH 約${man(now.noahSales)}円＋NOAH以外 約${man(now.extra)}円）` : ''
  out.push({
    tone: 'info',
    text: `いまのペース（1日 約${fmt1(base.perDay)}人・1回あたり 約${fmt(now.perVisit)}円）だと、月末の見込みは 約${man(now.sales)}円${extraText}です。目標まで あと${man(goal - now.sales)}円。`,
  })
  if (req.visitsOnly.ratio > 1.5) {
    out.push({
      tone: 'warn',
      text: `来院だけで届かせると1日 約${fmt1(req.visitsOnly.perDay)}人（いまの${fmt1(req.visitsOnly.ratio)}倍）が必要です。これまでの最多の日は${fmt(b.maxDayVisits)}人なので、来院を増やすだけでは難しく、1回あたりと体制も合わせて見直す必要があります。`,
    })
  }
  if (req.balanced.k < 5) {
    out.push({
      tone: 'info',
      text: `来院・自費の1回あたり・交通事故をそろって ${fmt1(req.balanced.k)}倍 にすると届きます（1日 約${fmt1(req.balanced.input.perDay)}人、自費・商品 1回 約${fmt(req.balanced.input.selfUnit)}円）。`,
    })
  }
  const r = b.repeat
  if (r && typeof r.last === 'number' && typeof r.gone === 'number' && r.last > 0) {
    const cont = typeof r.goneCont === 'number' ? `（そのうち、治療を続けているはずの方 ${r.goneCont}人）` : ''
    out.push({
      tone: r.gone / r.last >= 0.4 ? 'warn' : 'info',
      text: `先月来られた${r.last}人のうち、今月まだ来られていない方が${r.gone}人${cont}。いちばん早く効くのは、この方々への声かけです。`,
    })
  }
  if (b.newcomers !== null) {
    out.push({ tone: 'info', text: `今月の初めての方（新患＋再初検）は${b.newcomers}人です。` })
  }
  return out
}

export const man = (n: number) =>
  Math.abs(n) >= 10_000 ? `${(Math.round(n / 1000) / 10).toLocaleString('ja-JP')}万` : fmt(n)
