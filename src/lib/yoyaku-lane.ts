/**
 * 予約管理画面（予約システム）の「時間未定」の欄とのやりとり（2026-11-25 院長「予約管理画面で院長、スタッフと別に
 * その日の時間を定めない予約欄を作成してください」）
 *
 * 予約システム v3.29〜は、この日の表の右（スマホでは上）に「時間未定」の欄を出す。中身は、院内アプリの
 * 「来院予定（日にち）」と同じ記録（pt_visit_plans。予約システムの表には書かない）。
 * 予約の画面（iframe）と院内アプリは、合図（postMessage）でやりとりする：
 *   院内アプリ → 予約の画面
 *     - yuuki:karte-hello-ack { visitPlans: true } … 「来院予定を出せます」（予約の画面は、これが来たときだけ欄を出す）
 *     - yuuki:visit-plans { date, plans }          … その日の来院予定（お名前・メモ・状態だけ）。変わるたびに送り直す
 *   予約の画面 → 院内アプリ
 *     - yuuki:visit-plans-watch { date } … この日を見ています（返事と、そのあとの変更を送る）
 *     - yuuki:visit-plan-add { date }    … 「＋ 入れる」が押された（院内アプリが入れる画面を出す）
 *     - yuuki:visit-plan-open { id }     … 来院予定が押された（来院した・来なかった・日にちを変える・取り消す）
 * 受け取るのは予約システムのページからだけ（YoyakuFrame の isReservationOrigin）。ここは形を確かめるだけ
 */
import { plansOn, type VisitPlan, type VisitPlanStatus } from '@/lib/visit-plans'

/** 「院内アプリの中にいます」の返事。visitPlans … 「時間未定」の欄を出せる */
export const KARTE_HELLO_ACK = { type: 'yuuki:karte-hello-ack', visitPlans: true } as const

/** 1日に欄へ出す人数の上限（予約システムの VISIT_LANE_MAX と同じ） */
export const LANE_MAX_PLANS = 40
/** 予約表を見ている間、ほかの端末で入れた来院予定を取り込む間隔 */
export const LANE_SYNC_INTERVAL_MS = 60_000

/** 欄へ渡す1人分（お名前・メモ・状態だけ。カルテの中身・電話などは渡さない） */
export interface LanePlan {
  id: string
  name: string
  note: string
  status: VisitPlanStatus
}

const STATUS_ORDER: Record<VisitPlanStatus, number> = { planned: 0, visited: 1, no_show: 2 }

/** その日の来院予定を、欄に出す順（まだの方 → 来院した → 来なかった。同じ中ではお名前の順）で */
export function lanePlans(plans: VisitPlan[], date: string): LanePlan[] {
  return plansOn(plans, date)
    .map((p, i) => ({ p, i }))
    .sort((a, b) => STATUS_ORDER[a.p.status] - STATUS_ORDER[b.p.status] || a.i - b.i)
    .slice(0, LANE_MAX_PLANS)
    .map(({ p }) => ({ id: p.id, name: p.name, note: p.note ?? '', status: p.status }))
}

/** 予約の画面へ送る「その日の来院予定」 */
export function lanePlansMessage(date: string, plans: VisitPlan[]): { type: 'yuuki:visit-plans'; date: string; plans: LanePlan[] } {
  return { type: 'yuuki:visit-plans', date, plans: lanePlans(plans, date) }
}

export type LaneRequest = { kind: 'watch'; date: string } | { kind: 'add'; date: string } | { kind: 'open'; id: string }

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

/** 予約の画面から届いた合図を読む（形がちがえば null） */
export function parseLaneRequest(data: unknown): LaneRequest | null {
  if (!data || typeof data !== 'object') return null
  const d = data as { type?: unknown; date?: unknown; id?: unknown }
  const date = typeof d.date === 'string' && YMD_RE.test(d.date) ? d.date : ''
  if (d.type === 'yuuki:visit-plans-watch') return date ? { kind: 'watch', date } : null
  if (d.type === 'yuuki:visit-plan-add') return date ? { kind: 'add', date } : null
  if (d.type === 'yuuki:visit-plan-open') return typeof d.id === 'string' && /^[\w-]{1,64}$/.test(d.id) ? { kind: 'open', id: d.id } : null
  return null
}
