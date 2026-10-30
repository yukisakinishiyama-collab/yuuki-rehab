// ──────────────────────────────────────────────
// 重複したカルテの整理（同じ方のカルテが2つ以上あるとき、最新の1つにまとめる）
//
// 院長の決めたルール（2026-10-31）:
// - 「同じ方」= お名前（空白・全角半角の違いは無視）が同じで、生年月日か電話番号も同じ。
//   お名前だけ同じで生年月日も電話も違う組は「別の方かも」として出し、まとめるかは院長が選ぶ
// - 残すのは「最後に記録した日」がいちばん新しいカルテ（記録が無ければ登録日）
// - 消す方のカルテの記録（SOAP・評価・メモ・キャンセルなど）は、消さずに残す方のカルテへ移す
//
// 患者さんの情報はこの端末の中だけで扱う（どこにも送らない。まとめたあとは、いつものクラウド同期だけ）。
// 実際に消すのは、院長が画面で確かめて押したときだけ。押す前に端末の全データの控え（JSON）を保存する。
// ──────────────────────────────────────────────
import type { NoahLink, Patient } from '@/types/patient'
import { nameKey } from './noah-import'

/** 患者さんに結びつく記録の入れ物（localStorage のキー）。patientId を持つ配列 */
export const PATIENT_RECORD_KEYS = [
  'pt_evaluations',
  'pt_rom_records',
  'pt_strength_records',
  'pt_special_tests',
  'pt_soap_notes',
  'pt_rehab_plans',
  'pt_patient_exercises',
  'pt_progress_records',
  'pt_attendance_records',
  'pt_cancellations',
  'pt_retention_risks',
  'pt_quick_memos',
  'pt_intakes',
  'pt_explanation_overrides',
  'pt_goals',
  'pt_problems',
  'outcomeScores_v1',
  'returnCriteria',
] as const

/** 1人に1つだけの入れ物（目標・患者さん向けの説明の上書き）。まとめたときは更新日が新しい方を残す */
const ONE_PER_PATIENT = new Set<string>(['pt_goals', 'pt_explanation_overrides'])

/** 「記録した日」として見る欄（予約日・目標日など、先の日付になりうるものは入れない） */
const RECORD_DATE_FIELDS = [
  'evaluationDate',
  'measuredDate',
  'visitDate',
  'recordDate',
  'memoDate',
  'intakeDate',
  'assessmentDate',
  'scoreDate',
  'createdAt',
  'updatedAt',
] as const

type AnyRecord = Record<string, unknown> & { patientId?: unknown }
export type RecordStore = Record<string, AnyRecord[]>

export interface MemberInfo {
  patient: Patient
  /** 最後に記録した日（'YYYY-MM-DD'）。記録が無ければ登録日。どちらも無ければ '' */
  lastActivity: string
  /** 記録が1件も無く、登録日で決めたか */
  activityFromCreated: boolean
  /** 結びついている記録の件数 */
  recordCount: number
}

export interface DuplicateUnit {
  /** まとめる組の目印（残す方のカルテのID） */
  id: string
  members: MemberInfo[]
  /** 残す方（最後に記録した日がいちばん新しい方） */
  keep: MemberInfo
}

export interface NameGroup {
  /** お名前の比べ方のキー（空白などを除いたもの） */
  key: string
  name: string
  /** お名前が同じ全員 */
  all: MemberInfo[]
  /** 生年月日か電話番号が同じ方どうしの組（2人以上のものだけ） */
  sureUnits: DuplicateUnit[]
  /** お名前は同じだが、生年月日も電話も一致しない方がいる（別の方かもしれない） */
  hasUnsure: boolean
}

const digits = (s: string | undefined): string => (s ?? '').replace(/\D/g, '')

/** 'YYYY-MM-DD' にそろえる（読めないものは ''） */
function day(value: unknown): string {
  if (typeof value !== 'string' || !value) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const t = Date.parse(value)
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : ''
}

/** 記録の中で、いちばん新しい「記録した日」。今日より先の日付は無視する */
function recordDay(record: AnyRecord, today: string): string {
  let best = ''
  for (const field of RECORD_DATE_FIELDS) {
    const d = day(record[field])
    if (d && d <= today && d > best) best = d
  }
  return best
}

/** 患者さんごとの「最後に記録した日」と記録の件数 */
export function activityByPatient(store: RecordStore, today: string): Map<string, { last: string; count: number }> {
  const map = new Map<string, { last: string; count: number }>()
  for (const key of PATIENT_RECORD_KEYS) {
    for (const record of store[key] ?? []) {
      const pid = typeof record.patientId === 'string' ? record.patientId : ''
      if (!pid) continue
      const cur = map.get(pid) ?? { last: '', count: 0 }
      const d = recordDay(record, today)
      map.set(pid, { last: d > cur.last ? d : cur.last, count: cur.count + 1 })
    }
  }
  return map
}

function memberInfo(patient: Patient, activity: Map<string, { last: string; count: number }>): MemberInfo {
  const a = activity.get(patient.id)
  const created = day(patient.createdAt)
  if (a && a.last) return { patient, lastActivity: a.last, activityFromCreated: false, recordCount: a.count }
  return { patient, lastActivity: created, activityFromCreated: true, recordCount: a?.count ?? 0 }
}

