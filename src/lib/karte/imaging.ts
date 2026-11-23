/**
 * 画像レポート（DICOMの読み取り）の、画面にもテストにも使う純粋な関数
 *
 * - CDに入っている方と、開いているカルテの方が同じかを見る（別の方のカルテに提出しないため）
 * - 読影プログラム（院のパソコン）から届いた結果を、カルテの記録の形にする
 * - 院長が気づいたことの見直し（相談。2026-11-23）：CDのどの検査を読み直すか・前回の読影として何を渡すか・答えの記録の形
 */
import type { ImagingConsult, ImagingConsultVerdict, ImagingEstimate, ImagingReport, Patient } from '@/types/patient'

/** CDから読んだ方（読影プログラムの /scan） */
export interface CdPatient {
  name: string
  id: string
  /** yyyy-MM-dd（無ければ空） */
  birth_date: string
  sex: string
}

export type IdentityLevel = 'ok' | 'check' | 'mismatch'

export interface IdentityCheck {
  level: IdentityLevel
  /** 画面に出す説明 */
  message: string
}

function norm(text: string): string {
  return (text ?? '').normalize('NFKC').replace(/[\s　^,.・]/g, '').toLowerCase()
}

/** お名前が同じか。CDがローマ字でカルテが漢字・かなのときは比べられない（null） */
export function sameName(cdName: string, patient: Pick<Patient, 'name' | 'kana'>): boolean | null {
  const cd = norm(cdName)
  if (!cd) return null
  const candidates = [norm(patient.name), norm(patient.kana)].filter(Boolean)
  if (candidates.length === 0) return null
  if (candidates.some(c => c === cd)) return true
  // 姓と名の順がちがうだけ（例：花子 試験）
  const parts = (cdName ?? '').normalize('NFKC').split(/[\s　^]+/).filter(Boolean)
  if (parts.length === 2 && candidates.includes(norm(parts[1] + parts[0]))) return true
  // 文字の種類がちがう（ローマ字とかな・漢字）と比べられない
  const ascii = (s: string) => /^[\x20-\x7e]+$/.test(s)
  if (candidates.every(c => ascii(c) !== ascii(cd))) return null
  return false
}

/**
 * CDの方とカルテの方を比べる。
 * - 生年月日が同じ → そのまま進める
 * - 生年月日がちがう → 別の方のCDの恐れ（確かめるまで進めない）
 * - 生年月日が比べられない → お名前で見る。お名前も比べられない・ちがうときは、確かめてもらう
 */
export function checkIdentity(cd: CdPatient, patient: Pick<Patient, 'name' | 'kana' | 'birthDate'>): IdentityCheck {
  const cdBirth = /^\d{4}-\d{2}-\d{2}$/.test(cd.birth_date) ? cd.birth_date : ''
  const ptBirth = /^\d{4}-\d{2}-\d{2}$/.test(patient.birthDate ?? '') ? patient.birthDate : ''
  const name = sameName(cd.name, patient)
  if (cdBirth && ptBirth) {
    if (cdBirth !== ptBirth) {
      return { level: 'mismatch', message: `CDの方の生年月日（${cdBirth}）が、このカルテ（${ptBirth}）とちがいます。別の方のCDではありませんか？` }
    }
    if (name === false) {
      return { level: 'check', message: `生年月日は同じですが、CDのお名前（${cd.name}）がカルテとちがいます。ご確認ください。` }
    }
    return { level: 'ok', message: '生年月日がカルテと同じです。' }
  }
  if (name === true) return { level: 'ok', message: 'お名前がカルテと同じです（生年月日は比べられませんでした）。' }
  if (name === false) return { level: 'mismatch', message: `CDのお名前（${cd.name || '記載なし'}）が、このカルテとちがいます。別の方のCDではありませんか？` }
  return { level: 'check', message: 'CDの方とカルテの方が同じか、自動では確かめられませんでした。お名前・生年月日をご確認ください。' }
}

/** 読影プログラムが返す、読影の結果 */
export interface ReaderResult {
  title_region: string
  headline: string
  summary: string[]
  estimates: ImagingEstimate[]
  modalities: string[]
  counts: Record<string, number>
  study_date: string
  institution: string
  bytes: number
  file_name: string
  minutes: number
}

const text = (v: unknown, max: number) => String(v ?? '').slice(0, max)

