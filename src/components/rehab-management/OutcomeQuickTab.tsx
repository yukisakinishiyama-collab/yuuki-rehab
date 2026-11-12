'use client'
/**
 * アウトカム（評価・測定 → アウトカム）
 * 痛み（NRS）・可動域・機能スコア・筋力（LSI）・ホップ・バランスを、その場で ＋／− で記録し、指標ごとにグラフで経過を見る。
 * 競技（野球・サッカー・陸上・バスケ/バレー・ACL術後）をえらぶと、その競技でよく使う指標が上に並び、目安とのまとめが出る。
 * 左右を入れる指標は LSI・左右差を、肩の内旋・外旋は GIRD と TRM 差を自動で出す。
 * 記録は pt_outcomes、競技の設定は pt_outcome_settings（カルテの同期で、ほかの端末にも15秒ほどで出る）。
 */
import { useMemo, useState } from 'react'
import { nanoid } from 'nanoid'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Patient } from '@/types/patient'
import type { OutcomeRecord, SportKey } from '@/types/contracts'
import {
  OUTCOME_GROUPS,
  OUTCOME_METRICS,
  SPORT_SETS,
  TRM_CAUTION,
  WILK_SOURCE,
  getOutcomeMetric,
  getSportSet,
  suggestSport,
  type OutcomeMetric,
} from '@/data/outcome-metrics'
import { addOutcome, deleteOutcome, setOutcomeSport } from '@/lib/contracts/store'
import { jstToday } from '@/lib/contracts/member'
import { buildOutcomeValues, judgeTarget, latestByMetric, trmOver, type RotationInput } from '@/lib/outcomes/calc'

function fmt(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 10 && !Number.isInteger(v * 10) ? 2 : 1)
}

const ROT_DEFAULT: RotationInput = { irThrow: 45, erThrow: 115, irNon: 60, erNon: 100 }

/** 一覧・まとめに出す「元の値」（患側 20 / 健側 25 kg など） */
function rawText(m: OutcomeMetric | undefined, o: OutcomeRecord): string {
  if (!m) return ''
  if (m.rotation && o.detail) {
    const d = o.detail
    return `投げる側 内旋${d.irThrow}°・外旋${d.erThrow}° / 投げない側 内旋${d.irNon}°・外旋${d.erNon}°`
  }
  if (m.pair && o.involved !== undefined && o.uninvolved !== undefined) {
    return `${m.pair.labels[0]} ${fmt(o.involved)} / ${m.pair.labels[1]} ${fmt(o.uninvolved)} ${m.pair.unit}`
  }
  return ''
}

function valueText(m: OutcomeMetric | undefined, o: OutcomeRecord): string {
  if (m?.rotation) {
    const trm = o.detail?.trm
    return `GIRD ${fmt(o.value)}°${trm !== undefined ? `・TRM差 ${fmt(trm)}°` : ''}`
  }
  return `${fmt(o.value)}${m?.unit ?? ''}`
}