/** 残す方を決める：最後に記録した日 → 記録の件数 → 登録日時 が新しい・多い方 */
export function pickKeep(members: MemberInfo[]): MemberInfo {
  return [...members].sort((x, y) => {
    if (x.lastActivity !== y.lastActivity) return x.lastActivity < y.lastActivity ? 1 : -1
    if (x.recordCount !== y.recordCount) return y.recordCount - x.recordCount
    return (y.patient.createdAt ?? '').localeCompare(x.patient.createdAt ?? '')
  })[0]
}

function unitOf(members: MemberInfo[]): DuplicateUnit {
  const keep = pickKeep(members)
  return { id: keep.patient.id, members, keep }
}

/** 同じ方どうし（生年月日か電話番号が同じ）をつなげる */
function clusters(members: MemberInfo[]): MemberInfo[][] {
  const parent = members.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i].patient
      const b = members[j].patient
      const sameBirth = !!a.birthDate && a.birthDate === b.birthDate
      const pa = digits(a.phone)
      const sameTel = pa.length >= 8 && pa === digits(b.phone)
      if (sameBirth || sameTel) parent[find(i)] = find(j)
    }
  }
  const groups = new Map<number, MemberInfo[]>()
  members.forEach((m, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), m]))
  return [...groups.values()]
}

/** お名前が同じカルテを探して、まとめる組を作る */
export function findDuplicateGroups(patients: Patient[], store: RecordStore, today: string): NameGroup[] {
  const activity = activityByPatient(store, today)
  const byName = new Map<string, Patient[]>()
  for (const p of patients) {
    const key = nameKey(p.name ?? '')
    if (!key) continue
    byName.set(key, [...(byName.get(key) ?? []), p])
  }
  const groups: NameGroup[] = []
  for (const [key, list] of byName) {
    if (list.length < 2) continue
    const all = list.map((p) => memberInfo(p, activity))
    const parts = clusters(all)
    const sureUnits = parts.filter((c) => c.length >= 2).map(unitOf)
    groups.push({ key, name: pickKeep(all).patient.name, all, sureUnits, hasUnsure: parts.length > 1 })
  }
  // 「同じ方」の組がある名前を先に、そのあとは名前の順
  return groups.sort((a, b) => (b.sureUnits.length > 0 ? 1 : 0) - (a.sureUnits.length > 0 ? 1 : 0) || a.name.localeCompare(b.name, 'ja'))
}

/** 名前ごとの選び方：同じ方だけ（既定）／全員まとめる／まとめない */
export type GroupMode = 'sure' | 'all' | 'none'

export function defaultMode(group: NameGroup): GroupMode {
  return group.sureUnits.length > 0 ? 'sure' : 'none'
}

/** 選び方から、実際にまとめる組を出す */
export function unitsFor(group: NameGroup, mode: GroupMode): DuplicateUnit[] {
  if (mode === 'none') return []
  if (mode === 'all') return [unitOf(group.all)]
  return group.sureUnits
}

// ── まとめる（端末のデータを書きかえる） ─────────────────────────

function mergeNoah(links: (NoahLink | undefined)[]): NoahLink | undefined {
  const list = links.filter((l): l is NoahLink => !!l)
  if (list.length === 0) return undefined
  const ids = [...new Set(list.flatMap((l) => l.ids ?? []))].sort((x, y) => Number(x) - Number(y))
  const firsts = list.map((l) => l.firstVisit).filter((v): v is string => !!v).sort()
  const lasts = list.map((l) => l.lastVisit).filter((v): v is string => !!v).sort()
  const counts = list.map((l) => l.visitCount).filter((v): v is number => typeof v === 'number')
  const imported = list.map((l) => l.importedAt).filter(Boolean).sort()
  return {
    ids,
    firstVisit: firsts[0],
    lastVisit: lasts[lasts.length - 1],
    visitCount: counts.length ? Math.max(...counts) : undefined,
    importedAt: imported[imported.length - 1] ?? '',
  }
}

const TEXT_FIELDS = [
  'kana',
  'birthDate',
  'phone',
  'emergencyContact',
  'mainComplaint',
  'diagnosisLabel',
  'onsetDate',
  'postalCode',
  'address',
  'email',
  'occupation',
] as const

