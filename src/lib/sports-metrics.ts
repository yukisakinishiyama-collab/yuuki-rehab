/**
 * スポーツパフォーマンス指標計算モジュール
 *
 * TrackedPerson の時系列データから以下を算出する:
 *  - スピード・加速度（重心変位 / 経過時間）
 *  - ジャンプ検出・滞空時間・推定跳躍高さ（h = g × T² / 8）
 *  - 左右非対称スコア（ROM項目の左右差）
 *  - 疲労兆候（動画後半での非対称性増大を検出）
 */
import { calcROMItems } from './pose-analyzer'
import type { Landmark } from './pose-analyzer'
import type { TrackedPerson } from './multi-tracker'

// ── 定数 ────────────────────────────────────────────────────────────────────

const G = 9.81                  // 重力加速度 (m/s²)
const JUMP_THRESHOLD    = 0.045  // ジャンプ判定閾値（正規化座標: 小さい値=上方）
const BASELINE_FRAMES   = 25     // 立位ベースライン確立に使うフレーム数
const MIN_JUMP_DURATION = 0.12   // ノイズ除外: 0.12 秒未満のジャンプは無視
const SPEED_SCALE       = 8.0    // 正規化座標/秒 → 表示スピード係数

/** 左右対称ペア（左キー, 右キー, 表示ラベル） */
const SYMMETRY_PAIRS: [string, string, string][] = [
  ['L_KneeFlexion', 'R_KneeFlexion', '膝屈曲'],
  ['L_HipFlexion',  'R_HipFlexion',  '股関節屈曲'],
  ['L_AnkleDorsi',  'R_AnkleDorsi',  '足首'],
  ['L_KneeAlign',   'R_KneeAlign',   '膝アライメント'],
  ['L_HipAbduct',   'R_HipAbduct',   '股関節外転'],
]

// ── 型定義 ──────────────────────────────────────────────────────────────────

export interface SpeedSample {
  /** タイムスタンプ（秒） */
  t: number
  /** 相対スピード（正規化座標/秒 × スケール係数） */
  speed: number
  /** 加速度（speed の変化率） */
  acceleration: number
}

export interface JumpEvent {
  /** 離陸タイムスタンプ（秒） */
  startT: number
  /** 着地タイムスタンプ（秒） */
  endT: number
  /** 滞空時間（秒） */
  airTimeSec: number
  /**
   * 推定跳躍高さ（cm）
   * 対称ジャンプ仮定: h = g × T² / 8  （T = 総滞空時間）
   */
  heightCm: number
}

export interface FormSample {
  t: number
  /** 全体的な左右差（度）= 対称ペアの差の平均 */
  asymmetryDeg: number
  /** 関節別の左右差（表示ラベル → 度） */
  perJoint: Record<string, number>
}

/** 1人分のパフォーマンス計算済み指標（UI表示用） */
export interface PersonMetrics {
  personId: number
  color: string
  // ── スピード ──────────────────────
  speedHistory: SpeedSample[]
  currentSpeed: number
  peakSpeed: number
  avgSpeed: number
  // ── ジャンプ ──────────────────────
  jumpEvents: JumpEvent[]
  jumpCount: number
  avgJumpHeightCm: number
  maxJumpHeightCm: number
  // ── フォーム（左右差） ────────────
  formHistory: FormSample[]
  currentAsymmetryDeg: number
  avgAsymmetryDeg: number
  perJointAsymmetry: Record<string, number>  // ラベル → 平均差（度）
  // ── 疲労 ──────────────────────────
  fatigueScore: number     // 0（良好）〜 100（高疲労）
  fatigueLabel: '良好' | '注意' | '要休息'
}

// ── 内部型 ──────────────────────────────────────────────────────────────────

interface PersonHistory {
  personId: number
  color: string
  centroidHistory: { t: number; x: number; y: number }[]
  ankleHistory:    { t: number; leftY: number; rightY: number }[]
  formHistory:     FormSample[]
  /** 立位時の平均アンクルY（画像Y座標: 大きい値=下） */
  baselineAnkleY:  number | null
  baselineCount:   number
}

// ── モジュール内部状態 ───────────────────────────────────────────────────────
const _histories = new Map<number, PersonHistory>()

// ── ヘルパー ────────────────────────────────────────────────────────────────

