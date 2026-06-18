'use client'
import type { ReactElement } from 'react'

// ──────────────────────────────────────────────
// 運動イラストコンポーネント（棒人間SVG）
// 将来的に本格イラストやAI画像に差し替えやすい設計
// ──────────────────────────────────────────────

interface Props {
  type: string
  size?: number
  className?: string
}

export default function ExerciseIllustration({ type, size = 120, className = '' }: Props) {
  const Svg = ILLUSTRATIONS[type] ?? ILLUSTRATIONS['default']
  return (
    <div className={className} style={{ width: size, height: size }}>
      <Svg size={size} />
    </div>
  )
}

// ── 共通スタイル ──
const S = {
  body: '#374151',
  joint: '#6B7280',
  highlight: '#0d9488',
  arrow: '#f59e0b',
  stop: '#ef4444',
}

function StickFigureBase({ x = 50, y = 30, size = 120 }: { x?: number; y?: number; size?: number }) {
  const scale = size / 120
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`} fill="none">
      {/* 頭 */}
      <circle cx="0" cy="-10" r="6" stroke={S.body} strokeWidth="2" />
      {/* 体幹 */}
      <line x1="0" y1="-4" x2="0" y2="20" stroke={S.body} strokeWidth="2" />
      {/* 腕 */}
      <line x1="0" y1="2" x2="-12" y2="12" stroke={S.body} strokeWidth="2" />
      <line x1="0" y1="2" x2="12" y2="12" stroke={S.body} strokeWidth="2" />
      {/* 脚 */}
      <line x1="0" y1="20" x2="-8" y2="36" stroke={S.body} strokeWidth="2" />
      <line x1="0" y1="20" x2="8" y2="36" stroke={S.body} strokeWidth="2" />
    </g>
  )
}

// ── 各イラスト ──
const ILLUSTRATIONS: Record<string, (props: { size: number }) => ReactElement> = {
  // 足関節ポンプ
  pump: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {/* 座っている人 */}
      <circle cx="55" cy="25" r="7" stroke={S.body} strokeWidth="2" fill="none" />
      <line x1="55" y1="32" x2="55" y2="58" stroke={S.body} strokeWidth="2" />
      <line x1="55" y1="38" x2="42" y2="48" stroke={S.body} strokeWidth="2" />
      <line x1="55" y1="38" x2="68" y2="48" stroke={S.body} strokeWidth="2" />
      {/* 太もも（座位） */}
      <line x1="55" y1="58" x2="40" y2="72" stroke={S.body} strokeWidth="2" />
      <line x1="55" y1="58" x2="70" y2="72" stroke={S.body} strokeWidth="2" />
      {/* 椅子 */}
      <line x1="30" y1="72" x2="85" y2="72" stroke={S.joint} strokeWidth="1.5" />
      {/* 左足 矢印（上下） */}
      <line x1="40" y1="72" x2="40" y2="90" stroke={S.body} strokeWidth="2" />
      <path d="M35 82 L40 72 L45 82" stroke={S.arrow} strokeWidth="2" fill="none" />
      <path d="M35 88 L40 98 L45 88" stroke={S.highlight} strokeWidth="2" fill="none" />
      <text x="18" y="108" fontSize="9" fill={S.highlight} fontFamily="sans-serif">ポンプ運動</text>
    </svg>
  ),

  // クラムシェル
  clamshell: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {/* 横向き人体 */}
      <circle cx="25" cy="45" r="7" stroke={S.body} strokeWidth="2" fill="none" />
      {/* 体幹（横） */}
      <line x1="30" y1="48" x2="75" y2="52" stroke={S.body} strokeWidth="2" />
      {/* 腕 */}
      <line x1="40" y1="48" x2="38" y2="62" stroke={S.body} strokeWidth="2" />
      {/* 下の脚 */}
      <line x1="75" y1="52" x2="80" y2="70" stroke={S.body} strokeWidth="2" />
      <line x1="80" y1="70" x2="85" y2="85" stroke={S.body} strokeWidth="2" />
      {/* 上の脚（開いた） */}
      <line x1="75" y1="52" x2="85" y2="62" stroke={S.highlight} strokeWidth="2.5" />
      <line x1="85" y1="62" x2="95" y2="75" stroke={S.highlight} strokeWidth="2.5" />
      {/* 矢印 */}
      <path d="M88 52 Q95 58 90 65" stroke={S.arrow} strokeWidth="2" fill="none" markerEnd="url(#arrowhead)" />
      <text x="8" y="108" fontSize="9" fill={S.highlight} fontFamily="sans-serif">外側に開く</text>
    </svg>
  ),

  // ブリッジ
  bridge: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {/* 仰向け人体 */}
      <circle cx="20" cy="52" r="7" stroke={S.body} strokeWidth="2" fill="none" />
      <line x1="25" y1="55" x2="65" y2="60" stroke={S.body} strokeWidth="2" />
      {/* 腕（床に） */}
      <line x1="35" y1="57" x2="30" y2="70" stroke={S.body} strokeWidth="2" />
      {/* 膝曲げた脚 */}
      <line x1="65" y1="60" x2="78" y2="72" stroke={S.body} strokeWidth="2" />
      <line x1="78" y1="72" x2="82" y2="82" stroke={S.body} strokeWidth="2" />
      <line x1="65" y1="60" x2="85" y2="68" stroke={S.body} strokeWidth="2" />
      <line x1="85" y1="68" x2="90" y2="82" stroke={S.body} strokeWidth="2" />
      {/* 床 */}
      <line x1="10" y1="82" x2="110" y2="82" stroke={S.joint} strokeWidth="1.5" />
      {/* お尻の矢印 */}
      <path d="M60 60 Q55 45 60 40" stroke={S.arrow} strokeWidth="2" fill="none" />
      <polygon points="57,40 63,40 60,34" fill={S.arrow} />
      <text x="8" y="108" fontSize="9" fill={S.highlight} fontFamily="sans-serif">お尻を持ち上げる</text>
    </svg>
  ),

  // 片脚立位
  single_leg: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {/* 立ち姿勢 */}
      <circle cx="60" cy="22" r="8" stroke={S.body} strokeWidth="2" fill="none" />
      <line x1="60" y1="30" x2="60" y2="60" stroke={S.body} strokeWidth="2" />
      <line x1="60" y1="38" x2="45" y2="52" stroke={S.body} strokeWidth="2" />
      <line x1="60" y1="38" x2="75" y2="52" stroke={S.body} strokeWidth="2" />
      {/* 支持脚 */}
      <line x1="60" y1="60" x2="55" y2="85" stroke={S.highlight} strokeWidth="2.5" />
      <line x1="55" y1="85" x2="55" y2="95" stroke={S.highlight} strokeWidth="2.5" />
      {/* 浮かせた脚 */}
      <line x1="60" y1="60" x2="72" y2="72" stroke={S.body} strokeWidth="2" />
      <line x1="72" y1="72" x2="78" y2="65" stroke={S.body} strokeWidth="2" />
      {/* 床 */}
      <line x1="35" y1="95" x2="85" y2="95" stroke={S.joint} strokeWidth="1.5" />
      <text x="8" y="112" fontSize="9" fill={S.highlight} fontFamily="sans-serif">バランスをとる</text>
    </svg>
  ),

  // カーフレイズ
  calf_raise: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {/* 立ち姿勢・つま先立ち */}
      <circle cx="60" cy="18" r="8" stroke={S.body} strokeWidth="2" fill="none" />
      <line x1="60" y1="26" x2="60" y2="55" stroke={S.body} strokeWidth="2" />
      <line x1="60" y1="33" x2="45" y2="46" stroke={S.body} strokeWidth="2" />
      <line x1="60" y1="33" x2="75" y2="46" stroke={S.body} strokeWidth="2" />
      {/* 脚 */}
      <line x1="60" y1="55" x2="50" y2="78" stroke={S.body} strokeWidth="2" />
      <line x1="60" y1="55" x2="70" y2="78" stroke={S.body} strokeWidth="2" />
      {/* つま先立ち（足） */}
      <line x1="50" y1="78" x2="46" y2="88" stroke={S.highlight} strokeWidth="2.5" />
      <line x1="70" y1="78" x2="74" y2="88" stroke={S.highlight} strokeWidth="2.5" />
      {/* 矢印 */}
      <path d="M60 62 Q60 52 60 45" stroke={S.arrow} strokeWidth="2" fill="none" />
      <polygon points="57,45 63,45 60,39" fill={S.arrow} />
      <text x="18" y="108" fontSize="9" fill={S.highlight} fontFamily="sans-serif">かかとを上げる</text>
    </svg>
  ),

  // 肩甲骨セッティング
  scapular: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {/* 背面から見た人体 */}
      <circle cx="60" cy="20" r="8" stroke={S.body} strokeWidth="2" fill="none" />
      <line x1="60" y1="28" x2="60" y2="62" stroke={S.body} strokeWidth="2" />
      <line x1="60" y1="35" x2="38" y2="50" stroke={S.body} strokeWidth="2" />
      <line x1="60" y1="35" x2="82" y2="50" stroke={S.body} strokeWidth="2" />
      {/* 肩甲骨（矢印） */}
      <rect x="44" y="30" width="10" height="16" rx="2" stroke={S.highlight} strokeWidth="1.5" fill={S.highlight + '22'} />
      <rect x="66" y="30" width="10" height="16" rx="2" stroke={S.highlight} strokeWidth="1.5" fill={S.highlight + '22'} />
      {/* 引き寄せる矢印 */}
      <path d="M53 38 L62 38" stroke={S.arrow} strokeWidth="2" markerEnd="url(#arrowhead)" fill="none" />
      <path d="M67 38 L58 38" stroke={S.arrow} strokeWidth="2" markerEnd="url(#arrowhead)" fill="none" />
      <text x="14" y="108" fontSize="9" fill={S.highlight} fontFamily="sans-serif">後ろ・下に引く</text>
    </svg>
  ),

  // 体幹ブレーシング
  bracing: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {/* 立ち姿勢 */}
      <circle cx="60" cy="22" r="8" stroke={S.body} strokeWidth="2" fill="none" />
      <line x1="60" y1="30" x2="60" y2="62" stroke={S.body} strokeWidth="2" />
      <line x1="60" y1="38" x2="45" y2="52" stroke={S.body} strokeWidth="2" />
      <line x1="60" y1="38" x2="75" y2="52" stroke={S.body} strokeWidth="2" />
      <line x1="60" y1="62" x2="50" y2="85" stroke={S.body} strokeWidth="2" />
      <line x1="60" y1="62" x2="70" y2="85" stroke={S.body} strokeWidth="2" />
      {/* お腹（体幹）表示 */}
      <ellipse cx="60" cy="48" rx="12" ry="10" stroke={S.highlight} strokeWidth="2" fill={S.highlight + '15'} strokeDasharray="4 2" />
      {/* 矢印（引き締め） */}
      <path d="M48 44 L54 46" stroke={S.arrow} strokeWidth="2" fill="none" />
      <path d="M72 44 L66 46" stroke={S.arrow} strokeWidth="2" fill="none" />
      <text x="12" y="108" fontSize="9" fill={S.highlight} fontFamily="sans-serif">お腹に力を入れる</text>
    </svg>
  ),

  // チューブ外旋
  tube_er: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx="45" cy="22" r="8" stroke={S.body} strokeWidth="2" fill="none" />
      <line x1="45" y1="30" x2="45" y2="62" stroke={S.body} strokeWidth="2" />
      {/* 上腕（体に沿って） */}
      <line x1="45" y1="37" x2="38" y2="52" stroke={S.body} strokeWidth="2" />
      <line x1="45" y1="37" x2="52" y2="52" stroke={S.body} strokeWidth="2" />
      {/* 前腕（外旋位） */}
      <line x1="52" y1="52" x2="72" y2="52" stroke={S.highlight} strokeWidth="2.5" />
      {/* チューブ */}
      <path d="M72 52 Q85 50 90 55" stroke={S.arrow} strokeWidth="3" strokeDasharray="4 2" fill="none" />
      {/* 矢印（外旋） */}
      <path d="M58 45 Q68 40 72 52" stroke={S.arrow} strokeWidth="1.5" fill="none" markerEnd="url(#arrowhead)" />
      <text x="8" y="108" fontSize="9" fill={S.highlight} fontFamily="sans-serif">外側に回す</text>
    </svg>
  ),

  // スクワット
  squat: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {/* スクワット姿勢 */}
      <circle cx="60" cy="25" r="8" stroke={S.body} strokeWidth="2" fill="none" />
      <line x1="60" y1="33" x2="58" y2="55" stroke={S.body} strokeWidth="2" />
      {/* 腕（前方） */}
      <line x1="58" y1="40" x2="45" y2="50" stroke={S.body} strokeWidth="2" />
      <line x1="58" y1="40" x2="72" y2="48" stroke={S.body} strokeWidth="2" />
      {/* 膝曲げ */}
      <line x1="58" y1="55" x2="50" y2="72" stroke={S.body} strokeWidth="2" />
      <line x1="50" y1="72" x2="52" y2="88" stroke={S.highlight} strokeWidth="2.5" />
      <line x1="58" y1="55" x2="68" y2="72" stroke={S.body} strokeWidth="2" />
      <line x1="68" y1="72" x2="68" y2="88" stroke={S.highlight} strokeWidth="2.5" />
      {/* 床 */}
      <line x1="35" y1="88" x2="85" y2="88" stroke={S.joint} strokeWidth="1.5" />
      {/* 矢印 */}
      <path d="M60 65 Q55 75 60 85" stroke={S.arrow} strokeWidth="2" strokeDasharray="3 2" fill="none" />
      <text x="12" y="108" fontSize="9" fill={S.highlight} fontFamily="sans-serif">ゆっくり膝を曲げる</text>
    </svg>
  ),

  // 呼吸
  breathing: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {/* 仰向け */}
      <circle cx="20" cy="52" r="7" stroke={S.body} strokeWidth="2" fill="none" />
      <line x1="26" y1="54" x2="80" y2="58" stroke={S.body} strokeWidth="2" />
      <line x1="40" y1="55" x2="38" y2="68" stroke={S.body} strokeWidth="2" />
      <line x1="80" y1="58" x2="88" y2="72" stroke={S.body} strokeWidth="2" />
      <line x1="88" y1="72" x2="92" y2="82" stroke={S.body} strokeWidth="2" />
      <line x1="80" y1="58" x2="95" y2="65" stroke={S.body} strokeWidth="2" />
      <line x1="95" y1="65" x2="100" y2="82" stroke={S.body} strokeWidth="2" />
      {/* お腹（膨らむ） */}
      <ellipse cx="58" cy="56" rx="14" ry="8" stroke={S.highlight} strokeWidth="2" fill={S.highlight + '20'} />
      {/* 呼吸矢印 */}
      <path d="M58 42 Q55 50 58 56" stroke={S.arrow} strokeWidth="2" fill="none" />
      <polygon points="55,56 61,56 58,62" fill={S.arrow} />
      <text x="14" y="105" fontSize="9" fill={S.highlight} fontFamily="sans-serif">お腹を膨らませる</text>
    </svg>
  ),

  default: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx="60" cy="25" r="8" stroke={S.body} strokeWidth="2" fill="none" />
      <line x1="60" y1="33" x2="60" y2="65" stroke={S.body} strokeWidth="2" />
      <line x1="60" y1="42" x2="45" y2="56" stroke={S.body} strokeWidth="2" />
      <line x1="60" y1="42" x2="75" y2="56" stroke={S.body} strokeWidth="2" />
      <line x1="60" y1="65" x2="50" y2="88" stroke={S.body} strokeWidth="2" />
      <line x1="60" y1="65" x2="70" y2="88" stroke={S.body} strokeWidth="2" />
      <line x1="35" y1="88" x2="85" y2="88" stroke={S.joint} strokeWidth="1.5" />
    </svg>
  ),
}
