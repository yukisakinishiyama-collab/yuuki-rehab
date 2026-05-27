/**
 * color-marker-tracker.ts
 * カラーシール（100均マーカー）を使ったリアルタイム関節追跡
 *
 * 原理: HSV色空間でターゲット色のピクセルを検出し、その重心をマーカー位置とする
 */

export interface MarkerConfig {
  id:        string
  label:     string   // 例: '左膝'
  joint:     string   // MediaPipe landmark key
  hue:       number   // HSV 色相 0-360
  tolerance: number   // 色相許容幅（度）
  satMin:    number   // 最低彩度 %
  valMin:    number   // 最低明度 %
  cssColor:  string   // 表示用CSS色
}

export interface DetectedMarker {
  joint:   string
  label:   string
  x:       number   // 0-1 正規化
  y:       number   // 0-1 正規化
  pixelX:  number   // ピクセル座標
  pixelY:  number   // ピクセル座標
  count:   number   // 検出ピクセル数
  cssColor: string
}

export interface MarkerAngle {
  label:     string  // 例: '左膝屈曲'
  angle:     number  // 度
  direction: string  // '屈曲' など
  joints:    [string, string, string]  // [proximal, vertex, distal]
}

// ── カラープリセット ─────────────────────────────────────────────────────────
export const COLOR_PRESETS: Array<{
  name: string; hue: number; tolerance: number; satMin: number; valMin: number; cssColor: string
}> = [
  { name: '蛍光オレンジ', hue: 22,  tolerance: 18, satMin: 65, valMin: 60, cssColor: '#ff6600' },
  { name: '蛍光ピンク',   hue: 330, tolerance: 25, satMin: 55, valMin: 60, cssColor: '#ff1493' },
  { name: '蛍光黄緑',    hue: 82,  tolerance: 22, satMin: 65, valMin: 60, cssColor: '#adff2f' },
  { name: '蛍光黄',     hue: 55,  tolerance: 18, satMin: 65, valMin: 70, cssColor: '#ffff00' },
  { name: '赤',         hue: 0,   tolerance: 15, satMin: 65, valMin: 40, cssColor: '#ef4444' },
  { name: '青',         hue: 210, tolerance: 20, satMin: 55, valMin: 40, cssColor: '#3b82f6' },
  { name: '緑',         hue: 130, tolerance: 20, satMin: 55, valMin: 35, cssColor: '#22c55e' },
  { name: '紫',         hue: 280, tolerance: 22, satMin: 50, valMin: 35, cssColor: '#a855f7' },
  { name: '水色',       hue: 190, tolerance: 20, satMin: 55, valMin: 50, cssColor: '#06b6d4' },
]

// ── 貼り付け可能な関節一覧 ──────────────────────────────────────────────────
export const JOINT_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'LEFT_SHOULDER',  label: '左肩' },
  { key: 'RIGHT_SHOULDER', label: '右肩' },
  { key: 'LEFT_ELBOW',     label: '左肘' },
  { key: 'RIGHT_ELBOW',    label: '右肘' },
  { key: 'LEFT_WRIST',     label: '左手首' },
  { key: 'RIGHT_WRIST',    label: '右手首' },
  { key: 'LEFT_HIP',       label: '左股関節' },
  { key: 'RIGHT_HIP',      label: '右股関節' },
  { key: 'LEFT_KNEE',      label: '左膝' },
  { key: 'RIGHT_KNEE',     label: '右膝' },
  { key: 'LEFT_ANKLE',     label: '左足首' },
  { key: 'RIGHT_ANKLE',    label: '右足首' },
  { key: 'LEFT_FOOT',      label: '左つま先' },
  { key: 'RIGHT_FOOT',     label: '右つま先' },
]

