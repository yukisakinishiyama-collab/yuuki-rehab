/**
 * 来院予定（日にちだけ。時間を決めない）の決まり（2026-11-24 院長の依頼）
 *
 * 「金曜に行きます」のように、時間を決めずに来る日だけ聞いた方を、院で書いておく一覧。
 * 予約システム（時間の枠）とは別で、予約表の空きは減らさない。
 * LINE 連携の方には、入れたとき・日にちを変えたときに「ご来院の予定を承りました」、前日に「明日のご来院予定のお知らせ」を
 * LINE で送る（2026-11-26 院長「時間指定のない予約もlineが入るようにしてください」。文は lib/visit-plan-message.ts、
 * 送るのはサーバー lib/marketing/visit-plan-line-server.ts）。LINE 連携の無い方には何も送らない。
 * 記録は端末の pt_visit_plans（ほかのカルテの記録と同じく /api/sync でクラウドとそろう）。
 * 画面は 予約 →「来院予定（日にち）」（VisitPlansPanel）と、今日の画面の「今日の来院予定」。
 */
import { addDaysYmd, isYmd, jstToday } from '@/lib/reeval/schedule'

export { addDaysYmd, jstToday }

/** 予定／来院した／来なかった */
export type VisitPlanStatus = 'planned' | 'visited' | 'no_show'

export interface VisitPlan {
  id: string
  /** 来る予定の日（YYYY-MM-DD・日本時間） */
  date: string
  /** カルテの方なら、そのカルテ（無ければ名前だけ＝カルテがまだ無い方） */
  patientId?: string
  /** お名前（カルテの方は入れたときのお名前を写す） */
  name: string
  /** ふりがな（探すため。カルテの方だけ） */
  kana?: string
  /** メモ（例：夕方ごろ・部活のあと・テーピングだけ） */
  note?: string
  status: VisitPlanStatus
  createdAt: string
  updatedAt: string
  createdBy?: string
  /** この予定は LINE で知らせない（入れるときにチェックを外した。入れたとき・日にちを変えたとき・前日のどれも送らない） */
  lineOff?: boolean
  /** 「ご来院の予定を承りました」の LINE をどうしたか（date＝そのときの予定の日。日にちを変えたら送り直す） */
  line?: VisitPlanLine
}

/** LINE のお知らせの結果（一覧の小さな印に使う） */
export type VisitPlanLineResult = 'sent' | 'test' | 'off' | 'not_linked' | 'error'

export interface VisitPlanLine {
  date: string
  at: string
  result: VisitPlanLineResult
}

export const VISIT_PLAN_LINE_LABEL: Record<VisitPlanLineResult, string> = {
  sent: 'LINE 送信済み',
  test: 'LINE テスト中（送っていません）',
  off: 'LINE 停止中（送っていません）',
  not_linked: 'LINE 連携なし',
  error: 'LINE 送れず',
}

/** 一覧に出す印（いまの日にちに送った記録だけ。日にちを変えたあとの古い記録は出さない） */
export function planLineBadge(plan: Pick<VisitPlan, 'date' | 'line' | 'lineOff'>): { result: VisitPlanLineResult; label: string } | null {
  if (plan.lineOff) return { result: 'off', label: 'LINE お知らせなし' }
  if (!plan.line || plan.line.date !== plan.date) return null
  return { result: plan.line.result, label: VISIT_PLAN_LINE_LABEL[plan.line.result] }
}

/** サーバーの返事（lib/marketing/visit-plan-line-server.ts の PlanNotice）を、記録の形に。記録しないとき（過ぎた日など）は null */
export function planLineResult(notice: { linked?: boolean; delivered?: boolean; result?: string } | null | undefined): VisitPlanLineResult | null {
  if (!notice) return 'error'
  if (notice.result === 'past' || notice.result === 'invalid') return null
  if (notice.result === 'not_linked' || notice.linked === false) return 'not_linked'
  // 送った（同じお知らせを前に送ってあるときも「送信済み」）
  if (notice.delivered) return 'sent'
  // テストの見本（院長の LINE へ）。前に見本を送ってあるときも同じ
  if (notice.result === 'test' || notice.result === 'duplicate') return 'test'
  if (notice.result === 'skipped') return 'off'
  return 'error'
}

export const VISIT_PLAN_STATUS_LABEL: Record<VisitPlanStatus, string> = {
  planned: '予定',
  visited: '来院した',
  no_show: '来なかった',
}

export const MAX_PLAN_NAME_CHARS = 40
export const MAX_PLAN_NOTE_CHARS = 100
/** 記録がまだ（予定のまま）の過去の分を、何日前まで出すか */
export const PAST_UNMARKED_DAYS = 14
/** これからの予定を、何日先まで一覧に出すか（それより先も記録は残る） */
export const UPCOMING_DAYS = 60

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

/** 「11/28（金）」。今日・明日・あさっては前に付ける（「今日 11/24（月）」） */
export function planDateLabel(date: string, today: string): string {
  if (!isYmd(date)) return date
  const [y, m, d] = date.split('-').map(Number)
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  const base = `${m}/${d}（${wd}）`
  if (date === today) return `今日 ${base}`
  if (date === addDaysYmd(today, 1)) return `明日 ${base}`
  if (date === addDaysYmd(today, 2)) return `あさって ${base}`
  return base
}

