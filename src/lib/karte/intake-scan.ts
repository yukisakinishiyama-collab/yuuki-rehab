// ──────────────────────────────────────────────
// 問診票の写真から、患者さんの基本情報を登録する（決まり。純粋な関数。画面・API・テストから使う）
//
// 2026-11-19 院長の依頼「問診票などの撮影（iPhone・Android・iPad）で新規患者情報の登録もできるように」。DECISIONS.md
//
// 流れ：端末で問診票を撮る → 写真を AI（Anthropic）で読み取る（/api/karte/intake-scan）→ ここで形を整える
//      → 画面の欄に入れる → 院長・スタッフが写真と見比べて直す → 保存（新しいカルテ／今あるカルテに足す）
// - AI の読み取りは下書き。保存するのは、人が確かめたあとの欄の中身だけ
// - 生年月日は、AI には「書いてあるとおりの元号・年・月・日」を答えさせ、西暦への計算はここでする（計算ちがいを防ぐ）
// - 今あるカルテに足すときは、空いている欄だけを埋める。カルテと問診票でちがう欄は、どちらにするかを人が選ぶ
// ──────────────────────────────────────────────
import type { BodyRegion, Gender, Patient } from '@/types/patient'
import { phoneDigits, samePhone } from '@/lib/karte-link'
import { kanaKey, personNameKey } from '@/lib/karte-from-reservation'

/** 一度に読み取る枚数（表・裏・続き） */
export const MAX_SCAN_IMAGES = 4
/** AI に送る写真の長辺（これより大きくても AI の側で縮められるので、送る量だけが増える） */
export const SCAN_MAX_EDGE = 1568
/** カルテに残す写真の長辺（あとで拡大して読めるように、AI 用より大きく） */
export const SCAN_KEEP_EDGE = 2200
/** AI に送る写真の合計の上限（院内アプリの API は1回 4.5MB まで） */
export const MAX_SCAN_TOTAL_BYTES = 3_800_000

export type ScanEra = '令和' | '平成' | '昭和' | '大正' | '西暦' | ''

/** 読み取る欄（unclear に入る名前もこれ） */
export const SCAN_FIELDS = [
  { key: 'name', label: 'お名前' },
  { key: 'kana', label: 'ふりがな' },
  { key: 'birthDate', label: '生年月日' },
  { key: 'gender', label: '性別' },
  { key: 'phone', label: '電話番号' },
  { key: 'postalCode', label: '郵便番号' },
  { key: 'address', label: '住所' },
  { key: 'email', label: 'メール' },
  { key: 'occupation', label: '職業・学校' },
  { key: 'emergencyContact', label: '緊急連絡先' },
  { key: 'chiefComplaint', label: '症状（どこが・どのように）' },
  { key: 'onset', label: 'いつから' },
  { key: 'injuryMechanism', label: 'きっかけ' },
  { key: 'sportsActivity', label: 'スポーツ・部活' },
  { key: 'pastMedicalHistory', label: '今までの病気・ケガ' },
  { key: 'currentMedications', label: '飲んでいる薬' },
  { key: 'otherNotes', label: 'そのほか' },
] as const
export type ScanFieldKey = (typeof SCAN_FIELDS)[number]['key']
const FIELD_KEYS = new Set<string>(SCAN_FIELDS.map((f) => f.key))

export function scanFieldLabel(key: string): string {
  return SCAN_FIELDS.find((f) => f.key === key)?.label ?? key
}

/** AI が答える形（書いてあるとおり。足りない欄は空） */
export interface IntakeScanRaw {
  isIntakeSheet?: unknown
  name?: unknown
  kana?: unknown
  birthEra?: unknown
  birthYear?: unknown
  birthMonth?: unknown
  birthDay?: unknown
  birthText?: unknown
  gender?: unknown
  phone?: unknown
  postalCode?: unknown
  address?: unknown
  email?: unknown
  occupation?: unknown
  emergencyContact?: unknown
  chiefComplaint?: unknown
  onsetText?: unknown
  onsetEra?: unknown
  onsetYear?: unknown
  onsetMonth?: unknown
  onsetDay?: unknown
  injuryMechanism?: unknown
  sportsActivity?: unknown
  pastMedicalHistory?: unknown
  currentMedications?: unknown
  otherNotes?: unknown
  unclear?: unknown
}

