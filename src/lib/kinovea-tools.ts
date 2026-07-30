/**
 * Kinovea 風 動画計測ツールのコアロジック
 *
 * - 距離キャリブレーション（既知長の線分から px→cm 変換係数を算出）
 * - 距離計測
 * - ストップウォッチ（動画時間に連動した区間計時）
 * - ポイント自動追跡（ZNCC 二重テンプレートマッチング＋サブピクセル推定）
 * - 速度算出（最小二乗回帰によるノイズ耐性つき）
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

export interface TrajPoint {
  t: number
  p: NormPoint
  /** 追跡信頼度 0-1（手動点・不明時は undefined） */
  conf?: number
}

/** 動画ピクセル空間での2点間距離 (px) */
export function pixelDistance(p1: NormPoint, p2: NormPoint, videoW: number, videoH: number): number {
  const dx = (p1.x - p2.x) * videoW
  const dy = (p1.y - p2.y) * videoH
  return Math.sqrt(dx * dx + dy * dy)
}

/** cm/px 変換係数（未校正なら null） */
export function cmPerPx(calib: Calibration | null, videoW: number, videoH: number): number | null {
  if (!calib || videoW <= 0 || videoH <= 0) return null
  const calibPx = pixelDistance(calib.a, calib.b, videoW, videoH)
  if (calibPx < 1) return null
  return calib.lengthCm / calibPx
}

/** キャリブレーション済みなら cm 距離、未校正なら null */
export function distanceCm(
  p1: NormPoint, p2: NormPoint,
  calib: Calibration | null,
  videoW: number, videoH: number,
): number | null {
  const scale = cmPerPx(calib, videoW, videoH)
  if (scale === null) return null
  return pixelDistance(p1, p2, videoW, videoH) * scale
}

/**
 * 軌跡末尾の時間窓に対する最小二乗回帰で瞬間速度を算出する。
 * 2点差分より計測ノイズに強い。
 * @returns cm/s（未校正または点不足なら null）
 */
export function trajectorySpeedCmPerSec(
  traj: TrajPoint[],
  calib: Calibration | null,
  videoW: number, videoH: number,
  windowSec = 0.25,
): number | null {
  const scale = cmPerPx(calib, videoW, videoH)
  if (scale === null || traj.length < 2) return null

  const last = traj[traj.length - 1]
  // 時間窓内の点を収集（最大30点）
  const pts: TrajPoint[] = []
  for (let i = traj.length - 1; i >= 0 && pts.length < 30; i--) {
    if (last.t - traj[i].t > windowSec) break
    pts.push(traj[i])
  }
  if (pts.length < 2) return null

  const span = pts[0].t - pts[pts.length - 1].t
  if (span < 0.02) return null

  // x(t), y(t) それぞれの回帰勾配 (cm/s)
  const n = pts.length
  let st = 0, sx = 0, sy = 0, stt = 0, stx = 0, sty = 0
  for (const pt of pts) {
    const t = pt.t - last.t  // 数値安定化のため末尾基準
    const x = pt.p.x * videoW * scale
    const y = pt.p.y * videoH * scale
    st += t; sx += x; sy += y
    stt += t * t; stx += t * x; sty += t * y
  }
  const denom = n * stt - st * st
  if (Math.abs(denom) < 1e-9) return null
  const vx = (n * stx - st * sx) / denom
  const vy = (n * sty - st * sy) / denom
  return Math.hypot(vx, vy)
}

/** 経過時間を "m:ss.cc" 形式に整形 */
export function formatElapsed(sec: number): string {
  const s  = Math.max(0, sec)
  const m  = Math.floor(s / 60)
  const ss = Math.floor(s % 60)
  const cc = Math.floor((s % 1) * 100)
  return `${m}:${String(ss).padStart(2, '0')}.${String(cc).padStart(2, '0')}`
}

// ── ポイント自動追跡（ZNCC 二重テンプレート＋サブピクセル） ──────────────────
//
// 設計:
//  - ZNCC (zero-mean normalized cross correlation): 照明・コントラスト変化に不変
//  - 二重テンプレート: 初期テンプレート(ドリフト防止) + 適応テンプレート(外観変化追従)
//  - 速度予測: 直前の移動速度で探索中心を予測し、高速移動・一時遮蔽に対応
//  - サブピクセル: スコア面の放物線フィットで 1px 未満の精度を出す
//  - 信頼度: ベストスコアを 0-1 で公開。閾値未満はコースト（予測位置で滑走）
//  - 特徴のない一様パッチでは SAD + 中心優先ペナルティにフォールバック

