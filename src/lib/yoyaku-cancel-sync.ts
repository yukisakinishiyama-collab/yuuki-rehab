// ──────────────────────────────────────────────
// 予約システム（GAS）→ カルテのキャンセル記録 自動取り込み
//
// 【設計方針】
// ・確実に本人と分かる予約だけ自動で記録する。あいまいなものは記録せず「要確認」に回す。
//   （カルテは診療記録なので、他人の記録に書き込むことは絶対に避ける）
//   ─ 電話が一致しても氏名が違えば別人（家族で同じ番号を使う例が実在する）
//   ─ 氏名が一致しても電話が食い違えば別人の可能性がある
// ・区分（予約日前／当日）は予約日とキャンセル日時の比較で判定する。
//   判定できない場合は勝手に決めず「要確認」に回す。
// ・院長が自分で判断して入れた記録は、同期で勝手に消さない。
//   自動で取り下げるのは「自動取り込みした分」かつ「予約側でキャンセルが取り消された」場合だけ。
// ・誤って入力した記録を削除したら、以後その予約は取り込まない（除外リスト）。
//   除外を戻したときは自動記録せず、必ず「要確認」に出して患者を選び直せるようにする。
// ──────────────────────────────────────────────
import type { CancellationKind, CancellationRecord, Patient } from '@/types/patient'
import { getCancellations, saveCancellation, deleteCancellation } from './patient-store'

const EXCLUDED_KEY = 'pt_yoyaku_excluded'
const NOSHOW_OK_KEY = 'pt_yoyaku_noshow_ok'
const FORCE_REVIEW_KEY = 'pt_yoyaku_force_review'

/** 無断キャンセル候補として提示する期間（日）。古い予約まで遡ると大量に出て処理しきれないため */
const NO_SHOW_LOOKBACK_DAYS = 7

/** 予約フィードの1行（GAS buildReservationFeed_ の戻り値） */
export interface YoyakuFeedRow {
  time: string
  name: string
  kana: string
  phone: string
  kubun: string
  status: string
  reservationNo: string
  memo: string
  /** 以下はv2で追加。無い場合は旧フィード（GAS未更新） */
  date?: string
  updatedAt?: string
  receivedAt?: string
  visitType?: string
}

export interface YoyakuFeedDay {
  date: string
  rows: YoyakuFeedRow[]
}

export interface YoyakuFeed {
  ok: boolean
  error?: string
  today?: string
  feedVersion?: number
  days?: YoyakuFeedDay[]
}

/** 要確認（自動では記録せず、院長の判断をもらうもの） */
export interface PendingCancellation {
  reservationNo: string
  date: string
  time: string
  name: string
  kana: string
  phone: string
  /** 確度が十分で、そのまま初期選択してよい患者 */
  patientId?: string
  patientName?: string
  /** 参考までに提示する候補（自動では選ばない。院長が明示的に選ぶ） */
  guessPatientId?: string
  guessPatientName?: string
  /** 推定した区分。無い場合は院長が選ぶ */
  suggestedKind?: CancellationKind
  reason: 'unmatched' | 'ambiguous_kind' | 'no_show_candidate'
}

export interface SyncPlan {
  /** そのまま記録してよいもの */
  imports: CancellationRecord[]
  /** 既存の手入力記録に予約番号を結び付けるもの（二重計上の防止） */
  links: CancellationRecord[]
  /** 院長の確認が必要なもの */
  pending: PendingCancellation[]
  /** 予約側でキャンセルが取り消されたため、取り下げる記録のID */
  staleIds: string[]
  /** 予約システムで「来院済み」を運用しているか（無断キャンセル候補の提示可否） */
  usesVisitedStatus: boolean
  /** フィードが v2（キャンセル日時を含む）か */
  feedV2: boolean
}

// ── 文字列の正規化 ──────────────────────────────

/** 電話番号を数字だけにする */
export const digitsOnly = (value: string): string => String(value || '').replace(/[^0-9]/g, '')

/** 氏名の空白ゆれ（半角・全角）を吸収する */
export const normalizeName = (value: string): string => String(value || '').replace(/[\s　]/g, '')

/**
 * 「2026/08/07 12:34:56」「2026-08-07」などから日付部分だけを yyyy-MM-dd で取り出す。
 * シートの表示形式が変わっても壊れないよう、正規表現で拾う。
 */
