'use client'
// 人体図コンポーネント - 痛み部位チェック（前面・背面）

import { useState } from 'react'

type View = 'front' | 'back'

export interface BodyMapProps {
  selected: string[]
  onChange: (regions: string[]) => void
  readOnly?: boolean
}

interface Reg {
  id: string
  label: string
  view: View
  // ellipse: cx cy rx ry  |  rect: x y w h
  shape: 'e' | 'r'
  cx?: number; cy?: number; rx?: number; ry?: number
  x?: number; y?: number; w?: number; h?: number
}

const REGS: Reg[] = [
  // ── 前面 ──────────────────────────────────────────
  { id:'fh',   label:'頭部',      view:'front', shape:'e', cx:100, cy:36,  rx:26, ry:30 },
  { id:'fn',   label:'頚部',      view:'front', shape:'r', x:89,  y:65,  w:22, h:16 },
  { id:'fsl',  label:'左肩',      view:'front', shape:'e', cx:61,  cy:97,  rx:21, ry:17 },
  { id:'fsr',  label:'右肩',      view:'front', shape:'e', cx:139, cy:97,  rx:21, ry:17 },
  { id:'fcl',  label:'胸部左',    view:'front', shape:'r', x:73,  y:81,  w:27, h:52 },
  { id:'fcr',  label:'胸部右',    view:'front', shape:'r', x:100, y:81,  w:27, h:52 },
  { id:'fab',  label:'腹部',      view:'front', shape:'r', x:76,  y:133, w:48, h:45 },
  { id:'fual', label:'左上腕',    view:'front', shape:'r', x:46,  y:113, w:16, h:48 },
  { id:'fuar', label:'右上腕',    view:'front', shape:'r', x:138, y:113, w:16, h:48 },
  { id:'fel',  label:'左肘',      view:'front', shape:'e', cx:54,  cy:166, rx:12, ry:11 },
  { id:'fer',  label:'右肘',      view:'front', shape:'e', cx:146, cy:166, rx:12, ry:11 },
  { id:'ffl',  label:'左前腕',    view:'front', shape:'r', x:45,  y:177, w:16, h:44 },
  { id:'ffr',  label:'右前腕',    view:'front', shape:'r', x:139, y:177, w:16, h:44 },
  { id:'fhdl', label:'左手',      view:'front', shape:'r', x:41,  y:221, w:22, h:28 },
  { id:'fhdr', label:'右手',      view:'front', shape:'r', x:137, y:221, w:22, h:28 },
  { id:'fhil', label:'左股関節',  view:'front', shape:'r', x:73,  y:178, w:27, h:32 },
  { id:'fhir', label:'右股関節',  view:'front', shape:'r', x:100, y:178, w:27, h:32 },
  { id:'ftl',  label:'左大腿',    view:'front', shape:'r', x:74,  y:210, w:25, h:68 },
  { id:'ftr',  label:'右大腿',    view:'front', shape:'r', x:101, y:210, w:25, h:68 },
  { id:'fkl',  label:'左膝',      view:'front', shape:'e', cx:86,  cy:284, rx:15, ry:13 },
  { id:'fkr',  label:'右膝',      view:'front', shape:'e', cx:114, cy:284, rx:15, ry:13 },
  { id:'fll',  label:'左下腿',    view:'front', shape:'r', x:74,  y:297, w:22, h:65 },
  { id:'flr',  label:'右下腿',    view:'front', shape:'r', x:104, y:297, w:22, h:65 },
  { id:'fal',  label:'左足関節',  view:'front', shape:'e', cx:85,  cy:368, rx:14, ry:10 },
  { id:'far',  label:'右足関節',  view:'front', shape:'e', cx:115, cy:368, rx:14, ry:10 },
  { id:'fftl', label:'左足',      view:'front', shape:'r', x:67,  y:378, w:32, h:16 },
  { id:'fftr', label:'右足',      view:'front', shape:'r', x:101, y:378, w:32, h:16 },

  // ── 背面 ──────────────────────────────────────────
  { id:'bn',   label:'頚部後',    view:'back',  shape:'r', x:89,  y:65,  w:22, h:16 },
  { id:'bubl', label:'左上背部',  view:'back',  shape:'r', x:73,  y:81,  w:27, h:50 },
  { id:'bubr', label:'右上背部',  view:'back',  shape:'r', x:100, y:81,  w:27, h:50 },
  { id:'blb',  label:'腰部',      view:'back',  shape:'r', x:73,  y:131, w:54, h:47 },
  { id:'bsl',  label:'左肩後',    view:'back',  shape:'e', cx:61,  cy:97,  rx:21, ry:17 },
  { id:'bsr',  label:'右肩後',    view:'back',  shape:'e', cx:139, cy:97,  rx:21, ry:17 },
  { id:'bual', label:'左上腕後',  view:'back',  shape:'r', x:46,  y:113, w:16, h:48 },
  { id:'buar', label:'右上腕後',  view:'back',  shape:'r', x:138, y:113, w:16, h:48 },
  { id:'bel',  label:'左肘後',    view:'back',  shape:'e', cx:54,  cy:166, rx:12, ry:11 },
  { id:'ber',  label:'右肘後',    view:'back',  shape:'e', cx:146, cy:166, rx:12, ry:11 },
  { id:'bfal', label:'左前腕後',  view:'back',  shape:'r', x:45,  y:177, w:16, h:44 },
  { id:'bfar', label:'右前腕後',  view:'back',  shape:'r', x:139, y:177, w:16, h:44 },
  { id:'bgl',  label:'左臀部',    view:'back',  shape:'e', cx:86,  cy:196, rx:22, ry:20 },
  { id:'bgr',  label:'右臀部',    view:'back',  shape:'e', cx:114, cy:196, rx:22, ry:20 },
  { id:'bhl',  label:'左ハムスト',view:'back',  shape:'r', x:74,  y:216, w:25, h:64 },
  { id:'bhr',  label:'右ハムスト',view:'back',  shape:'r', x:101, y:216, w:25, h:64 },
  { id:'bkl',  label:'左膝後',    view:'back',  shape:'e', cx:86,  cy:285, rx:15, ry:13 },
  { id:'bkr',  label:'右膝後',    view:'back',  shape:'e', cx:114, cy:285, rx:15, ry:13 },
  { id:'bcl',  label:'左腓腹',    view:'back',  shape:'r', x:74,  y:298, w:22, h:64 },
  { id:'bcr',  label:'右腓腹',    view:'back',  shape:'r', x:104, y:298, w:22, h:64 },
  { id:'bhel', label:'左踵',      view:'back',  shape:'e', cx:85,  cy:369, rx:14, ry:12 },
  { id:'bher', label:'右踵',      view:'back',  shape:'e', cx:115, cy:369, rx:14, ry:12 },
]

