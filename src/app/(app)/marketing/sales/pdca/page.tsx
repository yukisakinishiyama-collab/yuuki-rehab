'use client'

/**
 * PDCA（施策を回す）— 院長のみ・経営メニュー（隠しモード）の中
 *
 * 相談して作る（P）→ やることのチェックと「やったこと」の記録（D）→ 数字で自動の評価（C）
 * → 続ける／直す／やめる と学んだこと（A）→ 次の施策の相談へ、を1つの画面で回す。
 * 数字は NOAH・予約システム・計測リンク・LINE から自動で集める（src/lib/marketing/pdca.ts）。
 * AIに相談するときだけ Anthropic の API の料金がかかる。渡すのは院全体の数字と、ここに書いた文だけ。
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronDown, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { useMarketingRole } from '@/lib/marketing/use-role'
import { man } from '@/lib/marketing/goal-plan'
import { SOURCE_LABELS } from '@/lib/marketing/booking-stats-labels'
import {
  DECISION_LABELS,
  addDays,
  effectiveStatus,
  metricDef,
  type CheckResult,
  type Decision,
  type MetricDef,
  type MetricKey,
  type PdcaItem,
  type PdcaStatus,
  type PlanDraft,
} from '@/lib/marketing/pdca'

interface ListResponse {
  today: string
  items: PdcaItem[]
  checks: Record<string, CheckResult>
  metrics: MetricDef[]
  templates: Array<{ id: string; label: string }>
  ai: boolean
}

interface DraftState {
  draft: PlanDraft
  start: string
  end: string
  reason: string
  ai: boolean
  fallback?: string
  concern: string
}

const fmt = (n: number) => Math.round(n).toLocaleString('ja-JP')
const value = (n: number, def: MetricDef) =>
  def.unit === '円' ? (Math.abs(n) >= 100_000 ? `${man(n)}円` : `${fmt(n)}円`) : `${fmt(n)}${def.unit}`
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
const newLocalId = () => Math.random().toString(36).slice(2, 10)

const STATUS_TABS: Array<{ key: PdcaStatus; label: string }> = [
  { key: 'doing', label: '実行中' },
  { key: 'review', label: '振り返り' },
  { key: 'done', label: '終わった' },
]

const input =
  'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100'
const pill =
  'inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50'
const primary =
  'inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-teal-600 px-5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50'

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

function Section({ letter, title, children }: { letter: 'P' | 'D' | 'C' | 'A'; title: string; children: ReactNode }) {
  const color: Record<string, string> = { P: 'bg-sky-600', D: 'bg-teal-600', C: 'bg-amber-600', A: 'bg-violet-600' }
  return (
    <section className="min-w-0 border-t border-slate-100 px-4 py-4 sm:px-6">
      <h3 className="mb-2.5 flex items-center gap-2 text-sm font-black text-slate-900">
        <span className={`flex h-6 w-6 items-center justify-center rounded-md text-xs text-white ${color[letter]}`}>{letter}</span>
        {title}
      </h3>
      {children}
    </section>
  )
}

function Progress({ ratio }: { ratio: number }) {
  const pct = Math.max(0, Math.min(100, ratio * 100))
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`目標の${Math.round(ratio * 100)}%`}>
      <div className={`h-full rounded-full ${ratio >= 1 ? 'bg-teal-500' : ratio >= 0.6 ? 'bg-sky-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

/** P→D→C→A のどこにいるか */
function Steps({ status, hasLogs }: { status: PdcaStatus; hasLogs: boolean }) {
  const at = status === 'done' ? 4 : status === 'review' ? 3 : hasLogs ? 1 : 0
  return (
    <span className="flex items-center gap-1" aria-label="PDCAの段階">
      {(['P', 'D', 'C', 'A'] as const).map((l, i) => (
        <span
          key={l}
          className={`flex h-5 w-5 items-center justify-center rounded text-xs font-black ${
            i < at ? 'bg-slate-200 text-slate-500' : i === at ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-400'
          }`}
        >
          {l}
        </span>
      ))}
    </span>
  )
}

// ── 計画の下書き ─────────────────────────────────────────