export function toDateKey(value: string): string {
  const matched = String(value || '').match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (!matched) return ''
  return `${matched[1]}-${matched[2].padStart(2, '0')}-${matched[3].padStart(2, '0')}`
}

/**
 * 予約システム由来の記録IDは予約番号から決めうちにする。
 * 画面を二重に開いた場合や端末をまたいでデータが合流した場合でも、
 * 同じ予約が二重に積み上がらないようにするため。
 */
export function reservationRecordId(reservationNo: string): string {
  return `yk_${reservationNo}`
}

// ── 患者の突き合わせ ────────────────────────────

export type MatchConfidence = 'phone' | 'name_kana' | 'name' | 'none'

export interface MatchResult {
  /** 見つかった（または疑わしい）患者。confidence が低い場合は参考候補にすぎない */
  patient?: Patient
  confidence: MatchConfidence
}

/**
 * 予約の氏名・電話から、カルテの患者を探す。
 * 自動記録に使ってよいのは confidence が 'phone' / 'name_kana' のときだけ。
 *
 * 取り違えを防ぐための決まりごと:
 *  - 氏名が空の予約は一切自動化しない
 *  - 電話が一致しても【氏名も一致しなければ】自動記録しない（家族で同じ番号を使う例があるため）
 *  - 氏名が一致しても【双方に電話があって食い違うなら】自動記録しない（同姓同名の別人）
 *  - 同姓同名がカルテに複数いる場合は必ず特定しない
 */
export function matchPatient(row: YoyakuFeedRow, patients: Patient[]): MatchResult {
  const rowName = normalizeName(row.name)
  if (!rowName) return { confidence: 'none' }

  const rowPhone = digitsOnly(row.phone)
  const rowKana = normalizeName(row.kana)
  const sameName = (p: Patient) => normalizeName(p.name) === rowName

  // ① 電話一致（氏名の一致が必須）
  if (rowPhone.length >= 10) {
    const byPhone = patients.filter((p) => digitsOnly(p.phone) === rowPhone)
    const narrowed = byPhone.filter(sameName)
    if (narrowed.length === 1) return { patient: narrowed[0], confidence: 'phone' }
    if (byPhone.length > 0) {
      // 電話は一致するが氏名が違う（ご家族など）。参考候補としてだけ返す
      return { patient: byPhone.length === 1 ? byPhone[0] : undefined, confidence: 'none' }
    }
  }

  // ② 氏名一致（カルテ内で一意であること）
  const byName = patients.filter(sameName)
  if (byName.length !== 1) return { confidence: 'none' }
  const candidate = byName[0]

  // 双方に電話があるのに食い違う＝同姓同名の別人の可能性。自動記録はしない
  const patientPhone = digitsOnly(candidate.phone)
  if (rowPhone.length >= 10 && patientPhone.length >= 10 && rowPhone !== patientPhone) {
    return { patient: candidate, confidence: 'none' }
  }

  const kanaMatched = rowKana !== '' && normalizeName(candidate.kana) === rowKana
  return { patient: candidate, confidence: kanaMatched ? 'name_kana' : 'name' }
}

/** 自動記録してよい確度か */
export function canAutoAssign(confidence: MatchConfidence): boolean {
  return confidence === 'phone' || confidence === 'name_kana'
}

// ── 区分の判定 ──────────────────────────────────

export interface KindResult {
  kind: CancellationKind
  contactedDate: string
  /** true なら確実に判定できたので自動で記録してよい */
  confident: boolean
}

/**
 * キャンセルの区分を判定する。
 *   キャンセル日 <  予約日 → 予約日前（確実）
 *   キャンセル日 == 予約日 → 当日（確実）
 *   キャンセル日 >  予約日 → 予約日より後の操作。当日か無断かを断定できないので要確認
 *   キャンセル日が不明     → 予約日がまだ先なら予約日前（確実）。それ以外は要確認
 *
 * 更新日時が受付日時と同じ行は「登録以降アプリで一度も更新されていない」＝
 * シートを直接書き換えてキャンセルにした行なので、日時をあてにせず要確認へ回す。
 */