// 人体シルエット（前面・背面共通の基本形）
function BodySilhouette({ view }: { view: View }) {
  return (
    <g opacity={0.12} fill="#64748b">
      {/* 頭 */}
      <ellipse cx={100} cy={36} rx={27} ry={31} />
      {/* 首 */}
      <rect x={90} y={66} width={20} height={15} />
      {/* 胴体 */}
      <path d="M73,81 Q60,82 47,114 L47,220 L63,220 L63,250 L42,250 L42,280 L68,280 L68,396 L100,396 L100,380 L100,396 L132,396 L132,280 L158,280 L158,250 L137,250 L137,220 L153,220 L153,114 Q140,82 127,81 Z" />
    </g>
  )
}

function RegionShape({
  reg, selected, hovered, readOnly, onToggle, onHover,
}: {
  reg: Reg
  selected: boolean
  hovered: boolean
  readOnly: boolean
  onToggle: () => void
  onHover: (id: string | null) => void
}) {
  const fill = selected
    ? 'rgba(20,184,166,0.72)'
    : hovered && !readOnly
    ? 'rgba(20,184,166,0.22)'
    : 'rgba(226,232,240,0.55)'
  const stroke = selected ? '#0d9488' : hovered ? '#0d9488' : '#94a3b8'
  const sw = selected ? 1.5 : 0.8

  const common = {
    fill, stroke, strokeWidth: sw,
    onClick: readOnly ? undefined : onToggle,
    onMouseEnter: () => onHover(reg.id),
    onMouseLeave: () => onHover(null),
    style: { cursor: readOnly ? 'default' : 'pointer', transition: 'fill 0.15s' },
  }

  if (reg.shape === 'e') {
    return <ellipse cx={reg.cx} cy={reg.cy} rx={reg.rx} ry={reg.ry} {...common} />
  }
  return <rect x={reg.x} y={reg.y} width={reg.w} height={reg.h} rx={3} {...common} />
}

export default function BodyMap({ selected, onChange, readOnly = false }: BodyMapProps) {
  const [view, setView] = useState<View>('front')
  const [hovered, setHovered] = useState<string | null>(null)

  function toggle(id: string) {
    onChange(selected.includes(id)
      ? selected.filter(s => s !== id)
      : [...selected, id])
  }

  const visibleRegs = REGS.filter(r => r.view === view)
  const selectedLabels = REGS.filter(r => selected.includes(r.id)).map(r => r.label)
  const hoveredLabel = REGS.find(r => r.id === hovered)?.label

  return (
    <div className="space-y-3">
      {/* 前面/背面切り替え */}
      <div className="flex items-center gap-2">
        {(['front', 'back'] as View[]).map(v => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              view === v
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {v === 'front' ? '前面' : '背面'}
          </button>
        ))}
        <span className="text-xs text-gray-400 ml-1">
          {readOnly ? '選択済み部位' : '痛い部位をタップ'}
        </span>
      </div>

      <div className="flex gap-4 items-start">
        {/* SVG 人体図 */}
        <div className="relative flex-shrink-0">
          <svg
            viewBox="0 0 200 400"
            width={160}
            height={320}
            xmlns="http://www.w3.org/2000/svg"
            className="border border-gray-200 rounded-xl bg-gray-50"
          >
            <BodySilhouette view={view} />
            {visibleRegs.map(reg => (
              <RegionShape
                key={reg.id}
                reg={reg}
                selected={selected.includes(reg.id)}
                hovered={hovered === reg.id}
                readOnly={readOnly}
                onToggle={() => toggle(reg.id)}
                onHover={setHovered}
              />
            ))}
            {/* ホバーラベル */}
            {hoveredLabel && (
              <text
                x={100} y={14}
                textAnchor="middle"
                fontSize={9}
                fill="#0d9488"
                fontWeight="bold"
              >
                {hoveredLabel}
              </text>
            )}
          </svg>
        </div>

        {/* 選択済み部位リスト */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 mb-2">選択中の部位</p>
          {selectedLabels.length === 0 ? (
            <p className="text-xs text-gray-400 italic">なし</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {selectedLabels.map(label => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-50 border border-teal-200 rounded-full text-xs text-teal-700 font-medium"
                >
                  🔴 {label}
                </span>
              ))}
            </div>
          )}
          {!readOnly && selectedLabels.length > 0 && (
            <button
              type="button"
              onClick={() => onChange(selected.filter(id => !REGS.find(r => r.id === id && r.view === view)))}
              className="mt-2 text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              この面の選択をクリア
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