/** 形を整えた読み取りの結果（画面の欄に入れるもと） */
export interface IntakeScanResult {
  /** 問診票（患者さんが書いた用紙）が写っていたか */
  isIntakeSheet: boolean
  name: string
  kana: string
  /** YYYY-MM-DD（計算できなかったら空） */
  birthDate: string
  /** 問診票に書いてあった生年月日（見比べ用。例「昭和58年4月3日」） */
  birthText: string
  gender: Gender | ''
  phone: string
  postalCode: string
  address: string
  email: string
  occupation: string
  emergencyContact: string
  chiefComplaint: string
  /** YYYY-MM-DD（年月日がそろって書いてあったときだけ） */
  onsetDate: string
  /** 問診票に書いてあった「いつから」（例「2週間前」） */
  onsetText: string
  injuryMechanism: string
  sportsActivity: string
  pastMedicalHistory: string
  currentMedications: string
  otherNotes: string
  /** 読みにくかった欄（写真で確かめてもらう） */
  unclear: ScanFieldKey[]
}

// ── 文字を整える ────────────────────────────────

/** 1行の文字にする（改行・制御文字を除く・全角半角をそろえる・長さを切る） */
function line(value: unknown, max: number): string {
  if (typeof value !== 'string' && typeof value !== 'number') return ''
  return String(value)
    .normalize('NFKC')
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/** 文章の欄（改行は残す） */
function text(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/\r/g, '')
    .replace(/[^\S\n]+/g, ' ')
    // 改行のほかの制御文字を除く
    .replace(/[^\P{Cc}\n]/gu, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
}

function int(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\s*\d{1,4}\s*$/.test(value.normalize('NFKC')) ? Number(value.normalize('NFKC')) : NaN
  return Number.isInteger(n) ? n : null
}

/** 電話番号：数字とハイフンだけに（全角・長音の「ー」などもハイフンにそろえる） */
export function normalizePhone(value: unknown): string {
  const s = line(value, 30).replace(/[‐‑‒–—―ー－]/g, '-')
  const kept = s.replace(/[^0-9+\-]/g, '').replace(/-{2,}/g, '-').replace(/^-|-$/g, '')
  return kept
}

/** 日本の電話番号として桁が合うか（携帯・IP電話＝090/080/070/050 は11桁、固定電話は10桁） */
export function plausiblePhone(value: string): boolean {
  const digits = phoneDigits(value)
  if (!digits.startsWith('0')) return false
  return /^0[5789]0/.test(digits) ? digits.length === 11 : digits.length === 10
}

/** 郵便番号：7桁なら NNN-NNNN に（7桁でなければ空） */
export function normalizePostal(value: unknown): string {
  const digits = line(value, 20).replace(/[^0-9]/g, '')
  return digits.length === 7 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : ''
}

export function normalizeEmail(value: unknown): string {
  const s = line(value, 120).replace(/\s/g, '')
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? s : ''
}

function normalizeGender(value: unknown): Gender | '' {
  const s = line(value, 10)
  if (s === 'male' || s === '男' || s === '男性') return 'male'
  if (s === 'female' || s === '女' || s === '女性') return 'female'
  if (s === 'other' || s === 'その他') return 'other'
  return ''
}

// ── 日付 ──────────────────────────────────────

const ERA_START: Record<Exclude<ScanEra, '' | '西暦'>, { first: number; from: string; to: string }> = {
  // from〜to はその元号の期間（その外の日付は、読みちがいとして受けつけない）
  大正: { first: 1912, from: '1912-07-30', to: '1926-12-24' },
  昭和: { first: 1926, from: '1926-12-25', to: '1989-01-07' },
  平成: { first: 1989, from: '1989-01-08', to: '2019-04-30' },
  令和: { first: 2019, from: '2019-05-01', to: '9999-12-31' },
}

export function normalizeEra(value: unknown): ScanEra {
  const s = line(value, 10).toUpperCase()
  if (s === '令和' || s === 'R') return '令和'
  if (s === '平成' || s === 'H') return '平成'
  if (s === '昭和' || s === 'S') return '昭和'
  if (s === '大正' || s === 'T') return '大正'
  if (s === '西暦' || s === 'AD') return '西暦'
  return ''
}

function isoOf(year: number, month: number, day: number): string {
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return ''
  const d = new Date(Date.UTC(year, month - 1, day))
  // 無い日（2月30日など）は受けつけない
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return ''
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * 元号・年・月・日（書いてあるとおり）を西暦の日付にする。計算できない・ありえない日付は空。
 * 元号が無く年が4桁なら西暦として扱う（年が2桁以下で元号が無いものは、どの元号か分からないので空）。
 */
export function eraDateToIso(era: ScanEra, year: number | null, month: number | null, day: number | null): string {
  if (year == null || month == null || day == null) return ''
  if (era === '西暦' || era === '') {
    return year >= 1000 ? isoOf(year, month, day) : ''
  }
  const e = ERA_START[era]
  if (year < 1 || year > 99) return ''
  const iso = isoOf(e.first + year - 1, month, day)
  return iso && iso >= e.from && iso <= e.to ? iso : ''
}

/** 生年月日として成り立つか（今日より前・120年より昔ではない） */
export function plausibleBirthDate(iso: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return false
  if (iso > today) return false
  return Number(today.slice(0, 4)) - Number(iso.slice(0, 4)) <= 120
}

/** 日本時間の今日（YYYY-MM-DD） */
export function jstDate(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// ── AI の答えを整える ──────────────────────────────

export function normalizeScan(raw: IntakeScanRaw, today: string): IntakeScanResult {
  const unclear = new Set<ScanFieldKey>()
  if (Array.isArray(raw.unclear)) {
    for (const k of raw.unclear) if (typeof k === 'string' && FIELD_KEYS.has(k)) unclear.add(k as ScanFieldKey)
  }

  const birthText = line(raw.birthText, 40)
  let birthDate = eraDateToIso(normalizeEra(raw.birthEra), int(raw.birthYear), int(raw.birthMonth), int(raw.birthDay))
  if (birthDate && !plausibleBirthDate(birthDate, today)) birthDate = ''
  // 書いてあるのに日付にできなかった → 写真で確かめてもらう
  if (!birthDate && (birthText || int(raw.birthYear) != null)) unclear.add('birthDate')

  const onsetText = line(raw.onsetText, 80)
  let onsetDate = eraDateToIso(normalizeEra(raw.onsetEra), int(raw.onsetYear), int(raw.onsetMonth), int(raw.onsetDay))
  if (onsetDate && onsetDate > today) onsetDate = ''

  const phoneRaw = line(raw.phone, 30)
  const phone = normalizePhone(raw.phone)
  // 桁が合わない電話番号は、読みちがいかもしれない（読んだままを出して、写真で確かめてもらう）
  if (phoneRaw && !plausiblePhone(phone)) unclear.add('phone')

  const postalRaw = line(raw.postalCode, 20)
  const postalCode = normalizePostal(raw.postalCode)
  if (postalRaw && !postalCode) unclear.add('postalCode')

  const emailRaw = line(raw.email, 120)
  const email = normalizeEmail(raw.email)
  if (emailRaw && !email) unclear.add('email')

  return {
    isIntakeSheet: raw.isIntakeSheet !== false,
    name: line(raw.name, 40),
    kana: line(raw.kana, 60),
    birthDate,
    birthText,
    gender: normalizeGender(raw.gender),
    phone,
    postalCode,
    address: line(raw.address, 120),
    email,
    occupation: line(raw.occupation, 60),
    emergencyContact: line(raw.emergencyContact, 80),
    chiefComplaint: text(raw.chiefComplaint, 300),
    onsetDate,
    onsetText,
    injuryMechanism: text(raw.injuryMechanism, 300),
    sportsActivity: line(raw.sportsActivity, 100),
    pastMedicalHistory: text(raw.pastMedicalHistory, 300),
    currentMedications: text(raw.currentMedications, 200),
    otherNotes: text(raw.otherNotes, 400),
    unclear: SCAN_FIELDS.map((f) => f.key).filter((k) => unclear.has(k)),
  }
}

/** 何も読み取れなかった（白紙・ちがう写真） */
export function scanIsEmpty(r: IntakeScanResult): boolean {
  return !r.name && !r.kana && !r.birthDate && !r.birthText && !r.phone && !r.address && !r.chiefComplaint
}

// ── 画面の欄（基本情報） ─────────────────────────────

/** 登録・修正の画面の欄 */
export interface PatientInfoValues {
  name: string
  kana: string
  birthDate: string
  gender: Gender
  phone: string
  postalCode: string
  address: string
  email: string
  occupation: string
  emergencyContact: string
  mainComplaint: string
  bodyRegion: BodyRegion
  onsetDate: string
  therapistNotes: string
}

export const INFO_FIELDS: { key: keyof PatientInfoValues; label: string }[] = [
  { key: 'name', label: 'お名前' },
  { key: 'kana', label: 'ふりがな' },
  { key: 'birthDate', label: '生年月日' },
  { key: 'gender', label: '性別' },
  { key: 'phone', label: '電話番号' },
  { key: 'postalCode', label: '郵便番号' },
  { key: 'address', label: '住所' },
  { key: 'email', label: 'メール' },
  { key: 'occupation', label: '職業・学校' },
  { key: 'emergencyContact', label: '緊急連絡先' },
  { key: 'mainComplaint', label: '主訴' },
  { key: 'bodyRegion', label: '対象部位' },
  { key: 'onsetDate', label: '発症日' },
  { key: 'therapistNotes', label: '担当者メモ' },
]

export function emptyInfo(): PatientInfoValues {
  return {
    name: '',
    kana: '',
    birthDate: '',
    gender: 'other',
    phone: '',
    postalCode: '',
    address: '',
    email: '',
    occupation: '',
    emergencyContact: '',
    mainComplaint: '',
    bodyRegion: 'other',
    onsetDate: '',
    therapistNotes: '',
  }
}

export function infoFromPatient(p: Patient): PatientInfoValues {
  return {
    name: p.name ?? '',
    kana: p.kana ?? '',
    birthDate: p.birthDate ?? '',
    gender: p.gender ?? 'other',
    phone: p.phone ?? '',
    postalCode: p.postalCode ?? '',
    address: p.address ?? '',
    email: p.email ?? '',
    occupation: p.occupation ?? '',
    emergencyContact: p.emergencyContact ?? '',
    mainComplaint: p.mainComplaint ?? '',
    bodyRegion: p.bodyRegion ?? 'other',
    onsetDate: p.onsetDate ?? '',
    therapistNotes: p.therapistNotes ?? '',
  }
}

/** 症状の文から、対象部位の見当をつける（決まった言葉だけ。分からなければ null） */
export function guessBodyRegion(complaint: string): BodyRegion | null {
  const s = complaint.normalize('NFKC')
  const rules: [RegExp, BodyRegion][] = [
    [/股関節|そけい|鼠径|足の付け根|脚の付け根/, 'hip'],
    [/膝|ひざ|ヒザ/, 'knee'],
    [/足首|足関節|アキレス|かかと|踵/, 'ankle'],
    [/肩/, 'shoulder'],
    [/肘|ひじ|ヒジ/, 'elbow'],
    [/手首|手関節/, 'wrist'],
    // 「足首」「手首」の首は数えない
    [/(?<![足手])首|頚|頸|むち打ち|むちうち|寝違/, 'cervical'],
    [/腰|ぎっくり/, 'lumbar'],
    [/背中|胸椎|肋/, 'thoracic'],
  ]
  const hits = rules.filter(([re]) => re.test(s)).map(([, region]) => region)
  // 2か所以上に当てはまるときは決めない（人が選ぶ）
  return new Set(hits).size === 1 ? hits[0] : null
}

/** 読み取りの結果を、画面の欄の形にする（問診票に書いてあったことだけ） */
export function infoFromScan(scan: IntakeScanResult): Partial<PatientInfoValues> {
  const out: Partial<PatientInfoValues> = {}
  if (scan.name) out.name = scan.name
  if (scan.kana) out.kana = scan.kana
  if (scan.birthDate) out.birthDate = scan.birthDate
  if (scan.gender) out.gender = scan.gender
  if (scan.phone) out.phone = scan.phone
  if (scan.postalCode) out.postalCode = scan.postalCode
  if (scan.address) out.address = scan.address
  if (scan.email) out.email = scan.email
  if (scan.occupation) out.occupation = scan.occupation
  if (scan.emergencyContact) out.emergencyContact = scan.emergencyContact
  if (scan.chiefComplaint) {
    out.mainComplaint = scan.chiefComplaint.replace(/\n+/g, ' ').slice(0, 100)
    const region = guessBodyRegion(scan.chiefComplaint)
    if (region) out.bodyRegion = region
  }
  if (scan.onsetDate) out.onsetDate = scan.onsetDate
  return out
}

/** 欄が「入っていない」か（性別・対象部位は、初期値の「その他」を未入力として扱う） */
function isBlank(key: keyof PatientInfoValues, value: string): boolean {
  if (key === 'gender' || key === 'bodyRegion') return !value || value === 'other'
  return !value.trim()
}

/** 同じ中身か（電話は数字だけ・お名前とふりがなは空白や全角半角のちがいを無視して比べる） */
function sameValue(key: keyof PatientInfoValues, a: string, b: string): boolean {
  if (key === 'phone') return samePhone(phoneDigits(a), phoneDigits(b))
  if (key === 'name') return personNameKey(a) === personNameKey(b)
  if (key === 'kana') return kanaKey(a) === kanaKey(b)
  if (key === 'postalCode') return a.replace(/[^0-9]/g, '') === b.replace(/[^0-9]/g, '')
  return a.normalize('NFKC').replace(/\s+/g, '') === b.normalize('NFKC').replace(/\s+/g, '')
}

export interface ScanConflict {
  key: keyof PatientInfoValues
  label: string
  /** カルテに入っている値 */
  chart: string
  /** 問診票から読み取った値 */
  sheet: string
}

/**
 * 今の欄（カルテの値）に、読み取りの結果を重ねる。
 * - 空いている欄だけを埋める（filled に入る）
 * - カルテと問診票でちがう欄は、カルテの値のままにして conflicts に入れる（どちらにするかは人が選ぶ）
 */
export function mergeScanIntoInfo(
  current: PatientInfoValues,
  scan: IntakeScanResult,
): { values: PatientInfoValues; filled: (keyof PatientInfoValues)[]; conflicts: ScanConflict[] } {
  const fromSheet = infoFromScan(scan)
  const values: PatientInfoValues = { ...current }
  const filled: (keyof PatientInfoValues)[] = []
  const conflicts: ScanConflict[] = []
  for (const { key, label } of INFO_FIELDS) {
    const sheet = fromSheet[key]
    if (sheet == null || isBlank(key, String(sheet))) continue
    const chart = String(current[key] ?? '')
    if (isBlank(key, chart)) {
      ;(values as unknown as Record<string, string>)[key] = String(sheet)
      filled.push(key)
    } else if (!sameValue(key, chart, String(sheet))) {
      conflicts.push({ key, label, chart, sheet: String(sheet) })
    }
  }
  return { values, filled, conflicts }
}

/** 担当者メモに足す、問診票のそのほかの内容（基本情報の欄に入らないもの） */
export function sheetNoteOf(scan: IntakeScanResult, today: string): string {
  const rows: string[] = []
  if (scan.onsetText && !scan.onsetDate) rows.push(`いつから：${scan.onsetText}`)
  if (scan.injuryMechanism) rows.push(`きっかけ：${scan.injuryMechanism.replace(/\n+/g, ' ')}`)
  if (scan.sportsActivity) rows.push(`スポーツ・部活：${scan.sportsActivity}`)
  if (scan.pastMedicalHistory) rows.push(`今までの病気・ケガ：${scan.pastMedicalHistory.replace(/\n+/g, ' ')}`)
  if (scan.currentMedications) rows.push(`飲んでいる薬：${scan.currentMedications.replace(/\n+/g, ' ')}`)
  if (scan.otherNotes) rows.push(`そのほか：${scan.otherNotes.replace(/\n+/g, ' ')}`)
  if (rows.length === 0) return ''
  const when = /^\d{4}-\d{2}-\d{2}$/.test(today) ? `${Number(today.slice(5, 7))}/${Number(today.slice(8, 10))}` : ''
  return [`【問診票${when ? `（${when} 読み取り）` : ''}】`, ...rows].join('\n')
}

/** 担当者メモのうしろに足す（同じ文がもう入っていれば足さない） */
export function appendNote(current: string, add: string): string {
  const a = current.trim()
  const b = add.trim()
  if (!b) return a
  if (a.includes(b)) return a
  return (a ? `${a}\n\n${b}` : b).slice(0, 4000)
}

// ── 保存する形 ──────────────────────────────────

export type InfoProblem = { key: keyof PatientInfoValues; message: string }

/** 保存の前に確かめる（お名前は必須。日付は形だけ） */
export function checkInfo(values: PatientInfoValues, today: string): InfoProblem[] {
  const out: InfoProblem[] = []
  if (!personNameKey(values.name)) out.push({ key: 'name', message: 'お名前を入れてください。' })
  if (values.birthDate && !plausibleBirthDate(values.birthDate, today)) out.push({ key: 'birthDate', message: '生年月日を確かめてください（今日より先の日付・120年より前の日付は入れられません）。' })
  if (values.onsetDate && (!/^\d{4}-\d{2}-\d{2}$/.test(values.onsetDate) || values.onsetDate > today)) out.push({ key: 'onsetDate', message: '発症日を確かめてください（今日より先の日付は入れられません）。' })
  return out
}

const trimTo = (s: string, max: number) => s.trim().slice(0, max)

/**
 * 画面の欄から、保存するカルテを作る。
 * base があれば、そのカルテの欄だけを置きかえる（ID・状態・診断名・NOAH の情報・保険証などはそのまま）。
 * 無ければ新しいカルテ（初回来院の日は今日）。
 */
export function patientFromInfo(base: Patient | null, values: PatientInfoValues, fixed: { id: string; now: string; today: string }): Patient {
  const fields = {
    name: trimTo(values.name, 40),
    kana: trimTo(values.kana, 60),
    birthDate: values.birthDate,
    gender: values.gender,
    phone: trimTo(values.phone, 24),
    emergencyContact: trimTo(values.emergencyContact, 80),
    mainComplaint: trimTo(values.mainComplaint, 100),
    bodyRegion: values.bodyRegion,
    onsetDate: values.onsetDate,
    therapistNotes: trimTo(values.therapistNotes, 4000),
  }
  // 住所などは、入っているときだけ持つ（空の欄をカルテに増やさない。もとから入っていた欄を空にしたときは消す）
  const optional = {
    postalCode: trimTo(values.postalCode, 8),
    address: trimTo(values.address, 120),
    email: trimTo(values.email, 120),
    occupation: trimTo(values.occupation, 60),
  }
  const next: Patient = base
    ? { ...base, ...fields, updatedAt: fixed.now }
    : {
        id: fixed.id,
        ...fields,
        diagnosisLabel: '',
        firstVisitDate: fixed.today,
        status: 'active',
        createdAt: fixed.now,
        updatedAt: fixed.now,
      }
  for (const [key, value] of Object.entries(optional) as [keyof typeof optional, string][]) {
    if (value) next[key] = value
    else delete next[key]
  }
  return next
}

// ── 同じ方のカルテを探す ────────────────────────────

export interface ChartMatch<T> {
  patient: T
  /** なぜ同じ方と見たか（画面に出す） */
  reason: string
  /** お名前のほかにも同じものがある（生年月日・電話）。画面で、最初からこのカルテを選んでおいてよい */
  strong: boolean
}

/**
 * 問診票の方と同じかもしれないカルテ（強い順）。
 * - お名前と生年月日が同じ／お名前と電話が同じ／電話とふりがなが同じ … 同じ方
 * - お名前だけ同じ … 同じ方かもしれない（予約から自動で登録したカルテは、お名前と電話しか無い）
 */
export function chartsForSheet<T extends { id: string; name?: string; kana?: string; phone?: string; birthDate?: string }>(
  patients: T[],
  sheet: { name: string; kana: string; phone: string; birthDate: string },
): ChartMatch<T>[] {
  const name = personNameKey(sheet.name)
  const kana = kanaKey(sheet.kana)
  const digits = phoneDigits(sheet.phone)
  const scored: { m: ChartMatch<T>; score: number }[] = []
  for (const p of patients) {
    const sameName = Boolean(name) && personNameKey(p.name) === name
    const sameKana = Boolean(kana) && kanaKey(p.kana) === kana
    const samePh = Boolean(digits) && samePhone(phoneDigits(p.phone), digits)
    const sameBirth = Boolean(sheet.birthDate) && p.birthDate === sheet.birthDate
    const otherBirth = Boolean(sheet.birthDate) && Boolean(p.birthDate) && p.birthDate !== sheet.birthDate
    if (sameName && sameBirth) scored.push({ m: { patient: p, reason: 'お名前と生年月日が同じ', strong: true }, score: 4 })
    else if (sameName && samePh && !otherBirth) scored.push({ m: { patient: p, reason: 'お名前と電話番号が同じ', strong: true }, score: 3 })
    else if (samePh && sameKana && !otherBirth) scored.push({ m: { patient: p, reason: '電話番号とふりがなが同じ', strong: true }, score: 3 })
    else if (sameName && !otherBirth) scored.push({ m: { patient: p, reason: 'お名前が同じ', strong: false }, score: 2 })
    else if (sameName || (samePh && sameKana)) scored.push({ m: { patient: p, reason: `${sameName ? 'お名前' : '電話番号とふりがな'}が同じ（生年月日はちがいます）`, strong: false }, score: 1 })
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.m)
}

// ── アプリの問診票の欄に入れる ─────────────────────────

/** カルテの「問診票」タブの欄に入れる下書き（保存はスタッフが確かめてから） */
export interface IntakePrefill {
  chiefComplaint: string
  injuryDate: string
  injuryMechanism: string
  occupation: string
  sportsActivity: string
  pastMedicalHistory: string
  currentMedications: string
}

export const INTAKE_PREFILL_KEY = 'intakeScanPrefill'

export function intakePrefillOf(scan: IntakeScanResult): IntakePrefill | null {
  const out: IntakePrefill = {
    chiefComplaint: scan.chiefComplaint,
    injuryDate: scan.onsetDate,
    injuryMechanism: scan.injuryMechanism,
    occupation: scan.occupation,
    sportsActivity: scan.sportsActivity,
    pastMedicalHistory: scan.pastMedicalHistory,
    currentMedications: scan.currentMedications,
  }
  return Object.values(out).some(Boolean) ? out : null
}
