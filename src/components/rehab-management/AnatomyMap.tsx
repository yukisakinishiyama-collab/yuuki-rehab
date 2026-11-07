'use client'
// ──────────────────────────────────────────────
// 解剖図の部位えらび（新しい形式）
// 関節ごとに「向き（前面・後面・内側・外側…）」を切り替え、イラストの上の部位を押して選ぶ。
// 図と座標は src/lib/anatomy/zones/<joint>.json（Codex が納品）。無い関節は従来の JointDetailMap に戻る。
// 右側の図だけ持ち、左を選んだときは左右反転して出す。
// ──────────────────────────────────────────────
import { useMemo, useState } from 'react'
import type { Side } from '@/types/patient'
import { ANATOMY_VIEW_LABELS, getAnatomySpec, polygonCenter, type AnatomyViewSpec, type ZoneType } from '@/lib/anatomy'
import JointDetailMap from './JointDetailMap'

export interface AnatomyMapProps {
  joint: string
  selected: string[]
  onChange: (regions: string[]) => void
  /** 右・左（左のときは図を反転）。省略時は右 */
  side?: Side
  readOnly?: boolean
}

const ZONE_TEXT = '#0f172a'
const TYPE_COLORS: Record<ZoneType, { idle: string; hover: string; selected: string; stroke: string }> = {
  ligament:  { idle: 'rgba(245,158,11,0.18)',  hover: 'rgba(245,158,11,0.45)', selected: 'rgba(245,158,11,0.72)', stroke: '#b45309' },
  tendon:    { idle: 'rgba(249,115,22,0.18)',  hover: 'rgba(249,115,22,0.45)', selected: 'rgba(249,115,22,0.72)', stroke: '#c2410c' },
  meniscus:  { idle: 'rgba(59,130,246,0.18)',  hover: 'rgba(59,130,246,0.45)', selected: 'rgba(59,130,246,0.72)', stroke: '#1d4ed8' },
  muscle:    { idle: 'rgba(236,72,153,0.18)',  hover: 'rgba(236,72,153,0.45)', selected: 'rgba(236,72,153,0.72)', stroke: '#be185d' },
  nerve:     { idle: 'rgba(234,179,8,0.18)',   hover: 'rgba(234,179,8,0.45)',  selected: 'rgba(234,179,8,0.72)',  stroke: '#92400e' },
  bursa:     { idle: 'rgba(168,85,247,0.18)',  hover: 'rgba(168,85,247,0.45)', selected: 'rgba(168,85,247,0.72)', stroke: '#7e22ce' },
  cartilage: { idle: 'rgba(16,185,129,0.18)',  hover: 'rgba(16,185,129,0.45)', selected: 'rgba(16,185,129,0.72)', stroke: '#065f46' },
  bone:      { idle: 'rgba(107,114,128,0.18)', hover: 'rgba(107,114,128,0.45)',selected: 'rgba(107,114,128,0.72)',stroke: '#374151' },
}
const TYPE_LABELS: Record<ZoneType, string> = {
  ligament: '靭帯', tendon: '腱', meniscus: '半月板', muscle: '筋', nerve: '神経', bursa: '滑液包', cartilage: '軟骨', bone: '骨',
}

export default function AnatomyMap({ joint, selected, onChange, side = 'right', readOnly = false }: AnatomyMapProps) {
  const spec = getAnatomySpec(joint)
  if (!spec) return <JointDetailMap joint={joint} selected={selected} onChange={onChange} readOnly={readOnly} />
  return <AnatomyViews joint={joint} views={spec.views} mirror={spec.mirrorForLeft && side === 'left'} selected={selected} onChange={onChange} readOnly={readOnly} />
}