// ── 自動計算する角度の定義（3関節セット） ────────────────────────────────────
const ANGLE_DEFS: Array<{
  label: string; joints: [string, string, string]
  calc: (raw: number) => number; direction: (a: number) => string
}> = [
  {
    label: '左膝屈曲', joints: ['LEFT_HIP', 'LEFT_KNEE', 'LEFT_ANKLE'],
    calc: (r) => 180 - r,
    direction: (a) => a > 0 ? `屈曲 ${a}°` : `伸展 ${Math.abs(a)}°`,
  },
  {
    label: '右膝屈曲', joints: ['RIGHT_HIP', 'RIGHT_KNEE', 'RIGHT_ANKLE'],
    calc: (r) => 180 - r,
    direction: (a) => a > 0 ? `屈曲 ${a}°` : `伸展 ${Math.abs(a)}°`,
  },
  {
    label: '左股関節屈曲', joints: ['LEFT_SHOULDER', 'LEFT_HIP', 'LEFT_KNEE'],
    calc: (r) => 180 - r,
    direction: (a) => a > 0 ? `屈曲 ${a}°` : `伸展 ${Math.abs(a)}°`,
  },
  {
    label: '右股関節屈曲', joints: ['RIGHT_SHOULDER', 'RIGHT_HIP', 'RIGHT_KNEE'],
    calc: (r) => 180 - r,
    direction: (a) => a > 0 ? `屈曲 ${a}°` : `伸展 ${Math.abs(a)}°`,
  },
  {
    label: '左足首背屈', joints: ['LEFT_KNEE', 'LEFT_ANKLE', 'LEFT_FOOT'],
    calc: (r) => 90 - r,
    direction: (a) => a >= 0 ? `背屈 ${a}°` : `底屈 ${Math.abs(a)}°`,
  },
  {
    label: '右足首背屈', joints: ['RIGHT_KNEE', 'RIGHT_ANKLE', 'RIGHT_FOOT'],
    calc: (r) => 90 - r,
    direction: (a) => a >= 0 ? `背屈 ${a}°` : `底屈 ${Math.abs(a)}°`,
  },
  {
    label: '左肘屈曲', joints: ['LEFT_SHOULDER', 'LEFT_ELBOW', 'LEFT_WRIST'],
    calc: (r) => 180 - r,
    direction: (a) => `屈曲 ${Math.max(0,a)}°`,
  },
  {
    label: '右肘屈曲', joints: ['RIGHT_SHOULDER', 'RIGHT_ELBOW', 'RIGHT_WRIST'],
    calc: (r) => 180 - r,
    direction: (a) => `屈曲 ${Math.max(0,a)}°`,
  },
]

// ── RGB → HSV 変換 ───────────────────────────────────────────────────────────
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  const s = max === 0 ? 0 : d / max
  const v = max
  if (d !== 0) {
    switch (max) {
      case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break
      case gn: h = ((bn - rn) / d + 2) / 6; break
      case bn: h = ((rn - gn) / d + 4) / 6; break
    }
  }
  return [h * 360, s * 100, v * 100]
}

// ── 1マーカーをImageDataから検出 ─────────────────────────────────────────────
function detectOneMarker(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cfg: MarkerConfig,
): DetectedMarker | null {
  let sumX = 0, sumY = 0, count = 0

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
    if (a < 128) continue

    const [h, s, v] = rgbToHsv(r, g, b)
    if (s < cfg.satMin || v < cfg.valMin) continue

    // 赤は360°付近でラップアラウンドするため特殊処理
    const hueDiff = Math.min(Math.abs(h - cfg.hue), 360 - Math.abs(h - cfg.hue))
    if (hueDiff > cfg.tolerance) continue

    const px = (i / 4) % width
    const py = Math.floor((i / 4) / width)
    sumX += px; sumY += py; count++
  }

  if (count < 8) return null  // 最低8px以上検出されないと無効

  const pixelX = sumX / count
  const pixelY = sumY / count
  return {
    joint:    cfg.joint,
    label:    cfg.label,
    x:        pixelX / width,
    y:        pixelY / height,
    pixelX,
    pixelY,
    count,
    cssColor: cfg.cssColor,
  }
}

