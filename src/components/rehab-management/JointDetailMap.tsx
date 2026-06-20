'use client'
// 関節別詳細解剖マップ - イラスト風解剖図SVGコンポーネント

import { useState } from 'react'

export interface JointDetailMapProps {
  joint: string
  selected: string[]
  onChange: (regions: string[]) => void
  readOnly?: boolean
}

type ZoneType = 'ligament' | 'tendon' | 'meniscus' | 'muscle' | 'nerve' | 'bursa' | 'cartilage' | 'bone'

interface Zone {
  id: string
  label: string
  type: ZoneType
  d: string
}

const TYPE_COLORS: Record<ZoneType, { idle: string; hover: string; selected: string; stroke: string }> = {
  ligament:  { idle: 'rgba(245,158,11,0.2)',  hover: 'rgba(245,158,11,0.45)', selected: 'rgba(245,158,11,0.75)', stroke: '#b45309' },
  tendon:    { idle: 'rgba(249,115,22,0.2)',  hover: 'rgba(249,115,22,0.45)', selected: 'rgba(249,115,22,0.75)', stroke: '#c2410c' },
  meniscus:  { idle: 'rgba(59,130,246,0.2)',  hover: 'rgba(59,130,246,0.45)', selected: 'rgba(59,130,246,0.75)', stroke: '#1d4ed8' },
  muscle:    { idle: 'rgba(236,72,153,0.2)',  hover: 'rgba(236,72,153,0.45)', selected: 'rgba(236,72,153,0.75)', stroke: '#be185d' },
  nerve:     { idle: 'rgba(234,179,8,0.2)',   hover: 'rgba(234,179,8,0.45)',  selected: 'rgba(234,179,8,0.75)',  stroke: '#92400e' },
  bursa:     { idle: 'rgba(168,85,247,0.2)',  hover: 'rgba(168,85,247,0.45)', selected: 'rgba(168,85,247,0.75)', stroke: '#7e22ce' },
  cartilage: { idle: 'rgba(16,185,129,0.2)',  hover: 'rgba(16,185,129,0.45)', selected: 'rgba(16,185,129,0.75)', stroke: '#065f46' },
  bone:      { idle: 'rgba(107,114,128,0.2)', hover: 'rgba(107,114,128,0.45)',selected: 'rgba(107,114,128,0.75)',stroke: '#374151' },
}

const TYPE_LABELS: Record<ZoneType, string> = {
  ligament: '靭帯', tendon: '腱', meniscus: '半月板', muscle: '筋',
  nerve: '神経', bursa: '滑液包', cartilage: '軟骨', bone: '骨',
}

// ──────────────────────────────────────────────
// 骨シルエット背景（非インタラクティブ）
// ──────────────────────────────────────────────
function KneeSilhouette() {
  return (
    <g opacity="0.9">
      {/* 大腿骨遠位部・骨幹 */}
      <path d="M 88,8 Q 85,8 84,18 L 84,70 Q 78,80 68,92 Q 58,106 60,124 Q 62,138 76,142 L 86,144 Q 92,142 92,134 L 92,128 L 108,128 L 108,134 Q 108,142 114,144 L 124,142 Q 138,138 140,124 Q 142,106 132,92 Q 122,80 116,70 L 116,18 Q 115,8 112,8 Z" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* 膝蓋骨 */}
      <path d="M 78,72 Q 68,78 68,92 Q 68,112 84,118 Q 100,122 116,118 Q 132,112 132,92 Q 132,78 122,72 Q 110,66 100,66 Q 90,66 78,72 Z" fill="#e8d4b2" stroke="#b09060" strokeWidth="1.5"/>
      {/* 脛骨近位部 */}
      <path d="M 58,148 Q 52,148 50,160 L 54,205 L 72,205 L 74,162 L 126,162 L 128,205 L 146,205 L 150,160 Q 148,148 142,148 Z" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* 脛骨関節面（平台） */}
      <path d="M 58,146 Q 56,138 68,134 Q 84,130 100,130 Q 116,130 132,134 Q 144,138 142,146 Z" fill="#dde8e0" stroke="#9ab0a0" strokeWidth="1.2"/>
      {/* 腓骨頭 */}
      <ellipse cx="152" cy="168" rx="13" ry="17" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* 関節軟骨ライン */}
      <path d="M 66,128 Q 84,124 100,124 Q 116,124 134,128" fill="none" stroke="#9ab0a0" strokeWidth="2" opacity="0.7"/>
    </g>
  )
}

function ShoulderSilhouette() {
  return (
    <g opacity="0.9">
      {/* 鎖骨 */}
      <path d="M 28,48 Q 52,36 76,34 Q 88,33 95,36 L 95,44 Q 88,44 76,44 Q 55,46 32,56 Z" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* 肩甲骨（関節窩・肩峰） */}
      <path d="M 72,26 Q 86,18 100,22 Q 108,26 106,38 Q 100,44 92,42 L 90,52 L 95,56 L 95,200 Q 80,202 68,196 Q 48,185 44,162 L 44,90 Q 44,60 58,38 Z" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* 関節窩軟骨 */}
      <path d="M 92,80 Q 92,112 92,140" fill="none" stroke="#9ab0a0" strokeWidth="3" opacity="0.7"/>
      {/* 上腕骨頭 */}
      <ellipse cx="140" cy="100" rx="48" ry="52" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* 上腕骨体 */}
      <path d="M 118,146 L 110,250 L 126,250 L 132,148 Z" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* 大結節 */}
      <ellipse cx="184" cy="90" rx="12" ry="18" fill="#e8d4b2" stroke="#b09060" strokeWidth="1.2"/>
    </g>
  )
}

