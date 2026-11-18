'use client'
/**
 * カルテ「評価・測定」のいちばん上の「再評価」欄
 *
 * - 次回の評価予定日を決める（7日後・14日後・28日後・日付をえらぶ。最初に選んであるのは14日後だが、押すまで入らない）
 * - 予定日を変える（後ろへずらす＝延期は理由が要る）・予定をやめる（理由を残す）
 * - 前回の正式な再評価のときの値と、今回の値を並べる（今ある評価の記録だけを使う。測るのは今までどおり各タブ）
 * - 「再評価を完了する」で、前回との比べを履歴に残し、マークを外して次回の予定日を入れる
 *   （ふつうの SOAP の保存では完了にしない）
 * マークは医学的な危険の知らせとは別。危ない変化があれば、予定日を待たずに院長が判断する（その一言を出す）。
 */
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { nanoid } from 'nanoid'
import { CalendarClock, ChevronDown, ChevronUp, ClipboardCheck, History } from 'lucide-react'
import type { Patient, ROMRecord, SOAPNote, StrengthRecord } from '@/types/patient'
import type { OutcomeRecord } from '@/types/contracts'
import type { ReevalInterval, ReevalPlan } from '@/types/reeval'
import type { ReturnCriteriaAssessment } from '@/types/return-criteria'
import { REGION_LABELS } from '@/types/return-criteria'
import type { OutcomeScoreRecord } from '@/types/outcome-scores'
import { SCORE_DEFS } from '@/data/outcome-score-defs'
import {
  DEFAULT_REEVAL_INTERVAL,
  REEVAL_EVENT_LABELS,
  REEVAL_INTERVALS,
  completeReeval,
  daysLeftText,
  dueFromInterval,
  isYmd,
  reevalStatus,
  setReevalDue,
  shortDate,
  soapReassessmentHint,
  stopReeval,
} from '@/lib/reeval/schedule'
import { TREND_TEXT, compareSeries, compareSummary, seriesFromKarte } from '@/lib/reeval/compare'
import { saveReevalPlan } from '@/lib/reeval/store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card } from './shared'
import ReevalMark from './ReevalMark'

export type ReevalGoTo = 'outcome' | 'rom' | 'strength' | 'progress'

type Mode = 'idle' | 'change' | 'stop' | 'complete'

const chip = (on: boolean) =>
  cn(
    'min-h-10 rounded-full border px-3 text-sm transition-colors lg:min-h-8',
    on ? 'border-teal-700 bg-teal-700 font-bold text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  )

function IntervalPicker({
  value,
  onChange,
  custom,
  onCustom,
  allowNone,
  min,
}: {
  value: ReevalInterval | 'none'
  onChange: (v: ReevalInterval | 'none') => void
  custom: string
  onCustom: (v: string) => void
  allowNone?: boolean
  min: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {REEVAL_INTERVALS.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} className={chip(value === o.value)}>
          {o.label}
        </button>
      ))}
      {allowNone && (
        <button type="button" aria-pressed={value === 'none'} onClick={() => onChange('none')} className={chip(value === 'none')}>
          次回は決めない
        </button>
      )}
      {value === 'custom' && (
        <input
          type="date"
          value={custom}
          min={min}
          onChange={(e) => onCustom(e.target.value)}
          aria-label="次回の評価予定日"
          className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm lg:min-h-8"
        />
      )}
    </div>
  )
}