/** ランドマーク配列から撮影方向を簡易推定 */
function inferSide(lm: Landmark[]): 'front' | 'side' | 'unknown' {
  const ls = lm[11], rs = lm[12], lh = lm[23], rh = lm[24]
  if (!ls || !rs || !lh || !rh) return 'unknown'
  const sw = Math.abs(ls.x - rs.x)
  const hw = Math.abs(lh.x - rh.x)
  return sw > 0.12 || hw > 0.10 ? 'front' : 'side'
}

/** ジャンプイベントをアンクル履歴から検出 */
function detectJumps(hist: PersonHistory): JumpEvent[] {
  if (hist.baselineAnkleY === null || hist.ankleHistory.length < 10) return []

  // 画像座標系ではY小=上方。ジャンプ中はアンクルYがベースラインより小さくなる
  const threshold = hist.baselineAnkleY - JUMP_THRESHOLD
  const events: JumpEvent[] = []
  let jumpStart: number | null = null

  for (const { t, leftY, rightY } of hist.ankleHistory) {
    const airborne = leftY < threshold && rightY < threshold
    if (airborne && jumpStart === null) {
      jumpStart = t
    } else if (!airborne && jumpStart !== null) {
      const airTimeSec = t - jumpStart
      if (airTimeSec >= MIN_JUMP_DURATION) {
        events.push({
          startT:     jumpStart,
          endT:       t,
          airTimeSec: Math.round(airTimeSec * 1000) / 1000,
          heightCm:   Math.round((G * airTimeSec * airTimeSec / 8) * 100),
        })
      }
      jumpStart = null
    }
  }

  return events
}

/** 重心変位からスピード・加速度を計算 */
function computeSpeed(hist: PersonHistory): SpeedSample[] {
  const ch = hist.centroidHistory
  if (ch.length < 2) return []

  const samples: SpeedSample[] = []
  let prevSpeed = 0

  for (let i = 1; i < ch.length; i++) {
    const dt = ch[i].t - ch[i - 1].t
    if (dt <= 0) continue
    const dx = ch[i].x - ch[i - 1].x
    const dy = ch[i].y - ch[i - 1].y
    const speed = (Math.hypot(dx, dy) / dt) * SPEED_SCALE
    const accel = (speed - prevSpeed) / dt
    samples.push({ t: ch[i].t, speed: Math.round(speed * 100) / 100, acceleration: Math.round(accel * 100) / 100 })
    prevSpeed = speed
  }

  return samples
}

/** 疲労スコアを計算: 後半での非対称性増大 → 疲労指数 */
function computeFatigue(hist: PersonHistory): number {
  const fh = hist.formHistory
  if (fh.length < 20) return 0

  const n = fh.length
  const early = fh.slice(0, Math.floor(n * 0.30))
  const late  = fh.slice(Math.floor(n * 0.70))

  const avgAsym = (arr: FormSample[]) =>
    arr.reduce((s, f) => s + f.asymmetryDeg, 0) / arr.length

  const earlyAsym = avgAsym(early)
  const lateAsym  = avgAsym(late)

  // 5度差 → スコア50 の線形スケール
  const delta = lateAsym - earlyAsym
  return Math.max(0, Math.min(100, Math.round(delta * 10)))
}

// ── パブリック API ───────────────────────────────────────────────────────────

/**
 * 1フレームの追跡結果を履歴に記録する
 * @param persons updateTracks() の返り値
 * @param t 動画の現在時刻（秒）
 */