function HipSilhouette() {
  return (
    <g opacity="0.9">
      {/* 腸骨稜 */}
      <path d="M 8,38 Q 10,8 48,8 Q 82,8 104,28 Q 118,40 122,62 L 118,72 Q 112,50 96,36 Q 78,18 50,18 Q 24,18 20,42 Z" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* 寛骨臼・腸骨体 */}
      <path d="M 80,62 Q 82,50 96,48 L 118,72 Q 124,82 124,96 Q 124,116 108,122 Q 92,126 80,116 Q 68,104 70,88 Z" fill="#dde8e0" stroke="#9ab0a0" strokeWidth="1.5"/>
      {/* 大腿骨頭 */}
      <circle cx="100" cy="92" r="28" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* 大腿骨頸部 */}
      <path d="M 120,106 Q 138,112 150,122 L 155,136 Q 142,140 128,130 Q 116,120 112,108 Z" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* 大転子 */}
      <ellipse cx="156" cy="136" rx="18" ry="15" fill="#e8d4b2" stroke="#b09060" strokeWidth="1.5"/>
      {/* 大腿骨体 */}
      <path d="M 144,148 L 136,258 L 152,258 L 158,150 Z" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* 小転子 */}
      <ellipse cx="118" cy="150" rx="10" ry="8" fill="#e8d4b2" stroke="#b09060" strokeWidth="1.2"/>
    </g>
  )
}

function AnkleSilhouette() {
  return (
    <g opacity="0.9">
      {/* 脛骨遠位部 */}
      <path d="M 70,8 L 66,108 Q 66,118 80,122 L 100,122 Q 110,120 110,108 L 106,8 Z" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* 内果 */}
      <path d="M 58,110 Q 50,112 48,124 Q 46,138 58,144 Q 70,148 78,140 Q 84,130 78,118 Q 72,108 62,110 Z" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* 腓骨遠位部 */}
      <path d="M 120,8 L 118,106 Q 118,118 130,124 L 138,124 Q 148,120 148,108 L 146,8 Z" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* 外果 */}
      <path d="M 138,106 Q 148,108 152,120 Q 156,136 148,146 Q 140,156 128,152 Q 118,146 116,134 Q 114,120 122,110 Z" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* 距骨 */}
      <path d="M 62,122 Q 60,140 70,148 L 130,148 Q 140,140 140,122 Z" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* 距骨滑車（関節面） */}
      <path d="M 68,122 Q 100,116 132,122" fill="none" stroke="#9ab0a0" strokeWidth="2.5" opacity="0.7"/>
      {/* 踵骨 */}
      <path d="M 50,148 Q 44,150 42,168 Q 40,188 50,205 Q 62,218 90,218 Q 115,218 118,200 Q 120,182 112,162 L 60,152 Z" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
    </g>
  )
}

function LumbarSilhouette() {
  // 後面観
  return (
    <g opacity="0.9">
      {/* 各腰椎椎体（L1-L5） */}
      {([
        [76,12,48,26],
        [72,40,56,26],
        [68,68,64,26],
        [64,96,72,26],
        [60,124,80,26],
      ] as [number,number,number,number][]).map(([x,y,w,h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="5" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      ))}
      {/* 椎間板 */}
      {([38,66,94,122,150] as number[]).map((y, i) => (
        <rect key={i} x={78-i*2} y={y} width={44+i*4} height={6} rx="3" fill="#b8d0e8" stroke="#7090b8" strokeWidth="1" opacity="0.85"/>
      ))}
      {/* 仙骨 */}
      <path d="M 60,152 Q 55,152 53,168 Q 51,188 58,205 Q 68,222 100,224 Q 132,222 142,205 Q 149,188 147,168 Q 145,152 140,152 Z" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* 棘突起 */}
      {[25,53,81,109,137].map((y, i) => (
        <rect key={i} x={96} y={y} width={8} height={18} rx="2" fill="#e0c8a0" stroke="#b09060" strokeWidth="1"/>
      ))}
    </g>
  )
}

function CervicalSilhouette() {
  return (
    <g opacity="0.9">
      {/* 後頭骨 */}
      <path d="M 68,8 Q 68,4 100,4 Q 132,4 132,8 L 130,26 Q 126,30 100,30 Q 74,30 70,26 Z" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* C1（環椎）- 輪状 */}
      <path d="M 72,30 Q 70,30 68,38 L 70,50 Q 74,54 100,54 Q 126,54 130,50 L 132,38 Q 130,30 128,30 Z" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* C2-C7 */}
      {([
        [74,56,52,24], [76,82,48,24], [78,108,44,24],
        [80,134,40,24], [82,160,36,24],
      ] as [number,number,number,number][]).map(([x,y,w,h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="4" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      ))}
      {/* 椎間板（C2-7間） */}
      {[52,78,104,130,156].map((y, i) => (
        <rect key={i} x={76-i} y={y} width={48+i*2} height={5} rx="2" fill="#b8d0e8" stroke="#7090b8" strokeWidth="1" opacity="0.8"/>
      ))}
      {/* 棘突起 */}
      {[32,60,86,112,138,164].map((y, i) => (
        <rect key={i} x={97} y={y} width={6} height={16} rx="2" fill="#e0c8a0" stroke="#b09060" strokeWidth="1"/>
      ))}
    </g>
  )
}