export interface VisitPlanInput {
  date: string
  name: string
  patientId?: string
  kana?: string
  note?: string
  /** LINE で知らせない */
  lineOff?: boolean
}

/** 入れる前の確かめ。問題があれば画面に出す文、無ければ null */
export function visitPlanProblem(input: VisitPlanInput, today: string): string | null {
  if (!isYmd(input.date)) return '日にちを選んでください'
  if (input.date < addDaysYmd(today, -PAST_UNMARKED_DAYS)) return `${PAST_UNMARKED_DAYS}日より前の日にちは入れられません`
  if (!String(input.name ?? '').trim()) return 'お名前を入れるか、カルテから選んでください'
  return null
}

/** 新しい予定の記録（形と長さをそろえる） */
export function newVisitPlan(input: VisitPlanInput, id: string, nowIso: string, by?: string): VisitPlan {
  const note = String(input.note ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_PLAN_NOTE_CHARS)
  const kana = String(input.kana ?? '').trim().slice(0, MAX_PLAN_NAME_CHARS)
  return {
    id,
    date: input.date,
    ...(input.patientId ? { patientId: input.patientId } : {}),
    name: String(input.name).replace(/\s+/g, ' ').trim().slice(0, MAX_PLAN_NAME_CHARS),
    ...(kana ? { kana } : {}),
    ...(note ? { note } : {}),
    status: 'planned',
    createdAt: nowIso,
    updatedAt: nowIso,
    ...(by ? { createdBy: by } : {}),
    ...(input.lineOff ? { lineOff: true } : {}),
  }
}

function sameName(a: string, b: string): boolean {
  return a.replace(/[\s　]/g, '') === b.replace(/[\s　]/g, '')
}

/** 同じ日に同じ方の予定がもうあるか（カルテの方はカルテで、名前だけの方は名前で見る）。あればその予定 */
export function duplicatePlan(plans: VisitPlan[], input: VisitPlanInput): VisitPlan | undefined {
  return plans.find(
    (p) => p.date === input.date && (input.patientId ? p.patientId === input.patientId : !p.patientId && sameName(p.name, String(input.name ?? ''))),
  )
}

export interface VisitPlanDay {
  date: string
  label: string
  plans: VisitPlan[]
}

const byName = (a: VisitPlan, b: VisitPlan) => (a.kana || a.name).localeCompare(b.kana || b.name, 'ja')

/**
 * 一覧の並べ方：
 * - upcoming … 今日から UPCOMING_DAYS 日先までの予定（日にちの順。今日がいちばん上）
 * - unmarked … 過去 PAST_UNMARKED_DAYS 日の、まだ「来院した／来なかった」を付けていない予定
 * - later    … UPCOMING_DAYS 日より先の予定の数
 */
export function groupVisitPlans(plans: VisitPlan[], today: string): { upcoming: VisitPlanDay[]; unmarked: VisitPlan[]; later: number } {
  const until = addDaysYmd(today, UPCOMING_DAYS)
  const from = addDaysYmd(today, -PAST_UNMARKED_DAYS)
  const days = new Map<string, VisitPlan[]>()
  let later = 0
  for (const p of plans) {
    if (!isYmd(p.date) || p.date < today) continue
    if (p.date > until) {
      later += 1
      continue
    }
    days.set(p.date, [...(days.get(p.date) ?? []), p])
  }
  const upcoming = [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({ date, label: planDateLabel(date, today), plans: list.sort(byName) }))
  const unmarked = plans
    .filter((p) => isYmd(p.date) && p.date < today && p.date >= from && p.status === 'planned')
    .sort((a, b) => b.date.localeCompare(a.date) || byName(a, b))
  return { upcoming, unmarked, later }
}

/** その日の予定（今日の画面に出す。取り消した予定は記録から消すので、ここには残らない） */
export function plansOn(plans: VisitPlan[], date: string): VisitPlan[] {
  return plans.filter((p) => p.date === date).sort(byName)
}

/** カルテの方の、今日からの次の予定（無ければ undefined） */
export function nextPlanFor(plans: VisitPlan[], patientId: string, today: string): VisitPlan | undefined {
  return plans
    .filter((p) => p.patientId === patientId && p.status === 'planned' && isYmd(p.date) && p.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0]
}

/** カタカナ → ひらがな（ふりがなで探すため） */
function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
}

/** カルテから選ぶときの候補（お名前・ふりがなに入っている方。最大 limit 人） */
export function findPatientsForPlan<T extends { id: string; name: string; kana?: string }>(patients: T[], query: string, limit = 8): T[] {
  const q = query.normalize('NFKC').replace(/[\s　]/g, '')
  if (!q) return []
  const qKana = toHiragana(q)
  return patients
    .filter((p) => {
      const name = String(p.name ?? '').normalize('NFKC').replace(/[\s　]/g, '')
      const kana = toHiragana(String(p.kana ?? '').normalize('NFKC').replace(/[\s　]/g, ''))
      return name.includes(q) || (kana !== '' && kana.includes(qKana))
    })
    .slice(0, limit)
}
