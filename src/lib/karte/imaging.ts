/**
 * 画像レポート（DICOMの読み取り）の、画面にもテストにも使う純粋な関数
 *
 * - CDに入っている方と、開いているカルテの方が同じかを見る（別の方のカルテに提出しないため）
 * - 読影プログラム（院のパソコン）から届いた結果を、カルテの記録の形にする
 */
import type { ImagingEstimate, ImagingReport, Patient } from '@/types/patient'

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