function ElbowSilhouette() {
  return (
    <g opacity="0.9">
      {/* 上腕骨遠位部 */}
      <path d="M 86,8 L 84,88 Q 82,100 66,112 Q 54,122 54,136 Q 54,148 66,152 Q 80,156 90,144 Q 96,132 96,118 L 104,118 Q 104,132 110,144 Q 120,156 134,152 Q 146,148 146,136 Q 146,122 134,112 Q 118,100 116,88 L 114,8 Z" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* 内側上顆 */}
      <ellipse cx="52" cy="110" rx="20" ry="16" fill="#e8d4b2" stroke="#b09060" strokeWidth="1.5"/>
      {/* 外側上顆 */}
      <ellipse cx="148" cy="110" rx="20" ry="16" fill="#e8d4b2" stroke="#b09060" strokeWidth="1.5"/>
      {/* 滑車（関節面） */}
      <ellipse cx="100" cy="140" rx="22" ry="16" fill="#dde8e0" stroke="#9ab0a0" strokeWidth="1.5"/>
      {/* 肘頭（尺骨） */}
      <path d="M 84,152 Q 78,154 76,170 L 76,240 L 90,240 L 90,178 Q 96,170 100,170 Q 104,170 110,178 L 110,240 L 124,240 L 124,170 Q 122,154 116,152 Z" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* 橈骨頭 */}
      <ellipse cx="130" cy="152" rx="15" ry="18" fill="#e8d4b2" stroke="#b09060" strokeWidth="1.5"/>
      {/* 橈骨体 */}
      <path d="M 118,166 L 115,240 L 130,240 L 132,168 Z" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
    </g>
  )
}

function WristSilhouette() {
  return (
    <g opacity="0.9">
      {/* 橈骨 */}
      <path d="M 66,8 L 62,72 Q 62,82 76,84 L 88,84 Q 94,80 94,70 L 92,8 Z" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* 橈骨茎状突起 */}
      <path d="M 62,76 Q 54,80 52,92 Q 50,102 58,106 Q 66,108 72,96 Q 76,85 74,78 Z" fill="#e8d4b2" stroke="#b09060" strokeWidth="1.5"/>
      {/* 尺骨 */}
      <path d="M 108,8 L 106,68 Q 106,78 118,80 L 128,80 Q 136,76 136,66 L 134,8 Z" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* 尺骨茎状突起 */}
      <path d="M 136,72 Q 144,76 146,88 Q 148,98 140,102 Q 132,104 126,94 Q 122,84 124,76 Z" fill="#e8d4b2" stroke="#b09060" strokeWidth="1.5"/>
      {/* 手根骨近位列 */}
      <rect x="56" y="86" width="88" height="24" rx="6" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* 手根骨遠位列 */}
      <rect x="54" y="112" width="92" height="24" rx="6" fill="#eddfc0" stroke="#b09060" strokeWidth="1.5"/>
      {/* 中手骨 1-5 */}
      {([[38,140,14,48],[60,138,14,52],[82,137,14,54],[104,138,14,52],[126,140,14,48]] as [number,number,number,number][]).map(([x,y,w,h],i)=>(
        <rect key={i} x={x} y={y} width={w} height={h} rx="4" fill="#eddfc0" stroke="#b09060" strokeWidth="1.2"/>
      ))}
      {/* 近位指節骨 */}
      {([[36,192,14,32],[58,193,14,34],[80,192,14,36],[102,193,14,34],[124,194,14,32]] as [number,number,number,number][]).map(([x,y,w,h],i)=>(
        <rect key={i} x={x} y={y} width={w} height={h} rx="4" fill="#eddfc0" stroke="#b09060" strokeWidth="1.2"/>
      ))}
    </g>
  )
}

