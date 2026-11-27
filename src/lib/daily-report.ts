/**
 * 日報（1日分の予約・来院予定・キャンセル・カルテ・売上のまとめ）の決まり。純粋な関数
 *
 * 2026-11-27 院長「1日ごとの予約などを日報として出せるようにしてください」「印刷できるようにも」。
 * 画面は components/clinic/DailyReport.tsx（予約 →「日報」＝/yoyaku/daily?date=YYYY-MM-DD）。
 *
 * 材料（どれも今あるものだけ。日報のために新しく記録するものは無い）
 * - 予約：予約システムの一覧（/api/yoyaku/feed。読めるのは60日前〜13日先まで＝予約システムの決まり）
 * - 時間を決めない来院予定：pt_visit_plans
 * - キャンセルの区分・理由：カルテのキャンセルの記録（pt_cancellations）
 * - カルテの記録：SOAP の来院日・カルテを作った日
 * - 売上：NOAH の日ごとの集計（院長が経営を開いているときだけ。画面の側で決める）
 *
 * 電話番号は日報に載せない（印刷して置いておくものなので、要らない個人情報は出さない）。
 */
import type { CancellationKind, CancellationExclusion } from '@/types/patient'
import { CANCELLATION_SHORT_LABELS, CANCELLATION_EXCLUSION_LABELS } from '@/types/patient'
import { sameChartsForReservation, reservationName, type ChartPerson } from '@/lib/karte-from-reservation'
import { sourceLabel } from '@/lib/marketing/booking-stats-labels'
import { VISIT_PLAN_STATUS_LABEL, type VisitPlan } from '@/lib/visit-plans'
import { addDaysYmd, daysBetween, isYmd } from '@/lib/reeval/schedule'

/** 予約システムから読めるのは、今日から60日前まで・13日先まで（予約システムの ?api=feed の決まり） */
export const REPORT_BACK_DAYS = 60
export const REPORT_AHEAD_DAYS = 13

const WEEK = ['日', '月', '火', '水', '木', '金', '土']

/** '2026-11-27' → '2026年11月27日（金）' */
export function reportDateLabel(date: string): string {
  if (!isYmd(date)) return date
  const [y, m, d] = date.split('-').map(Number)
  return `${y}年${m}月${d}日（${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}）`
}

/** '2026-11-27' → '11/27（金）' */
export function shortDateLabel(date: string): string {
  if (!isYmd(date)) return date
  const [y, m, d] = date.split('-').map(Number)
  return `${m}/${d}（${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}）`
}

/**
 * その日（と次の日）を読むための、予約システムへの頼み方。
 * 予約システムは「今日から back 日さかのぼって、そこから back＋days 日分」を返す。
 * 読めない日（60日より前・14日より先）は null
 */
export function feedRange(date: string, today: string): { back: number; days: number } | null {
  if (!isYmd(date) || !isYmd(today)) return null
  const diff = daysBetween(today, date)
  if (diff < -REPORT_BACK_DAYS || diff > REPORT_AHEAD_DAYS) return null
  const back = Math.max(0, -diff)
  // 次の日の予約の数も出すので、次の日まで入るように頼む（14日先が上限）
  const days = Math.min(REPORT_AHEAD_DAYS + 1, Math.max(1, diff + 2))
  return { back, days }
}

/** 予約システムの一覧の1行（日報で使うところだけ。v3 からの項目は、古い予約システムでは無い） */
export interface ReportFeedRow {
  time: string
  name: string
  kana?: string
  phone?: string
  kubun?: string
  status?: string
  reservationNo?: string
  memo?: string
  visitType?: string
  staff?: string
  nominated?: boolean
  duration?: number
  source?: string
  sub?: boolean
}

export type ReportStatus = 'booked' | 'visited' | 'cancelled' | 'other'

export function rowStatus(status: string | undefined): ReportStatus {
  const s = String(status ?? '').trim()
  if (!s || s === '確定') return 'booked'
  if (s === '来院済み') return 'visited'
  if (/キャンセル|取消/.test(s)) return 'cancelled'
  return 'other'
}

/** 初めての方か（ネット予約の「初めて」、メニューの「初診」。再初診・再初検は入れない） */
export function isFirstVisit(row: Pick<ReportFeedRow, 'visitType' | 'kubun'>): boolean {
  const text = `${row.visitType ?? ''} ${row.kubun ?? ''}`
  if (/再初診|再初検/.test(text)) return false
  return /初めて|初診/.test(text)
}

