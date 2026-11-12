/**
 * NOAH の日別集計の計算と、院長LINE「今日のまとめ」の文面（純粋関数のみ。外部通信・保存はしない）
 *
 * - 月ごとの集計のまとめ（新しいファイルで置きかえ）
 * - 最新日・今月累計・先月の同じ時期との比較・同じ曜日の平均
 * - 空きが多い日（投稿の下書きを作る日）の選び方
 * - 次の一手（集客の提案）
 *
 * 型の import だけにしてあるので、node（22.18+）で .ts のまま単体テストできる。
 */
import type { NoahMonth, NoahRepeat } from './noah-types'
import type { OpeningDay } from './autopilot-planner'

const WEEK = ['日', '月', '火', '水', '木', '金', '土']
const pad = (n: number) => String(n).padStart(2, '0')

export interface DayPoint {
  date: string
  day: number
  weekday: number
  visits: number
  sales: number
  ins: [number, number]
  self: [number, number]
  acc: [number, number]
  work: [number, number]
  nonIns: [number, number]
}

export function weekdayOfDate(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function prevMonthOf(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`
}

export function nextDate(date: string, days = 1): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** '2026-10-23' → '10/23（金）' */
export function dateLabel(date: string): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}（${WEEK[weekdayOfDate(date)]}）`
}

export const yen = (n: number) => `${Math.round(n).toLocaleString('ja-JP')}円`
export const people = (n: number) => `${Math.round(n).toLocaleString('ja-JP')}人`

export function monthPoints(m: NoahMonth): DayPoint[] {
  return m.days.map((r) => {
    const date = `${m.month}-${pad(r[0])}`
    return {
      date,
      day: r[0],
      weekday: weekdayOfDate(date),
      visits: r[1],
      sales: r[2],
      ins: [r[3], r[4]],
      self: [r[5], r[6]],
      nonIns: [r[7], r[8]],
      acc: [r[9], r[10]],
      work: [r[11], r[12]],
    }
  })
}

/** 月ごとに、集計日（asOf）→ 書き出し日時 の新しい方を残す。新しい月が先頭 */
export function mergeMonths(existing: NoahMonth[], incoming: NoahMonth[], keep = 36): NoahMonth[] {
  const byMonth = new Map<string, NoahMonth>()
  for (const m of [...existing, ...incoming]) {
    const current = byMonth.get(m.month)
    const newer =
      !current ||
      m.asOf > current.asOf ||
      (m.asOf === current.asOf && String(m.exportedAt) >= String(current.exportedAt))
    if (newer) byMonth.set(m.month, m)
  }
  return [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month)).slice(0, keep)
}

function sumPoints(points: DayPoint[]) {
  return points.reduce(
    (acc, p) => ({
      visits: acc.visits + p.visits,
      sales: acc.sales + p.sales,
      selfSales: acc.selfSales + p.self[1],
      openDays: acc.openDays + (p.visits > 0 ? 1 : 0),
    }),
    { visits: 0, sales: 0, selfSales: 0, openDays: 0 },
  )
}

const ratio = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

export interface PeriodTotals {
  month: string
  from: string
  to: string
  visits: number
  sales: number
  selfSales: number
  selfRatio: number
  openDays: number
}

export interface NightlySummary {
  /** 集計の最新日 */
  date: string
  today: DayPoint | null
  /** 同じ曜日（来院のあった日）の直近4回の平均来院数 */
  weekdayAvg: number | null
  weekdaySamples: number
  mtd: PeriodTotals
  /** 先月の同じ時期（1日〜同じ日まで） */
  prev: PeriodTotals | null
  repeat?: NoahRepeat
  /** 先月の最終の値（先月最後のファイル） */
  prevRepeat?: NoahRepeat
  /** 初回の方（新患＋再初検）。画面で読めた日だけ */
  newcomers: number | null
  prevNewcomers: number | null
}