// ──────────────────────────────────────────────
// 各関節のインタラクティブゾーン定義（SVGパス）
// ──────────────────────────────────────────────
const JOINT_ZONES: Record<string, Zone[]> = {
  '膝関節': [
    { id: 'knee_qt',     label: '大腿四頭筋腱',  type: 'tendon',
      d: 'M 86,14 Q 82,14 82,24 L 82,66 Q 82,74 100,76 Q 118,74 118,66 L 118,24 Q 118,14 114,14 Z' },
    { id: 'knee_patella',label: '膝蓋骨',         type: 'bone',
      d: 'M 76,72 Q 66,80 66,92 Q 66,114 84,120 Q 100,124 116,120 Q 134,114 134,92 Q 134,80 124,72 Q 112,64 100,64 Q 88,64 76,72 Z' },
    { id: 'knee_pt',     label: '膝蓋腱',         type: 'tendon',
      d: 'M 88,122 Q 84,124 84,134 L 84,156 Q 84,164 100,166 Q 116,164 116,156 L 116,134 Q 116,124 112,122 Z' },
    { id: 'knee_mcl',    label: 'MCL内側',        type: 'ligament',
      d: 'M 44,94 Q 36,96 34,108 L 32,155 Q 32,166 44,168 L 60,168 Q 68,165 68,156 L 68,108 Q 67,96 58,94 Z' },
    { id: 'knee_lcl',    label: 'LCL外側',        type: 'ligament',
      d: 'M 156,94 Q 164,96 166,108 L 168,155 Q 168,166 156,168 L 140,168 Q 132,165 132,156 L 132,108 Q 133,96 144,94 Z' },
    { id: 'knee_mm',     label: '内側半月板',     type: 'meniscus',
      d: 'M 50,145 Q 48,136 60,130 Q 76,124 88,132 Q 96,140 90,152 Q 80,162 64,158 Q 50,153 50,145 Z' },
    { id: 'knee_lm',     label: '外側半月板',     type: 'meniscus',
      d: 'M 150,145 Q 152,136 140,130 Q 124,124 112,132 Q 104,140 110,152 Q 120,162 136,158 Q 150,153 150,145 Z' },
    { id: 'knee_acl',    label: 'ACL/PCL',        type: 'ligament',
      d: 'M 86,136 Q 84,128 100,126 Q 116,128 114,136 Q 112,150 100,152 Q 88,150 86,136 Z' },
    { id: 'knee_pes',    label: '鵞足部',         type: 'tendon',
      d: 'M 42,172 Q 34,170 32,184 Q 30,200 48,206 Q 66,210 76,200 Q 84,190 77,178 Q 68,170 54,170 Z' },
    { id: 'knee_itb',    label: 'ITB付着部',      type: 'tendon',
      d: 'M 158,172 Q 166,170 168,184 Q 170,200 152,206 Q 134,210 124,200 Q 116,190 123,178 Q 132,170 146,170 Z' },
    { id: 'knee_tt',     label: '脛骨粗面',       type: 'bone',
      d: 'M 86,168 Q 82,170 82,182 Q 82,194 100,196 Q 118,194 118,182 Q 118,170 114,168 Z' },
  ],
  '肩関節': [
    { id: 'sh_bursa',    label: '肩峰下滑液包',       type: 'bursa',
      d: 'M 75,46 Q 68,42 64,52 Q 61,65 70,72 L 130,72 Q 136,64 133,52 Q 130,42 124,46 Z' },
    { id: 'sh_ac',       label: 'AC関節',             type: 'ligament',
      d: 'M 38,32 Q 30,30 28,44 Q 25,58 38,66 Q 54,72 68,62 Q 77,52 72,40 Q 64,28 52,30 Z' },
    { id: 'sh_sup',      label: '棘上筋腱',           type: 'tendon',
      d: 'M 63,72 Q 58,68 56,80 L 56,102 Q 56,110 75,110 L 125,110 Q 142,108 142,100 L 142,80 Q 140,68 136,72 Z' },
    { id: 'sh_sub',      label: '肩甲下筋腱',         type: 'tendon',
      d: 'M 46,110 Q 38,110 36,124 L 36,148 Q 36,158 50,160 L 88,160 Q 98,157 98,148 L 98,124 Q 97,112 86,110 Z' },
    { id: 'sh_inf',      label: '棘下筋・小円筋腱',   type: 'tendon',
      d: 'M 112,110 Q 102,112 102,124 L 102,148 Q 102,158 112,160 L 150,160 Q 163,157 164,148 L 164,124 Q 162,110 155,110 Z' },
    { id: 'sh_lhb',      label: '上腕二頭筋長頭腱',   type: 'tendon',
      d: 'M 90,72 Q 84,72 83,84 L 86,155 Q 86,165 100,168 Q 114,165 114,155 L 117,84 Q 116,72 110,72 Z' },
    { id: 'sh_ant_lab',  label: '関節唇前方',         type: 'cartilage',
      d: 'M 56,118 Q 46,122 44,138 Q 42,158 56,168 Q 68,178 80,170 Q 90,160 86,142 Q 82,122 70,118 Z' },
    { id: 'sh_post_lab', label: '関節唇後方',         type: 'cartilage',
      d: 'M 144,118 Q 154,122 156,138 Q 158,158 144,168 Q 132,178 120,170 Q 110,160 114,142 Q 118,122 130,118 Z' },
    { id: 'sh_slap',     label: '上方関節唇SLAP',     type: 'cartilage',
      d: 'M 70,100 Q 70,88 100,86 Q 130,88 130,100 Q 130,114 100,116 Q 70,114 70,100 Z' },
  ],
  '股関節': [
    { id: 'hip_groin',  label: '鼠径部・腸腰筋',  type: 'muscle',
      d: 'M 48,46 Q 36,42 33,60 Q 30,80 46,94 Q 65,106 86,96 Q 102,86 98,66 Q 93,48 76,44 Z' },
    { id: 'hip_gt',     label: '大転子',           type: 'bone',
      d: 'M 146,88 Q 136,85 130,100 Q 124,118 136,130 Q 148,142 164,136 Q 176,128 174,112 Q 171,94 158,88 Z' },
    { id: 'hip_glut',   label: '殿部・後方',       type: 'muscle',
      d: 'M 72,168 Q 58,160 52,180 Q 46,202 62,218 Q 80,234 106,234 Q 132,232 144,216 Q 156,200 148,180 Q 140,162 124,168 Z' },
    { id: 'hip_add',    label: '内転筋群',         type: 'muscle',
      d: 'M 34,108 Q 26,110 24,126 L 22,182 Q 22,194 36,196 L 60,194 Q 70,190 70,180 L 70,124 Q 68,110 56,108 Z' },
    { id: 'hip_lab',    label: '関節唇',           type: 'cartilage',
      d: 'M 78,92 Q 74,82 100,78 Q 126,80 122,92 Q 118,108 100,112 Q 82,108 78,92 Z' },
    { id: 'hip_piri',   label: '梨状筋',           type: 'muscle',
      d: 'M 94,158 Q 84,152 78,168 Q 72,184 86,196 Q 102,206 122,198 Q 138,190 136,176 Q 132,160 118,156 Z' },
    { id: 'hip_itb',    label: '腸脛靭帯・外側',   type: 'ligament',
      d: 'M 148,140 Q 140,136 136,156 L 132,210 Q 132,220 146,222 L 162,220 Q 170,216 170,206 L 168,156 Q 166,138 158,138 Z' },
    { id: 'hip_sci',    label: '坐骨神経走行',     type: 'nerve',
      d: 'M 92,198 Q 84,196 82,216 L 84,258 Q 84,264 100,265 Q 116,264 116,258 L 118,216 Q 116,196 108,198 Z' },
  ],
  '足関節': [
    { id: 'ank_achilles',  label: 'アキレス腱',       type: 'tendon',
      d: 'M 82,8 Q 76,8 74,22 L 74,88 Q 74,100 88,102 Q 100,104 112,102 Q 126,100 126,88 L 126,22 Q 124,8 118,8 Z' },
    { id: 'ank_lat_mall',  label: '外果',             type: 'bone',
      d: 'M 136,104 Q 148,106 154,120 Q 160,138 150,150 Q 138,160 124,154 Q 112,146 112,132 Q 112,116 124,108 Z' },
    { id: 'ank_med_mall',  label: '内果',             type: 'bone',
      d: 'M 64,104 Q 52,106 46,120 Q 40,138 50,150 Q 62,160 76,154 Q 88,146 88,132 Q 88,116 76,108 Z' },
    { id: 'ank_atfl',      label: 'ATFL前距腓靭帯',   type: 'ligament',
      d: 'M 126,98 Q 112,88 108,104 Q 103,120 116,128 Q 130,136 144,126 Q 154,115 146,104 Z' },
    { id: 'ank_cfl',       label: 'CFL踵腓靭帯',      type: 'ligament',
      d: 'M 148,132 Q 140,126 134,144 Q 128,162 140,172 Q 154,180 166,170 Q 174,160 168,144 Q 162,128 154,130 Z' },
    { id: 'ank_ptfl',      label: 'PTFL後距腓靭帯',   type: 'ligament',
      d: 'M 138,150 Q 128,144 122,160 Q 116,176 128,184 Q 142,192 154,184 Q 164,174 158,160 Q 152,146 142,148 Z' },
    { id: 'ank_deltoid',   label: '三角靭帯内側',     type: 'ligament',
      d: 'M 36,120 Q 26,116 22,134 Q 18,154 34,164 Q 50,174 66,164 Q 78,153 72,134 Q 64,118 50,118 Z' },
    { id: 'ank_peroneal',  label: '腓骨筋腱',         type: 'tendon',
      d: 'M 165,135 Q 158,130 155,150 L 154,200 Q 153,210 165,212 L 174,210 Q 180,206 180,196 L 178,148 Q 176,132 170,133 Z' },
    { id: 'ank_sinus',     label: '足根洞',           type: 'cartilage',
      d: 'M 118,144 Q 109,138 106,154 Q 102,172 116,178 Q 132,184 144,174 Q 153,163 147,150 Q 139,138 126,142 Z' },
    { id: 'ank_plantar',   label: '足底腱膜',         type: 'tendon',
      d: 'M 42,222 Q 36,220 35,232 L 34,244 Q 34,252 48,254 L 160,254 Q 172,250 172,242 L 170,230 Q 168,220 156,220 Z' },
    { id: 'ank_calcaneus', label: '踵骨付着部',       type: 'bone',
      d: 'M 44,200 Q 34,196 32,214 Q 30,234 48,242 Q 70,250 90,242 Q 106,232 101,212 Q 94,198 74,198 Z' },
  ],
  '腰部': [
    { id: 'lum_para_l',  label: '左傍脊柱筋',    type: 'muscle',
      d: 'M 22,14 Q 14,14 13,28 L 10,175 Q 10,188 24,190 L 66,188 Q 74,184 74,172 L 72,28 Q 70,14 58,14 Z' },
    { id: 'lum_para_r',  label: '右傍脊柱筋',    type: 'muscle',
      d: 'M 178,14 Q 186,14 187,28 L 190,175 Q 190,188 176,190 L 134,188 Q 126,184 126,172 L 128,28 Q 130,14 142,14 Z' },
    { id: 'lum_l1',      label: 'L1高位',        type: 'bone',
      d: 'M 74,12 Q 72,8 100,6 Q 128,8 126,12 L 122,36 Q 120,40 100,40 Q 80,40 78,36 Z' },
    { id: 'lum_l2',      label: 'L2高位',        type: 'bone',
      d: 'M 70,42 Q 68,38 100,36 Q 132,38 130,42 L 126,64 Q 124,68 100,68 Q 76,68 74,64 Z' },
    { id: 'lum_l3',      label: 'L3高位',        type: 'bone',
      d: 'M 66,70 Q 64,66 100,64 Q 136,66 134,70 L 130,92 Q 128,96 100,96 Q 72,96 70,92 Z' },
    { id: 'lum_l4',      label: 'L4高位',        type: 'bone',
      d: 'M 62,98 Q 60,94 100,92 Q 140,94 138,98 L 134,120 Q 132,124 100,124 Q 68,124 66,120 Z' },
    { id: 'lum_l5',      label: 'L5高位',        type: 'bone',
      d: 'M 58,126 Q 56,122 100,120 Q 144,122 142,126 L 138,148 Q 136,152 100,152 Q 64,152 62,148 Z' },
    { id: 'lum_si_l',    label: '左仙腸関節',    type: 'ligament',
      d: 'M 44,180 Q 32,176 28,196 Q 24,218 42,228 Q 60,236 76,224 Q 88,212 82,192 Q 75,176 60,178 Z' },
    { id: 'lum_si_r',    label: '右仙腸関節',    type: 'ligament',
      d: 'M 156,180 Q 168,176 172,196 Q 176,218 158,228 Q 140,236 124,224 Q 112,212 118,192 Q 125,176 140,178 Z' },
    { id: 'lum_glut_l',  label: '左殿部',        type: 'muscle',
      d: 'M 18,228 Q 10,225 8,245 Q 6,262 25,267 Q 50,272 68,262 Q 84,251 78,232 Q 70,218 50,222 Z' },
    { id: 'lum_glut_r',  label: '右殿部',        type: 'muscle',
      d: 'M 182,228 Q 190,225 192,245 Q 194,262 175,267 Q 150,272 132,262 Q 116,251 122,232 Q 130,218 150,222 Z' },
  ],
  '頚部': [
    { id: 'cerv_sub_l',   label: '左後頭下筋',   type: 'muscle',
      d: 'M 34,12 Q 22,10 18,26 Q 14,44 30,54 Q 48,62 62,52 Q 72,41 66,26 Q 58,10 46,12 Z' },
    { id: 'cerv_sub_r',   label: '右後頭下筋',   type: 'muscle',
      d: 'M 166,12 Q 178,10 182,26 Q 186,44 170,54 Q 152,62 138,52 Q 128,41 134,26 Q 142,10 154,12 Z' },
    { id: 'cerv_c12',     label: 'C1-C2',        type: 'bone',
      d: 'M 72,30 Q 70,26 100,24 Q 130,26 128,30 L 126,56 Q 124,60 100,60 Q 76,60 74,56 Z' },
    { id: 'cerv_c34',     label: 'C3-C4',        type: 'bone',
      d: 'M 74,62 Q 72,58 100,56 Q 128,58 126,62 L 124,110 Q 122,114 100,114 Q 78,114 76,110 Z' },
    { id: 'cerv_c56',     label: 'C5-C6',        type: 'bone',
      d: 'M 76,116 Q 74,112 100,110 Q 126,112 124,116 L 122,162 Q 120,166 100,166 Q 80,166 78,162 Z' },
    { id: 'cerv_c7t1',    label: 'C7-T1',        type: 'bone',
      d: 'M 78,168 Q 76,164 100,162 Q 124,164 122,168 L 120,210 Q 118,214 100,214 Q 82,214 80,210 Z' },
    { id: 'cerv_facet_l', label: '左後関節',     type: 'bone',
      d: 'M 50,44 Q 40,44 38,58 L 36,160 Q 36,170 48,172 L 68,172 Q 76,168 76,158 L 76,56 Q 74,44 64,44 Z' },
    { id: 'cerv_facet_r', label: '右後関節',     type: 'bone',
      d: 'M 150,44 Q 160,44 162,58 L 164,160 Q 164,170 152,172 L 132,172 Q 124,168 124,158 L 124,56 Q 126,44 136,44 Z' },
    { id: 'cerv_trap_l',  label: '左僧帽筋上部', type: 'muscle',
      d: 'M 20,66 Q 10,64 7,88 Q 4,114 20,130 Q 38,146 58,134 Q 72,120 67,96 Q 61,72 44,68 Z' },
    { id: 'cerv_trap_r',  label: '右僧帽筋上部', type: 'muscle',
      d: 'M 180,66 Q 190,64 193,88 Q 196,114 180,130 Q 162,146 142,134 Q 128,120 133,96 Q 139,72 156,68 Z' },
    { id: 'cerv_scale_l', label: '左斜角筋',     type: 'muscle',
      d: 'M 26,138 Q 15,135 12,156 Q 9,178 26,188 Q 46,196 62,186 Q 74,174 69,154 Q 63,134 46,136 Z' },
    { id: 'cerv_scale_r', label: '右斜角筋',     type: 'muscle',
      d: 'M 174,138 Q 185,135 188,156 Q 191,178 174,188 Q 154,196 138,186 Q 126,174 131,154 Q 137,134 154,136 Z' },
  ],
  '肘関節': [
    { id: 'elb_lat_epi',   label: '外側上顆（テニス肘）', type: 'tendon',
      d: 'M 132,60 Q 120,55 116,72 Q 112,90 126,98 Q 142,106 156,98 Q 167,88 162,72 Q 156,56 144,58 Z' },
    { id: 'elb_med_epi',   label: '内側上顆（ゴルフ肘）', type: 'tendon',
      d: 'M 68,60 Q 80,55 84,72 Q 88,90 74,98 Q 58,106 44,98 Q 33,88 38,72 Q 44,56 56,58 Z' },
    { id: 'elb_olecranon', label: '肘頭',                  type: 'bone',
      d: 'M 76,150 Q 68,148 65,165 Q 62,183 76,192 Q 92,200 114,198 Q 130,194 130,178 Q 128,162 120,152 Q 108,146 100,146 Z' },
    { id: 'elb_ucl',       label: 'UCL内側側副靭帯',       type: 'ligament',
      d: 'M 30,88 Q 20,89 18,106 L 16,160 Q 16,172 30,174 L 60,174 Q 70,170 70,160 L 70,104 Q 69,88 58,88 Z' },
    { id: 'elb_lcl',       label: 'LCL外側側副靭帯',       type: 'ligament',
      d: 'M 170,88 Q 180,89 182,106 L 184,160 Q 184,172 170,174 L 140,174 Q 130,170 130,160 L 130,104 Q 131,88 142,88 Z' },
    { id: 'elb_cubital',   label: '肘部管・尺骨神経',      type: 'nerve',
      d: 'M 22,102 Q 12,100 10,118 Q 7,138 22,150 Q 38,160 54,150 Q 66,138 62,118 Q 56,100 40,100 Z' },
    { id: 'elb_biceps_t',  label: '上腕二頭筋腱',          type: 'tendon',
      d: 'M 84,120 Q 78,120 77,136 L 78,166 Q 78,176 100,178 Q 122,176 122,166 L 123,136 Q 122,120 116,120 Z' },
    { id: 'elb_triceps_t', label: '上腕三頭筋腱',          type: 'tendon',
      d: 'M 82,148 Q 76,150 75,164 L 76,188 Q 76,198 100,200 Q 124,198 124,188 L 125,164 Q 124,150 118,148 Z' },
    { id: 'elb_comm_ext',  label: '総指伸筋起始部',        type: 'muscle',
      d: 'M 144,86 Q 134,81 130,98 Q 126,116 140,122 Q 156,128 168,118 Q 177,106 170,92 Q 163,80 152,84 Z' },
    { id: 'elb_comm_flex', label: '総指屈筋起始部',        type: 'muscle',
      d: 'M 56,86 Q 66,81 70,98 Q 74,116 60,122 Q 44,128 32,118 Q 23,106 30,92 Q 37,80 48,84 Z' },
  ],
  '手関節・手指': [
    { id: 'wrist_rad_styloid',   label: '橈骨茎状突起・de Quervain', type: 'tendon',
      d: 'M 38,42 Q 26,40 22,58 Q 18,76 34,86 Q 52,96 68,84 Q 80,72 73,56 Q 65,40 52,40 Z' },
    { id: 'wrist_uln_styloid',   label: '尺骨茎状突起',              type: 'bone',
      d: 'M 152,44 Q 140,40 136,58 Q 132,76 148,84 Q 164,92 178,80 Q 188,68 182,52 Q 174,40 162,42 Z' },
    { id: 'wrist_tfcc',          label: 'TFCC尺側',                  type: 'cartilage',
      d: 'M 144,80 Q 132,76 128,94 Q 124,114 138,122 Q 156,130 168,120 Q 178,108 172,90 Q 163,74 152,78 Z' },
    { id: 'wrist_carpal_tunnel', label: '手根管掌側',                type: 'nerve',
      d: 'M 60,86 Q 55,84 53,98 L 52,114 Q 52,122 100,126 Q 148,122 148,114 L 147,98 Q 145,84 140,86 Z' },
    { id: 'wrist_scaphoid',      label: '舟状骨',                    type: 'bone',
      d: 'M 48,86 Q 38,84 36,100 Q 33,118 48,126 Q 66,134 78,122 Q 88,110 82,92 Q 74,80 62,84 Z' },
    { id: 'wrist_lunate',        label: '月状骨',                    type: 'bone',
      d: 'M 86,82 Q 78,80 76,96 Q 74,114 88,120 Q 104,128 118,120 Q 128,110 124,94 Q 119,80 106,80 Z' },
    { id: 'wrist_1cm',           label: '第1CM関節（母指基底部）',   type: 'cartilage',
      d: 'M 22,114 Q 11,110 8,130 Q 5,150 22,160 Q 42,170 58,160 Q 70,148 64,128 Q 57,112 42,112 Z' },
    { id: 'wrist_mcp_index',     label: '示指MCP',                   type: 'cartilage',
      d: 'M 42,148 Q 32,146 30,164 Q 28,182 46,190 Q 64,196 76,186 Q 86,174 78,158 Q 69,144 56,146 Z' },
    { id: 'wrist_mcp_middle',    label: '中指MCP',                   type: 'cartilage',
      d: 'M 74,145 Q 64,143 62,162 Q 60,182 78,190 Q 96,198 112,190 Q 124,180 120,162 Q 114,142 100,142 Z' },
    { id: 'wrist_mcp_ring',      label: '環指MCP',                   type: 'cartilage',
      d: 'M 108,148 Q 98,145 96,164 Q 94,182 112,190 Q 128,196 142,186 Q 152,174 146,156 Q 138,142 124,146 Z' },
    { id: 'wrist_mcp_little',    label: '小指MCP',                   type: 'cartilage',
      d: 'M 136,155 Q 126,152 124,170 Q 121,190 138,198 Q 154,204 167,194 Q 177,182 170,164 Q 163,148 150,152 Z' },
  ],
}

