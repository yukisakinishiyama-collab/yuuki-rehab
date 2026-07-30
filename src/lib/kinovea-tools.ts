/**
 * Kinovea 風 動画計測ツールのコアロジック
 *
 * - 距離キャリブレーション（既知長の線分から px→cm 変換係数を算出）
 * - 距離計測
 * - ストップウォッチ（動画時間に連動した区間計時）
 * - ポイント自動追跡（SAD テンプレートマッチング）と速度算出
 *
 * 座標系:
 *   NormPoint は「動画コンテンツ領域内の正規化座標 (0-1)」。
 *   object-contain のレターボックスに依存しないよう、表示要素座標との
 *   変換は getContentRect / elementToContent / contentToElement で行う。
 */

export interface NormPoint { x: number; y: number }

/** 表示要素内で実際に動画が描画されている矩形（レターボックス除外） */
export interface ContentRect { left: number; top: number; width: number; height: number }

export function getContentRect(elW: number, elH: number, videoW: number, videoH: number): ContentRect {
  if (elW <= 0 || elH <= 0 || videoW <= 0 || videoH <= 0) {
    return { left: 0, top: 0, width: elW, height: elH }
  }
  const elAspect = elW / elH
  const vAspect  = videoW / videoH
  if (vAspect > elAspect) {
    // 上下にレターボックス
    const h = elW / vAspect
    return { left: 0, top: (elH - h) / 2, width: elW, height: h }
  }
  // 左右にレターボックス
  const w = elH * vAspect
  return { left: (elW - w) / 2, top: 0, width: w, height: elH }
}

/** 要素座標 → コンテンツ正規化座標（動画外なら null） */
export function elementToContent(px: number, py: number, rect: ContentRect): NormPoint | null {
  if (rect.width <= 0 || rect.height <= 0) return null
  const x = (px - rect.left) / rect.width
  const y = (py - rect.top)  / rect.height
  if (x < 0 || x > 1 || y < 0 || y > 1) return null
  return { x, y }
}

/** コンテンツ正規化座標 → 要素座標 */
export function contentToElement(p: NormPoint, rect: ContentRect): { x: number; y: number } {
  return { x: rect.left + p.x * rect.width, y: rect.top + p.y * rect.height }
}

// ── キャリブレーション・距離 ────────────────────────────────────────────────

export interface Calibration {
  a: NormPoint
  b: NormPoint
  lengthCm: number
}

export interface DistanceMeasure {
  id: string
  a: NormPoint
  b: NormPoint
}

export interface StopwatchState {
  startT: number
  endT:   number | null
  /** 表示ボックスの位置（コンテンツ正規化座標） */
  pos:    NormPoint
}

export interface TrajPoint { t: number; p: NormPoint }

/** 動画ピクセル空間での2点間距離 (px) */
export function pixelDistance(p1: NormPoint, p2: NormPoint, videoW: number, videoH: number): number {
  const dx = (p1.x - p2.x) * videoW
  const dy = (p1.y - p2.y) * videoH
  return Math.sqrt(dx * dx + dy * dy)
}

/** キャリブレーション済みなら cm 距離、未校正なら null */
export function distanceCm(
  p1: NormPoint, p2: NormPoint,
  calib: Calibration | null,
  videoW: number, videoH: number,
): number | null {
  if (!calib || videoW <= 0 || videoH <= 0) return null
  const calibPx = pixelDistance(calib.a, calib.b, videoW, videoH)
  if (calibPx < 1) return null
  const scale = calib.lengthCm / calibPx  // cm per px
  return pixelDistance(p1, p2, videoW, videoH) * scale
}

/**
 * 軌跡の末尾区間から瞬間速度を算出する
 * @returns cm/s（未校正または点不足なら null）
 */
export function trajectorySpeedCmPerSec(
  traj: TrajPoint[],
  calib: Calibration | null,
  videoW: number, videoH: number,
  minWindowSec = 0.15,
): number | null {
  if (!calib || traj.length < 2) return null
  const last = traj[traj.length - 1]
  // minWindowSec 以上離れた過去の点を探す（ノイズ低減）
  let ref: TrajPoint | null = null
  for (let i = traj.length - 2; i >= 0; i--) {
    if (last.t - traj[i].t >= minWindowSec) { ref = traj[i]; break }
  }
  if (!ref) ref = traj[traj.length - 2]
  const dt = last.t - ref.t
  if (dt <= 0.001) return null
  const cm = distanceCm(last.p, ref.p, calib, videoW, videoH)
  if (cm === null) return null
  return cm / dt
}

