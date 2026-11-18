// ──────────────────────────────────────────────
// SOAP の欄で「選べる文」を入れる・外すときの決まり（文そのものは src/data/soap-phrases.ts）
//
// - 入れる：いま書いてある文字は消さず、うしろに「、」でつなぐ
// - もう一度押す：その文だけを外す（「、」「。」改行で区切ったひとかたまりが、文とぴったり同じときだけ。
//   数字を書き足した文や、手で書いた文には触らない）
// - その方の部位（部位別NRS・人体図で押した関節・表紙の部位）の文を先に出す
// - 数字を書く文（＿ がある）は、足した直後に ＿ を選んだ状態にする（そのまま数字を打つ）
// ──────────────────────────────────────────────
import { PHRASE_BLANK, SOAP_PHRASES, type SoapPhraseField } from '@/data/soap-phrases'
import { BODY_REGION_LABELS, type BodyRegion, type ComplaintEntry } from '@/types/patient'

const SEPARATOR = '、'
const BREAKS = /([、。\n])/

/** 部位ごとの文を持てる部位（出す順） */
export const PHRASE_REGIONS: BodyRegion[] = ['knee', 'ankle', 'hip', 'shoulder', 'elbow', 'wrist', 'lumbar', 'cervical']

/** 部位の短い名前（切りかえのボタン用） */
export const PHRASE_REGION_SHORT: Partial<Record<BodyRegion, string>> = {
  knee: '膝',
  ankle: '足',
  hip: '股',
  shoulder: '肩',
  elbow: '肘',
  wrist: '手',
  lumbar: '腰',
  cervical: '頚',
}

/** 欄の文字を、区切り（、。改行）ごとのかたまりにする */
export function phraseSegments(value: string): string[] {
  return value
    .split(BREAKS)
    .filter((_, i) => i % 2 === 0)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** その文が、もう欄に入っているか（かたまりが文とぴったり同じ） */
export function hasPhrase(value: string, phrase: string): boolean {
  return phraseSegments(value).includes(phrase)
}

/** うしろに足す（書いてある文字は消さない） */
export function addPhrase(value: string, phrase: string): string {
  const base = value.replace(/[ \t　]+$/, '')
  if (!base) return phrase
  if (/[、。\n]$/.test(base)) return base + phrase
  return base + SEPARATOR + phrase
}

/** その文だけを外す（最初の1つ。となりの「、」も1つ外す） */
export function removePhrase(value: string, phrase: string): string {
  const parts = value.split(BREAKS) // [文, 区切り, 文, 区切り, …]
  const at = parts.findIndex((p, i) => i % 2 === 0 && p.trim() === phrase)
  if (at < 0) return value
  parts[at] = ''
  if (at > 0 && parts[at - 1] === SEPARATOR) parts[at - 1] = ''
  else if (parts[at + 1] === SEPARATOR) parts[at + 1] = ''
  return parts.join('').replace(/^[ \t　]+/, '')
}

/**
 * 文を足した直後に、数字を書く場所（＿）を選ぶ位置。文はいつも欄のいちばんうしろに付くので、そこから数える。
 * ＿ の無い文は null
 */
export function blankSelection(next: string, phrase: string): [number, number] | null {
  const at = phrase.indexOf(PHRASE_BLANK)
  if (at < 0 || !next.endsWith(phrase)) return null
  const start = next.length - phrase.length + at
  return [start, start + PHRASE_BLANK.length]
}

/** 押したときの動き：入っていれば外す、無ければ足す。1つだけ選ぶ欄は入れかえる */
export function togglePhrase(value: string, phrase: string, single = false): string {
  if (single) return value.trim() === phrase ? '' : phrase
  return hasPhrase(value, phrase) ? removePhrase(value, phrase) : addPhrase(value, phrase)
}

/** その欄で、部位ごとの文がある部位（出す順） */
export function phraseRegions(field: SoapPhraseField): BodyRegion[] {
  const by = SOAP_PHRASES[field].byRegion
  if (!by) return []
  return PHRASE_REGIONS.filter((r) => (by[r]?.length ?? 0) > 0)
}

const REGION_BY_LABEL = Object.fromEntries(
  (Object.keys(BODY_REGION_LABELS) as BodyRegion[]).map((r) => [BODY_REGION_LABELS[r], r]),
) as Record<string, BodyRegion>

/**
 * その方の部位（先に出す順）：経過中の部位別NRS → 人体図で押した関節 → 表紙の部位。
 * 軽快・終了にした部位は入れない
 */
export function regionsForPhrases(input: {
  complaints?: Pick<ComplaintEntry, 'bodyRegion' | 'status'>[]
  joints?: string[]
  patientRegion?: BodyRegion
}): BodyRegion[] {
  const out: BodyRegion[] = []
  const push = (r: BodyRegion | undefined) => {
    if (r && PHRASE_REGIONS.includes(r) && !out.includes(r)) out.push(r)
  }
  for (const c of input.complaints ?? []) if (c.status !== 'resolved') push(c.bodyRegion)
  for (const j of input.joints ?? []) push(REGION_BY_LABEL[j])
  if (out.length === 0) push(input.patientRegion)
  return out
}

export interface PhraseGroup {
  /** 見出し（部位の名前。どの部位でも使う文は null） */
  region: BodyRegion | null
  label: string
  phrases: string[]
}

/** 出す文（部位の文 → どの部位でも使う文） */
export function phraseGroups(field: SoapPhraseField, region: BodyRegion | null): PhraseGroup[] {
  const set = SOAP_PHRASES[field]
  const groups: PhraseGroup[] = []
  const regional = region ? set.byRegion?.[region] ?? [] : []
  if (region && regional.length > 0) groups.push({ region, label: BODY_REGION_LABELS[region], phrases: regional })
  groups.push({ region: null, label: regional.length > 0 ? 'どの部位でも' : '', phrases: set.common })
  return groups
}

/** 1つだけ選ぶ欄か（通院目安） */
export function isSinglePhraseField(field: SoapPhraseField): boolean {
  return SOAP_PHRASES[field].single === true
}
