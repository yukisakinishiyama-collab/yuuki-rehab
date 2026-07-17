// がんばりレポート・進捗管理用のインラインSVGイラスト集
// 外部画像・外部フォントに依存しないため、印刷・オフラインでも確実に描画される。
// カラーはアプリのteal系パレットに統一。

// ─── 回復の旅（ジャーニーマップ） ────────────────────────────────
// なだらかな丘を登る一本道に、フェーズのチェックポイントと現在地の人物を描く。

interface JourneyProps {
  phaseCount: number
  currentPhaseIndex: number
  /** 現在フェーズ内の基準達成率 0〜1 */
  criteriaPct: number
}

// 道のパラメトリック座標（t: 0〜1）
function roadX(t: number) { return 64 + 672 * t }
function roadY(t: number) { return 196 - 124 * t + 14 * Math.sin(t * Math.PI * 2.2) }

export function JourneyIllustration({ phaseCount, currentPhaseIndex, criteriaPct }: JourneyProps) {
  const n = Math.max(1, phaseCount)
  // 全体進捗（0〜1）: 完了フェーズ + 現在フェーズの部分達成
  const p = Math.min(1, (currentPhaseIndex + Math.min(1, Math.max(0, criteriaPct))) / n)
  const walkerT = 0.03 + 0.94 * p
  const wx = roadX(walkerT)
  const wy = roadY(walkerT)

  // 道のポリライン
  const roadPoints = Array.from({ length: 49 }, (_, i) => {
    const t = i / 48
    return `${roadX(t).toFixed(1)},${roadY(t).toFixed(1)}`
  }).join(' L ')

  // チェックポイント: フェーズiの完了地点 t=(i+1)/n（最後はゴールと重なるため n-1 個）
  const checkpoints = Array.from({ length: n - 1 }, (_, i) => {
    const t = (i + 1) / n
    return { i, x: roadX(0.03 + 0.94 * t), y: roadY(0.03 + 0.94 * t), done: i < currentPhaseIndex }
  })

  const gx = roadX(0.97)
  const gy = roadY(0.97)

  return (
    <svg viewBox="0 0 800 240" className="w-full h-auto" role="img" aria-label="回復の旅の進捗マップ">
      {/* 太陽 */}
      <g opacity="0.9">
        <circle cx="64" cy="42" r="14" fill="#fbbf24" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4
          return (
            <line key={i}
              x1={64 + Math.cos(a) * 20} y1={42 + Math.sin(a) * 20}
              x2={64 + Math.cos(a) * 26} y2={42 + Math.sin(a) * 26}
              stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
          )
        })}
      </g>

      {/* 雲 */}
      <g fill="#eef2f7">
        <ellipse cx="590" cy="38" rx="34" ry="13" />
        <ellipse cx="616" cy="30" rx="24" ry="11" />
        <ellipse cx="710" cy="60" rx="28" ry="10" />
      </g>

      {/* 丘（奥・手前） */}
      <path d="M0,150 Q160,98 340,132 T800,102 L800,240 L0,240 Z" fill="#ecf7f4" />
      <path d="M0,192 Q220,150 430,176 T800,148 L800,240 L0,240 Z" fill="#dcefe9" />

      {/* 道 */}
      <path d={`M ${roadPoints}`} fill="none" stroke="#e2e8f0" strokeWidth="11" strokeLinecap="round" />
      <path d={`M ${roadPoints}`} fill="none" stroke="#94a3b8" strokeWidth="1.6"
        strokeDasharray="7 9" strokeLinecap="round" opacity="0.7" />

      {/* スタート地点 */}
      <g transform={`translate(${roadX(0.03)}, ${roadY(0.03)})`}>
        <circle r="7" fill="#64748b" />
        <circle r="3" fill="white" />
        <text y="24" textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748b">スタート</text>
      </g>

      {/* フェーズチェックポイント */}
      {checkpoints.map(cp => (
        <g key={cp.i} transform={`translate(${cp.x}, ${cp.y})`}>
          <circle r="12" fill={cp.done ? '#0d9488' : 'white'}
            stroke={cp.done ? '#0d9488' : '#cbd5e1'} strokeWidth="2.5" />
          {cp.done ? (
            <path d="M-4.5,0 L-1.5,3.5 L5,-3.5" fill="none" stroke="white" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <text y="4.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="#94a3b8">
              {cp.i + 1}
            </text>
          )}
        </g>
      ))}

      {/* ゴール（旗＋トロフィー） */}
      <g transform={`translate(${gx}, ${gy})`}>
        <circle r="7" fill="#f97316" opacity="0.15" />
        <line x1="0" y1="2" x2="0" y2="-40" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
        <path d="M0,-40 L30,-33 L0,-26 Z" fill="#f97316" />
        {/* トロフィー */}
        <g transform="translate(14, -6)">
          <path d="M-6,-8 h12 v5 a6,6 0 0 1 -12 0 Z" fill="#fbbf24" />
          <path d="M-6,-7 a4,4 0 0 1 -5,4 M6,-7 a4,4 0 0 0 5,4" fill="none" stroke="#fbbf24" strokeWidth="2" />
          <rect x="-2" y="2" width="4" height="4" fill="#fbbf24" />
          <rect x="-5" y="6" width="10" height="2.5" rx="1" fill="#f59e0b" />
        </g>
        <text y="24" textAnchor="middle" fontSize="11" fontWeight="700" fill="#f97316">ゴール</text>
      </g>

      {/* 現在地の人物（歩く人） */}
      <g transform={`translate(${wx}, ${wy})`}>
        <ellipse cy="4" rx="9" ry="2.6" fill="#0f172a" opacity="0.10" />
        {/* 脚 */}
        <path d="M-1,-10 L-6,1 M1,-10 L5,-2 L6,2" fill="none" stroke="#0f766e"
          strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        {/* 胴体 */}
        <rect x="-5" y="-24" width="10" height="16" rx="5" fill="#14b8a6" />
        {/* 腕（前後に振る） */}
        <path d="M-3,-20 L-9,-13 M3,-20 L9,-24" fill="none" stroke="#0f766e"
          strokeWidth="3.2" strokeLinecap="round" />
        {/* 頭 */}
        <circle cy="-31" r="5.5" fill="#fde0c2" />
        <path d="M-5.5,-32 a5.5,5.5 0 0 1 11,-1 l-2,-0.5 a4,4 0 0 0 -7,0 Z" fill="#57534e" />
        {/* 現在地マーカー */}
        <path d="M0,-48 l4,6 h-8 Z" fill="#f97316" />
      </g>
    </svg>
  )
}