/** 読影の結果を、カルテに残す記録の形にする（届いた値はそのまま信じず、形と長さを整える） */
export function toImagingReport(input: {
  id: string
  patientId: string
  result: ReaderResult
  complaint: string
  storagePath: string
  bytes: number
  submittedAt: string
  submittedBy?: string
}): ImagingReport {
  const r = input.result
  const counts: Record<string, number> = {}
  for (const [k, v] of Object.entries(r.counts ?? {})) {
    if (Number.isFinite(Number(v))) counts[text(k, 20)] = Math.max(0, Math.round(Number(v)))
  }
  return {
    id: input.id,
    patientId: input.patientId,
    studyDate: /^\d{4}-\d{2}-\d{2}$/.test(r.study_date ?? '') ? r.study_date : '',
    region: text(r.title_region, 40),
    modalities: (Array.isArray(r.modalities) ? r.modalities : []).slice(0, 6).map(m => text(m, 20)),
    imageCounts: counts,
    institution: text(r.institution, 80) || undefined,
    headline: text(r.headline, 80),
    summary: (Array.isArray(r.summary) ? r.summary : []).slice(0, 8).map(s => text(s, 500)),
    estimates: (Array.isArray(r.estimates) ? r.estimates : []).slice(0, 10).map(e => ({
      condition: text(e?.condition, 80),
      percent: Math.max(0, Math.min(100, Math.round(Number(e?.percent) || 0))),
      basis: text(e?.basis, 240),
    })),
    complaint: text(input.complaint, 600),
    storagePath: input.storagePath,
    fileName: text(r.file_name, 80).replace(/[\\/:*?"<>|]/g, '') || '画像所見レポート.pdf',
    bytes: input.bytes,
    author: 'Claude（AI）',
    submittedAt: input.submittedAt,
    submittedBy: input.submittedBy,
  }
}

/** 「単純X線 4枚・MRI 139枚」 */
export function countsLabel(report: Pick<ImagingReport, 'modalities' | 'imageCounts'>): string {
  const counts = report.imageCounts ?? {}
  const keys = Object.keys(counts).length > 0 ? Object.keys(counts) : report.modalities
  return keys.map(k => (counts[k] ? `${k} ${counts[k]}枚` : k)).join('・')
}

/** **…** を強調にするための分け方（画面は <b> で出す。HTMLとしては解釈しない） */
export function splitEmphasis(textValue: string): Array<{ text: string; bold: boolean }> {
  const out: Array<{ text: string; bold: boolean }> = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(textValue)) !== null) {
    if (m.index > last) out.push({ text: textValue.slice(last, m.index), bold: false })
    out.push({ text: m[1], bold: true })
    last = m.index + m[0].length
  }
  if (last < textValue.length) out.push({ text: textValue.slice(last), bold: false })
  return out
}

// ──────────────────────────────────────────────
// 院長が気づいたことの見直し（相談）
// ──────────────────────────────────────────────

export const CONSULT_VERDICTS: Record<ImagingConsultVerdict, { label: string; tone: 'teal' | 'amber' | 'slate' }> = {
  seen: { label: '気づいた所見を確認', tone: 'teal' },
  partly: { label: '一部を確認', tone: 'amber' },
  not_seen: { label: '確認できず', tone: 'slate' },
  cannot_judge: { label: 'この画像では判断できない', tone: 'slate' },
}

export const MAX_OBSERVATION_CHARS = 600
export const MAX_LOCATION_CHARS = 200

/** 読影プログラムが返す、見直しの結果 */
export interface ReaderConsultResult {
  kind: 'consult'
  verdict: ImagingConsultVerdict
  verdict_label: string
  headline: string
  answer: string[]
  next: string[]
  title_region: string
  modalities: string[]
  counts: Record<string, number>
  study_date: string
  institution: string
  bytes: number
  file_name: string
  minutes: number
}

/** 読影プログラムが見直し（相談）に対応しているか（v1.1.0〜。古い版は features が無い） */
export function readerCanConsult(health: { features?: string[] } | null | undefined): boolean {
  return Array.isArray(health?.features) && health.features.includes('consult')
}

/**
 * CDのどの検査を読み直すか。レポートの撮影日と同じ日の検査を選ぶ（同じ日が無い・撮影日が分からないときは全部）。
 * matched が false なら、画面で「撮影日がちがいます」と知らせる
 */
export function studiesForReport(
  studies: Array<{ uid: string; date: string }>,
  report: Pick<ImagingReport, 'studyDate'>,
): { uids: string[]; matched: boolean } {
  const same = report.studyDate ? studies.filter(s => s.date === report.studyDate) : []
  if (same.length > 0) return { uids: same.map(s => s.uid), matched: true }
  return { uids: studies.map(s => s.uid), matched: !report.studyDate }
}

/** 前回の読影として渡すもの（AIが書いた要点だけ。PDF・お名前は渡さない） */
export function consultPrior(report: ImagingReport): {
  region: string
  headline: string
  summary: string[]
  estimates: Array<{ condition: string; percent: number }>
} {
  return {
    region: text(report.region, 40),
    headline: text(report.headline, 80),
    summary: (report.summary ?? []).slice(0, 8).map(s => text(s, 500)),
    estimates: (report.estimates ?? []).slice(0, 10).map(e => ({ condition: text(e.condition, 80), percent: e.percent })),
  }
}

/** 見直しの結果を、カルテに残す記録の形にする（届いた値はそのまま信じず、形と長さを整える） */
export function toImagingConsult(input: {
  id: string
  result: ReaderConsultResult
  observation: string
  location?: string
  storagePath: string
  bytes: number
  askedAt: string
  askedBy?: string
}): ImagingConsult {
  const r = input.result
  const verdict: ImagingConsultVerdict = r.verdict in CONSULT_VERDICTS ? r.verdict : 'cannot_judge'
  const lines = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v : []).slice(0, n).map(x => text(x, max)).filter(Boolean)
  return {
    id: input.id,
    observation: text(input.observation, MAX_OBSERVATION_CHARS),
    location: text(input.location, MAX_LOCATION_CHARS) || undefined,
    verdict,
    headline: text(r.headline, 80),
    answer: lines(r.answer, 6, 600),
    next: lines(r.next, 8, 300),
    storagePath: input.storagePath,
    fileName: text(r.file_name, 80).replace(/[\\/:*?"<>|]/g, '') || '画像の見直し.pdf',
    bytes: input.bytes,
    author: 'Claude（AI）',
    askedAt: input.askedAt,
    askedBy: input.askedBy,
  }
}

/** 画像レポートと、その相談のPDFの場所（削除・バックアップで使う） */
export function reportFilePaths(report: Pick<ImagingReport, 'storagePath' | 'consults'>): string[] {
  return [report.storagePath, ...(report.consults ?? []).map(c => c.storagePath)].filter(Boolean)
}