export function classifyCancellation(
  appointmentDate: string,
  updatedAtRaw: string,
  today: string,
  receivedAtRaw = '',
): KindResult | null {
  const updated = toDateKey(updatedAtRaw)
  const untouched =
    updated !== '' && receivedAtRaw !== '' && String(updatedAtRaw).trim() === String(receivedAtRaw).trim()

  if (updated && !untouched) {
    if (updated < appointmentDate) {
      return { kind: 'advance', contactedDate: updated, confident: true }
    }
    if (updated === appointmentDate) {
      return { kind: 'same_day', contactedDate: updated, confident: true }
    }
    // 予約日より後に操作された（後日まとめて整理した等）。当日か無断かは断定できない
    return { kind: 'same_day', contactedDate: updated, confident: false }
  }

  // キャンセル日時が分からない。予約日がまだ先なら「予約日前」で確実
  if (appointmentDate > today) {
    return { kind: 'advance', contactedDate: '', confident: true }
  }
  return updated ? { kind: 'same_day', contactedDate: updated, confident: false } : null
}

// ── 端末に保存する処理状態 ──────────────────────

function readList(key: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function writeList(key: string, list: string[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify([...new Set(list)]))
}

/** 取り込み対象外にした予約番号（誤入力として削除したもの） */
export function getExcludedReservationNos(): string[] {
  return readList(EXCLUDED_KEY)
}

export function excludeReservationNo(reservationNo: string): void {
  if (!reservationNo) return
  writeList(EXCLUDED_KEY, [...readList(EXCLUDED_KEY), reservationNo])
  // 除外したものは「要確認へ戻す」印を消しておく
  writeList(FORCE_REVIEW_KEY, readList(FORCE_REVIEW_KEY).filter((no) => no !== reservationNo))
}

/**
 * 除外を取り消す。ただし自動記録には戻さず、必ず「要確認」に出す。
 * （前回と同じ判定で同じ患者に自動記録されると、取り違えを直せなくなるため）
 */
export function unexcludeReservationNo(reservationNo: string): void {
  writeList(EXCLUDED_KEY, readList(EXCLUDED_KEY).filter((no) => no !== reservationNo))
  writeList(FORCE_REVIEW_KEY, [...readList(FORCE_REVIEW_KEY), reservationNo])
}

export function getForceReviewNos(): string[] {
  return readList(FORCE_REVIEW_KEY)
}

export function clearForceReview(reservationNo: string): void {
  writeList(FORCE_REVIEW_KEY, readList(FORCE_REVIEW_KEY).filter((no) => no !== reservationNo))
}

/** 「来院された」と確認済みにした予約番号（無断キャンセル候補から外す） */
export function getResolvedNoShows(): string[] {
  return readList(NOSHOW_OK_KEY)
}

export function resolveNoShow(reservationNo: string): void {
  if (!reservationNo) return
  writeList(NOSHOW_OK_KEY, [...readList(NOSHOW_OK_KEY), reservationNo])
}

/** 「来院された」の判断を取り消す（押し間違いの復旧） */
export function unresolveNoShow(reservationNo: string): void {
  writeList(NOSHOW_OK_KEY, readList(NOSHOW_OK_KEY).filter((no) => no !== reservationNo))
}

// ── 取り込み計画の作成（純関数） ────────────────

export interface BuildPlanParams {
  feed: YoyakuFeed
  patients: Patient[]
  existing: CancellationRecord[]
  excluded: string[]
  resolvedNoShows: string[]
  forceReview?: string[]
  /** 記録日時（テスト時に固定できるようにする） */
  now?: string
}

/** yyyy-MM-dd の日数差（a - b）。不正な形式は 0 */
function diffDays(a: string, b: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return 0
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000)
}