/** 残す方のカルテに、消す方の情報を足す（残す方に書いてある欄は上書きしない） */
export function mergePatient(keep: Patient, others: Patient[], nowIso: string): Patient {
  const merged: Patient = { ...keep }
  for (const field of TEXT_FIELDS) {
    if (!merged[field]) {
      const found = others.map((o) => o[field]).find((v) => typeof v === 'string' && v.trim())
      if (found) (merged as unknown as Record<string, unknown>)[field] = found
    }
  }
  if (!merged.insurance) merged.insurance = others.map((o) => o.insurance).find(Boolean)
  // いちばん早い初診日
  const firstVisits = [keep, ...others].map((p) => p.firstVisitDate).filter(Boolean).sort()
  if (firstVisits[0]) merged.firstVisitDate = firstVisits[0]
  // NOAH の受診者番号はすべて残す（次の取り込みで、別の方としてまた作られないように）
  const noah = mergeNoah([keep.noah, ...others.map((o) => o.noah)])
  if (noah) merged.noah = noah
  // 施術者メモは消さずに後ろへつなげる
  const notes = others.map((o) => o.therapistNotes?.trim()).filter((n): n is string => !!n && n !== keep.therapistNotes?.trim())
  if (notes.length) {
    merged.therapistNotes = [keep.therapistNotes?.trim(), ...notes.map((n) => `（まとめたカルテのメモ）${n}`)].filter(Boolean).join('\n')
  }
  merged.updatedAt = nowIso
  return merged
}

export interface MergeResult {
  patients: Patient[]
  store: RecordStore
  pinned: string[]
  recent: Array<{ id: string; at: string }>
  /** 消したカルテの数 */
  removed: number
  /** 移した記録の数 */
  moved: number
  /** 1人に1つだけの入れ物で、重なって古い方を外した数 */
  droppedSingles: number
}

/** まとめる組に従って、カルテと記録を書きかえた結果を作る（保存はしない） */
export function applyMerge(
  patients: Patient[],
  store: RecordStore,
  units: DuplicateUnit[],
  pinned: string[],
  recent: Array<{ id: string; at: string }>,
  nowIso: string,
): MergeResult {
  // 消す方のID → 残す方のID
  const to = new Map<string, string>()
  const keepers = new Map<string, Patient>()
  for (const unit of units) {
    const keepId = unit.keep.patient.id
    const others = unit.members.map((m) => m.patient).filter((p) => p.id !== keepId)
    if (others.length === 0) continue
    for (const o of others) to.set(o.id, keepId)
    keepers.set(keepId, mergePatient(unit.keep.patient, others, nowIso))
  }

  const nextPatients = patients.filter((p) => !to.has(p.id)).map((p) => keepers.get(p.id) ?? p)

  let moved = 0
  let droppedSingles = 0
  const nextStore: RecordStore = {}
  for (const key of PATIENT_RECORD_KEYS) {
    const list = store[key]
    if (!list) continue
    let next = list.map((r) => {
      const pid = typeof r.patientId === 'string' ? r.patientId : ''
      const target = to.get(pid)
      if (!target) return r
      moved += 1
      return { ...r, patientId: target }
    })
    if (ONE_PER_PATIENT.has(key)) {
      // 同じ方に2つになったら、更新日（無ければ作成日）が新しい方を残す
      const best = new Map<string, AnyRecord>()
      for (const r of next) {
        const pid = String(r.patientId ?? '')
        const cur = best.get(pid)
        const stamp = (x: AnyRecord) => String(x.updatedAt ?? x.createdAt ?? '')
        if (!cur || stamp(r) > stamp(cur)) best.set(pid, r)
      }
      const before = next.length
      next = next.filter((r) => best.get(String(r.patientId ?? '')) === r)
      droppedSingles += before - next.length
    }
    nextStore[key] = next
  }

  const nextPinned = [...new Set(pinned.map((id) => to.get(id) ?? id))]
  const seen = new Set<string>()
  const nextRecent = recent
    .map((v) => ({ ...v, id: to.get(v.id) ?? v.id }))
    .filter((v) => (seen.has(v.id) ? false : (seen.add(v.id), true)))

  return { patients: nextPatients, store: nextStore, pinned: nextPinned, recent: nextRecent, removed: to.size, moved, droppedSingles }
}

// ── 端末の localStorage とのやりとり（画面から使う） ──────────────────

function readArray<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

export function readRecordStore(): RecordStore {
  const store: RecordStore = {}
  for (const key of PATIENT_RECORD_KEYS) store[key] = readArray<AnyRecord>(key)
  return store
}

/** 端末の全データの控え（同期から外している一時データ以外）。まとめる前に保存してもらう */
export function backupJson(): string {
  const data: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || key === 'rehabStore_session') continue
    const value = localStorage.getItem(key)
    if (value !== null) data[key] = value
  }
  return JSON.stringify({ kind: 'yuuki-karte-backup', savedAt: new Date().toISOString(), data })
}

/** まとめた結果を端末に書く。書いたあと、クラウドへすぐ控えを送る（失敗しても端末には残る） */
export async function writeMerge(result: MergeResult): Promise<{ cloud: boolean }> {
  localStorage.setItem('pt_patients', JSON.stringify(result.patients))
  for (const [key, list] of Object.entries(result.store)) localStorage.setItem(key, JSON.stringify(list))
  localStorage.setItem('pt_pinned', JSON.stringify(result.pinned))
  localStorage.setItem('pt_recent_views', JSON.stringify(result.recent))
  try {
    const { isSyncEnabled, pushToCloud } = await import('./sync-service')
    if (!isSyncEnabled()) return { cloud: false }
    return { cloud: await pushToCloud() }
  } catch {
    return { cloud: false }
  }
}