function DraftEditor({
  state,
  metrics,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  state: DraftState
  metrics: MetricDef[]
  onChange: (s: DraftState) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  const d = state.draft
  const def = metricDef(d.metric)
  const set = (patch: Partial<PlanDraft>) => onChange({ ...state, draft: { ...d, ...patch } })
  return (
    <div className="rounded-2xl border-2 border-teal-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 sm:px-6">
        <p className="text-xs font-bold text-teal-700">
          計画の下書き（{state.ai ? 'AIに相談' : 'ひな形'}）— 直してから始めてください
        </p>
        <button type="button" onClick={onCancel} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100" aria-label="下書きを閉じる">
          <X className="h-4 w-4" />
        </button>
      </div>
      {(state.reason || state.fallback) && (
        <p className="px-4 pt-2 text-xs leading-relaxed text-slate-500 sm:px-6">
          {state.reason}
          {state.fallback && <span className="block text-amber-700">{state.fallback}</span>}
        </p>
      )}
      <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-6">
        <div className="sm:col-span-2">
          <Field label="施策名">
            <input className={input} value={d.title} maxLength={60} onChange={(e) => set({ title: e.target.value })} />
          </Field>
        </div>
        <Field label="ねらい（なぜやるか）">
          <textarea className={`${input} min-h-20`} value={d.purpose} maxLength={400} onChange={(e) => set({ purpose: e.target.value })} />
        </Field>
        <Field label="仮説（これをすると、こうなるはず）">
          <textarea className={`${input} min-h-20`} value={d.hypothesis} maxLength={400} onChange={(e) => set({ hypothesis: e.target.value })} />
        </Field>
        <Field label="見る数字（指標）" hint={`数字のもと：${def.source}${def.sum ? '・期間の合計' : '・期間の平均'}`}>
          <select
            className={input}
            value={d.metric}
            onChange={(e) => set({ metric: e.target.value as MetricKey, filter: metricDef(e.target.value as MetricKey).filterable ? d.filter : undefined })}
          >
            {metrics.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`目標（${def.sum ? '期間の合計' : '期間の平均'}・${def.unit}）`}>
          <input
            className={`${input} text-right tabular-nums`}
            inputMode="numeric"
            value={String(d.target)}
            onChange={(e) => set({ target: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })}
          />
        </Field>
        {def.filterable && (
          <Field label="流入元でしぼる（しぼらなければ全部）">
            <select
              className={input}
              value={d.filter?.source ?? ''}
              onChange={(e) => set({ filter: e.target.value ? { ...d.filter, source: e.target.value } : undefined })}
            >
              <option value="">全部</option>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3 sm:col-span-2">
          <Field label="始める日">
            <input type="date" className={input} value={state.start} onChange={(e) => onChange({ ...state, start: e.target.value })} />
          </Field>
          <Field label="終わる日">
            <input type="date" className={input} value={state.end} onChange={(e) => onChange({ ...state, end: e.target.value })} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <span className="text-xs font-bold text-slate-600">やること</span>
          <ul className="mt-1 space-y-2">
            {d.actions.map((a, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  className={`${input} mt-0`}
                  value={a}
                  maxLength={200}
                  aria-label={`やること${i + 1}`}
                  onChange={(e) => set({ actions: d.actions.map((x, j) => (j === i ? e.target.value : x)) })}
                />
                <button
                  type="button"
                  onClick={() => set({ actions: d.actions.filter((_, j) => j !== i) })}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
                  aria-label={`やること${i + 1}を消す`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          {d.actions.length < 12 && (
            <button type="button" onClick={() => set({ actions: [...d.actions, ''] })} className="mt-2 inline-flex h-10 items-center gap-1 text-sm font-bold text-teal-700">
              <Plus className="h-4 w-4" />
              やることを足す
            </button>
          )}
        </div>
        {d.cautions.length > 0 && (
          <div className="rounded-xl bg-amber-50 px-3 py-2.5 sm:col-span-2">
            <p className="text-xs font-bold text-amber-900">気をつけること</p>
            <ul className="mt-1 space-y-0.5 text-xs leading-relaxed text-amber-900">
              {d.cautions.map((c) => (
                <li key={c}>・{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3 sm:px-6">
        <button type="button" onClick={onSave} disabled={saving || !d.title.trim() || state.end < state.start} className={primary}>
          {saving ? '保存中…' : 'この計画で始める'}
        </button>
        <button type="button" onClick={onCancel} className={pill}>
          やめる
        </button>
      </div>
    </div>
  )
}

// ── 施策のカード ─────────────────────────────────────────

function ItemCard({
  item,
  c,
  today,
  open,
  ai,
  onPatch,
  onDelete,
  onNext,
}: {
  item: PdcaItem
  c: CheckResult | undefined
  today: string
  open: boolean
  ai: boolean
  onPatch: (patch: Partial<PdcaItem>) => Promise<boolean>
  onDelete: () => Promise<void>
  onNext: (concern: string) => void
}) {
  const def = metricDef(item.metric)
  const status = effectiveStatus(item, today)
  const [logText, setLogText] = useState('')
  const [logDate, setLogDate] = useState(today)
  const [manualValue, setManualValue] = useState('')
  const [newAction, setNewAction] = useState('')
  const [review, setReview] = useState<{ decision: Decision; learned: string; next: string }>(() => ({
    decision: item.review?.decision ?? 'continue',
    learned: item.review?.learned ?? '',
    next: item.review?.next ?? '',
  }))
  const [nextConcern, setNextConcern] = useState('')
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [plan, setPlan] = useState({ title: item.title, target: String(item.target), start: item.start, end: item.end })
  const done = item.actions.filter((a) => a.done).length

  async function addLog() {
    if (!logText.trim()) return
    const ok = await onPatch({ logs: [{ id: newLocalId(), at: logDate || today, text: logText.trim() }, ...item.logs] })
    if (ok) setLogText('')
  }
  async function addManual() {
    const v = Number(manualValue.replace(/[^\d.]/g, ''))
    if (!Number.isFinite(v) || v <= 0) return
    const ok = await onPatch({ manual: [{ at: logDate || today, value: v }, ...item.manual] })
    if (ok) setManualValue('')
  }
  async function askReview() {
    setAsking(true)
    setNote('')
    try {
      const res = await fetch('/api/marketing/pdca/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'review', id: item.id }),
      })
      const body = (await res.json()) as { decision?: Decision; learned?: string; next?: string; nextConcern?: string; fallback?: string; error?: string }
      if (!res.ok || !body.decision) {
        setNote(body.error ?? '下書きを作れませんでした')
        return
      }
      setReview({ decision: body.decision, learned: body.learned ?? '', next: body.next ?? '' })
      setNextConcern(body.nextConcern ?? '')
      if (body.fallback) setNote(body.fallback)
    } catch {
      setNote('下書きを作れませんでした（通信の失敗）')
    } finally {
      setAsking(false)
    }
  }
  async function saveReview(finish: boolean) {
    const ok = await onPatch({
      status: finish ? 'done' : 'review',
      review: { ...review, at: new Date().toISOString(), actual: c?.projected, baseline: c?.baseline ?? null },
    })
    if (ok) setNote(finish ? '完了にしました' : '振り返りを保存しました')
  }
  async function savePlan() {
    const ok = await onPatch({ title: plan.title.trim() || item.title, target: Number(plan.target.replace(/[^\d]/g, '')) || 0, start: plan.start, end: plan.end })
    if (ok) setEditing(false)
  }

  return (
    <details open={open} className="group min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none flex-col gap-2 px-4 py-3.5 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <Steps status={status} hasLogs={item.logs.length > 0 || done > 0} />
          <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-slate-900">{item.title}</span>
          <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden />
        </span>
        {c && (
          <span className="block">
            <Progress ratio={c.progress} />
            <span className="mt-1 flex flex-wrap justify-between gap-x-3 text-xs tabular-nums text-slate-500">
              <span>
                {def.label}：
                {c.noData ? 'まだ数字がありません' : c.phase === 'running' && def.sum ? `このペースで ${value(c.projected, def)}` : value(c.actual, def)}
                ／目標 {value(item.target, def)}
              </span>
              <span>
                {md(item.start)}〜{md(item.end)}
                {status === 'review' && <span className="ml-2 font-bold text-violet-700">振り返りの時期です</span>}
              </span>
            </span>
          </span>
        )}
      </summary>

      <Section letter="P" title="計画">
        {editing ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="施策名">
                <input className={input} value={plan.title} maxLength={60} onChange={(e) => setPlan({ ...plan, title: e.target.value })} />
              </Field>
            </div>
            <Field label={`目標（${def.unit}）`}>
              <input className={`${input} text-right`} inputMode="numeric" value={plan.target} onChange={(e) => setPlan({ ...plan, target: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="始める日">
                <input type="date" className={input} value={plan.start} onChange={(e) => setPlan({ ...plan, start: e.target.value })} />
              </Field>
              <Field label="終わる日">
                <input type="date" className={input} value={plan.end} onChange={(e) => setPlan({ ...plan, end: e.target.value })} />
              </Field>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <button type="button" className={primary} onClick={() => void savePlan()} disabled={plan.end < plan.start}>
                保存
              </button>
              <button type="button" className={pill} onClick={() => setEditing(false)}>
                やめる
              </button>
            </div>
          </div>
        ) : (
          <dl className="space-y-1.5 text-sm leading-relaxed text-slate-700">
            {item.purpose && (
              <div>
                <dt className="inline font-bold text-slate-500">ねらい：</dt>
                <dd className="inline">{item.purpose}</dd>
              </div>
            )}
            {item.hypothesis && (
              <div>
                <dt className="inline font-bold text-slate-500">仮説：</dt>
                <dd className="inline">{item.hypothesis}</dd>
              </div>
            )}
            <div>
              <dt className="inline font-bold text-slate-500">目標：</dt>
              <dd className="inline">
                {def.label} {value(item.target, def)}（{item.start}〜{item.end}
                {item.filter?.source ? `・${SOURCE_LABELS[item.filter.source] ?? item.filter.source}だけ` : ''}
                {item.filter?.campaign ? `・計測名 ${item.filter.campaign}` : ''}）
              </dd>
            </div>
            <div>
              <button type="button" onClick={() => setEditing(true)} className="h-9 text-sm font-bold text-teal-700">
                計画を直す
              </button>
            </div>
          </dl>
        )}
      </Section>

      <Section letter="D" title={`実行（やること ${done}／${item.actions.length}）`}>
        <ul className="space-y-1">
          {item.actions.map((a) => (
            <li key={a.id} className="flex items-start gap-3 py-1">
              <input
                id={`a-${item.id}-${a.id}`}
                type="checkbox"
                checked={a.done}
                onChange={() =>
                  void onPatch({
                    actions: item.actions.map((x) => (x.id === a.id ? { ...x, done: !x.done, doneAt: !x.done ? today : undefined } : x)),
                  })
                }
                className="mt-0.5 h-5 w-5 shrink-0 accent-teal-600"
              />
              <label htmlFor={`a-${item.id}-${a.id}`} className={`min-w-0 flex-1 text-sm leading-relaxed ${a.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                {a.text}
              </label>
            </li>
          ))}
        </ul>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newAction.trim()) return
            void onPatch({ actions: [...item.actions, { id: newLocalId(), text: newAction.trim(), done: false }] }).then((ok) => ok && setNewAction(''))
          }}
        >
          <input className={`${input} mt-0`} placeholder="やることを足す" value={newAction} maxLength={200} onChange={(e) => setNewAction(e.target.value)} />
          <button type="submit" className={`${pill} shrink-0`} disabled={!newAction.trim()}>
            足す
          </button>
        </form>

        <div className="mt-4 rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-bold text-slate-600">やったことを記録（あとで振り返る手がかり）</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[9.5rem_1fr_auto]">
            <input type="date" className={`${input} mt-0`} value={logDate} onChange={(e) => setLogDate(e.target.value)} aria-label="記録する日" />
            <input
              className={`${input} mt-0`}
              placeholder="例：間があいた方3人に声かけ（お名前は書かない）"
              value={logText}
              maxLength={400}
              onChange={(e) => setLogText(e.target.value)}
              aria-label="やったこと"
            />
            <button type="button" className={pill} onClick={() => void addLog()} disabled={!logText.trim()}>
              記録
            </button>
          </div>
          {item.metric === 'manual' && (
            <div className="mt-2 flex gap-2">
              <input
                className={`${input} mt-0 text-right`}
                inputMode="numeric"
                placeholder="数（例：口コミ 2件）"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                aria-label="数を記録"
              />
              <button type="button" className={`${pill} shrink-0`} onClick={() => void addManual()} disabled={!manualValue.trim()}>
                数を記録
              </button>
            </div>
          )}
          {item.logs.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-600">
              {item.logs.slice(0, 8).map((l) => (
                <li key={l.id} className="flex gap-2">
                  <span className="shrink-0 tabular-nums text-slate-400">{md(l.at)}</span>
                  <span className="min-w-0">{l.text}</span>
                </li>
              ))}
              {item.logs.length > 8 && <li className="text-slate-400">ほか {item.logs.length - 8}件</li>}
            </ul>
          )}
        </div>
      </Section>

      <Section letter="C" title="評価（数字は自動で集めます）">
        {c ? (
          <>
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {(
                [
                  [c.phase === 'ended' ? '期間の結果' : '今日まで', c.noData ? '—' : value(c.actual, def)],
                  [
                    def.sum && c.phase === 'running' ? 'このペースで' : '目標に対して',
                    c.noData ? '—' : def.sum && c.phase === 'running' ? value(c.projected, def) : `${Math.round(c.progress * 100)}%`,
                  ],
                  ['目標', value(item.target, def)],
                  [
                    '始める前の同じ日数',
                    c.baseline === null
                      ? '—'
                      : `${value(c.baseline, def)}${c.change === null ? '' : `（${c.change >= 0 ? '+' : '−'}${Math.abs(Math.round(c.change * 100))}%）`}`,
                  ],
                ] as const
              ).map(([label, v]) => (
                <div key={label} className="rounded-xl bg-slate-50 px-3 py-2">
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="font-bold tabular-nums text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              {c.phase === 'before'
                ? `${item.start}から数えはじめます。`
                : `${c.totalDays}日のうち${c.elapsedDays}日目。数字のもと：${def.source}。始める前の同じ日数＝${c.baselineRange.from}〜${c.baselineRange.to}。`}
              {c.notes.map((n) => (
                <span key={n} className="block text-amber-700">
                  ・{n}
                </span>
              ))}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500">数字を集められませんでした。</p>
        )}
      </Section>

      <Section letter="A" title="改善（振り返って次へ）">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="この施策をどうするか">
          {(Object.keys(DECISION_LABELS) as Decision[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={review.decision === k}
              onClick={() => setReview({ ...review, decision: k })}
              className={`h-10 rounded-full px-4 text-sm font-bold ${review.decision === k ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}
            >
              {DECISION_LABELS[k]}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="学んだこと（うまくいった・いかなかった理由）">
            <textarea className={`${input} min-h-24`} value={review.learned} maxLength={800} onChange={(e) => setReview({ ...review, learned: e.target.value })} />
          </Field>
          <Field label="次にやること">
            <textarea className={`${input} min-h-24`} value={review.next} maxLength={800} onChange={(e) => setReview({ ...review, next: e.target.value })} />
          </Field>
        </div>
        {note && <p className="mt-2 text-xs text-slate-600">{note}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={pill} onClick={() => void askReview()} disabled={asking}>
            <Sparkles className="h-4 w-4" aria-hidden />
            {asking ? '考えています…' : ai ? 'AIに振り返りを相談' : '数字から下書き'}
          </button>
          <button type="button" className={pill} onClick={() => void saveReview(false)}>
            振り返りを保存
          </button>
          <button type="button" className={primary} onClick={() => void saveReview(true)}>
            完了にする
          </button>
          <button
            type="button"
            className={pill}
            onClick={() => onNext(nextConcern || [`「${item.title}」の次の施策`, review.learned && `学んだこと：${review.learned}`, review.next && `次にやること：${review.next}`].filter(Boolean).join('\n'))}
          >
            次の施策を相談する
          </button>
        </div>
        <div className="mt-4 flex justify-end">
          {confirmDelete ? (
            <span className="flex items-center gap-2 text-xs text-slate-600">
              この施策を消しますか？
              <button type="button" className="h-9 rounded-full bg-red-600 px-3 font-bold text-white" onClick={() => void onDelete()}>
                消す
              </button>
              <button type="button" className="h-9 px-2 font-bold text-slate-500" onClick={() => setConfirmDelete(false)}>
                やめる
              </button>
            </span>
          ) : (
            <button type="button" className="inline-flex h-9 items-center gap-1 text-xs font-bold text-slate-400 hover:text-red-600" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              消す
            </button>
          )}
        </div>
      </Section>
    </details>
  )
}

// ── 画面 ─────────────────────────────────────────────

export default function PdcaPage() {
  const { isAdmin } = useMarketingRole()
  const [data, setData] = useState<ListResponse | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState<PdcaStatus>('doing')
  const [concern, setConcern] = useState('')
  const [consulting, setConsulting] = useState(false)
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [saving, setSaving] = useState(false)

  async function reload() {
    const res = await fetch('/api/marketing/pdca', { cache: 'no-store' })
    if (!res.ok) throw new Error(String(res.status))
    const body = (await res.json()) as ListResponse
    setData(body)
    return body
  }

  async function consult(opts: { templateId?: string; concernText?: string; today?: string }) {
    const text = opts.concernText ?? concern
    setConsulting(true)
    setMessage('')
    try {
      let goal: number | undefined
      try {
        const g = Number(window.localStorage.getItem('keiei:goal'))
        goal = g > 0 ? g : undefined
      } catch {
        goal = undefined
      }
      const res = await fetch('/api/marketing/pdca/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'plan', concern: text, templateId: opts.templateId, goal }),
      })
      const body = (await res.json()) as { draft?: PlanDraft; reason?: string; ai?: boolean; fallback?: string; error?: string }
      if (!res.ok || !body.draft) {
        setMessage(body.error ?? '計画を作れませんでした')
        return
      }
      const today = opts.today ?? data?.today ?? new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)
      setDraft({
        draft: body.draft,
        start: today,
        end: addDays(today, Math.max(7, body.draft.days) - 1),
        reason: body.reason ?? '',
        ai: Boolean(body.ai),
        fallback: body.fallback,
        concern: text,
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setMessage('計画を作れませんでした（通信の失敗）')
    } finally {
      setConsulting(false)
    }
  }

  useEffect(() => {
    let alive = true
    fetch('/api/marketing/pdca', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status))
        return (await r.json()) as ListResponse
      })
      .then((body) => {
        if (!alive) return
        setData(body)
        setLoaded(true)
        // 「道すじ」の段階から来たとき（?t=ひな形）は、その下書きをすぐ出す
        const t = new URLSearchParams(window.location.search).get('t')
        if (t) {
          window.history.replaceState(null, '', window.location.pathname)
          void consult({ templateId: t, concernText: '', today: body.today })
        }
      })
      .catch(() => {
        if (!alive) return
        setMessage('読み込めませんでした')
        setLoaded(true)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const groups = useMemo(() => {
    const out: Record<PdcaStatus, PdcaItem[]> = { doing: [], review: [], done: [] }
    if (!data) return out
    for (const it of data.items) out[effectiveStatus(it, data.today)].push(it)
    return out
  }, [data])

  if (!isAdmin) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">この画面は院長（管理者）だけが見られます。</div>
  }

  async function saveDraft() {
    if (!draft) return
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/marketing/pdca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft.draft,
          actions: draft.draft.actions.map((a) => a.trim()).filter(Boolean),
          start: draft.start,
          end: draft.end,
          origin: { concern: draft.concern.slice(0, 600), ai: draft.ai },
        }),
      })
      const body = (await res.json()) as { error?: string }
      if (!res.ok) {
        setMessage(body.error ?? '保存できませんでした')
        return
      }
      setDraft(null)
      setConcern('')
      setTab('doing')
      await reload()
      setMessage('施策を始めました。やったことを記録していくと、振り返りの手がかりになります。')
    } catch {
      setMessage('保存できませんでした（通信の失敗）')
    } finally {
      setSaving(false)
    }
  }

  async function patch(id: string, p: Partial<PdcaItem>): Promise<boolean> {
    // 画面はすぐ変え、保存できなければ元に戻す
    const before = data
    if (data) setData({ ...data, items: data.items.map((i) => (i.id === id ? { ...i, ...p } : i)) })
    try {
      const res = await fetch('/api/marketing/pdca', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...p }),
      })
      if (!res.ok) throw new Error(String(res.status))
      // 数字（評価）は計画・記録で変わるので読み直す
      if ('start' in p || 'end' in p || 'target' in p || 'manual' in p || 'status' in p) await reload()
      return true
    } catch {
      setData(before)
      setMessage('保存できませんでした')
      return false
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/marketing/pdca?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (res.ok) await reload()
    else setMessage('消せませんでした')
  }

  const list = groups[tab]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-black text-slate-900 sm:text-2xl">PDCA（施策を回す）</h1>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
          相談して計画 → やったことを記録 → 数字で評価（自動） → 振り返って次へ。
          <Link href="/marketing/sales/goal" className="ml-1 font-bold text-teal-700">
            月の目標への道すじ
          </Link>
        </p>
      </div>

      {message && <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p>}

      {draft && data ? (
        <DraftEditor state={draft} metrics={data.metrics} onChange={setDraft} onSave={() => void saveDraft()} onCancel={() => setDraft(null)} saving={saving} />
      ) : (
        <section className="rounded-2xl p-4 text-white sm:p-6" style={{ background: '#13253d' }}>
          <h2 className="text-[15px] font-bold">相談して計画をつくる</h2>
          <p className="mt-0.5 text-xs text-white/60">いま気になっていること・やりたいことを書いてください（患者さんのお名前は書かないでください）</p>
          <textarea
            className="mt-3 min-h-24 w-full rounded-xl border-0 bg-white/95 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-300"
            placeholder="例：初めての方を月10人にしたい。Instagramからの予約が少ない気がする"
            value={concern}
            maxLength={600}
            onChange={(e) => setConcern(e.target.value)}
            aria-label="相談の内容"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void consult({})}
              disabled={consulting || !concern.trim() || !data}
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-teal-500 px-5 text-sm font-bold text-white hover:bg-teal-400 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              {consulting ? '考えています…' : data?.ai ? 'AIに相談して計画をつくる' : '計画の下書きをつくる'}
            </button>
            {data?.ai && <span className="text-xs text-white/50">AIに相談すると、1回 数円〜10円ほどかかります</span>}
          </div>
          {data && (
            <div className="mt-4 border-t border-white/10 pt-3">
              <p className="text-xs text-white/60">ひな形から作る（AIを使わない・無料）</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={consulting}
                    onClick={() => void consult({ templateId: t.id, concernText: '' })}
                    className="h-9 rounded-full bg-white/10 px-3 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-50"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <div className="grid grid-cols-3 gap-1 rounded-full bg-slate-200/70 p-1" role="group" aria-label="施策の段階">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`h-10 rounded-full text-sm font-bold ${tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {t.label}
            <span className="ml-1 tabular-nums text-xs text-slate-400">{groups[t.key].length}</span>
          </button>
        ))}
      </div>

      {!loaded && <p className="text-sm text-slate-400">読み込み中…</p>}
      {loaded && data && list.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm leading-relaxed text-slate-600">
          {tab === 'doing'
            ? 'まだ実行中の施策はありません。上で相談するか、ひな形から1つ始めてみましょう。'
            : tab === 'review'
              ? '振り返りの時期の施策はありません。期間が終わると、ここに出ます。'
              : '終わった施策はまだありません。'}
        </div>
      )}
      {data && (
        <div className="space-y-3">
          {list.map((it, i) => (
            <ItemCard
              key={it.id}
              item={it}
              c={data.checks[it.id]}
              today={data.today}
              open={i === 0 && tab !== 'done'}
              ai={data.ai}
              onPatch={(p) => patch(it.id, p)}
              onDelete={() => remove(it.id)}
              onNext={(text) => {
                setConcern(text)
                setDraft(null)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