/** 'HH:MM' に分を足す（'9:30' も読む）。読めなければ '' */
export function endTime(time: string, minutes: number | undefined): string {
  const m = String(time ?? '').match(/^(\d{1,2}):(\d{2})/)
  if (!m || !minutes || minutes <= 0) return ''
  const total = Number(m[1]) * 60 + Number(m[2]) + minutes
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

const timeKey = (time: string) => {
  const m = String(time ?? '').match(/^(\d{1,2}):(\d{2})/)
  return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60
}

/** 予約の入口の短い名前（日報の表に入るように） */
const SOURCE_SHORT: Record<string, string> = {
  staff: '院で登録',
  direct: 'ネット',
  instagram: 'Instagram',
  google_post: 'Google投稿',
  google_profile: 'Googleマップ',
  line: 'LINE',
  website: 'ホームページ',
  flyer: 'チラシ・QR',
}

/** 入口の並び（同じ数のときの順。予約システムの流入元の並びと同じ） */
const SOURCE_ORDER = ['instagram', 'google_post', 'google_profile', 'line', 'website', 'flyer', 'direct']
const sourceOrder = (s: string) => {
  const i = SOURCE_ORDER.indexOf(s)
  return i === -1 ? SOURCE_ORDER.length : i
}

export function sourceShort(source: string | undefined): string {
  const s = String(source ?? '')
  return SOURCE_SHORT[s] ?? (s ? sourceLabel(s) : '')
}

export interface ReportReservation {
  time: string
  end: string
  name: string
  kana: string
  menu: string
  first: boolean
  member: boolean
  staff: string
  nominated: boolean
  status: ReportStatus
  /** いつもの「確定」は空（札を付けない） */
  statusLabel: string
  memo: string
  source: string
  sourceLabel: string
  reservationNo: string
  /** 同じ方のカルテ（1つに決まるときだけ） */
  patientId?: string
}

export interface ReportCancel {
  time: string
  name: string
  /** 予約日前・当日・無断（カルテに記録が無ければ空） */
  kind: string
  reason: string
  /** キャンセル回数に数えない記録（入力ミス・院側の都合） */
  excluded: string
  /** 予約システムの一覧にある予約か（無ければカルテに手で書いた記録） */
  fromYoyaku: boolean
}

export interface ReportPlan {
  name: string
  note: string
  status: VisitPlan['status']
  statusLabel: string
  patientId?: string
}

export interface ReportNewChart {
  id: string
  name: string
  /** 予約から自動で作ったカルテ */
  auto: boolean
}

/** NOAH の1日分（noah-analysis の DayPoint と同じ形） */
export interface NoahDayLike {
  visits: number
  sales: number
  ins: [number, number]
  self: [number, number]
  nonIns: [number, number]
  acc: [number, number]
  work: [number, number]
}

export interface ReportCancellation {
  id?: string
  patientId: string
  kind: CancellationKind
  appointmentDate: string
  appointmentTime?: string
  reason?: string
  sourceReservationNo?: string
  excludedAs?: CancellationExclusion
}

export interface ReportPatient extends ChartPerson {
  createdAt?: string
  autoCreatedFrom?: string
}

export interface DailyReportInput {
  date: string
  /** 日本時間の今日 */
  today: string
  /** いまの時刻 'HH:MM'（日本時間）。今日の「カルテの記録がまだ」を、時刻を過ぎた予約だけにするため */
  nowTime?: string
  /** その日の予約（読めなかったときは null） */
  rows: ReportFeedRow[] | null
  /** 次の日の予約（読めなかったときは null） */
  nextRows?: ReportFeedRow[] | null
  plans: VisitPlan[]
  cancellations: ReportCancellation[]
  patients: ReportPatient[]
  /** SOAP の来院日（だれが・いつ） */
  notes: Array<{ patientId: string; visitDate: string }>
  noah?: NoahDayLike | null
}

export interface DailyReport {
  date: string
  label: string
  /** 予約を読めたか */
  reservationsLoaded: boolean
  /** キャンセルを除いた、その日の予約（時刻の順） */
  reservations: ReportReservation[]
  counts: {
    /** 予約（キャンセルを除く） */
    total: number
    visited: number
    first: number
    member: number
    /** ネット予約（院で登録を除く） */
    net: number
    /** 院で登録（電話・窓口） */
    clinic: number
    cancelled: number
    /** キャンセルのうち、当日・無断（カルテに区分の記録があるものだけ） */
    sameDay: number
    noShow: number
    plans: number
  }
  byStaff: Array<{ staff: string; count: number }>
  bySource: Array<{ label: string; count: number }>
  cancels: ReportCancel[]
  plans: ReportPlan[]
  /** カルテの記録（未来の日は null） */
  karte: {
    written: number
    /** 予約があって、この日の SOAP がまだの方 */
    missing: Array<{ time: string; name: string; patientId?: string; noKarte: boolean }>
  } | null
  newCharts: ReportNewChart[]
  next: { date: string; total: number; first: number } | null
  noah: NoahDayLike | null
}

const jstDateOfIso = (iso: string | undefined): string => {
  const t = Date.parse(String(iso ?? ''))
  return Number.isFinite(t) ? new Date(t + 9 * 3_600_000).toISOString().slice(0, 10) : ''
}

/** 予約の方のカルテ（1つに決まるときだけ）。カルテが無い・2つ以上で決められないときは undefined */
function chartFor(row: ReportFeedRow, patients: ReportPatient[]): { id?: string; any: ReportPatient[] } {
  const hits = sameChartsForReservation(patients, { name: row.name, kana: row.kana ?? '', phone: row.phone ?? '' })
  return { id: hits.length === 1 ? hits[0].id : undefined, any: hits }
}

function toReservation(row: ReportFeedRow, patients: ReportPatient[]): ReportReservation {
  const status = rowStatus(row.status)
  const source = String(row.source ?? '')
  return {
    time: String(row.time ?? ''),
    end: endTime(row.time, row.duration),
    name: reservationName(row.name),
    kana: String(row.kana ?? ''),
    menu: String(row.kubun ?? ''),
    first: isFirstVisit(row),
    member: Boolean(row.sub),
    staff: String(row.staff ?? ''),
    nominated: Boolean(row.nominated),
    status,
    statusLabel: status === 'booked' ? '' : String(row.status ?? ''),
    memo: String(row.memo ?? '').trim(),
    source,
    sourceLabel: source ? sourceLabel(source) : '',
    reservationNo: String(row.reservationNo ?? ''),
    patientId: chartFor(row, patients).id,
  }
}

function tally(values: string[]): Array<{ key: string; count: number }> {
  const map = new Map<string, number>()
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1)
  return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'ja'))
}