export function buildSyncPlan({
  feed,
  patients,
  existing,
  excluded,
  resolvedNoShows,
  forceReview = [],
  now = new Date().toISOString(),
}: BuildPlanParams): SyncPlan {
  const empty: SyncPlan = {
    imports: [], links: [], pending: [], staleIds: [], usesVisitedStatus: false, feedV2: false,
  }
  if (!feed.ok || !feed.days || !feed.today) return empty

  const today = feed.today
  const excludedSet = new Set(excluded)
  const resolvedSet = new Set(resolvedNoShows)
  const forceReviewSet = new Set(forceReview)

  // 取り込み済みの予約番号
  const recordedNos = new Set(
    existing.map((r) => r.sourceReservationNo).filter((no): no is string => Boolean(no)),
  )
  // 同じ患者・同じ予約日の既存記録（手入力との二重計上を防ぐ）
  const byPatientDate = new Map<string, CancellationRecord>()
  for (const r of existing) byPatientDate.set(`${r.patientId}|${r.appointmentDate}`, r)

  const allRows: YoyakuFeedRow[] = []
  // その日に「来院済み」を付けた実績がある日付（無断候補を出してよい日）
  const processedDates = new Set<string>()
  for (const day of feed.days) {
    for (const row of day.rows) {
      // 旧フィードには date が無いので、日ごとの date で補う
      const date = row.date || day.date
      allRows.push({ ...row, date })
      if (row.status === '来院済み') processedDates.add(date)
    }
  }

  const feedV2 = feed.feedVersion === 2 || allRows.some((r) => r.updatedAt !== undefined)
  const usesVisitedStatus = processedDates.size > 0

  const imports: CancellationRecord[] = []
  const links: CancellationRecord[] = []
  const pending: PendingCancellation[] = []
  // 同じ予約番号を1回の同期で二度扱わないための印
  const handled = new Set<string>()

  for (const row of allRows) {
    const reservationNo = String(row.reservationNo || '')
    const date = String(row.date || '')
    if (!reservationNo || !date) continue
    if (excludedSet.has(reservationNo)) continue
    if (recordedNos.has(reservationNo)) continue
    if (handled.has(reservationNo)) continue

    const isCancelled = row.status === 'キャンセル'
    // 無断キャンセル候補：予約日を過ぎても「確定」のまま＝来院の記録が無い。
    // ただし、その日に「来院済み」を付けた実績がある日に限る
    // （来院済みを付け忘れただけの日を無断扱いにしないため）。
    const isNoShowCandidate =
      !isCancelled &&
      row.status !== '来院済み' &&
      date < today &&
      diffDays(today, date) <= NO_SHOW_LOOKBACK_DAYS &&
      processedDates.has(date) &&
      !resolvedSet.has(reservationNo)

    if (!isCancelled && !isNoShowCandidate) continue

    const match = matchPatient(row, patients)
    const strong = canAutoAssign(match.confidence)
    const base = {
      reservationNo,
      date,
      time: String(row.time || ''),
      name: String(row.name || ''),
      kana: String(row.kana || ''),
      phone: String(row.phone || ''),
      // 確度が十分なときだけ初期選択する。弱い一致は「候補」として提示するだけ
      patientId: strong ? match.patient?.id : undefined,
      patientName: strong ? match.patient?.name : undefined,
      guessPatientId: strong ? undefined : match.patient?.id,
      guessPatientName: strong ? undefined : match.patient?.name,
    }

    // 無断キャンセルは予約システムからは断定できない（来院済みの付け忘れと区別できない）ため、
    // 自動記録はせず必ず確認してもらう
    if (isNoShowCandidate) {
      pending.push({ ...base, suggestedKind: 'no_show', reason: 'no_show_candidate' })
      handled.add(reservationNo)
      continue
    }

    const classified = classifyCancellation(
      date, String(row.updatedAt || ''), today, String(row.receivedAt || ''),
    )

    // 一度削除して除外を戻した予約は、必ず院長に選び直してもらう
    if (forceReviewSet.has(reservationNo)) {
      pending.push({
        ...base,
        patientId: undefined,
        patientName: undefined,
        guessPatientId: match.patient?.id,
        guessPatientName: match.patient?.name,
        suggestedKind: classified?.kind,
        reason: 'unmatched',
      })
      handled.add(reservationNo)
      continue
    }

    if (!match.patient || !strong) {
      pending.push({ ...base, suggestedKind: classified?.kind, reason: 'unmatched' })
      handled.add(reservationNo)
      continue
    }
    if (!classified || !classified.confident) {
      pending.push({ ...base, suggestedKind: classified?.kind, reason: 'ambiguous_kind' })
      handled.add(reservationNo)
      continue
    }

    handled.add(reservationNo)

    // 同じ患者・同じ予約日の記録が既にあるなら、新しく作らず予約番号だけ結び付ける
    // （電話連絡を受けて手入力した後で、予約システム側もキャンセルにした場合）
    const duplicate = byPatientDate.get(`${match.patient.id}|${date}`)
    if (duplicate) {
      links.push({ ...duplicate, sourceReservationNo: reservationNo })
      continue
    }

    imports.push({
      id: reservationRecordId(reservationNo),
      patientId: match.patient.id,
      kind: classified.kind,
      appointmentDate: date,
      contactedDate: classified.contactedDate,
      reason: '',
      memo: '',
      createdAt: now,
      source: 'yoyaku',
      origin: 'auto',
      sourceReservationNo: reservationNo,
      appointmentTime: String(row.time || ''),
    })
  }

  // 予約側でキャンセルが取り消された記録を取り下げる。
  // 対象は【自動取り込みした分】に限る。院長が自分で判断して入れた記録は消さない。
  const statusByNo = new Map<string, string>()
  for (const row of allRows) {
    if (row.reservationNo) statusByNo.set(String(row.reservationNo), String(row.status || ''))
  }
  const staleIds = existing
    .filter(
      (r) =>
        r.source === 'yoyaku' &&
        r.origin === 'auto' &&
        r.sourceReservationNo != null &&
        statusByNo.has(r.sourceReservationNo) &&
        statusByNo.get(r.sourceReservationNo) !== 'キャンセル',
    )
    .map((r) => r.id)

  return { imports, links, pending, staleIds, usesVisitedStatus, feedV2 }
}