/** ビデオフレームから全マーカーを検出 */
export function detectMarkers(
  video: HTMLVideoElement,
  offscreen: HTMLCanvasElement,
  configs: MarkerConfig[],
): DetectedMarker[] {
  if (video.readyState < 2 || configs.length === 0) return []

  const W = video.videoWidth  || 640
  const H = video.videoHeight || 360
  offscreen.width  = W
  offscreen.height = H
  const ctx = offscreen.getContext('2d', { willReadFrequently: true })
  if (!ctx) return []

  ctx.drawImage(video, 0, 0, W, H)
  const imageData = ctx.getImageData(0, 0, W, H)

  return configs
    .map((cfg) => detectOneMarker(imageData.data, W, H, cfg))
    .filter((m): m is DetectedMarker => m !== null)
}

// ── 2D 3点間角度 ─────────────────────────────────────────────────────────────
function angle2D(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y }
  const v2 = { x: c.x - b.x, y: c.y - b.y }
  const dot = v1.x * v2.x + v1.y * v2.y
  const mag = Math.sqrt(v1.x ** 2 + v1.y ** 2) * Math.sqrt(v2.x ** 2 + v2.y ** 2)
  if (mag === 0) return 0
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI
}

/** 検出されたマーカーから関節角度を計算 */
export function calcMarkerAngles(detected: DetectedMarker[]): MarkerAngle[] {
  const map = new Map(detected.map((d) => [d.joint, d]))
  const results: MarkerAngle[] = []

  for (const def of ANGLE_DEFS) {
    const [j0, j1, j2] = def.joints
    const m0 = map.get(j0), m1 = map.get(j1), m2 = map.get(j2)
    if (!m0 || !m1 || !m2) continue

    const raw   = angle2D(m0, m1, m2)
    const angle = Math.round(def.calc(raw))
    results.push({
      label:     def.label,
      angle,
      direction: def.direction(angle),
      joints:    def.joints,
    })
  }
  return results
}

/** Canvas にマーカーと角度を描画 */
export function drawMarkers(
  ctx: CanvasRenderingContext2D,
  detected: DetectedMarker[],
  angles: MarkerAngle[],
  W: number,
  H: number,
) {
  const map = new Map(detected.map((d) => [d.joint, d]))

  // ── 接続線を先に描く ──
  ctx.save()
  ctx.lineWidth = 2.5
  ctx.setLineDash([6, 4])
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  for (const ang of angles) {
    const [j0, j1, j2] = ang.joints
    const m0 = map.get(j0), m1 = map.get(j1), m2 = map.get(j2)
    if (!m0 || !m1 || !m2) continue
    ctx.beginPath()
    ctx.moveTo(m0.pixelX, m0.pixelY)
    ctx.lineTo(m1.pixelX, m1.pixelY)
    ctx.lineTo(m2.pixelX, m2.pixelY)
    ctx.stroke()
  }
  ctx.setLineDash([])

  // ── マーカー円 ──
  for (const m of detected) {
    // 外側リング
    ctx.beginPath()
    ctx.arc(m.pixelX, m.pixelY, 14, 0, Math.PI * 2)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.stroke()
    // 塗りつぶし
    ctx.beginPath()
    ctx.arc(m.pixelX, m.pixelY, 12, 0, Math.PI * 2)
    ctx.fillStyle = m.cssColor + 'cc'
    ctx.fill()
    // ラベル
    ctx.font = 'bold 11px sans-serif'
    ctx.fillStyle = '#000'
    ctx.fillText(m.label, m.pixelX - ctx.measureText(m.label).width / 2, m.pixelY + 4)
  }

  // ── 角度ラベル（頂点関節の横） ──
  for (const ang of angles) {
    const m1 = map.get(ang.joints[1])
    if (!m1) continue
    const x = m1.pixelX + 18, y = m1.pixelY - 6
    ctx.font = 'bold 13px sans-serif'
    // 背景
    const tw = ctx.measureText(ang.direction).width
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.fillRect(x - 3, y - 14, tw + 6, 20)
    // テキスト
    ctx.fillStyle = '#fff'
    ctx.fillText(ang.direction, x, y)
  }

  ctx.restore()
}