/** 月の集計（新しい月が先頭）から、最新日のまとめを作る */
export function summarize(months: NoahMonth[]): NightlySummary | null {
  const sorted = [...months].sort((a, b) => b.month.localeCompare(a.month))
  const current = sorted[0]
  if (!current || current.days.length === 0) return null
  const date = current.asOf
  const points = monthPoints(current)
  const today = points.find((p) => p.date === date) ?? null
  const totals = sumPoints(points)
  const mtd: PeriodTotals = {
    month: current.month,
    from: `${current.month}-01`,
    to: date,
    ...totals,
    selfRatio: ratio(totals.selfSales, totals.sales),
  }

  const prevMonth = sorted.find((m) => m.month === prevMonthOf(current.month))
  let prev: PeriodTotals | null = null
  if (prevMonth) {
    const lastDay = Math.min(Number(date.slice(8, 10)), daysInMonth(prevMonth.month))
    const prevPoints = monthPoints(prevMonth).filter((p) => p.day <= lastDay)
    const complete = prevMonth.asOf >= `${prevMonth.month}-${pad(lastDay)}`
    if (complete && prevPoints.length > 0) {
      const t = sumPoints(prevPoints)
      prev = {
        month: prevMonth.month,
        from: `${prevMonth.month}-01`,
        to: `${prevMonth.month}-${pad(lastDay)}`,
        ...t,
        selfRatio: ratio(t.selfSales, t.sales),
      }
    }
  }

  let weekdayAvg: number | null = null
  let weekdaySamples = 0
  if (today) {
    const history = sorted
      .slice(0, 3)
      .flatMap(monthPoints)
      .filter((p) => p.date < date && p.weekday === today.weekday && p.visits > 0)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 4)
    weekdaySamples = history.length
    if (history.length >= 2) weekdayAvg = Math.round(history.reduce((s, p) => s + p.visits, 0) / history.length)
  }

  const newcomersOf = (r?: NoahRepeat) =>
    r && typeof r.newPt === 'number' && typeof r.reinit === 'number' ? r.newPt + r.reinit : null
  return {
    date,
    today,
    weekdayAvg,
    weekdaySamples,
    mtd,
    prev,
    repeat: current.repeat,
    prevRepeat: prevMonth?.repeat,
    newcomers: newcomersOf(current.repeat),
    prevNewcomers: prevMonth && prevMonth.asOf === `${prevMonth.month}-${pad(daysInMonth(prevMonth.month))}` ? newcomersOf(prevMonth.repeat) : null,
  }
}

/** 曜日ごとの平均来院数（月〜土。来院のあった日だけで平均。直近 weeks 週） */
export function weekdayAverages(months: NoahMonth[], endDate: string, weeks = 8) {
  const start = nextDate(endDate, -7 * weeks + 1)
  const points = months.flatMap(monthPoints).filter((p) => p.date >= start && p.date <= endDate && p.visits > 0)
  return [1, 2, 3, 4, 5, 6].map((weekday) => {
    const list = points.filter((p) => p.weekday === weekday)
    const avg = list.length > 0 ? list.reduce((s, p) => s + p.visits, 0) / list.length : null
    const sales = list.length > 0 ? list.reduce((s, p) => s + p.sales, 0) / list.length : null
    return { weekday, label: WEEK[weekday], avg, sales, samples: list.length }
  })
}

// ── 空きの多い日 ─────────────────────────────────────────────

/** 1日の予約枠の数（30分ごと。月〜金 10:00〜13:00・15:00〜20:00＝16、土 10:00〜15:00＝10） */
export function slotTimesFor(date: string): number {
  const wd = weekdayOfDate(date)
  if (wd === 0) return 0
  return wd === 6 ? 10 : 16
}

/** 空いている枠の割合（0〜1）。休診日は 0 */
export function freeRatio(day: OpeningDay): number {
  const total = slotTimesFor(day.date)
  if (day.closed || total === 0) return 0
  return Math.min(1, (day.am + day.pm) / total)
}

/**
 * 下書きを作る日：今日のあと最初の診療日（2日先まで）で、空きが minRatio 以上の日。無ければ null。
 * 1晩に1日だけ（毎晩の投稿が続きすぎないように）。
 */
export function pickDraftDay(openings: OpeningDay[], today: string, minRatio = 0.6): OpeningDay | null {
  const limit = nextDate(today, 2)
  const next = [...openings]
    .filter((d) => d.date > today && d.date <= limit && !d.closed && slotTimesFor(d.date) > 0)
    .sort((a, b) => a.date.localeCompare(b.date))[0]
  if (!next) return null
  return freeRatio(next) >= minRatio ? next : null
}