// ── 実行（localStorageへの反映） ────────────────

export interface SyncResult {
  imported: number
  linked: number
  withdrawn: number
  pending: PendingCancellation[]
  usesVisitedStatus: boolean
  feedV2: boolean
}

/** 取り込み計画をカルテへ反映する */
export function applySyncPlan(plan: SyncPlan): SyncResult {
  // 保存直前に最新の記録を読み直し、他タブ等で既に入っている分は二重に書かない
  const currentNos = new Set(
    getCancellations().map((r) => r.sourceReservationNo).filter((no): no is string => Boolean(no)),
  )
  let imported = 0
  for (const record of plan.imports) {
    if (record.sourceReservationNo && currentNos.has(record.sourceReservationNo)) continue
    saveCancellation(record)
    imported += 1
  }
  for (const record of plan.links) saveCancellation(record)
  for (const id of plan.staleIds) deleteCancellation(id)
  return {
    imported,
    linked: plan.links.length,
    withdrawn: plan.staleIds.length,
    pending: plan.pending,
    usesVisitedStatus: plan.usesVisitedStatus,
    feedV2: plan.feedV2,
  }
}

/** フィードを受け取って取り込みまで行う（UIから呼ぶ入口） */
export function syncFromFeed(feed: YoyakuFeed, patients: Patient[]): SyncResult {
  const plan = buildSyncPlan({
    feed,
    patients,
    existing: getCancellations(),
    excluded: getExcludedReservationNos(),
    resolvedNoShows: getResolvedNoShows(),
    forceReview: getForceReviewNos(),
  })
  return applySyncPlan(plan)
}

/** 要確認の1件を、指定の患者・区分でカルテへ記録する */
export function confirmPending(
  item: PendingCancellation,
  patientId: string,
  kind: CancellationKind,
): void {
  saveCancellation({
    id: reservationRecordId(item.reservationNo),
    patientId,
    kind,
    // 当日キャンセルは予約日に連絡があったと分かる。
    // 予約日前・無断は連絡日を特定できないため空欄のままにする（推測で埋めない）
    appointmentDate: item.date,
    contactedDate: kind === 'same_day' ? item.date : '',
    reason: '',
    memo: '',
    createdAt: new Date().toISOString(),
    source: 'yoyaku',
    // 院長の判断で入れた記録。同期で自動的に取り下げてはいけない
    origin: 'confirmed',
    sourceReservationNo: item.reservationNo,
    appointmentTime: item.time,
  })
  clearForceReview(item.reservationNo)
}

/**
 * 記録を「誤入力」として削除する。
 * 予約システム由来の記録は、削除しただけでは次の同期で戻ってきてしまうため、
 * 同時に取り込み除外リストへ入れる。
 */
export function deleteCancellationRecord(record: CancellationRecord): void {
  deleteCancellation(record.id)
  if (record.sourceReservationNo) excludeReservationNo(record.sourceReservationNo)
}
