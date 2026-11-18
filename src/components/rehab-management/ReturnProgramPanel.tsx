'use client'
/**
 * カルテ「評価・測定」の「復帰プログラム」欄（2026-11-18 院長の依頼）
 *
 * - 段階的に競技・ランニング・投球へ戻す手順を、その方に始める → いまの段階を見る → 進む・戻す・終える・中止
 * - プログラムの中身と文献は src/data/return-programs.ts（文献で確かめた範囲と、当院の目安を分けて出す）
 * - 進み具合は pt_return_programs（src/lib/return-programs/）。ほかの記録は書きかえない
 * - 院内で院長・スタッフが見る欄。患者さんにお見せする画面ではない
 */
import { useState } from 'react'
import { nanoid } from 'nanoid'
import { ChevronDown, ChevronUp, ExternalLink, Footprints } from 'lucide-react'
import type { BodyRegion, Patient, Side } from '@/types/patient'
import { BODY_REGION_LABELS } from '@/types/patient'
import type { ReturnProgramRecord } from '@/types/return-programs'
import {
  COMMON_STOP, NO_PROGRAM_REGIONS, PROGRAMS_CHECKED_ON, PROGRAM_NOTE, RETURN_PROGRAMS, SOURCE_CHECK_LABEL,
  doiUrl, programById, pubmedUrl, type ReturnProgram,
} from '@/data/return-programs'
import {
  EVENT_LABELS, daysInStage, finishProgram, moveStage, nextStage, prevStage, programsFor, resumeProgram,
  stagePosition, startProgram, stopProgram,
} from '@/lib/return-programs/progress'
import { getReturnPrograms, saveReturnProgram } from '@/lib/return-programs/store'
import { shortDate } from '@/lib/reeval/schedule'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card } from './shared'

const SIDES: { value: Side; label: string }[] = [
  { value: 'na', label: '左右なし' },
  { value: 'right', label: '右' },
  { value: 'left', label: '左' },
  { value: 'bilateral', label: '両側' },
]
const sideLabel = (side: Side | undefined) => (side && side !== 'na' ? `（${SIDES.find(s => s.value === side)?.label ?? ''}）` : '')

const chip = (on: boolean) =>
  cn(
    'min-h-10 rounded-full border px-3 text-sm transition-colors lg:min-h-8',
    on ? 'border-teal-700 bg-teal-700 font-bold text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  )

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
      {items.map(t => <li key={t}>{t}</li>)}
    </ul>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold text-slate-600">{children}</p>
}