const PATCH  = 21    // テンプレート一辺 (px, 奇数)
const SEARCH = 20    // 探索半径 (px)
const CONF_MOVE  = 0.40  // これ未満の信頼度ではマッチ位置を採用せずコースト
// 適応は位置を採用したフレームすべてで実施（更新率は信頼度に比例）。
// 「位置は採用するが学習しない」帯域を作ると、回転などの連続的な
// 外観変化でテンプレートが取り残され追跡が必ず破綻する。

export class PointTracker {
  private canvas: HTMLCanvasElement | null = null
  private ctx:    CanvasRenderingContext2D | null = null

  private tmpl0raw: Float32Array | null = null  // 初期テンプレート(raw)
  private tmpl0n:   Float32Array | null = null  // 初期テンプレート(正規化, 一様なら null)
  private tmplAn:   Float32Array | null = null  // 適応テンプレート(正規化)

  private posX = 0                // 現在位置 (動画px, float)
  private posY = 0
  private velX = 0                // 速度 (px/s)
  private velY = 0
  private lastT: number | null = null

  /** 直近の追跡信頼度 0-1 */
  lastConfidence = 1
  /** 直近フレームがコースト（マッチ失敗で予測位置を採用）だったか */
  lastCoasting = false
  /** デバッグ用: 直近フレームの内部状態 */
  lastDebug: { ncc0: number; nccA: number; fallback: boolean; snap: number } | null = null

  // ── 内部ヘルパー ──────────────────────────────────────────────────────────

  /** 動画フレームの指定領域をグレースケール Float32Array で取得 */
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

  /** 正規化済みベクトル同士の内積（= ZNCC 値） */
  private static dot(a: Float32Array, b: Float32Array): number {
    let s = 0
    for (let i = 0; i < a.length; i++) s += a[i] * b[i]
    return s
  }

  /** パッチを中心まわりに回転させたコピーを返す（バイリニア補間・境界クランプ） */
  private static rotatePatch(src: Float32Array, deg: number): Float32Array {
    const c = (PATCH - 1) / 2
    const rad = (deg * Math.PI) / 180
    const cos = Math.cos(rad), sin = Math.sin(rad)
    const out = new Float32Array(PATCH * PATCH)
    for (let y = 0; y < PATCH; y++) {
      for (let x = 0; x < PATCH; x++) {
        // 出力座標を逆回転させて元パッチからサンプル
        const dx = x - c, dy = y - c
        const sx = Math.min(Math.max(c + dx * cos + dy * sin, 0), PATCH - 1)
        const sy = Math.min(Math.max(c - dx * sin + dy * cos, 0), PATCH - 1)
        const x0 = Math.floor(sx), y0 = Math.floor(sy)
        const x1 = Math.min(x0 + 1, PATCH - 1), y1 = Math.min(y0 + 1, PATCH - 1)
        const fx = sx - x0, fy = sy - y0
        out[y * PATCH + x] =
          src[y0 * PATCH + x0] * (1 - fx) * (1 - fy) +
          src[y0 * PATCH + x1] * fx * (1 - fy) +
          src[y1 * PATCH + x0] * (1 - fx) * fy +
          src[y1 * PATCH + x1] * fx * fy
      }
    }
    return out
  }

  /** 探索領域から (ox, oy) 位置のパッチを抽出 */
  private static extractPatch(region: Float32Array, rw: number, ox: number, oy: number): Float32Array {
    const out = new Float32Array(PATCH * PATCH)
    for (let ty = 0; ty < PATCH; ty++) {
      for (let tx = 0; tx < PATCH; tx++) {
        out[ty * PATCH + tx] = region[(oy + ty) * rw + ox + tx]
      }
    }
    return out
  }