const SILHOUETTE_MAP: Record<string, React.FC> = {
  '膝関節':     KneeSilhouette,
  '肩関節':     ShoulderSilhouette,
  '股関節':     HipSilhouette,
  '足関節':     AnkleSilhouette,
  '腰部':       LumbarSilhouette,
  '頚部':       CervicalSilhouette,
  '肘関節':     ElbowSilhouette,
  '手関節・手指': WristSilhouette,
}

export const SUPPORTED_JOINTS = Object.keys(JOINT_ZONES)

export default function JointDetailMap({ joint, selected, onChange, readOnly = false }: JointDetailMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [freeText, setFreeText] = useState('')

  const zones = JOINT_ZONES[joint]
  const Silhouette = SILHOUETTE_MAP[joint]

  if (!zones) {
    return (
      <div className="mt-2">
        <p className="text-xs text-gray-500 mb-1">{joint}（自由入力）</p>
        <textarea
          value={freeText}
          onChange={e => { setFreeText(e.target.value); onChange(e.target.value ? [e.target.value] : []) }}
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
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }

  const hoveredZone = zones.find(z => z.id === hoveredId)

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-600">{joint} — 詳細部位</p>

      {/* 凡例 */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-1">
        {(Object.entries(TYPE_LABELS) as [ZoneType, string][])
          .filter(([type]) => zones.some(z => z.type === type))
          .map(([type, label]) => (
            <span key={type} className="flex items-center gap-1 text-[10px] text-gray-500">
              <span className="inline-block w-3 h-3 rounded-full border" style={{ background: TYPE_COLORS[type].selected, borderColor: TYPE_COLORS[type].stroke }} />
              {label}
            </span>
          ))}
      </div>

      <div className="border border-gray-100 rounded-xl overflow-hidden bg-[#f8f6f2] flex flex-col items-center">
        {/* ホバーラベル */}
        <div className="h-7 flex items-center justify-center">
          {hoveredZone ? (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full border"
              style={{ background: TYPE_COLORS[hoveredZone.type].hover, borderColor: TYPE_COLORS[hoveredZone.type].stroke, color: TYPE_COLORS[hoveredZone.type].stroke }}>
              {hoveredZone.label}（{TYPE_LABELS[hoveredZone.type]}）
            </span>
          ) : null}
        </div>

        {/* SVGマップ */}
        <svg viewBox="0 0 200 260" className="w-full max-w-[280px]" style={{ userSelect: 'none' }}>
          {/* 骨シルエット背景 */}
          {Silhouette && <Silhouette />}

          {/* インタラクティブゾーン */}
          {zones.map(zone => {
            const isSelected = selected.includes(zone.id)
            const isHovered = hoveredId === zone.id
            const c = TYPE_COLORS[zone.type]
            const fill = isSelected ? c.selected : isHovered ? c.hover : c.idle
            return (
              <path
                key={zone.id}
                d={zone.d}
                fill={fill}
                stroke={c.stroke}
                strokeWidth={isSelected ? 1.8 : 1}
                strokeOpacity={isSelected || isHovered ? 1 : 0.5}
                cursor={readOnly ? 'default' : 'pointer'}
                onClick={() => toggleZone(zone.id)}
                onMouseEnter={() => setHoveredId(zone.id)}
                onMouseLeave={() => setHoveredId(null)}
              />
            )
          })}
        </svg>
      </div>

      {/* 選択済みチップ */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {selected.map(id => {
            const zone = zones.find(z => z.id === id)
            if (!zone) return null
            const c = TYPE_COLORS[zone.type]
            return (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border"
                style={{ background: c.selected, borderColor: c.stroke, color: '#fff' }}>
                {zone.label}
                {!readOnly && (
                  <button type="button" onClick={() => toggleZone(id)} className="opacity-80 hover:opacity-100 leading-none">×</button>
                )}
              </span>
            )
          })}
        </div>
      )}

      {!readOnly && <p className="text-[10px] text-gray-400 px-1">部位をクリックして選択・解除できます</p>}
    </div>
  )
}