/** 翌診療日（2日先まで）の空き（LINEに載せる用。休診なら null） */
export function nextOpenDay(openings: OpeningDay[], today: string): OpeningDay | null {
  const limit = nextDate(today, 2)
  return (
    [...openings]
      .filter((d) => d.date > today && d.date <= limit && !d.closed && slotTimesFor(d.date) > 0)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  )
}

// ── 次の一手 ─────────────────────────────────────────────────

export interface SuggestionContext {
  /** 空きが多く、下書きの対象にした日 */
  draftDay: OpeningDay | null
  /** 下書きを実際に作れたか（自動投稿がオフ・今週の投稿案がない、などで作れないこともある） */
  draftMade: boolean
  /** 週1回だけ出す提案（曜日ごとの傾向）を出す日か */
  weekly: boolean
  weekdays?: ReturnType<typeof weekdayAverages>
}

export function suggestions(s: NightlySummary, ctx: SuggestionContext): string[] {
  const out: string[] = []
  const day = Number(s.date.slice(8, 10))

  if (ctx.draftDay && !ctx.draftMade) {
    out.push(
      `${dateLabel(ctx.draftDay.date)}は空きが多めです。Instagramのストーリーなどで空き案内を出すのも手です（自動投稿の下書きは今週の投稿案がないため作っていません）。`,
    )
  }

  const r = s.repeat
  if (r && typeof r.goneCont === 'number' && r.goneCont >= 3 && day >= 15) {
    out.push(
      `先月来院された方のうち、施術が続いているはずの${people(r.goneCont)}が今月まだ来ていません。NOAHの「分析→来院分析→リピート率」で「月間離反率」の「継続」の数字を押すと一覧が出ます（ハガキはラベル印刷）。`,
    )
  }

  if (s.newcomers !== null && s.prevNewcomers !== null && s.prevNewcomers >= 5) {
    const expected = Math.round((s.prevNewcomers * day) / daysInMonth(prevMonthOf(s.mtd.month)))
    if (expected >= 3 && s.newcomers < expected * 0.8) {
      out.push(
        `初回の方が先月より少ないペースです（今月${people(s.newcomers)}・先月の同じ時期の目安${people(expected)}）。次の投稿は「初めての方へ（初回の流れ・予約のしかた）」がおすすめです。自動投稿の「院長メモ」に書くと次の下書きに入ります。`,
      )
    }
  }

  if (ctx.weekly && ctx.weekdays) {
    const ranked = ctx.weekdays.filter((w) => w.avg !== null && w.samples >= 3 && w.weekday !== 6)
    if (ranked.length >= 3) {
      const low = [...ranked].sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))[0]
      const avgAll = ranked.reduce((sum, w) => sum + (w.avg ?? 0), 0) / ranked.length
      if (low.avg !== null && low.avg < avgAll * 0.85) {
        out.push(
          `来院が少なめの曜日は${low.label}曜です（直近8週の平均${people(low.avg)}・平日平均${people(avgAll)}）。前日の夜に${low.label}曜の空き案内を出してみてはいかがでしょう。`,
        )
      }
    }
  }

  return out.slice(0, 3)
}

const signedNum = (n: number) => (n > 0 ? `+${n}` : `${n}`)
function changeText(now: number, before: number, unit: 'people' | 'percent'): string {
  if (unit === 'people') return `${signedNum(now - before)}人`
  if (before <= 0) return '—'
  return `${signedNum(Math.round(((now - before) / before) * 100))}%`
}

export interface NightlyTextOptions {
  next: OpeningDay | null
  draftDay: OpeningDay | null
  draftMade: boolean
  tips: string[]
}

