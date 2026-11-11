'use client'
/**
 * アウトカム（評価・測定 → アウトカム）
 * 痛み（NRS）・可動域・機能スコア・筋力（LSI）を、その場で ＋／− で記録し、指標ごとにグラフで経過を見る。
 * 記録は pt_outcomes（カルテの同期で、ほかの端末にも15秒ほどで出る）。
 */
import { useMemo, useState } from 'react'
import { nanoid } from 'nanoid'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Patient } from '@/types/patient'
import type { OutcomeRecord } from '@/types/contracts'
import { OUTCOME_METRICS, getOutcomeMetric, type OutcomeMetric } from '@/data/outcome-metrics'
import { addOutcome, deleteOutcome } from '@/lib/contracts/store'
import { jstToday } from '@/lib/contracts/member'

const GROUPS: OutcomeMetric['group'][] = ['痛み', '可動域', '機能スコア', '筋力・LSI']

function fmt(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

export default function OutcomeQuickTab({
  patient,
  outcomes,
  onUpdate,
}: {
  patient: Patient
  outcomes: OutcomeRecord[]
  onUpdate: () => void
}) {
  const [metricKey, setMetricKey] = useState<OutcomeMetric['key']>(() => outcomes.at(-1)?.metric ?? 'nrs')
  const metric = getOutcomeMetric(metricKey) ?? OUTCOME_METRICS[0]
  const series = useMemo(() => outcomes.filter((o) => o.metric === metric.key), [outcomes, metric.key])
  const lastValue = series.at(-1)?.value
  const [value, setValue] = useState<number>(lastValue ?? metric.start)
  const [date, setDate] = useState(jstToday())
  const [side, setSide] = useState(series.at(-1)?.side ?? '')
  const [note, setNote] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  function choose(m: OutcomeMetric) {
    setMetricKey(m.key)
    const prev = outcomes.filter((o) => o.metric === m.key).at(-1)
    setValue(prev?.value ?? m.start)
    setSide(prev?.side ?? '')
  }

  function clamp(v: number) {
    return Math.min(metric.max, Math.max(metric.min, Math.round(v / metric.step) * metric.step))
  }

  function record() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(value)) return
    addOutcome({
      id: nanoid(10),
      patientId: patient.id,
      date,
      metric: metric.key,
      value: clamp(value),
      side: side.trim() || undefined,
      note: note.trim() || undefined,
      createdAt: new Date().toISOString(),
    })
    setNote('')
    onUpdate()
  }

  const first = series[0]
  const latest = series.at(-1)
  const diff = first && latest && series.length > 1 ? latest.value - first.value : null
  const improved = diff === null ? null : metric.better === 'low' ? diff < 0 : diff > 0

  return (
    <div className="space-y-4">
      {/* 指標をえらぶ */}
      <div className="space-y-2">
        {GROUPS.map((g) => (
          <div key={g} className="flex flex-wrap items-center gap-2">
            <span className="w-20 shrink-0 text-xs font-bold text-slate-500">{g}</span>
            {OUTCOME_METRICS.filter((m) => m.group === g).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => choose(m)}
                aria-pressed={m.key === metric.key}
                className={`min-h-10 rounded-full border px-3 text-sm ${
                  m.key === metric.key ? 'border-teal-700 bg-teal-700 font-bold text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* 記録する */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="text-sm font-bold text-slate-700">{metric.label}</p>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                aria-label="減らす"
                onClick={() => setValue((v) => clamp(v - metric.step))}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                <Minus className="h-5 w-5" aria-hidden />
              </button>
              <input
                type="number"
                inputMode="decimal"
                value={Number.isFinite(value) ? value : ''}
                min={metric.min}
                max={metric.max}
                step={metric.step}
                onChange={(e) => setValue(Number(e.target.value))}
                className="h-12 w-24 rounded-xl border border-slate-300 text-center text-2xl font-black tabular-nums"
                aria-label={`${metric.label}の値`}
              />
              <span className="w-6 text-lg text-slate-600">{metric.unit}</span>
              <button
                type="button"
                aria-label="増やす"
                onClick={() => setValue((v) => clamp(v + metric.step))}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </div>
          <label className="text-sm">
            <span className="font-bold text-slate-700">測定日</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block min-h-11 rounded-lg border border-slate-300 px-2" />
          </label>
          <label className="text-sm">
            <span className="font-bold text-slate-700">部位・左右</span>
            <input
              value={side}
              onChange={(e) => setSide(e.target.value)}
              list="outcome-sides"
              placeholder="右膝 など"
              className="mt-1 block min-h-11 w-32 rounded-lg border border-slate-300 px-2"
            />
            <datalist id="outcome-sides">
              {['右', '左', '両側', '右膝', '左膝', '右足首', '左足首', '右肩', '左肩', '腰'].map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label className="min-w-[10rem] flex-1 text-sm">
            <span className="font-bold text-slate-700">メモ</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="測り方・条件など" className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-2" />
          </label>
          <button type="button" onClick={record} className="min-h-12 rounded-xl bg-teal-700 px-6 font-bold text-white hover:bg-teal-800">
            記録する
          </button>
        </div>
      </section>

      {/* 経過 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-bold text-slate-900">{metric.label} の経過</h3>
          {first && latest && series.length > 1 && (
            <p className={`text-sm font-bold ${improved ? 'text-teal-700' : 'text-orange-700'}`}>
              初回 {fmt(first.value)}
              {metric.unit} → 最新 {fmt(latest.value)}
              {metric.unit}（{diff! > 0 ? '+' : ''}
              {fmt(diff!)}
              {metric.unit}・{improved ? '改善' : diff === 0 ? '変わらず' : '悪化'}）
            </p>
          )}
        </div>
        {series.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">まだ記録がありません。上の「記録する」で残すと、ここに経過のグラフが出ます。</p>
        ) : (
          <div className="mt-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series.map((o) => ({ date: o.date, value: o.value }))} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis domain={[metric.min, metric.max]} tick={{ fontSize: 12 }} reversed={false} />
                <Tooltip formatter={(v) => [`${v}${metric.unit}`, metric.label]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                {metric.target !== undefined && (
                  <ReferenceLine y={metric.target} stroke="#0f766e" strokeDasharray="4 3" label={{ value: `目安 ${metric.target}${metric.unit}`, fontSize: 12, fill: '#0f766e' }} />
                )}
                <Line type="monotone" dataKey="value" stroke={metric.better === 'low' ? '#dc2626' : '#0f766e'} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {metric.better === 'low' && series.length > 0 && <p className="mt-1 text-xs text-slate-500">痛みは数字が小さいほど良い状態です。</p>}
      </section>

      {/* 記録の一覧 */}
      <section>
        <h3 className="mb-2 text-sm font-bold text-slate-700">記録の一覧（すべての指標）</h3>
        {outcomes.length === 0 ? (
          <p className="text-sm text-slate-500">まだ記録がありません。</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-600">
                  <th className="px-3 py-2 font-bold">測定日</th>
                  <th className="px-3 py-2 font-bold">指標</th>
                  <th className="px-3 py-2 font-bold">部位</th>
                  <th className="px-3 py-2 text-right font-bold">値</th>
                  <th className="px-3 py-2 font-bold">メモ</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {[...outcomes].reverse().map((o) => {
                  const m = getOutcomeMetric(o.metric)
                  return (
                    <tr key={o.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 tabular-nums">{o.date}</td>
                      <td className="px-3 py-2">{m?.label ?? o.metric}</td>
                      <td className="px-3 py-2">{o.side ?? ''}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">
                        {fmt(o.value)}
                        {m?.unit}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{o.note ?? ''}</td>
                      <td className="px-3 py-2 text-right">
                        {confirmId === o.id ? (
                          <button
                            type="button"
                            onClick={() => {
                              deleteOutcome(o.id)
                              setConfirmId(null)
                              onUpdate()
                            }}
                            className="min-h-10 rounded-lg bg-red-600 px-2 text-xs font-bold text-white"
                          >
                            消す
                          </button>
                        ) : (
                          <button
                            type="button"
                            aria-label="この記録を消す"
                            onClick={() => setConfirmId(o.id)}
                            className="flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
