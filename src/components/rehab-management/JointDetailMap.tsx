'use client'
// 関節別詳細解剖マップ - 解剖学的な部位を選択できるSVGコンポーネント

import { useState } from 'react'

export interface JointDetailMapProps {
  joint: string           // '膝関節' | '肩関節' | '股関節' | etc
  selected: string[]
  onChange: (regions: string[]) => void
  readOnly?: boolean
}

interface Zone {
  id: string
  label: string
  shape: 'e' | 'r'
  cx?: number; cy?: number; rx?: number; ry?: number
  x?: number; y?: number; w?: number; h?: number
}

// 関節ごとのゾーン定義（viewBox 200×260）
const JOINT_ZONES: Record<string, Zone[]> = {
  '膝関節': [
    { id: 'knee_qt',      label: '大腿四頭筋腱',   shape: 'r', x: 84,  y: 20,  w: 32, h: 45 },
    { id: 'knee_patella', label: '膝蓋骨',          shape: 'e', cx: 100, cy: 90,  rx: 24, ry: 20 },
    { id: 'knee_pt',      label: '膝蓋腱',          shape: 'r', x: 89,  y: 112, w: 22, h: 38 },
    { id: 'knee_mcl',     label: 'MCL内側',         shape: 'r', x: 42,  y: 85,  w: 18, h: 60 },
    { id: 'knee_lcl',     label: 'LCL外側',         shape: 'r', x: 140, y: 85,  w: 18, h: 60 },
    { id: 'knee_mm',      label: '内側半月板',      shape: 'e', cx: 70,  cy: 148, rx: 18, ry: 10 },
    { id: 'knee_lm',      label: '外側半月板',      shape: 'e', cx: 130, cy: 148, rx: 18, ry: 10 },
    { id: 'knee_acl',     label: 'ACL/PCL',         shape: 'e', cx: 100, cy: 148, rx: 14, ry: 10 },
    { id: 'knee_med_jl',  label: '内側関節裂隙',   shape: 'e', cx: 65,  cy: 148, rx: 12, ry: 7 },
    { id: 'knee_lat_jl',  label: '外側関節裂隙',   shape: 'e', cx: 135, cy: 148, rx: 12, ry: 7 },
    { id: 'knee_pes',     label: '鵞足部',          shape: 'e', cx: 62,  cy: 180, rx: 18, ry: 11 },
    { id: 'knee_itb',     label: 'ITB付着部',       shape: 'e', cx: 138, cy: 180, rx: 16, ry: 10 },
    { id: 'knee_tt',      label: '脛骨粗面',        shape: 'e', cx: 100, cy: 195, rx: 14, ry: 9 },
  ],
  '肩関節': [
    { id: 'sh_bursa',    label: '肩峰下滑液包',       shape: 'e', cx: 100, cy: 55,  rx: 38, ry: 14 },
    { id: 'sh_ac',       label: 'AC関節',             shape: 'e', cx: 55,  cy: 45,  rx: 20, ry: 12 },
    { id: 'sh_sup',      label: '棘上筋腱',           shape: 'r', x: 62,  y: 68,  w: 76, h: 22 },
    { id: 'sh_sub',      label: '肩甲下筋腱',         shape: 'r', x: 45,  y: 95,  w: 38, h: 28 },
    { id: 'sh_inf',      label: '棘下筋・小円筋腱',   shape: 'r', x: 117, y: 95,  w: 38, h: 28 },
    { id: 'sh_lhb',      label: '上腕二頭筋長頭腱',   shape: 'r', x: 90,  y: 88,  w: 20, h: 52 },
    { id: 'sh_ant_lab',  label: '関節唇前方',         shape: 'e', cx: 62,  cy: 138, rx: 14, ry: 20 },
    { id: 'sh_post_lab', label: '関節唇後方',         shape: 'e', cx: 138, cy: 138, rx: 14, ry: 20 },
    { id: 'sh_slap',     label: '上方関節唇SLAP',     shape: 'e', cx: 100, cy: 115, rx: 22, ry: 11 },
  ],
  '股関節': [
    { id: 'hip_groin', label: '鼠径部・腸腰筋', shape: 'e', cx: 88,  cy: 72,  rx: 34, ry: 24 },
    { id: 'hip_gt',    label: '大転子',          shape: 'e', cx: 158, cy: 100, rx: 24, ry: 19 },
    { id: 'hip_glut',  label: '殿部・後方',      shape: 'e', cx: 112, cy: 175, rx: 38, ry: 28 },
    { id: 'hip_add',   label: '内転筋群',        shape: 'r', x: 42,  y: 105, w: 32, h: 65 },
    { id: 'hip_lab',   label: '関節唇',          shape: 'e', cx: 100, cy: 108, rx: 20, ry: 14 },
    { id: 'hip_piri',  label: '梨状筋',          shape: 'e', cx: 120, cy: 155, rx: 28, ry: 16 },
    { id: 'hip_itb',   label: '腸脛靭帯・外側',  shape: 'r', x: 148, y: 122, w: 20, h: 60 },
    { id: 'hip_sci',   label: '坐骨神経走行',    shape: 'r', x: 95,  y: 188, w: 22, h: 48 },
  ],
  '足関節': [
    { id: 'ank_achilles',  label: 'アキレス腱',       shape: 'r', x: 88,  y: 20,  w: 24, h: 72 },
    { id: 'ank_lat_mall',  label: '外果',             shape: 'e', cx: 148, cy: 108, rx: 16, ry: 14 },
    { id: 'ank_med_mall',  label: '内果',             shape: 'e', cx: 52,  cy: 108, rx: 16, ry: 14 },
    { id: 'ank_atfl',      label: 'ATFL前距腓靭帯',   shape: 'e', cx: 140, cy: 100, rx: 24, ry: 13 },
    { id: 'ank_cfl',       label: 'CFL踵腓靭帯',      shape: 'e', cx: 152, cy: 130, rx: 18, ry: 12 },
    { id: 'ank_ptfl',      label: 'PTFL後距腓靭帯',   shape: 'e', cx: 136, cy: 155, rx: 18, ry: 11 },
    { id: 'ank_deltoid',   label: '三角靭帯内側',     shape: 'e', cx: 55,  cy: 128, rx: 22, ry: 18 },
    { id: 'ank_peroneal',  label: '腓骨筋腱',         shape: 'r', x: 153, y: 118, w: 16, h: 52 },
    { id: 'ank_sinus',     label: '足根洞',           shape: 'e', cx: 128, cy: 148, rx: 16, ry: 10 },
    { id: 'ank_plantar',   label: '足底腱膜',         shape: 'r', x: 45,  y: 205, w: 110, h: 16 },
    { id: 'ank_calcaneus', label: '踵骨付着部',       shape: 'e', cx: 75,  cy: 208, rx: 22, ry: 12 },
  ],
  '腰部': [
    { id: 'lum_para_l', label: '左傍脊柱筋',     shape: 'r', x: 36,  y: 25,  w: 40, h: 155 },
    { id: 'lum_para_r', label: '右傍脊柱筋',     shape: 'r', x: 124, y: 25,  w: 40, h: 155 },
    { id: 'lum_l1',     label: 'L1高位',         shape: 'r', x: 80,  y: 28,  w: 40, h: 22 },
    { id: 'lum_l2',     label: 'L2高位',         shape: 'r', x: 80,  y: 56,  w: 40, h: 22 },
    { id: 'lum_l3',     label: 'L3高位',         shape: 'r', x: 80,  y: 84,  w: 40, h: 22 },
    { id: 'lum_l4',     label: 'L4高位',         shape: 'r', x: 80,  y: 112, w: 40, h: 22 },
    { id: 'lum_l5',     label: 'L5高位',         shape: 'r', x: 80,  y: 140, w: 40, h: 22 },
    { id: 'lum_si_l',   label: '左仙腸関節',     shape: 'e', cx: 62,  cy: 190, rx: 22, ry: 17 },
    { id: 'lum_si_r',   label: '右仙腸関節',     shape: 'e', cx: 138, cy: 190, rx: 22, ry: 17 },
    { id: 'lum_glut_l', label: '左殿部',         shape: 'e', cx: 58,  cy: 228, rx: 30, ry: 22 },
    { id: 'lum_glut_r', label: '右殿部',         shape: 'e', cx: 142, cy: 228, rx: 30, ry: 22 },
  ],
  '頚部': [
    { id: 'cerv_sub_l',   label: '左後頭下筋',     shape: 'e', cx: 55,  cy: 32,  rx: 20, ry: 16 },
    { id: 'cerv_sub_r',   label: '右後頭下筋',     shape: 'e', cx: 145, cy: 32,  rx: 20, ry: 16 },
    { id: 'cerv_c12',     label: 'C1-C2',          shape: 'r', x: 80,  y: 22,  w: 40, h: 24 },
    { id: 'cerv_c34',     label: 'C3-C4',          shape: 'r', x: 80,  y: 52,  w: 40, h: 24 },
    { id: 'cerv_c56',     label: 'C5-C6',          shape: 'r', x: 80,  y: 82,  w: 40, h: 24 },
    { id: 'cerv_c7t1',    label: 'C7-T1',          shape: 'r', x: 80,  y: 112, w: 40, h: 24 },
    { id: 'cerv_facet_l', label: '左後関節',       shape: 'r', x: 55,  y: 48,  w: 18, h: 96 },
    { id: 'cerv_facet_r', label: '右後関節',       shape: 'r', x: 127, y: 48,  w: 18, h: 96 },
    { id: 'cerv_trap_l',  label: '左僧帽筋上部',   shape: 'e', cx: 48,  cy: 88,  rx: 26, ry: 40 },
    { id: 'cerv_trap_r',  label: '右僧帽筋上部',   shape: 'e', cx: 152, cy: 88,  rx: 26, ry: 40 },
    { id: 'cerv_scale_l', label: '左斜角筋',       shape: 'e', cx: 52,  cy: 140, rx: 20, ry: 24 },
    { id: 'cerv_scale_r', label: '右斜角筋',       shape: 'e', cx: 148, cy: 140, rx: 20, ry: 24 },
  ],
  '肘関節': [
    { id: 'elb_lat_epi',   label: '外側上顆（テニス肘）',  shape: 'e', cx: 148, cy: 72,  rx: 26, ry: 19 },
    { id: 'elb_med_epi',   label: '内側上顆（ゴルフ肘）',  shape: 'e', cx: 52,  cy: 72,  rx: 26, ry: 19 },
    { id: 'elb_olecranon', label: '肘頭',                  shape: 'e', cx: 100, cy: 158, rx: 22, ry: 16 },
    { id: 'elb_ucl',       label: 'UCL内側側副靭帯',       shape: 'r', x: 38,  y: 85,  w: 28, h: 58 },
    { id: 'elb_lcl',       label: 'LCL外側側副靭帯',       shape: 'r', x: 134, y: 85,  w: 28, h: 58 },
    { id: 'elb_cubital',   label: '肘部管・尺骨神経',      shape: 'e', cx: 48,  cy: 108, rx: 17, ry: 22 },
    { id: 'elb_biceps_t',  label: '上腕二頭筋腱',          shape: 'r', x: 87,  y: 118, w: 26, h: 36 },
    { id: 'elb_triceps_t', label: '上腕三頭筋腱',          shape: 'r', x: 87,  y: 140, w: 26, h: 28 },
    { id: 'elb_comm_ext',  label: '総指伸筋起始部',        shape: 'e', cx: 150, cy: 92,  rx: 18, ry: 12 },
    { id: 'elb_comm_flex', label: '総指屈筋起始部',        shape: 'e', cx: 50,  cy: 92,  rx: 18, ry: 12 },
  ],
  '手関節・手指': [
    { id: 'wrist_rad_styloid',   label: '橈骨茎状突起・de Quervain', shape: 'e', cx: 58,  cy: 55,  rx: 22, ry: 18 },
    { id: 'wrist_uln_styloid',   label: '尺骨茎状突起',              shape: 'e', cx: 142, cy: 55,  rx: 18, ry: 14 },
    { id: 'wrist_tfcc',          label: 'TFCC尺側',                  shape: 'e', cx: 148, cy: 80,  rx: 20, ry: 14 },
    { id: 'wrist_carpal_tunnel', label: '手根管掌側',                shape: 'r', x: 70,  y: 72,  w: 60, h: 30 },
    { id: 'wrist_scaphoid',      label: '舟状骨',                    shape: 'e', cx: 65,  cy: 82,  rx: 17, ry: 13 },
    { id: 'wrist_lunate',        label: '月状骨',                    shape: 'e', cx: 95,  cy: 82,  rx: 14, ry: 12 },
    { id: 'wrist_1cm',           label: '第1CM関節（母指基底部）',   shape: 'e', cx: 45,  cy: 118, rx: 20, ry: 16 },
    { id: 'wrist_mcp_index',     label: '示指MCP',                   shape: 'e', cx: 65,  cy: 148, rx: 14, ry: 11 },
    { id: 'wrist_mcp_middle',    label: '中指MCP',                   shape: 'e', cx: 95,  cy: 145, rx: 14, ry: 11 },
    { id: 'wrist_mcp_ring',      label: '環指MCP',                   shape: 'e', cx: 125, cy: 148, rx: 13, ry: 11 },
    { id: 'wrist_mcp_little',    label: '小指MCP',                   shape: 'e', cx: 148, cy: 155, rx: 12, ry: 10 },
  ],
}

