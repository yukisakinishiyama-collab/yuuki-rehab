// ──────────────────────────────────────────────
// 復帰プログラムの進み具合の決まり（始める・進む・戻す・終える・中止・再開）
// 画面にも保存にも触らない計算だけ。記録は書きかえず、新しい記録を返す
// ──────────────────────────────────────────────
import { programById, type ProgramStage, type ReturnProgram } from '@/data/return-programs'
import type { BodyRegion, Side } from '@/types/patient'
import type { ReturnProgramEvent, ReturnProgramEventKind, ReturnProgramRecord } from '@/types/return-programs'

export const RETURN_PROGRAMS_KEY = 'pt_return_programs'

export const EVENT_LABELS: Record<ReturnProgramEventKind, string> = {
  start: '開始',
  advance: '次の段階へ',
  back: '段階を戻した',
  finish: '終了（復帰）',
  stop: '中止',
  resume: '再開',
}

interface Stamp {
  /** その日（YYYY-MM-DD） */
  date: string
  /** 記録した時刻（ISO） */
  now: string
  eventId: string
  note?: string
}

function cleanNote(note: string | undefined): string | undefined {
  const t = (note ?? '').trim()
  return t ? t.slice(0, 200) : undefined
}

function event(kind: ReturnProgramEventKind, s: Stamp, from?: string, to?: string): ReturnProgramEvent {
  const e: ReturnProgramEvent = { id: s.eventId, kind, at: s.now, date: s.date }
  if (from) e.from = from
  if (to) e.to = to
  const note = cleanNote(s.note)
  if (note) e.note = note
  return e
}

/** 段階の番号（0 から。見つからなければ -1） */
export function stageIndex(program: ReturnProgram, stageId: string): number {
  return program.stages.findIndex((s) => s.id === stageId)
}

export function stageOf(program: ReturnProgram, stageId: string): ProgramStage | undefined {
  return program.stages.find((s) => s.id === stageId)
}

/** 始める（途中の段階から始めることもできる。無い段階なら最初から） */
export function startProgram(input: {
  id: string
  patientId: string
  programId: string
  stageId?: string
  side?: Side
} & Stamp): ReturnProgramRecord | null {
  const program = programById(input.programId)
  if (!program || program.stages.length === 0) return null
  const stageId = input.stageId && stageIndex(program, input.stageId) >= 0 ? input.stageId : program.stages[0].id
  const rec: ReturnProgramRecord = {
    id: input.id,
    patientId: input.patientId,
    programId: program.id,
    status: 'active',
    stageId,
    startedOn: input.date,
    stageSince: input.date,
    events: [event('start', input, undefined, stageId)],
    createdAt: input.now,
    updatedAt: input.now,
  }
  if (input.side && input.side !== 'na') rec.side = input.side
  return rec
}

/** 段階を動かす（進む・戻す）。同じ段階・無い段階・進行中でないときは null */
export function moveStage(rec: ReturnProgramRecord, toStageId: string, s: Stamp): ReturnProgramRecord | null {
  const program = programById(rec.programId)
  if (!program || rec.status !== 'active') return null
  const from = stageIndex(program, rec.stageId)
  const to = stageIndex(program, toStageId)
  if (to < 0 || to === from) return null
  return {
    ...rec,
    stageId: toStageId,
    stageSince: s.date,
    events: [...rec.events, event(to > from ? 'advance' : 'back', s, rec.stageId, toStageId)],
    updatedAt: s.now,
  }
}

/** 次の段階・前の段階（無ければ null） */
export function nextStage(rec: ReturnProgramRecord): ProgramStage | null {
  const program = programById(rec.programId)
  if (!program) return null
  const i = stageIndex(program, rec.stageId)
  return i >= 0 && i < program.stages.length - 1 ? program.stages[i + 1] : null
}
export function prevStage(rec: ReturnProgramRecord): ProgramStage | null {
  const program = programById(rec.programId)
  if (!program) return null
  const i = stageIndex(program, rec.stageId)
  return i > 0 ? program.stages[i - 1] : null
}

/** 終える（復帰した）。進行中のときだけ */
export function finishProgram(rec: ReturnProgramRecord, s: Stamp): ReturnProgramRecord | null {
  if (rec.status !== 'active') return null
  return { ...rec, status: 'finished', events: [...rec.events, event('finish', s, rec.stageId)], updatedAt: s.now }
}

/** 中止する（理由が要る）。進行中のときだけ */
export function stopProgram(rec: ReturnProgramRecord, s: Stamp): ReturnProgramRecord | null {
  if (rec.status !== 'active' || !cleanNote(s.note)) return null
  return { ...rec, status: 'stopped', events: [...rec.events, event('stop', s, rec.stageId)], updatedAt: s.now }
}

/** 再開する（中止・終了から。段階はそのまま、その日から数え直す） */
export function resumeProgram(rec: ReturnProgramRecord, s: Stamp): ReturnProgramRecord | null {
  if (rec.status === 'active') return null
  return { ...rec, status: 'active', stageSince: s.date, events: [...rec.events, event('resume', s, undefined, rec.stageId)], updatedAt: s.now }
}

/** YYYY-MM-DD の差（日） */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86_400_000)
}

/** いまの段階になってからの日数（今日を1日目とは数えない。0＝今日から） */
export function daysInStage(rec: ReturnProgramRecord, today: string): number {
  return Math.max(0, daysBetween(rec.stageSince, today))
}

/** 「段階3／7」のような位置（無い段階なら null） */
export function stagePosition(rec: ReturnProgramRecord): { index: number; total: number; stage: ProgramStage; program: ReturnProgram } | null {
  const program = programById(rec.programId)
  if (!program) return null
  const index = stageIndex(program, rec.stageId)
  if (index < 0) return null
  return { index, total: program.stages.length, stage: program.stages[index], program }
}

/** SOAP の欄に入れる文（「投球プログラム 段階3（塁間（20m））」）。区切りの文字（、。）は入れない */
export function soapPhrase(rec: ReturnProgramRecord): string | null {
  const pos = stagePosition(rec)
  if (!pos) return null
  return `${pos.program.short} 段階${pos.index + 1}（${pos.stage.title}）`
}

/** 進行中のプログラムの、SOAP に入れる文（新しく動かした順） */
export function activeSoapPhrases(records: ReturnProgramRecord[], patientId: string): string[] {
  return records
    .filter((r) => r.patientId === patientId && r.status === 'active')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(soapPhrase)
    .filter((p): p is string => !!p)
}

/** その方の部位に合うプログラムを先に並べる（順番は変えずに、合うもの → そのほか） */
export function programsFor(programs: ReturnProgram[], regions: BodyRegion[]): { mine: ReturnProgram[]; others: ReturnProgram[] } {
  const mine = programs.filter((p) => p.regions.some((r) => regions.includes(r)))
  return { mine, others: programs.filter((p) => !mine.includes(p)) }
}

/** 一覧に出す順：進行中（新しく動かした順）→ 終了・中止（新しい順） */
export function sortRecords(records: ReturnProgramRecord[]): ReturnProgramRecord[] {
  return [...records].sort((a, b) => {
    const A = a.status === 'active' ? 0 : 1
    const B = b.status === 'active' ? 0 : 1
    return A - B || b.updatedAt.localeCompare(a.updatedAt)
  })
}