export function buildDailyReport(input: DailyReportInput): DailyReport {
  const { date, today, patients } = input
  const rows = input.rows ?? []
  const all = rows.map((r) => ({ raw: r, r: toReservation(r, patients) })).sort((a, b) => timeKey(a.r.time) - timeKey(b.r.time))
  const live = all.filter((x) => x.r.status !== 'cancelled').map((x) => x.r)
  const cancelledRows = all.filter((x) => x.r.status === 'cancelled').map((x) => x.r)

  // キャンセル：予約システムでキャンセルの予約に、カルテの記録（区分・理由）を重ねる。カルテにだけある記録（手で書いたもの）も出す
  const records = input.cancellations.filter((c) => c.appointmentDate === date)
  const used = new Set<ReportCancellation>()
  const nameOf = (patientId: string) => patients.find((p) => p.id === patientId)?.name ?? ''
  const cancels: ReportCancel[] = cancelledRows.map((r) => {
    const rec =
      records.find((c) => r.reservationNo && c.sourceReservationNo === r.reservationNo) ??
      (r.patientId ? records.find((c) => !used.has(c) && !c.sourceReservationNo && c.patientId === r.patientId) : undefined)
    if (rec) used.add(rec)
    return {
      time: r.time,
      name: r.name,
      kind: rec ? CANCELLATION_SHORT_LABELS[rec.kind] ?? '' : '',
      reason: String(rec?.reason ?? '').trim(),
      excluded: rec?.excludedAs ? CANCELLATION_EXCLUSION_LABELS[rec.excludedAs] ?? '' : '',
      fromYoyaku: true,
    }
  })
  for (const rec of records) {
    if (used.has(rec)) continue
    // 予約システムの一覧にある予約（キャンセルされていない）の記録は、ここには出さない（予約が戻ったなど）
    if (rec.sourceReservationNo && live.some((r) => r.reservationNo === rec.sourceReservationNo)) continue
    cancels.push({
      time: String(rec.appointmentTime ?? ''),
      name: nameOf(rec.patientId),
      kind: CANCELLATION_SHORT_LABELS[rec.kind] ?? '',
      reason: String(rec.reason ?? '').trim(),
      excluded: rec.excludedAs ? CANCELLATION_EXCLUSION_LABELS[rec.excludedAs] ?? '' : '',
      fromYoyaku: false,
    })
  }
  cancels.sort((a, b) => timeKey(a.time) - timeKey(b.time))
  const counted = cancels.filter((c) => !c.excluded)

  const plans: ReportPlan[] = input.plans
    .filter((p) => p.date === date)
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
    .map((p) => ({ name: p.name, note: String(p.note ?? '').trim(), status: p.status, statusLabel: VISIT_PLAN_STATUS_LABEL[p.status] ?? p.status, patientId: p.patientId }))

  // カルテの記録：その日に SOAP を書いた方の数と、予約があって SOAP がまだの方（今日は時刻を過ぎた予約だけ。先の日は出さない）
  let karte: DailyReport['karte'] = null
  if (date <= today) {
    const wrote = new Set(input.notes.filter((n) => n.visitDate === date).map((n) => n.patientId))
    const missing: NonNullable<DailyReport['karte']>['missing'] = []
    for (const x of all) {
      if (x.r.status === 'cancelled') continue
      if (date === today && x.r.status !== 'visited' && input.nowTime && timeKey(x.r.time) > timeKey(input.nowTime)) continue
      const { any } = chartFor(x.raw, patients)
      if (any.some((p) => wrote.has(p.id))) continue
      missing.push({ time: x.r.time, name: x.r.name, patientId: x.r.patientId, noKarte: any.length === 0 })
    }
    karte = { written: wrote.size, missing }
  }

  // ふりがなの順（無ければお名前）
  const newCharts: ReportNewChart[] = patients
    .filter((p) => jstDateOfIso(p.createdAt) === date)
    .sort((a, b) => String(a.kana || a.name || '').localeCompare(String(b.kana || b.name || ''), 'ja'))
    .map((p) => ({ id: p.id, name: String(p.name ?? ''), auto: p.autoCreatedFrom === 'reservation' }))

  const nextDate = addDaysYmd(date, 1)
  const nextLive = input.nextRows ? input.nextRows.filter((r) => rowStatus(r.status) !== 'cancelled') : null

  return {
    date,
    label: reportDateLabel(date),
    reservationsLoaded: input.rows !== null,
    reservations: live,
    counts: {
      total: live.length,
      visited: live.filter((r) => r.status === 'visited').length,
      first: live.filter((r) => r.first).length,
      member: live.filter((r) => r.member).length,
      net: live.filter((r) => r.source && r.source !== 'staff').length,
      clinic: live.filter((r) => r.source === 'staff').length,
      cancelled: counted.length,
      sameDay: counted.filter((c) => c.kind === CANCELLATION_SHORT_LABELS.same_day).length,
      noShow: counted.filter((c) => c.kind === CANCELLATION_SHORT_LABELS.no_show).length,
      plans: plans.length,
    },
    byStaff: tally(live.map((r) => r.staff).filter(Boolean)).map((t) => ({ staff: t.key, count: t.count })),
    bySource: tally(live.filter((r) => r.source && r.source !== 'staff').map((r) => r.source))
      .sort((a, b) => b.count - a.count || sourceOrder(a.key) - sourceOrder(b.key))
      .map((t) => ({ label: t.key === 'direct' ? '入口不明' : sourceShort(t.key), count: t.count })),
    cancels,
    plans,
    karte,
    newCharts,
    next: nextLive ? { date: nextDate, total: nextLive.length, first: nextLive.filter((r) => isFirstVisit(r)).length } : null,
    noah: input.noah ?? null,
  }
}

/** NOAH の区分（日報に出す順。0 のものは出さない） */
export const NOAH_REPORT_KINDS: Array<{ key: keyof Omit<NoahDayLike, 'visits' | 'sales'>; label: string }> = [
  { key: 'ins', label: '保険' },
  { key: 'self', label: '自費・商品' },
  { key: 'acc', label: '交通事故' },
  { key: 'work', label: '労災' },
  { key: 'nonIns', label: '保険外' },
]
