// 疾患ページ用の解剖模式図（すべて自作のオリジナル図・著作権フリー）
// 目的: §3「解剖学的説明には模式図を用い、方向・左右・部位名を明示する」への対応。
// 注意: 実際の解剖を簡略化した位置関係理解用の図であり、正確な医学図ではない。
// 外部画像に依存しないため印刷・オフラインでも確実に描画される。

import type { DiseaseCategory } from '@/types/disease'

// 共通の色（骨・靱帯・軟骨/関節唇・神経・筋）
const C = {
  bone: '#eef2f7', boneLine: '#94a3b8',
  lig: '#0d9488', cartilage: '#38bdf8', nerve: '#f59e0b', muscle: '#fb7185',
  text: '#475569', sub: '#94a3b8',
}

function Label({ x, y, children, anchor = 'middle' }: {
  x: number; y: number; children: string; anchor?: 'start' | 'middle' | 'end'
}) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={9} fill={C.text} fontWeight={600}>{children}</text>
  )
}

// 方向表示（左上に配置）
function Orientation({ text }: { text: string }) {
  return <text x={8} y={16} fontSize={9} fill={C.sub} fontWeight={700}>{text}</text>
}

const svgProps = {
  viewBox: '0 0 320 240',
  className: 'w-full h-auto',
  role: 'img',
} as const

// ─── 膝関節（前面） ───────────────────────────────
function KneeSVG() {
  return (
    <svg {...svgProps} aria-label="膝関節の模式図（前面）">
      <Orientation text="前面 / 右膝" />
      {/* 大腿骨 */}
      <path d="M110,20 h100 v70 q0,25 -20,30 h-60 q-20,-5 -20,-30 Z" fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      <path d="M150,120 q10,-14 20,0" fill="none" stroke={C.boneLine} strokeWidth={1.5} />
      {/* 脛骨 */}
      <path d="M118,150 h84 v70 h-84 Z" fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      {/* 腓骨 */}
      <path d="M206,155 h14 v65 h-14 Z" fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      {/* 膝蓋骨 */}
      <ellipse cx={160} cy={105} rx={18} ry={22} fill="#f8fafc" stroke={C.boneLine} strokeWidth={1.5} />
      {/* 半月板 */}
      <path d="M124,148 q14,-8 26,0" fill="none" stroke={C.cartilage} strokeWidth={4} strokeLinecap="round" />
      <path d="M170,148 q14,-8 26,0" fill="none" stroke={C.cartilage} strokeWidth={4} strokeLinecap="round" />
      {/* ACL / PCL（交差） */}
      <line x1={146} y1={118} x2={174} y2={150} stroke={C.lig} strokeWidth={3} strokeLinecap="round" />
      <line x1={174} y1={118} x2={146} y2={150} stroke={C.lig} strokeWidth={3} strokeLinecap="round" opacity={0.6} />
      {/* MCL / LCL */}
      <line x1={120} y1={120} x2={120} y2={152} stroke={C.lig} strokeWidth={3} strokeLinecap="round" />
      <line x1={200} y1={120} x2={200} y2={152} stroke={C.lig} strokeWidth={3} strokeLinecap="round" />
      {/* ラベル */}
      <Label x={160} y={45}>大腿骨</Label>
      <Label x={160} y={200}>脛骨</Label>
      <Label x={213} y={240} anchor="end">腓骨</Label>
      <Label x={160} y={107}>膝蓋骨</Label>
      <text x={182} y={132} fontSize={8} fill={C.lig} fontWeight={700}>ACL/PCL</text>
      <text x={96} y={138} fontSize={8} fill={C.lig} fontWeight={700} textAnchor="end">MCL</text>
      <text x={224} y={138} fontSize={8} fill={C.lig} fontWeight={700}>LCL</text>
      <text x={112} y={164} fontSize={8} fill={C.cartilage} fontWeight={700} textAnchor="end">半月板</text>
    </svg>
  )
}