function Stepper({
  label,
  value,
  onChange,
  step,
  min,
  max,
  unit,
  size = 'lg',
  name,
}: {
  label: string
  /** 読み上げの名前（省略すると label） */
  name?: string
  value: number
  onChange: (v: number) => void
  step: number
  min: number
  max: number
  unit: string
  size?: 'lg' | 'md'
}) {
  const said = name ?? label
  const clamp = (v: number) => {
    const r = Math.round(v / step) * step
    return Math.min(max, Math.max(min, Number(r.toFixed(2))))
  }
  const box = size === 'lg' ? 'h-12 w-12' : 'h-11 w-11'
  return (
    <div>
      <p className="text-sm font-bold text-slate-700">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          aria-label={`${said}を減らす`}
          onClick={() => onChange(clamp(value - step))}
          className={`flex ${box} items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
        >
          <Minus className="h-5 w-5" aria-hidden />
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`${size === 'lg' ? 'h-12 w-24 text-2xl' : 'h-11 w-20 text-xl'} rounded-xl border border-slate-300 text-center font-black tabular-nums`}
          aria-label={`${said}の値`}
        />
        {unit && <span className="min-w-6 text-lg text-slate-600">{unit}</span>}
        <button
          type="button"
          aria-label={`${said}を増やす`}
          onClick={() => onChange(clamp(value + step))}
          className={`flex ${box} items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
        >
          <Plus className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  )
}

/** 目安との比べ（まとめ・経過の見出しに出す小さな札） */
function TargetBadge({ metric, record }: { metric: OutcomeMetric; record: OutcomeRecord }) {
  const j = judgeTarget(metric, record.value)
  const trm = metric.rotation ? record.detail?.trm : undefined
  const badges: { text: string; tone: 'ok' | 'warn' | 'info' }[] = []
  if (j.state === 'reached') badges.push({ text: '目安に届いている', tone: 'ok' })
  if (j.state === 'notyet') badges.push({ text: `目安まであと ${fmt(j.gap)}${metric.unit}`, tone: 'warn' })
  if (j.state === 'over') badges.push({ text: metric.rotation ? 'GIRD が注意の区切り以上' : '注意の区切りを超えている', tone: 'warn' })
  if (j.state === 'within') badges.push({ text: metric.rotation ? 'GIRD は区切りの内側' : '区切りの内側', tone: 'ok' })
  if (j.state === 'reference')
    badges.push({ text: j.gap > 0 ? `参考の値まであと ${fmt(j.gap)}${metric.unit}` : '参考の値と同じくらい以上', tone: 'info' })
  if (metric.rotation && trm !== undefined)
    badges.push(trmOver(trm) ? { text: `TRM差が${TRM_CAUTION}°を超えている`, tone: 'warn' } : { text: `TRM差は${TRM_CAUTION}°以内`, tone: 'ok' })
  if (badges.length === 0) return null
  return (
    <span className="flex flex-wrap gap-1">
      {badges.map((b) => (
        <span
          key={b.text}
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            b.tone === 'ok' ? 'bg-teal-50 text-teal-800' : b.tone === 'warn' ? 'bg-orange-50 text-orange-800' : 'bg-slate-100 text-slate-700'
          }`}
        >
          {b.text}
        </span>
      ))}
    </span>
  )
}

export default function OutcomeQuickTab({
  patient,
  outcomes,
  sport,
  suggestText = '',
  onUpdate,
}: {
  patient: Patient
  outcomes: OutcomeRecord[]
  /** えらんである競技（まだえらんでいなければ null） */
  sport: SportKey | null
  /** 競技のおすすめを出すための文（傷病名・主訴・問診の運動歴など） */
  suggestText?: string
  onUpdate: () => void
}) {
  const set = getSportSet(sport ?? 'none')
  const suggested = sport === null ? suggestSport(suggestText) : null
  const suggestedSet = suggested ? getSportSet(suggested) : null

  const [metricKey, setMetricKey] = useState<OutcomeMetric['key']>(() => outcomes.at(-1)?.metric ?? set.metrics[0] ?? 'nrs')
  const metric = getOutcomeMetric(metricKey) ?? OUTCOME_METRICS[0]
  const series = useMemo(() => outcomes.filter((o) => o.metric === metric.key), [outcomes, metric.key])
  const latestMap = useMemo(() => latestByMetric(outcomes), [outcomes])

  const prev = series.at(-1)
  const [value, setValue] = useState<number>(prev?.value ?? metric.start)
  const [pairA, setPairA] = useState<number>(prev?.involved ?? metric.pair?.start[0] ?? 0)
  const [pairB, setPairB] = useState<number>(prev?.uninvolved ?? metric.pair?.start[1] ?? 0)
  const [rot, setRot] = useState<RotationInput>(() => rotFrom(prev))
  const [date, setDate] = useState(jstToday())
  const [side, setSide] = useState(prev?.side ?? '')
  const [note, setNote] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState('')

  function rotFrom(r: OutcomeRecord | undefined): RotationInput {
    const d = r?.detail
    if (!d) return ROT_DEFAULT
    return { irThrow: d.irThrow ?? ROT_DEFAULT.irThrow, erThrow: d.erThrow ?? ROT_DEFAULT.erThrow, irNon: d.irNon ?? ROT_DEFAULT.irNon, erNon: d.erNon ?? ROT_DEFAULT.erNon }
  }

  function choose(m: OutcomeMetric) {
    setMetricKey(m.key)
    const last = outcomes.filter((o) => o.metric === m.key).at(-1)
    setValue(last?.value ?? m.start)
    setPairA(last?.involved ?? m.pair?.start[0] ?? 0)
    setPairB(last?.uninvolved ?? m.pair?.start[1] ?? 0)
    setRot(rotFrom(last))
    setSide(last?.side ?? '')
    setError('')
  }

  function chooseSport(key: SportKey) {
    setOutcomeSport(patient.id, key)
    const next = getSportSet(key)
    if (next.metrics.length > 0 && !next.metrics.includes(metric.key)) {
      const m = getOutcomeMetric(next.metrics[0])
      if (m) choose(m)
    }
    onUpdate()
  }

  const preview = useMemo(
    () =>
      buildOutcomeValues(
        metric,
        metric.rotation ? { kind: 'rotation', r: rot } : metric.pair ? { kind: 'pair', a: pairA, b: pairB } : { kind: 'single', value },
      ),
    [metric, rot, pairA, pairB, value],
  )

  function record() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('測定日を入れてください。')
      return
    }
    if (!preview) {
      setError(metric.pair?.calc === 'lsi' ? '健側の値を 0 より大きくしてください。' : metric.pair?.calc === 'lsi_time' ? '患側の時間を 0 より大きくしてください。' : '値を確かめてください。')
      return
    }
    addOutcome({
      id: nanoid(10),
      patientId: patient.id,
      date,
      metric: metric.key,
      ...preview,
      side: side.trim() || undefined,
      note: note.trim() || undefined,
      createdAt: new Date().toISOString(),
    })
    setNote('')
    setError('')
    onUpdate()
  }

  const first = series[0]
  const latest = series.at(-1)
  const diff = first && latest && series.length > 1 ? latest.value - first.value : null
  const improved = diff === null ? null : metric.better === 'low' ? diff < 0 : diff > 0

  const chartData = series.map((o) => ({ date: o.date, value: o.value, trm: o.detail?.trm }))
  const domain = useMemo(() => {
    const vals = chartData.flatMap((d) => [d.value, d.trm]).filter((v): v is number => typeof v === 'number')
    if (metric.target) vals.push(metric.target.value)
    if (metric.rotation) vals.push(TRM_CAUTION, 0)
    if (vals.length === 0) return [metric.min, metric.max] as [number, number]
    const lo = Math.min(...vals)
    const hi = Math.max(...vals)
    const pad = Math.max((hi - lo) * 0.15, metric.step * 2, 1)
    const unit = hi - lo + pad * 2 > 20 ? 5 : 1
    return [Math.max(metric.min, Math.floor((lo - pad) / unit) * unit), Math.min(metric.max, Math.ceil((hi + pad) / unit) * unit)] as [number, number]
  }, [chartData, metric])

  const otherMetrics = set.metrics.length > 0 ? OUTCOME_METRICS.filter((m) => !set.metrics.includes(m.key)) : OUTCOME_METRICS

  function chip(m: OutcomeMetric) {
    return (
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
    )
  }

  function groupRows(list: OutcomeMetric[]) {
    return OUTCOME_GROUPS.map((g) => {
      const items = list.filter((m) => m.group === g)
      if (items.length === 0) return null
      return (
        <div key={g} className="flex flex-wrap items-center gap-2">
          <span className="w-24 shrink-0 text-xs font-bold text-slate-500">{g}</span>
          {items.map(chip)}
        </div>
      )
    })
  }

  return (
    <div className="space-y-4">
      {/* 競技の評価セット */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-slate-700">競技の評価セット</span>
          {SPORT_SETS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => chooseSport(s.key)}
              aria-pressed={set.key === s.key}
              className={`min-h-10 rounded-full border px-3 text-sm ${
                set.key === s.key ? 'border-teal-700 bg-teal-700 font-bold text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {set.key === 'none' ? 'えらぶと、その競技でよく使う評価が上に並び、目安とのまとめが出ます。' : `${set.label}：${set.who}。`}
        </p>
        {suggestedSet && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">
            <span>カルテの内容から「{suggestedSet.label}」が合いそうです。</span>
            <button type="button" onClick={() => chooseSport(suggestedSet.key)} className="min-h-10 rounded-lg bg-sky-800 px-3 font-bold text-white hover:bg-sky-900">
              このセットにする
            </button>
          </div>
        )}
      </section>

      {/* セットのまとめ（最新の値と目安） */}
      {set.metrics.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="font-bold text-slate-900">{set.label} のまとめ（最新の値）</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {set.metrics.map((key) => {
              const m = getOutcomeMetric(key)
              if (!m) return null
              const r = latestMap.get(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => choose(m)}
                  aria-pressed={m.key === metric.key}
                  className={`min-h-16 rounded-xl border p-3 text-left ${m.key === metric.key ? 'border-teal-700 bg-teal-50/40' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <span className="block text-sm font-bold text-slate-700">{m.label}</span>
                  {r ? (
                    <>
                      <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                        <span className="text-lg font-black tabular-nums text-slate-900">{valueText(m, r)}</span>
                        <span className="text-xs text-slate-500">{r.date}</span>
                      </span>
                      {rawText(m, r) && <span className="block text-xs text-slate-600">{rawText(m, r)}</span>}
                      <span className="mt-1 block">
                        <TargetBadge metric={m} record={r} />
                      </span>
                    </>
                  ) : (
                    <span className="mt-0.5 block text-sm text-slate-500">まだ測っていません</span>
                  )}
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            目安・区切りは論文で使われた値を参考に出しています。これだけで復帰を決めるものではありません。痛み・動き・練習の様子とあわせて判断します。
          </p>
        </section>
      )}

      {/* 指標をえらぶ */}
      <div className="space-y-2">
        {set.metrics.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 shrink-0 text-xs font-bold text-teal-800">この競技の評価</span>
            {set.metrics.map((k) => getOutcomeMetric(k)).filter((m): m is OutcomeMetric => !!m).map(chip)}
          </div>
        )}
        {set.metrics.length > 0 ? (
          <details className="rounded-xl border border-slate-200 bg-white px-3 py-2" open={!set.metrics.includes(metric.key)}>
            <summary className="flex min-h-10 cursor-pointer items-center text-sm font-bold text-slate-700">ほかの指標</summary>
            <div className="mt-2 space-y-2">{groupRows(otherMetrics)}</div>
          </details>
        ) : (
          groupRows(otherMetrics)
        )}
      </div>

      {/* 記録する */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="font-bold text-slate-900">{metric.label}</p>
        {(metric.pair?.hint || metric.hint) && <p className="mt-0.5 text-xs text-slate-600">{metric.pair?.hint ?? metric.hint}</p>}

        <div className="mt-3 flex flex-wrap items-end gap-4">
          {metric.rotation ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Stepper label="投げる側 内旋" value={rot.irThrow} onChange={(v) => setRot((r) => ({ ...r, irThrow: v }))} step={1} min={0} max={180} unit="°" size="md" />
              <Stepper label="投げる側 外旋" value={rot.erThrow} onChange={(v) => setRot((r) => ({ ...r, erThrow: v }))} step={1} min={0} max={180} unit="°" size="md" />
              <Stepper label="投げない側 内旋" value={rot.irNon} onChange={(v) => setRot((r) => ({ ...r, irNon: v }))} step={1} min={0} max={180} unit="°" size="md" />
              <Stepper label="投げない側 外旋" value={rot.erNon} onChange={(v) => setRot((r) => ({ ...r, erNon: v }))} step={1} min={0} max={180} unit="°" size="md" />
            </div>
          ) : metric.pair ? (
            <>
              <Stepper label={metric.pair.labels[0]} value={pairA} onChange={setPairA} step={metric.pair.step} min={metric.pair.min} max={metric.pair.max} unit={metric.pair.unit} />
              <Stepper label={metric.pair.labels[1]} value={pairB} onChange={setPairB} step={metric.pair.step} min={metric.pair.min} max={metric.pair.max} unit={metric.pair.unit} />
            </>
          ) : (
            <Stepper label="値" name={metric.label} value={value} onChange={setValue} step={metric.step} min={metric.min} max={metric.max} unit={metric.unit} />
          )}

          {(metric.pair || metric.rotation) && (
            <div className="min-w-[9rem] rounded-xl bg-slate-50 px-3 py-2" aria-live="polite">
              <p className="text-xs font-bold text-slate-600">{metric.rotation ? '自動で計算' : metric.pair?.calc === 'absdiff' ? '左右の差' : 'LSI（自動で計算）'}</p>
              <p className="text-xl font-black tabular-nums text-slate-900">
                {preview ? (metric.rotation ? `GIRD ${fmt(preview.value)}° / TRM差 ${fmt(preview.detail?.trm ?? 0)}°` : `${fmt(preview.value)}${metric.unit}`) : '—'}
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-4">
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
              placeholder={metric.pair ? '患側：右膝 など' : '右膝 など'}
              className="mt-1 block min-h-11 w-32 rounded-lg border border-slate-300 px-2"
            />
            <datalist id="outcome-sides">
              {['右', '左', '両側', '右膝', '左膝', '右足首', '左足首', '右肩', '左肩', '右肘', '左肘', '右股関節', '左股関節', '腰'].map((s) => (
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
        {error && (
          <p role="alert" className="mt-2 text-sm font-bold text-red-700">
            {error}
          </p>
        )}
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
        {latest && (
          <div className="mt-1">
            <TargetBadge metric={metric} record={latest} />
          </div>
        )}
        {series.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">まだ記録がありません。上の「記録する」で残すと、ここに経過のグラフが出ます。</p>
        ) : (
          <div className="mt-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis domain={domain} tick={{ fontSize: 12 }} allowDecimals />
                <Tooltip
                  formatter={(v, name) => [`${v}${metric.rotation ? '°' : metric.unit}`, name === 'trm' ? 'TRM差' : metric.rotation ? 'GIRD' : metric.label]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                {metric.target && (
                  <ReferenceLine
                    y={metric.target.value}
                    stroke={metric.target.type === 'caution' ? '#c2410c' : '#0f766e'}
                    strokeDasharray="4 3"
                    label={{ value: metric.target.label, fontSize: 12, fill: metric.target.type === 'caution' ? '#c2410c' : '#0f766e', position: 'insideTopLeft' }}
                  />
                )}
                {metric.rotation && (
                  <ReferenceLine y={TRM_CAUTION} stroke="#2563eb" strokeDasharray="2 3" label={{ value: `TRM差 ${TRM_CAUTION}°`, fontSize: 12, fill: '#1d4ed8', position: 'insideBottomLeft' }} />
                )}
                <Line
                  type="monotone"
                  dataKey="value"
                  name={metric.rotation ? 'GIRD' : metric.label}
                  stroke={metric.better === 'low' ? '#dc2626' : '#0f766e'}
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                {metric.rotation && <Line type="monotone" dataKey="trm" name="TRM差" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} connectNulls />}
                {metric.rotation && <Legend wrapperStyle={{ fontSize: 12 }} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {metric.better === 'low' && series.length > 0 && (
          <p className="mt-1 text-xs text-slate-500">{metric.group === '痛み' ? '痛みは数字が小さいほど良い状態です。' : '左右の差は小さいほど良い状態です。'}</p>
        )}
        {metric.target && <p className="mt-1 text-xs text-slate-500">線の出どころ：{metric.rotation ? WILK_SOURCE : metric.target.source}</p>}
      </section>

      {/* 記録の一覧 */}
      <section>
        <h3 className="mb-2 text-sm font-bold text-slate-700">記録の一覧（すべての指標）</h3>
        {outcomes.length === 0 ? (
          <p className="text-sm text-slate-500">まだ記録がありません。</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs whitespace-nowrap text-slate-600">
                  <th className="px-3 py-2 font-bold">測定日</th>
                  <th className="px-3 py-2 font-bold">指標</th>
                  <th className="px-3 py-2 font-bold">部位</th>
                  <th className="px-3 py-2 text-right font-bold">値</th>
                  <th className="px-3 py-2 font-bold">メモ・元の値</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {[...outcomes].reverse().map((o) => {
                  const m = getOutcomeMetric(o.metric)
                  const raw = rawText(m, o)
                  return (
                    <tr key={o.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">{o.date}</td>
                      <td className="px-3 py-2">{m?.label ?? o.metric}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{o.side ?? ''}</td>
                      <td className="px-3 py-2 text-right font-bold whitespace-nowrap tabular-nums">{valueText(m, o)}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {o.note ?? ''}
                        {raw && <span className="block text-xs text-slate-500">{raw}</span>}
                      </td>
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