// ─── 進捗リング（ドーナツ型 達成率） ────────────────────────────

interface RingProps {
  /** 0〜100 */
  pct: number
  size?: number
  label?: string
}

export function ProgressRing({ pct, size = 120, label = '達成' }: RingProps) {
  const clamped = Math.min(100, Math.max(0, pct))
  const r = size / 2 - 10
  const c = 2 * Math.PI * r
  const offset = c * (1 - clamped / 100)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
      aria-label={`${label} ${clamped}%`}>
      <defs>
        <linearGradient id="rehabRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0d9488" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="url(#rehabRingGrad)" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="48%" textAnchor="middle" dominantBaseline="central"
        fontSize={size * 0.23} fontWeight="700" fill="#0f172a"
        style={{ fontVariantNumeric: 'tabular-nums' }}>
        {clamped}
        <tspan fontSize={size * 0.12} fill="#64748b">%</tspan>
      </text>
      <text x="50%" y="66%" textAnchor="middle" fontSize={size * 0.095}
        fontWeight="600" fill="#64748b">
        {label}
      </text>
    </svg>
  )
}

// ─── がんばりスタンプ（判子風） ──────────────────────────────────

interface StampProps {
  grade: 'excellent' | 'great' | 'keep'
  size?: number
}

const STAMP_LINES: Record<StampProps['grade'], string[]> = {
  excellent: ['たいへん', 'よくがんばり', 'ました'],
  great:     ['よく', 'がんばり', 'ました'],
  keep:      ['その調子で', 'いきましょう'],
}