// ─── 肩関節（前面） ───────────────────────────────
function ShoulderSVG() {
  return (
    <svg {...svgProps} aria-label="肩関節の模式図（前面）">
      <Orientation text="前面 / 右肩" />
      {/* 肩甲骨・関節窩 */}
      <path d="M60,60 q-20,50 10,120 l40,-10 q-10,-60 5,-100 Z" fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      <path d="M108,80 q18,50 0,90" fill="none" stroke={C.boneLine} strokeWidth={1.5} />
      {/* 関節唇 */}
      <path d="M110,82 q16,48 0,86" fill="none" stroke={C.cartilage} strokeWidth={4} strokeLinecap="round" />
      {/* 上腕骨頭 */}
      <circle cx={150} cy={125} r={34} fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      {/* 上腕骨骨幹 */}
      <path d="M138,155 q6,50 4,70 h24 q-4,-30 8,-74 Z" fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      {/* 腱板（棘上筋） */}
      <path d="M120,96 q30,-14 62,4" fill="none" stroke={C.muscle} strokeWidth={5} strokeLinecap="round" />
      {/* 鎖骨・肩鎖関節 */}
      <path d="M150,60 h100" stroke={C.bone} strokeWidth={9} strokeLinecap="round" />
      <line x1={152} y1={54} x2={152} y2={66} stroke={C.lig} strokeWidth={3} />
      {/* ラベル */}
      <Label x={70} y={150}>肩甲骨</Label>
      <Label x={150} y={128}>上腕骨頭</Label>
      <Label x={152} y={240}>上腕骨</Label>
      <text x={150} y={88} fontSize={8} fill={C.muscle} fontWeight={700} textAnchor="middle">腱板（棘上筋）</text>
      <text x={128} y={78} fontSize={8} fill={C.cartilage} fontWeight={700} textAnchor="end">関節唇</text>
      <Label x={215} y={52}>鎖骨</Label>
      <text x={150} y={46} fontSize={8} fill={C.lig} fontWeight={700} textAnchor="middle">肩鎖関節</text>
    </svg>
  )
}

// ─── 股関節（前面） ───────────────────────────────
function HipSVG() {
  return (
    <svg {...svgProps} aria-label="股関節の模式図（前面）">
      <Orientation text="前面 / 右股関節" />
      {/* 寛骨（骨盤） */}
      <path d="M40,40 q120,-10 150,30 q20,40 -6,70 l-30,-6 q10,-40 -14,-64 q-40,-20 -100,-10 Z"
        fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      {/* 寛骨臼（ソケット） */}
      <path d="M150,96 a36,36 0 0 1 0,72" fill="none" stroke={C.boneLine} strokeWidth={2} />
      {/* 関節唇 */}
      <path d="M150,96 a40,40 0 0 1 0,72" fill="none" stroke={C.cartilage} strokeWidth={4} strokeLinecap="round" />
      {/* 大腿骨頭 */}
      <circle cx={150} cy={132} r={30} fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      {/* 大腿骨頸部・骨幹 */}
      <path d="M168,150 q40,20 44,80 l-26,6 q-8,-52 -40,-70 Z" fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      {/* 大転子 */}
      <path d="M172,120 q28,-6 30,14 q-2,18 -26,14 Z" fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      {/* ラベル */}
      <Label x={90} y={60}>寛骨（骨盤）</Label>
      <Label x={150} y={135}>大腿骨頭</Label>
      <text x={118} y={132} fontSize={8} fill={C.cartilage} fontWeight={700} textAnchor="end">関節唇</text>
      <Label x={210} y={215} anchor="end">大腿骨</Label>
      <Label x={205} y={118} anchor="start">大転子</Label>
    </svg>
  )
}

// ─── 足関節（外側面） ─────────────────────────────
function AnkleSVG() {
  return (
    <svg {...svgProps} aria-label="足関節の模式図（外側面）">
      <Orientation text="外側面 / 右足" />
      {/* 脛骨 */}
      <path d="M120,20 h40 v100 h-40 Z" fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      {/* 腓骨（外果） */}
      <path d="M164,30 h20 v95 q0,14 -10,18 q-10,-4 -10,-18 Z" fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      {/* 距骨 */}
      <path d="M120,125 q30,-6 66,4 q6,26 -14,34 h-40 q-16,-6 -12,-38 Z" fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      {/* 踵骨 */}
      <path d="M108,170 q40,-8 80,4 q6,30 -20,40 h-46 q-20,-8 -14,-44 Z" fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      {/* 中足部（前方） */}
      <path d="M188,176 h56 q8,10 0,22 h-52 Z" fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      {/* ATFL（前距腓靱帯） */}
      <line x1={176} y1={140} x2={150} y2={150} stroke={C.lig} strokeWidth={3} strokeLinecap="round" />
      {/* CFL（踵腓靱帯） */}
      <line x1={176} y1={150} x2={150} y2={188} stroke={C.lig} strokeWidth={3} strokeLinecap="round" />
      {/* 遠位脛腓靱帯 */}
      <line x1={160} y1={110} x2={172} y2={112} stroke={C.lig} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
      {/* ラベル */}
      <Label x={140} y={70}>脛骨</Label>
      <Label x={186} y={80} anchor="start">腓骨</Label>
      <Label x={150} y={150}>距骨</Label>
      <Label x={150} y={200}>踵骨</Label>
      <text x={120} y={146} fontSize={8} fill={C.lig} fontWeight={700} textAnchor="end">ATFL</text>
      <text x={118} y={180} fontSize={8} fill={C.lig} fontWeight={700} textAnchor="end">CFL</text>
      <text x={196} y={108} fontSize={7.5} fill={C.lig} fontWeight={700} textAnchor="start">脛腓靱帯</text>
    </svg>
  )
}