export default function ReevalPanel({
  patient,
  plan,
  today,
  soapNotes,
  outcomes,
  rom,
  strength,
  scores,
  returnTests,
  open,
  onToggle,
  onGo,
  onUpdate,
}: {
  patient: Patient
  plan: ReevalPlan | null
  today: string
  soapNotes: SOAPNote[]
  outcomes: OutcomeRecord[]
  rom: ROMRecord[]
  strength: StrengthRecord[]
  scores: OutcomeScoreRecord[]
  returnTests: ReturnCriteriaAssessment[]
  open: boolean
  onToggle: () => void
  onGo: (to: ReevalGoTo) => void
  onUpdate: () => void
}) {
  const ended = patient.status === 'discharged'
  const status = reevalStatus(plan, today, { ended })
  const active = Boolean(plan?.active && isYmd(plan.dueDate))
  const hint = useMemo(() => soapReassessmentHint(soapNotes), [soapNotes])

  const [mode, setMode] = useState<Mode>('idle')
  const [choice, setChoice] = useState<ReevalInterval | 'none'>(plan?.interval ?? DEFAULT_REEVAL_INTERVAL)
  const [custom, setCustom] = useState('')
  const [reason, setReason] = useState('')
  const [doneDate, setDoneDate] = useState(today)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [allRows, setAllRows] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const rows = useMemo(() => {
    const series = seriesFromKarte({
      soapNotes,
      outcomes,
      rom,
      strength,
      scores: scores.map((s) => {
        const def = SCORE_DEFS[s.scoreId]
        return {
          key: s.scoreId,
          label: def?.shortName ?? s.scoreId,
          unit: def?.unit ?? '',
          higherIsBetter: def?.higherIsBetter ?? true,
          date: s.scoreDate,
          total: s.totalScore,
          createdAt: s.createdAt,
        }
      }),
      returnTests: returnTests.map((a) => ({
        label: `復帰基準テスト 総合（${REGION_LABELS[a.region] ?? ''}・${a.type === 'sport' ? '競技' : '日常'}）`,
        date: a.assessmentDate,
        composite: a.scores?.composite ?? NaN,
        createdAt: a.createdAt,
      })),
    })
    return compareSeries(series, plan?.lastDate ?? null)
  }, [soapNotes, outcomes, rom, strength, scores, returnTests, plan?.lastDate])

  const shownRows = allRows ? rows : rows.slice(0, 10)
  const history = useMemo(() => [...(plan?.events ?? [])].reverse(), [plan?.events])

  function reset(next: Mode = 'idle') {
    setMode(next)
    setError('')
    setReason('')
    setNote('')
    setCustom('')
    setDoneDate(today)
    setChoice(plan?.interval ?? DEFAULT_REEVAL_INTERVAL)
  }

  function chosenDue(base: string): string | null {
    if (choice === 'none') return null
    return choice === 'custom' ? (isYmd(custom) ? custom : null) : dueFromInterval(base, choice)
  }

  function finish(r: { ok: true; plan: ReevalPlan } | { ok: false; error: string }) {
    if (!r.ok) {
      setError(r.error)
      return
    }
    saveReevalPlan(r.plan)
    reset()
    onUpdate()
  }

  const stamp = () => ({ today, now: new Date().toISOString(), eventId: nanoid(10) })

  function setDue(due: string | null, src: ReevalInterval | null) {
    if (!due) {
      setError('日付をえらんでください。')
      return
    }
    finish(setReevalDue(plan, { ...stamp(), patientId: patient.id, due, interval: src, reason }))
  }

  function complete() {
    const next =
      choice === 'none' ? null : { interval: choice as ReevalInterval, due: choice === 'custom' ? custom : undefined }
    finish(
      completeReeval(plan, {
        ...stamp(),
        patientId: patient.id,
        date: doneDate,
        next,
        summary: compareSummary(rows),
        note,
      }),
    )
  }

  const changeDue = mode === 'change' ? chosenDue(today) : null
  const isPostpone = Boolean(changeDue && status.dueDate && changeDue > status.dueDate)

  return (
    <Card className="mb-4">
      <div id="reeval" className="scroll-mt-24">
        {/* 1行目（たたんでいても見える） */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left max-lg:min-h-10 sm:px-6"
        >
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-800">
            <CalendarClock className="h-4 w-4 text-teal-700" aria-hidden />
            再評価
          </span>
          <span className="text-sm text-slate-700">
            {ended
              ? 'カルテが「終了」のため、マークは出しません'
              : active && status.dueDate
                ? `次回 ${shortDate(status.dueDate, today)}（${daysLeftText(status.daysLeft)}）`
                : '予定はまだありません'}
            {plan?.lastDate ? ` ・ 前回 ${shortDate(plan.lastDate, today)}` : ''}
          </span>
          <ReevalMark status={status} today={today} />
          <span className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-teal-800">
            {open ? '閉じる' : '開く'}
            {open ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
          </span>
        </button>

        {open && (
          <div className="space-y-5 border-t border-slate-100 px-4 pb-5 pt-4 sm:px-6">
            {/* ── 予定 ── */}
            <section className="space-y-3" aria-label="次回の評価予定日">
              {!active && mode === 'idle' && (
                <>
                  <p className="text-sm text-slate-700">
                    次回の評価予定日をえらんでください（病態・術式・経過・医師の指示に合わせて決めます。全員に入れる必要はありません）。
                  </p>
                  <IntervalPicker value={choice} onChange={setChoice} custom={custom} onCustom={setCustom} min={today} />
                  {hint && (
                    <p className="text-sm text-slate-600">
                      SOAP（{shortDate(hint.visitDate, today)}）の「再評価予定」：{shortDate(hint.date, today)}
                      {hint.date >= today ? (
                        <button
                          type="button"
                          onClick={() => setDue(hint.date, 'custom')}
                          className="ml-2 rounded-lg border border-teal-300 bg-white px-2 py-0.5 text-sm font-bold text-teal-800 hover:bg-teal-50 max-lg:min-h-10"
                        >
                          この日にする
                        </button>
                      ) : (
                        <span className="ml-1">（過ぎているので、新しく決めてください）</span>
                      )}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={() => setDue(chosenDue(today), choice === 'none' ? null : choice)}>
                      {choice === 'custom' ? 'この日を予定にする' : `${REEVAL_INTERVALS.find((o) => o.value === choice)?.label ?? ''}（${chosenDue(today) ? shortDate(chosenDue(today) as string, today) : ''}）を予定にする`}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => reset('complete')}>
                      今日、再評価をした
                    </Button>
                  </div>
                </>
              )}

              {active && mode === 'idle' && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => reset('complete')}>
                    <ClipboardCheck className="h-4 w-4" aria-hidden />
                    再評価を完了する
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => reset('change')}>
                    予定日を変える・延期する
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => reset('stop')}>
                    予定をやめる
                  </Button>
                </div>
              )}

              {mode === 'change' && (
                <div className="space-y-3 rounded-xl bg-slate-50 p-3">
                  <p className="text-sm font-bold text-slate-800">新しい予定日（今日から数えます）</p>
                  <IntervalPicker value={choice} onChange={setChoice} custom={custom} onCustom={setCustom} min={today} />
                  <label className="block text-sm">
                    <span className="font-bold text-slate-700">理由{isPostpone ? '（延期なので必須）' : '（任意）'}</span>
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={120}
                      placeholder="例：体調不良で来院できない／医師の診察結果を待つ"
                      className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setDue(changeDue, choice === 'none' ? null : choice)}>
                      {isPostpone ? '延期して保存' : '保存'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => reset()}>
                      やめる
                    </Button>
                  </div>
                </div>
              )}

              {mode === 'stop' && (
                <div className="space-y-3 rounded-xl bg-slate-50 p-3">
                  <label className="block text-sm">
                    <span className="font-bold text-slate-700">予定をやめる理由（必須）</span>
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={120}
                      placeholder="例：施術終了／医療機関で管理"
                      className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => finish(stopReeval(plan, { ...stamp(), reason }))}>
                      予定をやめる
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => reset()}>
                      もどる
                    </Button>
                  </div>
                </div>
              )}

              {mode === 'complete' && (
                <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/60 p-3">
                  <p className="text-sm text-slate-800">
                    下の「前回と今回」を確かめてから完了してください。今回まだ測っていない項目は、各タブで測ってから完了できます。
                  </p>
                  <label className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-bold text-slate-700">再評価をした日</span>
                    <input
                      type="date"
                      value={doneDate}
                      max={today}
                      onChange={(e) => setDoneDate(e.target.value)}
                      className="min-h-10 rounded-lg border border-slate-300 px-3 lg:min-h-8"
                    />
                  </label>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-700">次回の評価予定日（再評価をした日から数えます）</p>
                    <IntervalPicker value={choice} onChange={setChoice} custom={custom} onCustom={setCustom} allowNone min={today} />
                  </div>
                  <label className="block text-sm">
                    <span className="font-bold text-slate-700">メモ（任意）</span>
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={120}
                      placeholder="例：負荷を一段上げる。ジョギング開始は次回の結果で判断"
                      className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={complete}>
                      完了として記録する
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => reset()}>
                      もどる
                    </Button>
                  </div>
                </div>
              )}

              {error && (
                <p role="alert" className="text-sm font-bold text-amber-900">
                  {error}
                </p>
              )}
            </section>

            {/* ── 前回と今回 ── */}
            <section aria-label="前回と今回">
              <h4 className="mb-2 text-sm font-bold text-slate-800">
                前回と今回{plan?.lastDate ? `（前回の再評価 ${shortDate(plan.lastDate, today)} をはさんで）` : '（最初の記録と最新の記録）'}
              </h4>
              {rows.length === 0 ? (
                <p className="text-sm text-slate-600">まだ評価の記録がありません。下のボタンから測ってください。</p>
              ) : (
                <>
                {/* スマホ：1項目ずつ縦に（表は横にはみ出すため） */}
                <ul className="space-y-1.5 sm:hidden">
                  {shownRows.map((r) => (
                    <li key={r.key} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <p className="font-bold text-slate-800">{r.label}</p>
                      <p className="mt-0.5 tabular-nums text-slate-700">
                        前回 {r.prev ? `${r.prev.text}（${shortDate(r.prev.date, today)}）` : '—'} → 今回{' '}
                        {r.curr ? `${r.curr.text}（${shortDate(r.curr.date, today)}）` : 'まだ測っていない'}
                        {r.trend ? `・${TREND_TEXT[r.trend]}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full min-w-[30rem] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                        <th className="py-1.5 pr-2 font-bold">項目</th>
                        <th className="py-1.5 pr-2 font-bold">前回</th>
                        <th className="py-1.5 pr-2 font-bold">今回</th>
                        <th className="py-1.5 font-bold">変化</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownRows.map((r) => (
                        <tr key={r.key} className="border-b border-slate-100 last:border-0">
                          <td className="py-1.5 pr-2 text-slate-800">{r.label}</td>
                          <td className="py-1.5 pr-2 tabular-nums text-slate-700">
                            {r.prev ? (
                              <>
                                <span className="font-bold">{r.prev.text}</span>
                                <span className="ml-1 text-xs text-slate-500">{shortDate(r.prev.date, today)}</span>
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-1.5 pr-2 tabular-nums text-slate-700">
                            {r.curr ? (
                              <>
                                <span className="font-bold">{r.curr.text}</span>
                                <span className="ml-1 text-xs text-slate-500">{shortDate(r.curr.date, today)}</span>
                              </>
                            ) : (
                              <span className="text-slate-600">まだ測っていない</span>
                            )}
                          </td>
                          <td className="py-1.5 text-slate-700">{r.trend ? TREND_TEXT[r.trend] : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}
              {rows.length > 10 && (
                <button
                  type="button"
                  onClick={() => setAllRows((v) => !v)}
                  className="mt-2 text-sm font-medium text-teal-800 underline max-lg:min-h-10"
                >
                  {allRows ? '10項目だけ出す' : `すべて出す（${rows.length}項目）`}
                </button>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500">測る</span>
                <Button size="sm" variant="outline" onClick={() => onGo('outcome')}>アウトカム</Button>
                <Button size="sm" variant="outline" onClick={() => onGo('rom')}>ROM</Button>
                <Button size="sm" variant="outline" onClick={() => onGo('strength')}>筋力</Button>
                <Link
                  href={`/patients/${patient.id}/outcome-scores`}
                  className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 lg:h-8 lg:text-xs"
                >
                  アウトカム評価
                </Link>
                <Link
                  href={`/patients/${patient.id}/return-criteria`}
                  className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 lg:h-8 lg:text-xs"
                >
                  復帰基準テスト
                </Link>
                <Button size="sm" variant="ghost" onClick={() => onGo('progress')}>経過グラフ</Button>
              </div>
            </section>

            {/* ── 安全のこと（マークとは別） ── */}
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
              このマークは「評価の時期」の目安で、危険の知らせではありません。急な痛みの強まり・新しいしびれや力の入りにくさ・排尿の異常・強い腫れなどがあるときは、予定日を待たずに再評価や医療機関の受診のおすすめを判断してください（判断は施術者が行います）。
            </p>

            {/* ── 履歴 ── */}
            {history.length > 0 && (
              <section>
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  aria-expanded={showHistory}
                  className="inline-flex items-center gap-1 text-sm font-bold text-slate-700 max-lg:min-h-10"
                >
                  <History className="h-4 w-4" aria-hidden />
                  再評価の履歴（{history.length}件）
                  {showHistory ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
                </button>
                {showHistory && (
                  <ol className="mt-2 space-y-2">
                    {history.map((ev) => (
                      <li key={ev.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center gap-x-2 text-slate-800">
                          <span className="font-bold tabular-nums">{ev.date}</span>
                          <span className="font-bold">{REEVAL_EVENT_LABELS[ev.kind]}</span>
                          {ev.kind !== 'stop' && (
                            <span className="text-slate-600">
                              {ev.prevDue ? `予定 ${ev.prevDue} → ` : ''}
                              {ev.nextDue ? `次回 ${ev.nextDue}` : ev.kind === 'complete' ? '次回は未定' : ''}
                            </span>
                          )}
                          {ev.source === 'soap' && <span className="text-xs text-slate-500">SOAP から</span>}
                        </div>
                        {ev.reason && <p className="mt-0.5 text-slate-700">理由：{ev.reason}</p>}
                        {ev.note && <p className="mt-0.5 text-slate-700">メモ：{ev.note}</p>}
                        {ev.summary && ev.summary.length > 0 && (
                          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-700">
                            {ev.summary.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