/** 経過時間を "m:ss.cc" 形式に整形 */
export function formatElapsed(sec: number): string {
  const s  = Math.max(0, sec)
  const m  = Math.floor(s / 60)
  const ss = Math.floor(s % 60)
  const cc = Math.floor((s % 1) * 100)
  return `${m}:${String(ss).padStart(2, '0')}.${String(cc).padStart(2, '0')}`
}

// ── ポイント自動追跡（SAD テンプレートマッチング） ──────────────────────────

const PATCH  = 21  // テンプレートの一辺 (px, 奇数)
const SEARCH = 18  // 探索半径 (px)

export class PointTracker {
  private canvas:   HTMLCanvasElement | null = null
  private ctx:      CanvasRenderingContext2D | null = null
  private template: Float32Array | null = null

  /** 動画フレームの指定領域をグレースケールで取得する */
  private grabRegion(
    video: HTMLVideoElement,
    x0: number, y0: number, w: number, h: number,
  ): Float32Array | null {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas')
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })
    }
    if (!this.ctx) return null
    if (this.canvas.width < w || this.canvas.height < h) {
      this.canvas.width = w; this.canvas.height = h
    }
    try {
      this.ctx.drawImage(video, x0, y0, w, h, 0, 0, w, h)
      const img = this.ctx.getImageData(0, 0, w, h).data
      const gray = new Float32Array(w * h)
      for (let i = 0; i < w * h; i++) {
        gray[i] = img[i * 4] * 0.299 + img[i * 4 + 1] * 0.587 + img[i * 4 + 2] * 0.114
      }
      return gray
    } catch {
      return null  // CORS 汚染や未ロード時
    }
  }

  /** 追跡開始点でテンプレートを初期化する */
  init(video: HTMLVideoElement, p: NormPoint): boolean {
    const vw = video.videoWidth, vh = video.videoHeight
    if (vw <= 0 || vh <= 0) return false
    const half = Math.floor(PATCH / 2)
    const cx = Math.round(Math.min(Math.max(p.x * vw, half), vw - half - 1))
    const cy = Math.round(Math.min(Math.max(p.y * vh, half), vh - half - 1))
    this.template = this.grabRegion(video, cx - half, cy - half, PATCH, PATCH)
    return this.template !== null
  }

  reset(): void {
    this.template = null
  }

  /**
   * 現フレームで前回位置周辺を探索し、新しい位置を返す。
   * マッチング失敗時は前回位置をそのまま返す。
   */
  track(video: HTMLVideoElement, prev: NormPoint): NormPoint {
    const vw = video.videoWidth, vh = video.videoHeight
    if (!this.template || vw <= 0 || vh <= 0) return prev

    const half = Math.floor(PATCH / 2)
    const cx = Math.round(Math.min(Math.max(prev.x * vw, half + SEARCH), vw - half - SEARCH - 1))
    const cy = Math.round(Math.min(Math.max(prev.y * vh, half + SEARCH), vh - half - SEARCH - 1))

    const rw = PATCH + SEARCH * 2
    const rh = PATCH + SEARCH * 2
    const region = this.grabRegion(video, cx - half - SEARCH, cy - half - SEARCH, rw, rh)
    if (!region) return prev

    let bestScore = Infinity
    let bestDx = 0, bestDy = 0
    for (let dy = 0; dy <= SEARCH * 2; dy++) {
      for (let dx = 0; dx <= SEARCH * 2; dx++) {
        const ox = dx - SEARCH, oy = dy - SEARCH
        // 一様領域での同点時は移動量最小を優先（微小ペナルティ）
        let score = (ox * ox + oy * oy) * 0.5
        for (let ty = 0; ty < PATCH; ty++) {
          const rowR = (dy + ty) * rw + dx
          const rowT = ty * PATCH
          for (let tx = 0; tx < PATCH; tx++) {
            score += Math.abs(region[rowR + tx] - this.template[rowT + tx])
          }
          if (score >= bestScore) break  // 早期打ち切り
        }
        if (score < bestScore) { bestScore = score; bestDx = ox; bestDy = oy }
      }
    }

    const nx = cx + bestDx
    const ny = cy + bestDy

    // テンプレートを新位置のパッチで更新（外観変化に追従）
    const newTmpl = this.grabRegion(video, nx - half, ny - half, PATCH, PATCH)
    if (newTmpl) this.template = newTmpl

    return { x: nx / vw, y: ny / vh }
  }
}
