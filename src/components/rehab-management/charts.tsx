'use client'
// ──────────────────────────────────────────────
// チャートコンポーネント（Recharts）
// ──────────────────────────────────────────────
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PolarRadiusAxis, ReferenceLine,
} from 'recharts'

// ── 痛みNRS推移グラフ ──
export function PainChart({ data }: { data: { date: string; nrs: number }[] }) {
  if (data.length === 0) return <EmptyChart label="痛みのデータがありません" />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
        <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(v) => [`NRS: ${v}`, '痛み']}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Line
          type="monotone" dataKey="nrs" stroke="#ef4444"
          strokeWidth={2.5} dot={{ fill: '#ef4444', r: 4 }}
          activeDot={{ r: 6 }}
        />
        <ReferenceLine y={4} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: '中程度', fontSize: 10 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── 改善スコア推移グラフ ──
export function ImprovementChart({ data }: { data: { date: string; score: number }[] }) {
  if (data.length === 0) return <EmptyChart label="進捗データがありません" />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(v) => [`${v}点`, '改善スコア']}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Line
          type="monotone" dataKey="score" stroke="#0d9488"
          strokeWidth={2.5} dot={{ fill: '#0d9488', r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── ROM推移グラフ ──
export function ROMChart({
  data,
  movement,
  normalValue,
}: {
  data: { date: string; active: number | null; passive: number | null }[]
  movement: string
  normalValue?: number
}) {
  if (data.length === 0) return <EmptyChart label="ROMデータがありません" />
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
        <YAxis tick={{ fontSize: 11 }} unit="°" />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v, name) => [`${v}°`, name === 'active' ? '自動ROM' : '他動ROM']}
        />
        {normalValue && (
          <ReferenceLine
            y={normalValue} stroke="#93C5FD" strokeDasharray="4 2"
            label={{ value: `正常値 ${normalValue}°`, fontSize: 10, fill: '#6B7280' }}
          />
        )}
        <Line type="monotone" dataKey="active" stroke="#0d9488" strokeWidth={2.5}
          dot={{ fill: '#0d9488', r: 4 }} name="active" connectNulls={false} />
        <Line type="monotone" dataKey="passive" stroke="#6EE7B7" strokeWidth={2}
          strokeDasharray="5 2" dot={{ fill: '#6EE7B7', r: 3 }} name="passive" connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── 筋力推移グラフ ──
export function StrengthChart({
  data,
}: {
  data: { date: string; value: number | null; contralateral: number | null }[]
}) {
  if (data.length === 0) return <EmptyChart label="筋力データがありません" />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="value" name="患側" fill="#0d9488" radius={[4, 4, 0, 0]} />
        <Bar dataKey="contralateral" name="健側" fill="#D1FAE5" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── ROM レーダーチャート ──
interface RadarDataItem {
  subject: string
  value: number
  fullMark: number
}

export function ROMRadarChart({ data }: { data: RadarDataItem[] }) {
  if (data.length === 0) return <EmptyChart label="ROMデータがありません" />
  return (
    <ResponsiveContainer width="100%" height={250}>
      <RadarChart data={data}>
        <PolarGrid stroke="#E5E7EB" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
        <Radar name="現在値" dataKey="value" stroke="#0d9488" fill="#0d9488" fillOpacity={0.3} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

// ── スペシャルテスト サマリー ──
export function SpecialTestSummary({
  tests,
}: {
  tests: { name: string; result: string }[]
}) {
  const positive = tests.filter(t => t.result === 'positive')
  const suspicious = tests.filter(t => t.result === 'suspicious')
  const negative = tests.filter(t => t.result === 'negative')

  return (
    <div className="space-y-3">
      {positive.length > 0 && (
        <div>
          <p className="text-xs font-medium text-red-700 mb-1">陽性 ({positive.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {positive.map(t => (
              <span key={t.name} className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">{t.name}</span>
            ))}
          </div>
        </div>
      )}
      {suspicious.length > 0 && (
        <div>
          <p className="text-xs font-medium text-yellow-700 mb-1">疑陽性 ({suspicious.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {suspicious.map(t => (
              <span key={t.name} className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">{t.name}</span>
            ))}
          </div>
        </div>
      )}
      {negative.length > 0 && (
        <div>
          <p className="text-xs font-medium text-green-700 mb-1">陰性 ({negative.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {negative.map(t => (
              <span key={t.name} className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">{t.name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 自宅運動実施率グラフ ──
export function AdherenceChart({ data }: { data: { date: string; rate: number }[] }) {
  if (data.length === 0) return <EmptyChart label="実施率データがありません" />
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v) => [`${v}%`, '実施率']} />
        <Bar dataKey="rate" name="実施率" fill="#6EE7B7" radius={[4, 4, 0, 0]} />
        <ReferenceLine y={70} stroke="#0d9488" strokeDasharray="4 2" />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Empty状態 ──
function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-[160px] flex items-center justify-center text-gray-400 text-sm">
      {label}
    </div>
  )
}