function StarPath({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rad = i % 2 === 0 ? r : r * 0.45
    return `${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)}`
  }).join(' ')
  return <polygon points={pts} fill={fill} />
}

export function EffortStamp({ grade, size = 130 }: StampProps) {
  const lines = STAMP_LINES[grade]
  const red = '#dc2626'
  const cy0 = grade === 'keep' ? 60 : 54

  return (
    <svg width={size} height={size} viewBox="0 0 130 130" role="img" aria-label="がんばりスタンプ">
      <g transform="rotate(-8 65 65)" opacity="0.92">
        <circle cx="65" cy="65" r="60" fill="#fef2f2" fillOpacity="0.5" stroke={red} strokeWidth="3.5" />
        <circle cx="65" cy="65" r="51" fill="none" stroke={red} strokeWidth="1.5" />
        <StarPath cx={65} cy={26} r={7} fill={red} />
        {lines.map((line, i) => (
          <text key={i} x="65" y={cy0 + i * 17} textAnchor="middle"
            fontSize={lines.length === 2 ? 15 : 14} fontWeight="800" fill={red} letterSpacing="1">
            {line}
          </text>
        ))}
        {grade === 'excellent' && (
          <>
            <StarPath cx={24} cy={80} r={5} fill={red} />
            <StarPath cx={106} cy={80} r={5} fill={red} />
          </>
        )}
      </g>
    </svg>
  )
}

// ─── 応援マスコット（両手を上げて祝福） ─────────────────────────

export function CheeringBuddy({ size = 88 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" role="img" aria-label="応援マスコット">
      {/* 紙吹雪 */}
      <g>
        <rect x="10" y="10" width="5" height="5" rx="1" fill="#f97316" transform="rotate(20 12 12)" />
        <rect x="70" y="8" width="5" height="5" rx="1" fill="#38bdf8" transform="rotate(-15 72 10)" />
        <circle cx="24" cy="22" r="2.5" fill="#fbbf24" />
        <circle cx="66" cy="24" r="2.5" fill="#14b8a6" />
        <rect x="42" y="4" width="4" height="4" rx="1" fill="#fb7185" transform="rotate(30 44 6)" />
      </g>
      {/* 腕（挙上） */}
      <path d="M26,52 Q18,42 20,32 M62,52 Q70,42 68,32" fill="none" stroke="#0f766e"
        strokeWidth="7" strokeLinecap="round" />
      <circle cx="20" cy="30" r="4.5" fill="#0f766e" />
      <circle cx="68" cy="30" r="4.5" fill="#0f766e" />
      {/* 体 */}
      <ellipse cx="44" cy="56" rx="24" ry="26" fill="#14b8a6" />
      <ellipse cx="44" cy="64" rx="15" ry="14" fill="#5eead4" opacity="0.55" />
      {/* 目 */}
      <circle cx="36" cy="48" r="4.2" fill="white" />
      <circle cx="52" cy="48" r="4.2" fill="white" />
      <circle cx="37" cy="49" r="2" fill="#134e4a" />
      <circle cx="53" cy="49" r="2" fill="#134e4a" />
      {/* 口（笑顔） */}
      <path d="M38,58 Q44,64 50,58" fill="none" stroke="#134e4a" strokeWidth="2.4" strokeLinecap="round" />
      {/* ほっぺ */}
      <circle cx="30" cy="55" r="3" fill="#fb7185" opacity="0.45" />
      <circle cx="58" cy="55" r="3" fill="#fb7185" opacity="0.45" />
    </svg>
  )
}