  /**
   * ゼロ平均・単位ノルム正規化。
   * @param minNorm 一様判定の閾値。生画素(0-255)のパッチは 1.0、
   *                正規化済みベクトルのブレンド・回転の再正規化は 1e-4 を使う
   *                （単位ベクトル同士のブレンドはノルムが必ず 1 以下になるため、
   *                 生画素用の閾値を流用すると常に棄却され適応が死ぬ）。
   */
  private static normalize(raw: Float32Array, minNorm = 1.0): Float32Array | null {
    const n = raw.length
    let mean = 0
    for (let i = 0; i < n; i++) mean += raw[i]
    mean /= n
    let norm = 0
    const out = new Float32Array(n)
    for (let i = 0; i < n; i++) { out[i] = raw[i] - mean; norm += out[i] * out[i] }
    norm = Math.sqrt(norm)
    if (norm < minNorm) return null  // 特徴なし（一様領域）
    for (let i = 0; i < n; i++) out[i] /= norm
    return out
  }

  // ── 公開 API ─────────────────────────────────────────────────────────────

  /** 追跡開始点でテンプレートを初期化する */
  init(video: HTMLVideoElement, p: NormPoint): boolean {
    const vw = video.videoWidth, vh = video.videoHeight
    if (vw <= 0 || vh <= 0) return false
    const half = (PATCH - 1) / 2
    this.posX = Math.min(Math.max(p.x * vw, half), vw - half - 1)
    this.posY = Math.min(Math.max(p.y * vh, half), vh - half - 1)
    this.velX = 0; this.velY = 0
    this.lastT = null
    this.lastConfidence = 1
    this.lastCoasting = false

    const raw = this.grabRegion(
      video,
      Math.round(this.posX) - half, Math.round(this.posY) - half,
      PATCH, PATCH,
    )
    if (!raw) return false
    this.tmpl0raw = raw
    this.tmpl0n = PointTracker.normalize(raw)
    this.tmplAn = this.tmpl0n ? new Float32Array(this.tmpl0n) : null
    return true
  }

  reset(): void {
    this.tmpl0raw = null
    this.tmpl0n = null
    this.tmplAn = null
    this.lastT = null
  }