function AnatomyViews({ joint, views, mirror, selected, onChange, readOnly }: {
  joint: string
  views: AnatomyViewSpec[]
  mirror: boolean
  selected: string[]
  onChange: (regions: string[]) => void
  readOnly: boolean
}) {
  // 選んでいる部位がある向きを最初に出す
  const initial = views.find(v => v.zones.some(z => selected.includes(z.id))) ?? views[0]
  const [viewKey, setViewKey] = useState(initial.view)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const view = views.find(v => v.view === viewKey) ?? views[0]
  const allZones = useMemo(() => views.flatMap(v => v.zones), [views])

  function toggle(id: string) {
    if (readOnly) return
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }

  const hovered = view.zones.find(z => z.id === hoveredId)
  const transform = mirror ? `translate(${view.width} 0) scale(-1 1)` : undefined

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs font-medium text-gray-600">{joint} — 詳細部位{mirror ? '（左）' : ''}</p>
        <div className="ml-auto flex gap-1">
          {views.map(v => {
            const count = v.zones.filter(z => selected.includes(z.id)).length
            return (
              <button
                key={v.view}
                type="button"
                onClick={() => setViewKey(v.view)}
                className={`px-2.5 py-1 text-xs rounded-lg border max-lg:min-h-10 ${viewKey === v.view ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'}`}
              >
                {ANATOMY_VIEW_LABELS[v.view]}{count > 0 ? ` ${count}` : ''}
              </button>
            )
          })}
        </div>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-1">
        {(Object.keys(TYPE_LABELS) as ZoneType[]).filter(t => view.zones.some(z => z.type === t)).map(t => (
          <span key={t} className="flex items-center gap-1 text-xs text-gray-500">
            <span className="inline-block w-3 h-3 rounded-full border" style={{ background: TYPE_COLORS[t].selected, borderColor: TYPE_COLORS[t].stroke }} />
            {TYPE_LABELS[t]}
          </span>
        ))}
      </div>

      <div className="border border-gray-100 rounded-xl overflow-hidden bg-white flex flex-col items-center">
        <div className="h-7 flex items-center justify-center">
          {hovered && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full border" style={{ background: TYPE_COLORS[hovered.type].hover, borderColor: TYPE_COLORS[hovered.type].stroke, color: ZONE_TEXT }}>
              {hovered.label}（{TYPE_LABELS[hovered.type]}）
            </span>
          )}
        </div>
        <svg viewBox={`0 0 ${view.width} ${view.height}`} className="w-full max-w-[360px]" style={{ userSelect: 'none' }} role="img" aria-label={`${joint}の${ANATOMY_VIEW_LABELS[view.view]}`}>
          <g transform={transform}>
            <image href={view.image} x="0" y="0" width={view.width} height={view.height} preserveAspectRatio="xMidYMid meet" />
            {view.zones.map(z => {
              const isSelected = selected.includes(z.id)
              const isHovered = hoveredId === z.id
              const c = TYPE_COLORS[z.type]
              return (
                <polygon
                  key={z.id}
                  points={z.polygon.map(([x, y]) => `${x},${y}`).join(' ')}
                  fill={isSelected ? c.selected : isHovered ? c.hover : c.idle}
                  stroke={c.stroke}
                  strokeWidth={isSelected ? 3 : 1.5}
                  strokeOpacity={isSelected || isHovered ? 1 : 0.5}
                  strokeLinejoin="round"
                  cursor={readOnly ? 'default' : 'pointer'}
                  onClick={() => toggle(z.id)}
                  onMouseEnter={() => setHoveredId(z.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <title>{z.label}</title>
                </polygon>
              )
            })}
          </g>
          {/* 選んだ部位の名札（反転しても文字は読める向きに） */}
          {view.zones.filter(z => selected.includes(z.id)).map(z => {
            const [cx, cy] = z.labelAt ?? polygonCenter(z.polygon)
            const x = mirror ? view.width - cx : cx
            return (
              <text key={`t-${z.id}`} x={x} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(12, view.width / 40)} fontWeight={700} fill={ZONE_TEXT} stroke="#fff" strokeWidth={3} paintOrder="stroke" pointerEvents="none">
                {z.label}
              </text>
            )
          })}
        </svg>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {selected.map(id => {
            const z = allZones.find(x => x.id === id)
            if (!z) return null
            const c = TYPE_COLORS[z.type]
            return (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border" style={{ background: c.selected, borderColor: c.stroke, color: ZONE_TEXT }}>
                {z.label}
                {!readOnly && (
                  <button type="button" onClick={() => toggle(id)} className="opacity-80 hover:opacity-100 leading-none max-lg:min-h-10 max-lg:min-w-10" aria-label={`${z.label}を外す`}>×</button>
                )}
              </span>
            )
          })}
        </div>
      )}
      {!readOnly && <p className="text-xs text-gray-500 px-1">向きを切り替えて、部位を押して選択・解除できます</p>}
    </div>
  )
}