export function recordFrame(persons: TrackedPerson[], t: number): void {
  for (const person of persons) {
    // ロスト中の人物はスキップ
    if (person.lostFrames > 0) continue

    if (!_histories.has(person.id)) {
      _histories.set(person.id, {
        personId:       person.id,
        color:          person.color,
        centroidHistory: [],
        ankleHistory:   [],
        formHistory:    [],
        baselineAnkleY: null,
        baselineCount:  0,
      })
    }

    const hist = _histories.get(person.id)!
    const lm   = person.landmarks
    const wl   = person.worldLandmarks

    // 重心履歴を追記
    hist.centroidHistory.push({ t, x: person.centroid.x, y: person.centroid.y })

    // アンクル履歴（ジャンプ検出用）
    const lAnkle = lm[27], rAnkle = lm[28]
    if (lAnkle && rAnkle
      && (lAnkle.visibility ?? 1) > 0.3
      && (rAnkle.visibility ?? 1) > 0.3) {
      hist.ankleHistory.push({ t, leftY: lAnkle.y, rightY: rAnkle.y })

      // 最初の BASELINE_FRAMES フレームで立位ベースラインを確立
      if (hist.baselineCount < BASELINE_FRAMES) {
        const avg = (lAnkle.y + rAnkle.y) / 2
        hist.baselineAnkleY = hist.baselineAnkleY === null
          ? avg
          : (hist.baselineAnkleY * hist.baselineCount + avg) / (hist.baselineCount + 1)
        hist.baselineCount++
      }
    }

    // フォーム（ROM）計測: world landmarks を使用
    if (wl.length > 0) {
      const side    = inferSide(lm)
      const romItems = calcROMItems(wl, side)

      const perJoint: Record<string, number> = {}
      let totalAsym = 0, count = 0

      for (const [lKey, rKey, label] of SYMMETRY_PAIRS) {
        const left  = romItems.find((r) => r.key === lKey)
        const right = romItems.find((r) => r.key === rKey)
        if (left && right) {
          const diff = Math.abs(left.value - right.value)
          perJoint[label] = Math.round(diff * 10) / 10
          totalAsym += diff
          count++
        }
      }

      hist.formHistory.push({
        t,
        asymmetryDeg: count > 0 ? Math.round((totalAsym / count) * 10) / 10 : 0,
        perJoint,
      })
    }
  }
}

/**
 * 蓄積した全履歴から計算済み指標 Map を返す
 * 解析完了後に一度呼び出す。
 */
export function computeAllMetrics(): Map<number, PersonMetrics> {
  const result = new Map<number, PersonMetrics>()

  for (const [id, hist] of _histories) {
    const speedHistory = computeSpeed(hist)
    const jumpEvents   = detectJumps(hist)
    const formHistory  = hist.formHistory

    const speeds   = speedHistory.map((s) => s.speed)
    const peakSpeed = speeds.length > 0 ? Math.max(...speeds) : 0
    const avgSpeed  = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0

    // 関節別非対称の全フレーム平均
    const jointAccum: Record<string, number[]> = {}
    for (const f of formHistory) {
      for (const [label, val] of Object.entries(f.perJoint)) {
        if (!jointAccum[label]) jointAccum[label] = []
        jointAccum[label].push(val)
      }
    }
    const perJointAsymmetry: Record<string, number> = {}
    for (const [label, vals] of Object.entries(jointAccum)) {
      perJointAsymmetry[label] = Math.round(
        (vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
    }

    const lastForm  = formHistory[formHistory.length - 1]
    const avgAsym   = formHistory.length > 0
      ? formHistory.reduce((s, f) => s + f.asymmetryDeg, 0) / formHistory.length : 0

    const jumpHeights = jumpEvents.map((e) => e.heightCm)
    const fatigue     = computeFatigue(hist)

    result.set(id, {
      personId: id,
      color:    hist.color,
      speedHistory,
      currentSpeed: Math.round((speeds[speeds.length - 1] ?? 0) * 10) / 10,
      peakSpeed:    Math.round(peakSpeed * 10) / 10,
      avgSpeed:     Math.round(avgSpeed  * 10) / 10,
      jumpEvents,
      jumpCount:        jumpEvents.length,
      avgJumpHeightCm:  jumpHeights.length > 0
        ? Math.round(jumpHeights.reduce((a, b) => a + b, 0) / jumpHeights.length) : 0,
      maxJumpHeightCm:  jumpHeights.length > 0 ? Math.max(...jumpHeights) : 0,
      formHistory,
      currentAsymmetryDeg: Math.round((lastForm?.asymmetryDeg ?? 0) * 10) / 10,
      avgAsymmetryDeg:     Math.round(avgAsym * 10) / 10,
      perJointAsymmetry,
      fatigueScore: fatigue,
      fatigueLabel: fatigue < 30 ? '良好' : fatigue < 60 ? '注意' : '要休息',
    })
  }

  return result
}

/** 指標履歴をリセット */
export function resetMetrics(): void {
  _histories.clear()
}