  /**
   * 現フレームで予測位置周辺を探索し、新しい位置を返す。
   * @param tSec 動画の現在時刻（省略時は 1/30s 間隔とみなす）
   */
  track(video: HTMLVideoElement, _prev: NormPoint, tSec?: number): NormPoint {
    const vw = video.videoWidth, vh = video.videoHeight
    if (!this.tmpl0raw || vw <= 0 || vh <= 0) return _prev

    const half = (PATCH - 1) / 2
    const dt = (tSec !== undefined && this.lastT !== null)
      ? Math.max(tSec - this.lastT, 0.001)
      : 1 / 30

    // 速度予測で探索中心を決める
    const predX = this.posX + this.velX * dt
    const predY = this.posY + this.velY * dt

    // 探索領域をフレーム内にクランプ
    const rw = PATCH + SEARCH * 2
    const rh = rw
    const rx0 = Math.round(Math.min(Math.max(predX - half - SEARCH, 0), vw - rw))
    const ry0 = Math.round(Math.min(Math.max(predY - half - SEARCH, 0), vh - rh))

    const region = this.grabRegion(video, rx0, ry0, rw, rh)
    if (!region) return this.toNorm(vw, vh)

    const nOffsets = SEARCH * 2 + 1
    const scores  = new Float32Array(nOffsets * nOffsets).fill(-2)  // 複合スコア面
    const scoresA = new Float32Array(nOffsets * nOffsets).fill(-2)  // 適応単独スコア面

    let bestScore = -2
    let bestOx = SEARCH, bestOy = SEARCH
    let bestScoreA = -2
    let bestAOx = SEARCH, bestAOy = SEARCH

    if (this.tmpl0n) {
      // ── ZNCC 経路（積分画像で窓統計を O(1) 化） ──
      const iw = rw + 1
      const intS = new Float64Array(iw * (rh + 1))
      const intQ = new Float64Array(iw * (rh + 1))
      for (let y = 0; y < rh; y++) {
        let rowS = 0, rowQ = 0
        for (let x = 0; x < rw; x++) {
          const v = region[y * rw + x]
          rowS += v; rowQ += v * v
          intS[(y + 1) * iw + x + 1] = intS[y * iw + x + 1] + rowS
          intQ[(y + 1) * iw + x + 1] = intQ[y * iw + x + 1] + rowQ
        }
      }
      const N = PATCH * PATCH
      const t0 = this.tmpl0n
      const tA = this.tmplAn ?? this.tmpl0n

      // 1オフセットの ZNCC 評価（計算済みならスキップ）
      const evalOffset = (ox: number, oy: number) => {
        const idx = oy * nOffsets + ox
        if (scores[idx] > -2) return
        const x1 = ox, y1 = oy, x2 = ox + PATCH, y2 = oy + PATCH
        const sumS = intS[y2 * iw + x2] - intS[y1 * iw + x2] - intS[y2 * iw + x1] + intS[y1 * iw + x1]
        const sumQ = intQ[y2 * iw + x2] - intQ[y1 * iw + x2] - intQ[y2 * iw + x1] + intQ[y1 * iw + x1]
        const varTerm = sumQ - (sumS * sumS) / N
        if (varTerm < 1.0) { scores[idx] = -1.9; scoresA[idx] = -1.9; return }  // 一様窓
        const invDenom = 1 / Math.sqrt(varTerm)

        // 正規化テンプレートとの内積（Σtn=0 なので窓平均の引き算は不要）
        let dot0 = 0, dotA = 0
        for (let ty = 0; ty < PATCH; ty++) {
          const rowR = (oy + ty) * rw + ox
          const rowT = ty * PATCH
          for (let tx = 0; tx < PATCH; tx++) {
            const w = region[rowR + tx]
            dot0 += t0[rowT + tx] * w
            dotA += tA[rowT + tx] * w
          }
        }
        // 初期テンプレート4割＋適応6割: ドリフト抑制と外観追従のバランス
        const score = (0.4 * dot0 + 0.6 * dotA) * invDenom
        const scoreA = dotA * invDenom
        scores[idx]  = score
        scoresA[idx] = scoreA
        if (score > bestScore)   { bestScore = score;   bestOx = ox;  bestOy = oy }
        if (scoreA > bestScoreA) { bestScoreA = scoreA; bestAOx = ox; bestAOy = oy }
      }

      // ── 粗探索（2px 刻み）→ ベスト周辺の精密化の2段階で約3倍高速化 ──
      for (let oy = 0; oy < nOffsets; oy += 2) {
        for (let ox = 0; ox < nOffsets; ox += 2) evalOffset(ox, oy)
      }
      const refine = (cx: number, cy: number) => {
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const x = cx + dx, y = cy + dy
            if (x >= 0 && x < nOffsets && y >= 0 && y < nOffsets) evalOffset(x, y)
          }
        }
      }
      // 2回精密化: 1回目でピークが移動した場合も近傍を埋める
      refine(bestOx, bestOy); refine(bestAOx, bestAOy)
      refine(bestOx, bestOy); refine(bestAOx, bestAOy)
    } else {
      // ── SAD フォールバック（一様テンプレート: 中心優先ペナルティ付き） ──
      const t0 = this.tmpl0raw
      const N = PATCH * PATCH
      const evalOffset = (ox: number, oy: number) => {
        const idx = oy * nOffsets + ox
        if (scores[idx] > -2) return
        let sad = 0
        for (let ty = 0; ty < PATCH; ty++) {
          const rowR = (oy + ty) * rw + ox
          const rowT = ty * PATCH
          for (let tx = 0; tx < PATCH; tx++) {
            sad += Math.abs(region[rowR + tx] - t0[rowT + tx])
          }
        }
        const dxc = ox - SEARCH, dyc = oy - SEARCH
        const score = 1 - sad / (255 * N) - 0.00005 * (dxc * dxc + dyc * dyc)
        scores[idx] = score
        if (score > bestScore) { bestScore = score; bestOx = ox; bestOy = oy }
      }
      for (let oy = 0; oy < nOffsets; oy += 2) {
        for (let ox = 0; ox < nOffsets; ox += 2) evalOffset(ox, oy)
      }
      const refine = (cx: number, cy: number) => {
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const x = cx + dx, y = cy + dy
            if (x >= 0 && x < nOffsets && y >= 0 && y < nOffsets) evalOffset(x, y)
          }
        }
      }
      refine(bestOx, bestOy); refine(bestOx, bestOy)
    }

    // ── 採用スコアの決定 ──────────────────────────────────────────────
    // 通常: 複合スコア（初期テンプレートがドリフトを抑える）
    // 複合が弱く適応単独が強い場合: 回転・変形などで初期テンプレートが
    // 無効化されたとみなし、適応テンプレート単独のピークへフォールバック
    let useSurface = scores
    let useOx = bestOx, useOy = bestOy
    let useScore = bestScore
    if (bestScore < 0.55 && bestScoreA >= 0.50 && bestScoreA > bestScore) {
      useSurface = scoresA
      useOx = bestAOx; useOy = bestAOy
      useScore = bestScoreA
    }

    const conf = Math.max(0, Math.min(1, useScore))
    this.lastConfidence = conf

    let newX: number, newY: number
    if (conf >= CONF_MOVE) {
      // ── サブピクセル推定（スコア面の放物線フィット） ──
      let subX = 0, subY = 0
      const idx = useOy * nOffsets + useOx
      if (useOx > 0 && useOx < nOffsets - 1) {
        const l = useSurface[idx - 1], c = useSurface[idx], r = useSurface[idx + 1]
        if (l > -2 && r > -2) {
          const denom = l - 2 * c + r
          if (Math.abs(denom) > 1e-9) subX = Math.max(-0.5, Math.min(0.5, 0.5 * (l - r) / denom))
        }
      }
      if (useOy > 0 && useOy < nOffsets - 1) {
        const u = useSurface[idx - nOffsets], c = useSurface[idx], d = useSurface[idx + nOffsets]
        if (u > -2 && d > -2) {
          const denom = u - 2 * c + d
          if (Math.abs(denom) > 1e-9) subY = Math.max(-0.5, Math.min(0.5, 0.5 * (u - d) / denom))
        }
      }

      newX = rx0 + useOx + half + subX
      newY = ry0 + useOy + half + subY
      this.lastCoasting = false

      // 速度更新（EMA）
      const instVx = (newX - this.posX) / dt
      const instVy = (newY - this.posY) / dt
      this.velX = 0.7 * this.velX + 0.3 * instVx
      this.velY = 0.7 * this.velY + 0.3 * instVy

      // ── 適応テンプレート更新（採用フレームすべてで実施） ──
      if (this.tmpl0n && this.tmplAn) {
        const winN = PointTracker.normalize(
          PointTracker.extractPatch(region, rw, useOx, useOy),
        )
        if (winN) {
          this.lastDebug = {
            ncc0: Math.round(PointTracker.dot(this.tmpl0n, winN) * 100) / 100,
            nccA: Math.round(PointTracker.dot(this.tmplAn, winN) * 100) / 100,
            fallback: useSurface === scoresA,
            snap: 0,
          }
          // 回転スナップ: 信頼度が下がってきたら適応テンプレートの回転版を試し、
          // 観測に最も合う向きへ張り替える（連続回転への追従）
          if (conf < 0.85) {
            let bestVar: Float32Array | null = null
            let bestDeg = 0
            let bestC = PointTracker.dot(this.tmplAn, winN) + 0.02
            for (const deg of [-12, -6, 6, 12]) {
              const rotN = PointTracker.normalize(PointTracker.rotatePatch(this.tmplAn, deg), 1e-4)
              if (!rotN) continue
              const c = PointTracker.dot(rotN, winN)
              if (c > bestC) { bestC = c; bestVar = rotN; bestDeg = deg }
            }
            if (bestVar) { this.tmplAn = bestVar; if (this.lastDebug) this.lastDebug.snap = bestDeg }
          }

          // 信頼度に比例したブレンド率で観測を取り込む
          // （高信頼: 素早く追従 / 低信頼: 汚染を抑えて緩やかに）
          const alpha = 0.35 * conf
          const blended = new Float32Array(winN.length)
          for (let i = 0; i < winN.length; i++) {
            blended[i] = (1 - alpha) * this.tmplAn[i] + alpha * winN[i]
          }
          this.tmplAn = PointTracker.normalize(blended, 1e-4) ?? this.tmplAn
        }
      }
    } else {
      // ── コースト: マッチ失敗（遮蔽など）→ 予測位置で滑走し速度を減衰 ──
      newX = predX
      newY = predY
      this.velX *= 0.85
      this.velY *= 0.85
      this.lastCoasting = true
    }

    this.posX = Math.min(Math.max(newX, 0), vw - 1)
    this.posY = Math.min(Math.max(newY, 0), vh - 1)
    if (tSec !== undefined) this.lastT = tSec

    return this.toNorm(vw, vh)
  }

  private toNorm(vw: number, vh: number): NormPoint {
    return { x: this.posX / vw, y: this.posY / vh }
  }
}