/** 院長LINEの「今日のまとめ」本文 */
export function nightlyText(s: NightlySummary, opt: NightlyTextOptions): string {
  const lines: string[] = []
  lines.push(`📊 ${dateLabel(s.date)}の締め（NOAH）`)
  if (s.today && s.today.visits > 0) {
    const t = s.today
    const parts = [
      t.ins[0] > 0 ? `保険${t.ins[0]}` : '',
      t.self[0] > 0 ? `自費${t.self[0]}` : '',
      t.acc[0] > 0 ? `交通事故${t.acc[0]}` : '',
      t.work[0] > 0 ? `労災${t.work[0]}` : '',
      t.nonIns[0] > 0 ? `保険外${t.nonIns[0]}` : '',
    ].filter(Boolean)
    lines.push(`来院 ${people(t.visits)}（${parts.join('・')}）`)
    lines.push(`金額 ${yen(t.sales)}（自費・商品 ${yen(t.self[1])}）`)
    if (s.weekdayAvg !== null) {
      const diff = t.visits - s.weekdayAvg
      const label = `いつもの${WEEK[t.weekday]}曜（直近${s.weekdaySamples}回の平均${people(s.weekdayAvg)}）`
      lines.push(diff === 0 ? `${label}と同じ` : `${label}より${Math.abs(diff)}人${diff > 0 ? '多め' : '少なめ'}`)
    }
  } else {
    lines.push('この日の来院の記録はありません（休診日など）')
  }

  lines.push('')
  lines.push(`【今月 ${Number(s.mtd.from.slice(5, 7))}/1〜${Number(s.mtd.to.slice(8, 10))}】`)
  lines.push(`来院 ${people(s.mtd.visits)}・金額 ${yen(s.mtd.sales)}`)
  if (s.prev) {
    lines.push(
      `先月の同じ時期より 来院${changeText(s.mtd.visits, s.prev.visits, 'people')}・金額${changeText(s.mtd.sales, s.prev.sales, 'percent')}`,
    )
  }
  lines.push(`自費・商品の割合 ${s.mtd.selfRatio}%${s.prev ? `（先月 ${s.prev.selfRatio}%）` : ''}`)
  if (s.newcomers !== null && s.repeat) {
    lines.push(`初回の方 ${people(s.newcomers)}（新患${s.repeat.newPt}・再初検${s.repeat.reinit}）`)
  }

  if (opt.next) {
    lines.push('')
    lines.push(`【${dateLabel(opt.next.date)}の空き】午前${opt.next.am}・午後${opt.next.pm}枠`)
    if (opt.draftDay && opt.draftMade && opt.draftDay.date === opt.next.date) {
      lines.push('→ 空きが多いので、Googleに出す「空き状況」の下書きを作りました。承認するまで投稿されません。')
    }
  }

  lines.push('')
  lines.push('【次の一手】')
  if (opt.tips.length === 0) lines.push('・今日は特にありません')
  for (const tip of opt.tips) lines.push(`・${tip}`)
  return lines.join('\n')
}

/** 集計が届いていない夜の文面 */
export function missingText(date: string, detail?: string): string {
  return [
    `⚠️ ${dateLabel(date)}のNOAHの集計がまだ届いていません。`,
    '',
    '院のパソコンの電源が入っていて、Claudeのアプリと NOAH が開いているかご確認ください。',
    '翌日以降に届けば、グラフには反映されます。',
    ...(detail ? ['', detail] : []),
  ].join('\n')
}

/** 「明日の空き状況」のGoogle投稿の文面（AIは使わない定型文。数字は予約システムの実データ） */
export function nextDayAvailabilityText(
  day: OpeningDay,
  asOfLocal: string,
  phone: string,
): { title: string; body: string } | null {
  if (day.closed) return null
  const halves = [day.am >= 2 ? '午前' : '', day.pm >= 2 ? '午後' : ''].filter(Boolean)
  if (halves.length === 0) return null
  const asOf = `${Number(asOfLocal.slice(5, 7))}/${Number(asOfLocal.slice(8, 10))}`
  const title = `${dateLabel(day.date)}のご予約の空き状況`
  const body = [
    `【${title}】（${asOf}時点）`,
    '',
    `${halves.join('・')}${halves.length === 2 ? 'とも' : 'に'}、比較的ご予約に空きがあります。`,
    '',
    'ネット予約は24時間受付。空き時間を見て、その場で予約が確定します。',
    `急なケガや強い痛みのときは、お電話（${phone}）のほうが早く対応できます。`,
    '',
    '※空き状況は変わることがあります。最新の空きは予約ページでご確認ください。',
  ].join('\n')
  return { title, body }
}