// ─── 肘関節（前面・右肘） ─────────────────────────
function ElbowSVG() {
  return (
    <svg {...svgProps} aria-label="肘関節の模式図（前面）">
      <Orientation text="前面 / 右肘" />
      {/* 上腕骨 */}
      <path d="M120,20 h40 v90 h-40 Z" fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      {/* 内側上顆 */}
      <circle cx={116} cy={112} r={12} fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      {/* 外側上顆 */}
      <circle cx={164} cy={112} r={12} fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      {/* 尺骨 */}
      <path d="M126,130 q-6,50 -2,88 h22 q-4,-44 4,-84 Z" fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      {/* 橈骨（橈骨頭） */}
      <circle cx={164} cy={132} r={12} fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      <path d="M156,142 q6,40 4,76 h18 q0,-40 -6,-72 Z" fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      {/* UCL（内側側副靱帯） */}
      <line x1={112} y1={122} x2={122} y2={146} stroke={C.lig} strokeWidth={3} strokeLinecap="round" />
      {/* 共通伸筋起始（外側） */}
      <path d="M172,116 q14,8 10,26" fill="none" stroke={C.muscle} strokeWidth={4} strokeLinecap="round" />
      {/* ラベル */}
      <Label x={140} y={70}>上腕骨</Label>
      <text x={100} y={108} fontSize={7.5} fill={C.text} fontWeight={700} textAnchor="end">内側上顆</text>
      <text x={180} y={108} fontSize={7.5} fill={C.text} fontWeight={700} textAnchor="start">外側上顆</text>
      <Label x={130} y={205}>尺骨</Label>
      <Label x={176} y={205}>橈骨</Label>
      <text x={98} y={140} fontSize={8} fill={C.lig} fontWeight={700} textAnchor="end">UCL</text>
      <text x={198} y={150} fontSize={7.5} fill={C.muscle} fontWeight={700} textAnchor="start">伸筋起始</text>
    </svg>
  )
}

// ─── 脊椎（腰椎・側面） ───────────────────────────
function SpineSVG() {
  return (
    <svg {...svgProps} aria-label="腰椎の模式図（側面・運動分節）">
      <Orientation text="側面 / 腰椎（前方＝左）" />
      {/* 上位椎体 */}
      <rect x={70} y={50} width={90} height={46} rx={6} fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      {/* 下位椎体 */}
      <rect x={70} y={128} width={90} height={46} rx={6} fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      {/* 椎間板 */}
      <rect x={72} y={98} width={86} height={28} rx={10} fill={C.cartilage} opacity={0.5} stroke={C.cartilage} strokeWidth={1.5} />
      {/* 後方要素（椎弓・棘突起） */}
      <path d="M160,58 h40 q16,4 16,18 v10 h-30 Z" fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      <path d="M160,136 h40 q16,4 16,18 v10 h-30 Z" fill={C.bone} stroke={C.boneLine} strokeWidth={1.5} />
      {/* 椎間関節（後方） */}
      <line x1={206} y1={90} x2={206} y2={140} stroke={C.lig} strokeWidth={4} strokeLinecap="round" opacity={0.7} />
      {/* 脊柱管・神経根 */}
      <path d="M186,112 q26,2 40,22" fill="none" stroke={C.nerve} strokeWidth={3.5} strokeLinecap="round" />
      {/* ラベル */}
      <Label x={115} y={76}>椎体</Label>
      <text x={115} y={116} fontSize={8} fill={C.cartilage} fontWeight={700} textAnchor="middle">椎間板</text>
      <text x={228} y={118} fontSize={8} fill={C.lig} fontWeight={700} textAnchor="start">椎間関節</text>
      <text x={230} y={142} fontSize={8} fill={C.nerve} fontWeight={700} textAnchor="start">神経根</text>
      <text x={196} y={52} fontSize={7.5} fill={C.text} fontWeight={700} textAnchor="middle">棘突起</text>
    </svg>
  )
}

const DIAGRAMS: Record<DiseaseCategory, () => React.JSX.Element> = {
  knee: KneeSVG,
  shoulder: ShoulderSVG,
  hip: HipSVG,
  ankle_foot: AnkleSVG,
  elbow_hand: ElbowSVG,
  spine: SpineSVG,
}

export default function AnatomyDiagram({ category }: { category: DiseaseCategory }) {
  const Diagram = DIAGRAMS[category]
  if (!Diagram) return null
  return (
    <figure className="bg-slate-50/70 border border-slate-100 rounded-xl p-3 mb-4">
      <div className="max-w-[320px] mx-auto">
        <Diagram />
      </div>
      <figcaption className="text-[10px] text-slate-400 text-center mt-1.5 leading-relaxed">
        模式図（部位の位置関係を理解するための簡略図・オリジナル作図）。
        実際の解剖・大きさ・角度とは異なります。
      </figcaption>
    </figure>
  )
}