// 対応している関節名リスト
export const SUPPORTED_JOINTS = Object.keys(JOINT_ZONES)

export default function JointDetailMap({ joint, selected, onChange, readOnly = false }: JointDetailMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [freeText, setFreeText] = useState('')

  const zones = JOINT_ZONES[joint]

  // 対応していない関節の場合はテキスト入力にフォールバック
  if (!zones) {
    return (
      <div className="mt-2">
        <p className="text-xs text-gray-500 mb-1">{joint}（自由入力）</p>
        <textarea
          value={freeText}
          onChange={e => {
            setFreeText(e.target.value)
            onChange(e.target.value ? [e.target.value] : [])
          }}
          rows={2}
          disabled={readOnly}
          placeholder="詳細な部位を入力してください"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none disabled:bg-gray-50"
        />
      </div>
    )
  }

  function toggleZone(id: string) {
    if (readOnly) return
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id))
    } else {
      onChange([...selected, id])
    }
  }

  const hoveredZone = zones.find(z => z.id === hoveredId)

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-600">{joint} — 詳細部位</p>
      <div className="border border-gray-100 rounded-xl overflow-hidden bg-gray-50 flex flex-col items-center">
        {/* ホバー時のラベル表示 */}
        <div className="h-6 flex items-center justify-center">
          {hoveredZone && (
            <span className="text-xs font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
              {hoveredZone.label}
            </span>
          )}
        </div>

        {/* SVGマップ */}
        <svg
          viewBox="0 0 200 260"
          className="w-full max-w-[280px]"
          style={{ userSelect: 'none' }}
        >
          {/* 背景シルエット（薄い灰色） */}
          <ellipse cx="100" cy="130" rx="80" ry="100" fill="rgba(200,200,200,0.1)" />

          {zones.map(zone => {
            const isSelected = selected.includes(zone.id)
            const isHovered = hoveredId === zone.id
            const fill = isSelected
              ? 'rgba(13,148,136,0.75)'
              : isHovered
              ? 'rgba(13,148,136,0.25)'
              : 'rgba(200,210,220,0.45)'
            const stroke = isSelected ? '#0d9488' : isHovered ? '#5eead4' : '#b0bec5'
            const strokeWidth = isSelected ? 1.5 : 1

            const shapeProps = {
              fill,
              stroke,
              strokeWidth,
              cursor: readOnly ? 'default' : 'pointer',
              onClick: () => toggleZone(zone.id),
              onMouseEnter: () => setHoveredId(zone.id),
              onMouseLeave: () => setHoveredId(null),
            }

            if (zone.shape === 'e') {
              return (
                <ellipse
                  key={zone.id}
                  cx={zone.cx}
                  cy={zone.cy}
                  rx={zone.rx}
                  ry={zone.ry}
                  {...shapeProps}
                />
              )
            } else {
              return (
                <rect
                  key={zone.id}
                  x={zone.x}
                  y={zone.y}
                  width={zone.w}
                  height={zone.h}
                  rx="3"
                  {...shapeProps}
                />
              )
            }
          })}
        </svg>
      </div>

      {/* 選択済みチップ */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {selected.map(id => {
            const zone = zones.find(z => z.id === id)
            if (!zone) return null
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-teal-100 text-teal-700 border border-teal-200"
              >
                {zone.label}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => toggleZone(id)}
                    className="text-teal-400 hover:text-teal-700 leading-none"
                  >
                    ×
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )}

      {!readOnly && (
        <p className="text-[10px] text-gray-400 px-1">部位をクリックして選択・解除できます</p>
      )}
    </div>
  )
}