/** プログラムの中身（対象・始める前・決まり・段階・中止の目安・文献） */
function ProgramDetail({ program, currentStageId }: { program: ReturnProgram; currentStageId?: string }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Heading>対象</Heading>
        <p className="text-sm text-slate-800">{program.forWhom}</p>
      </div>
      <div className="space-y-1">
        <Heading>始める前に確かめること</Heading>
        <Bullets items={program.before} />
      </div>
      <div className="space-y-1">
        <Heading>進め方の決まり</Heading>
        <Bullets items={program.rules} />
      </div>
      <div className="space-y-1.5">
        <Heading>段階（{program.stages.length}段階）</Heading>
        <ol className="space-y-1.5">
          {program.stages.map((s, i) => (
            <li key={s.id}
              className={cn('rounded-lg border px-3 py-2 text-sm', s.id === currentStageId ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white')}>
              <p className="font-bold text-slate-900">
                段階{i + 1}　{s.title}
                {s.id === currentStageId && <span className="ml-2 text-xs font-bold text-teal-800">いまここ</span>}
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-800">
                {s.doing.map(t => <li key={t}>{t}</li>)}
              </ul>
              {s.advance && (
                <p className="mt-1 text-xs text-slate-700">次へ進む目安：{s.advance.join('／')}</p>
              )}
            </li>
          ))}
        </ol>
      </div>
      <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <p className="text-xs font-bold text-amber-900">こうなったら中止して、院長が判断する（必要なら医師へ）</p>
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-amber-950">
          {[...program.stop, ...COMMON_STOP].map(t => <li key={t}>{t}</li>)}
        </ul>
      </div>
      <div className="space-y-2">
        <Heading>文献で分かっていること（{PROGRAMS_CHECKED_ON} に PubMed で確認）</Heading>
        <p className="text-sm text-slate-800">{program.evidence}</p>
        {program.unverified && program.unverified.length > 0 && (
          <div className="space-y-1 rounded-lg bg-slate-100 px-3 py-2">
            <p className="text-xs font-bold text-slate-700">文献で確かめられていないこと（院長が確かめて決める）</p>
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-800">
              {program.unverified.map(t => <li key={t}>{t}</li>)}
            </ul>
          </div>
        )}
        <ul className="space-y-2">
          {program.sources.map(s => (
            <li key={s.doi} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <p className="font-bold text-slate-900">
                {s.label}
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{SOURCE_CHECK_LABEL[s.checked]}</span>
              </p>
              <p className="mt-1 text-slate-800">{s.found}</p>
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {s.pmid && (
                  <a href={pubmedUrl(s.pmid)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-teal-800 underline max-lg:min-h-10">
                    PubMed {s.pmid}<ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                )}
                <a href={doiUrl(s.doi)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 break-all font-medium text-teal-800 underline max-lg:min-h-10">
                  doi:{s.doi}<ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

type Mode =
  | { kind: 'idle' }
  | { kind: 'pick' }
  | { kind: 'preview'; programId: string }
  | { kind: 'back' | 'stop' | 'finish'; id: string }

interface Props {
  patient: Patient
  /** 今日（YYYY-MM-DD。日本時間） */
  today: string
  /** その方の部位（合うプログラムを先に出す） */
  regions: BodyRegion[]
  onUpdate?: () => void
}

export default function ReturnProgramPanel({ patient, today, regions, onUpdate }: Props) {
  const [records, setRecords] = useState<ReturnProgramRecord[]>(() => getReturnPrograms(patient.id))
  const active = records.filter(r => r.status === 'active')
  const past = records.filter(r => r.status !== 'active')
  const [open, setOpen] = useState(active.length > 0)
  const [mode, setMode] = useState<Mode>({ kind: 'idle' })
  const [note, setNote] = useState('')
  const [side, setSide] = useState<Side>('na')
  const [startStage, setStartStage] = useState('')
  const [detailFor, setDetailFor] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)

  const stamp = () => ({ date: today, now: new Date().toISOString(), eventId: nanoid(10), note })
  function commit(next: ReturnProgramRecord | null) {
    if (!next) return
    saveReturnProgram(next)
    setRecords(getReturnPrograms(patient.id))
    setMode({ kind: 'idle' })
    setNote('')
    onUpdate?.()
  }
  function reset(next: Mode = { kind: 'idle' }) {
    setMode(next)
    setNote('')
  }

  const { mine, others } = programsFor(RETURN_PROGRAMS, regions)
  const missing = regions.map(r => NO_PROGRAM_REGIONS[r]).filter((t): t is string => !!t)
  const preview = mode.kind === 'preview' ? programById(mode.programId) : undefined

  const summary = active.length > 0
    ? active.map(r => {
        const pos = stagePosition(r)
        return pos ? `${pos.program.short} 段階${pos.index + 1}／${pos.total}` : ''
      }).filter(Boolean).join('・')
    : '段階的に競技・ランニング・投球へ戻す手順（文献つき）'

  return (
    <Card className="mb-4 overflow-hidden">
      <div id="return-program">
        <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left sm:px-6 max-lg:min-h-12">
          <Footprints className="h-5 w-5 flex-shrink-0 text-teal-700" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-slate-900">復帰プログラム</span>
            <span className="block truncate text-xs text-slate-600">{summary}</span>
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-slate-500" aria-hidden /> : <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden />}
        </button>

        {open && (
          <div className="space-y-5 border-t border-slate-100 px-4 pb-5 pt-4 sm:px-6">
            <p className="text-xs text-slate-600">{PROGRAM_NOTE}</p>

            {/* ── 進行中 ── */}
            {active.map(rec => {
              const pos = stagePosition(rec)
              if (!pos) return null
              const { program, stage, index, total } = pos
              const next = nextStage(rec)
              const prev = prevStage(rec)
              const days = daysInStage(rec, today)
              const mine_ = (mode.kind === 'back' || mode.kind === 'stop' || mode.kind === 'finish') && mode.id === rec.id ? mode.kind : null
              return (
                <section key={rec.id} aria-label={program.title} className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/40 p-3 sm:p-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="text-sm font-bold text-slate-900">{program.title}{sideLabel(rec.side)}</h3>
                    <span className="rounded-full bg-teal-700 px-2.5 py-0.5 text-xs font-bold text-white">段階{index + 1}／{total}</span>
                    <span className="text-xs text-slate-700">
                      {shortDate(rec.startedOn, today)} に開始・この段階になって{days === 0 ? '今日から' : `${days}日`}
                    </span>
                  </div>

                  <ol className="flex flex-wrap gap-1" aria-label="段階">
                    {program.stages.map((s, i) => (
                      <li key={s.id}
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs',
                          i === index ? 'bg-teal-700 font-bold text-white' : i < index ? 'bg-teal-100 text-teal-900' : 'bg-white text-slate-600 ring-1 ring-slate-200',
                        )}>
                        {i + 1} {s.title}
                      </li>
                    ))}
                  </ol>

                  <div className="space-y-2 rounded-lg bg-white p-3 ring-1 ring-slate-200">
                    <p className="text-sm font-bold text-slate-900">いまの段階：{stage.title}</p>
                    <div className="space-y-1">
                      <Heading>やること（目安）</Heading>
                      <Bullets items={stage.doing} />
                    </div>
                    <div className="space-y-1">
                      <Heading>次へ進む目安</Heading>
                      {stage.advance ? <Bullets items={stage.advance} /> : <p className="text-sm text-slate-800">下の「進め方の決まり」どおりにできたら、次へ。</p>}
                    </div>
                  </div>

                  {!mine_ && (
                    <div className="flex flex-wrap items-center gap-2">
                      {next ? (
                        <Button size="sm" onClick={() => commit(moveStage(rec, next.id, stamp()))}>
                          次の段階へ進む（{next.title}）
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => reset({ kind: 'finish', id: rec.id })}>
                          終了する（復帰した）
                        </Button>
                      )}
                      {prev && (
                        <Button size="sm" variant="outline" onClick={() => reset({ kind: 'back', id: rec.id })}>
                          1段階戻す
                        </Button>
                      )}
                      {next && (
                        <Button size="sm" variant="ghost" onClick={() => reset({ kind: 'finish', id: rec.id })}>
                          終了する
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => reset({ kind: 'stop', id: rec.id })}>
                        中止する
                      </Button>
                    </div>
                  )}

                  {mine_ && (
                    <div className="space-y-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
                      <label className="block text-sm">
                        <span className="font-bold text-slate-700">
                          {mine_ === 'back' && `「${prev?.title ?? ''}」に戻します。理由（任意）`}
                          {mine_ === 'stop' && '中止の理由（必須）'}
                          {mine_ === 'finish' && '終了します。ひとこと（任意）'}
                        </span>
                        <input value={note} onChange={e => setNote(e.target.value)} maxLength={200}
                          placeholder={mine_ === 'back' ? '例：翌日に張りが残った' : mine_ === 'stop' ? '例：医師の指示で休止／痛みが続く' : '例：試合に復帰'}
                          className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3" />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {mine_ === 'back' && prev && (
                          <Button size="sm" onClick={() => commit(moveStage(rec, prev.id, stamp()))}>戻して保存</Button>
                        )}
                        {mine_ === 'stop' && (
                          <Button size="sm" disabled={!note.trim()} onClick={() => commit(stopProgram(rec, stamp()))}>中止して保存</Button>
                        )}
                        {mine_ === 'finish' && (
                          <Button size="sm" onClick={() => commit(finishProgram(rec, stamp()))}>終了して保存</Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => reset()}>やめる</Button>
                      </div>
                    </div>
                  )}

                  <div>
                    <button type="button" aria-expanded={detailFor === rec.id}
                      onClick={() => setDetailFor(detailFor === rec.id ? null : rec.id)}
                      className="text-sm font-bold text-teal-800 underline max-lg:min-h-10">
                      {detailFor === rec.id ? '決まり・全部の段階・文献・履歴を閉じる' : '決まり・全部の段階・文献・履歴を見る'}
                    </button>
                    {detailFor === rec.id && (
                      <div className="mt-3 space-y-4">
                        <ProgramDetail program={program} currentStageId={rec.stageId} />
                        <div className="space-y-1">
                          <Heading>この方の履歴</Heading>
                          <ul className="space-y-1 text-sm text-slate-800">
                            {[...rec.events].reverse().map(e => {
                              const to = e.to ? program.stages.find(s => s.id === e.to)?.title : undefined
                              return (
                                <li key={e.id}>
                                  {shortDate(e.date, today)}　{EVENT_LABELS[e.kind]}{to ? `：${to}` : ''}{e.note ? `（${e.note}）` : ''}
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )
            })}

            {/* ── 始める ── */}
            {mode.kind === 'idle' && (
              <Button size="sm" variant={active.length > 0 ? 'outline' : 'default'} onClick={() => reset({ kind: 'pick' })}>
                プログラムを始める
              </Button>
            )}

            {mode.kind === 'pick' && (
              <section aria-label="プログラムをえらぶ" className="space-y-3 rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-bold text-slate-800">プログラムをえらんでください（中身と文献を見てから始められます）</p>
                {mine.length > 0 && (
                  <div className="space-y-1.5">
                    <Heading>この方の部位（{regions.map(r => BODY_REGION_LABELS[r]).join('・')}）</Heading>
                    <div className="flex flex-wrap gap-1.5">
                      {mine.map(p => (
                        <button key={p.id} type="button" className={chip(false)}
                          onClick={() => { setStartStage(p.stages[0].id); setSide('na'); reset({ kind: 'preview', programId: p.id }) }}>
                          {p.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {missing.map(t => <p key={t} className="text-sm text-slate-700">{t}</p>)}
                <div className="space-y-1.5">
                  {mine.length > 0 && <Heading>そのほか</Heading>}
                  <div className="flex flex-wrap gap-1.5">
                    {others.map(p => (
                      <button key={p.id} type="button" className={chip(false)}
                        onClick={() => { setStartStage(p.stages[0].id); setSide('na'); reset({ kind: 'preview', programId: p.id }) }}>
                        {p.title}
                      </button>
                    ))}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => reset()}>やめる</Button>
              </section>
            )}

            {preview && (
              <section aria-label={`${preview.title}を始める`} className="space-y-4 rounded-xl bg-slate-50 p-3 sm:p-4">
                <h3 className="text-sm font-bold text-slate-900">{preview.title}</h3>
                <ProgramDetail program={preview} />
                <div className="space-y-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
                  <div className="space-y-1.5">
                    <Heading>左右</Heading>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="左右">
                      {SIDES.map(s => (
                        <button key={s.value} type="button" aria-pressed={side === s.value} className={chip(side === s.value)} onClick={() => setSide(s.value)}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="block text-sm">
                    <span className="font-bold text-slate-700">始める段階</span>
                    <select value={startStage} onChange={e => setStartStage(e.target.value)}
                      className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3">
                      {preview.stages.map((s, i) => <option key={s.id} value={s.id}>段階{i + 1}　{s.title}</option>)}
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm"
                      onClick={() => commit(startProgram({ id: nanoid(12), patientId: patient.id, programId: preview.id, stageId: startStage, side, ...stamp() }))}>
                      この方に始める
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => reset({ kind: 'pick' })}>ほかのプログラムを見る</Button>
                    <Button size="sm" variant="ghost" onClick={() => reset()}>やめる</Button>
                  </div>
                </div>
              </section>
            )}

            {/* ── 終了・中止したもの ── */}
            {past.length > 0 && (
              <div>
                <button type="button" aria-expanded={showPast} onClick={() => setShowPast(v => !v)}
                  className="text-sm font-bold text-slate-700 underline max-lg:min-h-10">
                  終了・中止したプログラム（{past.length}件）{showPast ? 'を閉じる' : 'を見る'}
                </button>
                {showPast && (
                  <ul className="mt-2 space-y-2">
                    {past.map(rec => {
                      const pos = stagePosition(rec)
                      const last = rec.events[rec.events.length - 1]
                      return (
                        <li key={rec.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                          <span className="font-bold text-slate-900">{pos?.program.title ?? rec.programId}{sideLabel(rec.side)}</span>
                          <span className="text-slate-700">
                            {rec.status === 'finished' ? '終了' : '中止'}（{last ? shortDate(last.date, today) : ''}{pos ? `・段階${pos.index + 1}／${pos.total}` : ''}{last?.note ? `・${last.note}` : ''}）
                          </span>
                          <Button size="sm" variant="outline" onClick={() => commit(resumeProgram(rec, stamp()))}>再開する</Button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
