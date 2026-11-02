/**
 * AIが振り分けた結果を、SOAPの記入欄へ入れる（すでに書いてある内容は消さない）
 *
 * - 空の欄（または最初から入っている見本の値）→ そのまま入れる
 * - すでに書いてある欄 → 文章の欄は改行して下に足す、1行の欄は「／」で足す（同じ文がもう入っていれば足さない）
 * - 痛みの数字・自宅運動 → 話に出たときだけ入れる。腫れ・熱感 → 「ある」と出たときだけオンにする（オフにはしない）
 * 「書き込む前に戻す」は、AIが入れたままの欄だけを元に戻す（そのあと院長が直した欄はそのまま）。
 */
import { VOICE_SOAP_FIELDS, type HomeExerciseAdherence, type SoapTextKey, type VoiceSoapResult } from './soap-fields'

export type VoiceSoapTarget = Record<SoapTextKey, string> & {
  painToday: number
  swelling: boolean
  heat: boolean
  homeExerciseAdherence: HomeExerciseAdherence
}

type TargetKey = keyof VoiceSoapTarget
export interface VoiceChange {
  key: TargetKey
  before: VoiceSoapTarget[TargetKey]
  after: VoiceSoapTarget[TargetKey]
}

export function planVoiceSoapChanges(form: VoiceSoapTarget, result: VoiceSoapResult, defaults: Partial<VoiceSoapTarget>): VoiceChange[] {
  const changes: VoiceChange[] = []
  for (const field of VOICE_SOAP_FIELDS) {
    const add = result.fields[field.key]?.trim()
    if (!add) continue
    const current = form[field.key] ?? ''
    let next: string
    if (!current.trim() || current === defaults[field.key]) next = add
    else if (current.includes(add)) continue
    else next = field.singleLine ? `${current}／${add}` : `${current}\n${add}`
    changes.push({ key: field.key, before: current, after: next })
  }
  if (result.painToday !== undefined && result.painToday !== form.painToday) {
    changes.push({ key: 'painToday', before: form.painToday, after: result.painToday })
  }
  if (result.swelling && !form.swelling) changes.push({ key: 'swelling', before: false, after: true })
  if (result.heat && !form.heat) changes.push({ key: 'heat', before: false, after: true })
  if (result.homeExerciseAdherence && result.homeExerciseAdherence !== form.homeExerciseAdherence) {
    changes.push({ key: 'homeExerciseAdherence', before: form.homeExerciseAdherence, after: result.homeExerciseAdherence })
  }
  return changes
}

/** 欄に入れる */
export function applyVoiceChanges<T extends VoiceSoapTarget>(form: T, changes: VoiceChange[]): T {
  const next = { ...form } as Record<string, unknown>
  for (const c of changes) next[c.key] = c.after
  return next as T
}

/** 書き込む前に戻す（AIが入れたままの欄だけ） */
export function undoVoiceChanges<T extends VoiceSoapTarget>(form: T, changes: VoiceChange[]): T {
  const next = { ...form } as Record<string, unknown>
  for (const c of changes) {
    if (next[c.key] === c.after) next[c.key] = c.before
  }
  return next as T
}
